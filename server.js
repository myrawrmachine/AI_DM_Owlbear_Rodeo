const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || "gemini-3.8-flash";          // used for the live story
const PLAN_MODEL = process.env.PLAN_MODEL || MODEL;              // used for one-shots, maps, enemy moves
const ACCESS_CODE = process.env.ACCESS_CODE || "";               // all players
const GM_CODE = process.env.GM_CODE || "";                       // GM only

const FILES = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/manifest.json": ["manifest.json", "application/json"],
  "/icon.svg": ["icon.svg", "image/svg+xml"],
};

const SYSTEM_PROMPT = `You are the Dungeon Master for a group of several players playing Dungeons & Dragons using the 2024 (5.5e) rules.
- Narrate vividly but keep each reply under about 250 words.
- Play NPCs and monsters in character. Stay consistent with what has already happened in this chat.
- You cannot roll dice. When a roll is needed, tell the players exactly what to roll (e.g. "Roll a DC 13 Dexterity save") and wait for the results.
- If you are not sure about a rule, say so and give your best ruling instead of inventing an exact rule.
- If MONSTER STAT BLOCKS are provided, use those exact numbers for attacks, damage, saves and abilities. Never tell players a monster's exact HP, AC or stat numbers; describe how hurt it looks instead.
- Each player message begins with that player's name. Several players may act in one round: respond to all of them, addressing players by name.
- If a map snapshot is provided, use it for positions. Distances are in grid cells (1 cell = 5 ft).
- When new enemies or NPCs appear, say clearly who and how many so the GM can place their tokens.
- End scenes with a prompt like "What do you do?"`;

const ART_KEY = process.env.POLLINATIONS_KEY || "";              // optional free key from enter.pollinations.ai

async function fetchArt(prompt, w, h) {
  const seed = Math.floor(Math.random() * 1e6);
  const q = `width=${w}&height=${h}&seed=${seed}&model=flux`;
  // With a key: the new API (uses your free daily "pollen"). Without: the old anonymous endpoint (watermark, slow).
  const url = ART_KEY
    ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`
    : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
  const hdrs = ART_KEY ? { Authorization: "Bearer " + ART_KEY } : {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 70000);
    try {
      const resp = await fetch(url, { signal: ctrl.signal, headers: hdrs });
      if (resp.status === 429 && attempt === 0) { await new Promise((ok) => setTimeout(ok, 16000)); continue; }
      if (resp.status === 402)
        throw new Error(ART_KEY
          ? "The image service says your free daily allowance is used up (402). Try again tomorrow."
          : "The image service now wants an account for this (402). Add a free POLLINATIONS_KEY in Render (see the guide), or try again later.");
      if (resp.status === 401 || resp.status === 403)
        throw new Error("The image service rejected the POLLINATIONS_KEY (" + resp.status + "). Check it in Render.");
      if (!resp.ok) throw new Error("The image service answered " + resp.status + ".");
      const type = resp.headers.get("content-type") || "";
      if (!type.startsWith("image/")) throw new Error("The image service didn't return a picture.");
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 1000 || buf.length > 6000000) throw new Error("The picture was empty or too large.");
      return { buf, type };
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The image service took too long. Try again in a minute.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("The image service is busy. Try again in a minute.");
}

const ACTIONS_PROMPT = `

OUTPUT FORMAT: reply with ONLY valid JSON: {"narration": string, "actions": [ ... ]}
- "narration" is what you say to the players (markdown allowed). Never reveal secret notes in it.
- "actions" is optional (use [] when nothing is needed). The GM approves actions before anything happens, so only propose them when the story clearly calls for it. At most 6.
- Use grid cells from the map snapshot (col and row start at 0 in the top-left).
- For move, delete, camera and light, use a token's EXACT name from the map snapshot (for example "Goblin Warrior 2").
- Do NOT spawn creatures that are already on the map snapshot, and do NOT spawn the creatures of a hidden area: they appear automatically when that area is revealed, so use "reveal" instead. Only spawn genuinely new arrivals (reinforcements, summons, a newly introduced NPC).
- Never move a creature onto a cell that another token occupies.
- Action types:
  {"type":"spawn","name":"Goblin","count":3,"side":"enemy"|"npc"|"ally","col":int,"row":int}   (creatures that enter the scene now)
  {"type":"move","name":"Goblin 1","col":int,"row":int,"reason":"short"}   (only enemy/npc/ally tokens, never player characters)
  {"type":"delete","name":"Goblin 2"}   (remove a defeated or departed creature; never a player character)
  {"type":"fog","on":true|false}   (true = cover the whole scene in fog, false = clear it)
  {"type":"camera","name":"Cult Leader"}  or  {"type":"camera","col":int,"row":int}   (focus everyone's view)
  {"type":"light","name":"Ann","radius":4}   (give a token a light, radius in cells)
  {"type":"reveal","area":"Scene 2: Altar Hall"}   (make a hidden area, and the creatures in it, appear on the map when the party reaches, opens or discovers it)`;

function sanitizeActions(list) {
  const out = [];
  for (const a of (Array.isArray(list) ? list : []).slice(0, 6)) {
    if (!a || typeof a !== "object") continue;
    const type = str(a.type, 12);
    const name = str(a.name, 40);
    if (type === "spawn" && name)
      out.push({ type, name: baseName(name) || name, count: clampInt(a.count, 1, 12, 1), side: ["enemy", "npc", "ally"].includes(a.side) ? a.side : "enemy", col: clampInt(a.col, 0, 200, 0), row: clampInt(a.row, 0, 200, 0) });
    else if (type === "move" && name)
      out.push({ type, name, col: clampInt(a.col, 0, 200, 0), row: clampInt(a.row, 0, 200, 0), reason: str(a.reason, 80) });
    else if (type === "delete" && name) out.push({ type, name });
    else if (type === "fog") out.push({ type, on: a.on === true || a.on === "true" });
    else if (type === "camera" && (name || (isFinite(Number(a.col)) && isFinite(Number(a.row)))))
      out.push({ type, name, col: clampInt(a.col, 0, 200, 0), row: clampInt(a.row, 0, 200, 0) });
    else if (type === "light" && name) out.push({ type, name, radius: clampInt(a.radius, 1, 12, 3) });
    else if (type === "reveal" && str(a.area, 60)) out.push({ type, area: str(a.area, 60) });
  }
  return out;
}

// Everything lives in memory, one entry per Owlbear room. It resets if the server restarts or sleeps.
const rooms = {};
function getRoom(id) {
  id = String(id || "default").slice(0, 100);
  if (!rooms[id]) rooms[id] = { id, msgs: [], next: 1, busy: false, brief: "", pending: [], aseq: 1, adv: null, art: null, artV: 0, epoch: "" };
  return rooms[id];
}
function addMsg(r, role, who, text) {
  r.msgs.push({ id: r.next++, role, who, text });
  if (r.msgs.length > 200) r.msgs.splice(0, r.msgs.length - 200);
  notify(r);
}

// Live updates: each open panel keeps one stream open; we send a tiny "something changed" ping and the panel fetches the log.
const streams = {};
function notify(r) {
  const set = streams[r.id];
  if (!set) return;
  for (const res of set) { try { res.write("data: u\n\n"); } catch (e) {} }
}
function openStream(req, res, r) {
  const set = (streams[r.id] = streams[r.id] || new Set());
  if (set.size >= 60) return json(res, 429, { error: "Too many open panels." });
  res.writeHead(200, { ...headers("text/event-stream"), "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write(": hello\n\n");
  set.add(res);
  const beat = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 20000);
  req.on("close", () => { clearInterval(beat); set.delete(res); if (!set.size) delete streams[r.id]; });
}

function headers(type) {
  return {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Code, X-GM-Code",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
function json(res, code, obj) {
  res.writeHead(code, headers("application/json"));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 200000) { bad(new Error("Too big")); req.destroy(); }
    });
    req.on("end", () => ok(d));
    req.on("error", bad);
  });
}
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
function clampInt(v, min, max, def) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// ---------- Gemini ----------
async function gemini({ system, contents, json: wantJson, model, maxTokens }) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 4096,
          ...(wantJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("The free AI quota is used up for the moment. Wait a minute (or until tomorrow if it's the daily cap) and try again.");
    throw new Error("AI error: " + ((data.error && data.error.message) || resp.status));
  }
  const cand = data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts;
  const text = (parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
  const cut = cand && cand.finishReason === "MAX_TOKENS";
  if (!text) throw new Error(cut ? "The AI ran out of room before answering. Please try again." : "The AI returned an empty answer (it may have been blocked). Try rephrasing.");
  if (cut && wantJson) { const e = new Error("cut off"); e.cutOff = true; e.text = text; throw e; }
  return text;
}
// Asks for JSON and, if the answer comes back cut off or malformed, asks once more (costs one extra request).
async function geminiJson(opts) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt ? opts.system + "\n\nIMPORTANT: your previous answer was cut off or was not valid JSON. Reply again with complete, valid JSON only, and keep descriptions short." : opts.system;
    try {
      return parseJson(await gemini({ ...opts, system: sys, json: true }));
    } catch (e) {
      if (attempt === 0 && (e.cutOff || /expected format/.test(e.message))) { console.log("Retrying malformed AI JSON"); continue; }
      if (e.cutOff) throw new Error("The AI's answer was too long and got cut off. Try again, or make the map smaller (fewer Cols/Rows).");
      throw e;
    }
  }
}
function parseJson(t) {
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  throw new Error("The AI's answer wasn't in the expected format. Please try again.");
}
const one = (text) => [{ role: "user", parts: [{ text }] }];

function buildContents(msgs) {
  const contents = [];
  for (const m of msgs.slice(-40)) {
    const role = m.role === "dm" ? "model" : "user";
    const text = m.role === "dm" ? m.text : `${m.who}: ${m.text}`;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n" + text;
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  return contents;
}
function briefBlock(r) {
  return r.brief
    ? "\n\nSECRET DM NOTES (players must not see these. Never quote them. Reveal information only through play, when the players earn it):\n" + r.brief
    : "";
}
function advBlock(r) {
  if (!r.adv) return "";
  const rev = r.adv.revealed, hid = r.adv.areas.filter((n) => !rev.includes(n));
  return "\n\nMAP LAYOUT: " + r.adv.layout +
    "\nAreas players can see: " + (rev.join("; ") || "none") +
    "\nHidden areas (players have not found these yet; do not describe their contents as if seen): " + (hid.join("; ") || "none");
}
function recentStory(r, n) {
  return r.msgs.slice(-n).map((m) => (m.role === "dm" ? "DM: " : m.who + ": ") + m.text).join("\n");
}


// ---------- Official stat blocks (SRD via the free Open5e API) ----------
// 2024 rules first (SRD 5.2), then 2014 (SRD 5.1). Results are cached for the life of the server.
const SRD_URL = "https://api.open5e.com/v2/creatures/";
const statCache = new Map();
async function srdQuery(params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(SRD_URL + "?" + new URLSearchParams({ ...params, limit: "20" }), { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!resp.ok) throw new Error("SRD " + resp.status);
    const d = await resp.json();
    return Array.isArray(d.results) ? d.results : [];
  } finally {
    clearTimeout(timer);
  }
}
const baseName = (n) => String(n || "").replace(/\s+#?\d+$/, "").replace(/\s+/g, " ").trim();
async function lookupCreature(name) {
  const want = baseName(name);
  const key = want.toLowerCase();
  if (!key) return null;
  if (statCache.has(key)) return statCache.get(key);
  const words = key.split(" ");
  const tries = [];
  for (const n of [key, ...(words.length > 1 ? [words[words.length - 1], words[0]] : [])]) {
    tries.push(["srd-2024", { name__iexact: n }], ["srd-2014", { name__iexact: n }]);
    // 2024 renamed some monsters (e.g. "Goblin" became "Goblin Warrior")
    if (n === key) tries.push(["srd-2024", { name__icontains: n }, true]);
  }
  let found = null, failed = false;
  for (const [doc, q, loose] of tries) {
    try {
      let res = await srdQuery({ ...q, document__key__in: doc });
      if (loose) res = res.filter((c) => String(c.name).toLowerCase().startsWith(key)).sort((a, b) => a.name.length - b.name.length);
      if (res.length) { found = res[0]; break; }
    } catch (e) { failed = true; break; }
  }
  const out = found ? { asked: want, data: found } : null;
  if (found || !failed) statCache.set(key, out);
  if (statCache.size > 300) statCache.delete(statCache.keys().next().value);
  return out;
}
function crText(cr) {
  const n = Number(cr);
  if (n === 0.125) return "1/8";
  if (n === 0.25) return "1/4";
  if (n === 0.5) return "1/2";
  return isFinite(n) ? String(n) : "?";
}
function formatStat(hit) {
  const c = hit.data || {};
  const sign = (v) => (v >= 0 ? "+" : "") + v;
  const ed = c.document && c.document.key === "srd-2024" ? "2024" : "2014";
  const lines = [];
  let head = `${c.name} [${ed} rules]`;
  if (String(c.name).toLowerCase() !== hit.asked.toLowerCase()) head += ` (closest official match for "${hit.asked}")`;
  lines.push(head + ` - ${(c.size && c.size.name) || ""} ${(c.type && c.type.name) || ""}, CR ${crText(c.challenge_rating)}`.replace(/\s+,/, ","));
  lines.push(`AC ${c.armor_class}${c.armor_detail ? " (" + c.armor_detail + ")" : ""}, HP ${c.hit_points}${c.hit_dice ? " (" + c.hit_dice + ")" : ""}, Initiative ${sign(c.initiative_bonus || 0)}`);
  const sp = c.speed_all || c.speed || {};
  const speeds = ["walk", "fly", "swim", "climb", "burrow"].filter((k) => Number(sp[k]) > 0).map((k) => `${k} ${sp[k]} ft`);
  if (speeds.length) lines.push("Speed " + speeds.join(", "));
  const ab = c.ability_scores || {}, mods = c.modifiers || {};
  const short = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
  const abl = Object.keys(short).filter((k) => ab[k] !== undefined).map((k) => `${short[k]} ${ab[k]} (${sign(mods[k] !== undefined ? mods[k] : Math.floor((ab[k] - 10) / 2))})`);
  if (abl.length) lines.push(abl.join(" "));
  const skills = Object.entries(c.skill_bonuses || {}).map(([k, v]) => `${k} ${sign(v)}`);
  if (skills.length) lines.push("Skills " + skills.join(", "));
  const ri = c.resistances_and_immunities || {};
  for (const [k, label] of [["damage_resistances_display", "Resistances"], ["damage_immunities_display", "Immunities"], ["damage_vulnerabilities_display", "Vulnerabilities"], ["condition_immunities_display", "Condition immunities"]])
    if (typeof ri[k] === "string" && ri[k].trim()) lines.push(`${label} ${ri[k].trim()}`);
  const senses = [];
  if (c.darkvision_range) senses.push(`darkvision ${c.darkvision_range} ft`);
  if (c.blindsight_range) senses.push(`blindsight ${c.blindsight_range} ft`);
  if (c.tremorsense_range) senses.push(`tremorsense ${c.tremorsense_range} ft`);
  if (c.truesight_range) senses.push(`truesight ${c.truesight_range} ft`);
  if (c.passive_perception) senses.push(`passive Perception ${c.passive_perception}`);
  if (senses.length) lines.push("Senses " + senses.join(", "));
  const clip = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 320);
  for (const t of (Array.isArray(c.traits) ? c.traits : []).slice(0, 6)) lines.push(`Trait - ${t.name}: ${clip(t.desc)}`);
  const kinds = { ACTION: "Action", BONUS_ACTION: "Bonus action", REACTION: "Reaction", LEGENDARY_ACTION: "Legendary action" };
  const acts = (Array.isArray(c.actions) ? c.actions : []).slice().sort((a, b) => (a.order_in_statblock || 0) - (b.order_in_statblock || 0)).slice(0, 10);
  for (const a of acts) lines.push(`${kinds[a.action_type] || "Action"} - ${a.name}: ${clip(a.desc)}`);
  return lines.join("\n").slice(0, 2200);
}
function creatureNames(r, fromClient) {
  const list = [...(Array.isArray(fromClient) ? fromClient : []), ...((r.adv && r.adv.creatures) || [])];
  const seen = new Set(), out = [];
  for (const n of list) {
    const b = baseName(str(n, 60));
    if (b && !seen.has(b.toLowerCase())) { seen.add(b.toLowerCase()); out.push(b); }
  }
  return out.slice(0, 10);
}
async function statsBlock(names, cap, plain) {
  if (!names.length) return "";
  const hits = await Promise.all(names.map((n) => lookupCreature(n).catch(() => null)));
  const blocks = hits.filter(Boolean).map(formatStat);
  const missing = names.filter((n, i) => !hits[i]);
  if (!blocks.length && !plain) return "";
  let text = blocks.join("\n\n");
  if (missing.length) text += (text ? "\n\n" : "") + "No official stat block found for: " + missing.join(", ") + (plain ? " (the DM improvises these)." : ". Improvise sensible stats for these.");
  text = text.slice(0, cap || 7000);
  return plain ? text : "\n\nMONSTER STAT BLOCKS (official D&D SRD; use these exact numbers):\n" + text;
}

// ---------- Map + moves helpers ----------
function sanitizeMap(s) {
  s = s || {};
  const cols = clampInt(s.cols, 10, 60, 40);
  const rows = clampInt(s.rows, 8, 45, 30);
  const fix = (o) => {
    o = o || {};
    const x = clampInt(o.x, 0, cols - 1, 0);
    const y = clampInt(o.y, 0, rows - 1, 0);
    return { x, y, w: clampInt(o.w, 1, cols - x, 1), h: clampInt(o.h, 1, rows - y, 1) };
  };
  const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  return {
    title: str(s.title, 60) || "Map",
    art: str(s.art, 200),
    cols,
    rows,
    areas: list(s.areas, 30).map((a) => ({ name: str(a.name, 40) || "Area", kind: str(a.kind, 20) || "room", ...fix(a) })),
    features: list(s.features, 70).map((f) => ({ name: str(f.name, 40) || "Feature", kind: str(f.kind, 20) || "pillar", ...fix(f) })),
  };
}

const MAP_SYSTEM = `You design a single top-down battle map that contains an ENTIRE D&D one-shot, plus the creatures in it. Output ONLY valid JSON, no commentary.
Schema: {"title": string, "cols": integer, "rows": integer,
 "areas": [{"name": string, "kind": "room"|"corridor"|"outdoor"|"water", "x": int, "y": int, "w": int, "h": int}],
 "features": [{"name": string, "kind": "pillar"|"door"|"table"|"statue"|"water"|"hazard"|"stairs"|"tree"|"chest"|"altar", "x": int, "y": int, "w": int, "h": int}],
 "creatures": [{"name": string, "count": int, "side": "enemy"|"npc"|"ally", "area": string}],
 "art": string}
Rules:
- "art": 8 to 16 words describing ONLY the floor surface and mood (materials, colors, lighting) as a seamless texture, for example "mossy cracked flagstones, shallow puddles, green swamp light". Never mention walls, rooms, buildings, doors, furniture, characters or text.
- All numbers are whole grid cells (1 cell = 5 feet). x and y are the top-left cell, starting at 0. Everything must fit inside cols x rows.
- "areas" are the walkable floor. Anything not covered by an area is solid rock or wall.
- Lay out EVERY scene or location in the adventure notes, in story order, from one end of the map to the other. Name each main area after its scene or location (for example "Scene 1: Flooded Entry"). Link areas with corridors (kind "corridor", 2 cells wide) so everything is reachable.
- Use 6 to 14 areas. Rooms should be at least 5x5 cells, and big encounter rooms 8x8 or larger. Leave empty space between rooms.
- Put "features" inside areas: cover, hazards, doors at area edges, and interesting objects that fit the story. Use 10 to 30 features. Keep every name short (under 5 words). Keep each 1 to 3 cells.
- "creatures": include EVERY monster and NPC from the notes, in the area where the party meets them. Use the exact area name. Use the counts in the notes (maximum 12 per entry). Give the creature name without numbers. Use the official D&D 2024 (SRD 5.2) monster name when one fits (for example "Goblin Warrior", "Bandit", "Skeleton", "Cultist"), so the creature's official stats can be looked up. Leave out the player characters.`;

const MOVES_SYSTEM = `You control the enemies and NPCs in a tabletop D&D (2024, 5.5e) combat. Output ONLY valid JSON, no commentary.
Schema: {"summary": string (one sentence on the enemy plan), "moves": [{"id": string, "col": int, "row": int, "reason": string (max 12 words)}]}
Rules:
- Only move tokens whose side is "enemy", "npc" or "ally". Tokens with side "pc" are the players: never move them.
- Grid cells: 1 cell = 5 ft. If a creature's stat block gives a walking speed, it can move at most that many feet / 5 cells per turn; otherwise at most 6 cells (diagonals count as 1 cell).
- Only end on walkable floor (inside a listed area, or anywhere if no map is given). Do not end on a cell with a token or on a blocking feature (pillar, statue, table, water, tree, altar, chest).
- Play tactically but fairly: use cover, focus weak targets, protect leaders, and avoid unrealistic coordination. Cowardly or injured creatures may retreat.
- You may omit tokens that should stay put.`;

const BLOCKING = new Set(["pillar", "statue", "table", "water", "tree", "altar", "chest"]);
function placeCreatures(spec, creatures) {
  const occ = new Set();
  for (const f of spec.features)
    if (BLOCKING.has(f.kind))
      for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.h; y++) occ.add(x + "," + y);
  const placed = [];
  for (const c of (Array.isArray(creatures) ? creatures : []).slice(0, 30)) {
    const base = str(c.name, 40) || "Creature";
    const side = ["enemy", "npc", "ally"].includes(c.side) ? c.side : "enemy";
    const count = clampInt(c.count, 1, 12, 1);
    const want = str(c.area, 60).toLowerCase();
    const area =
      spec.areas.find((a) => a.name.toLowerCase() === want) ||
      (want && spec.areas.find((a) => a.name.toLowerCase().includes(want) || want.includes(a.name.toLowerCase()))) ||
      spec.areas.find((a) => a.kind === "room") || spec.areas[0];
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    const cells = [];
    for (let x = area.x; x < area.x + area.w; x++)
      for (let y = area.y; y < area.y + area.h; y++) if (!occ.has(x + "," + y)) cells.push([x, y]);
    cells.sort((p, q) => Math.hypot(p[0] + 0.5 - cx, p[1] + 0.5 - cy) - Math.hypot(q[0] + 0.5 - cx, q[1] + 0.5 - cy));
    for (let i = 0; i < count && placed.length < 60; i++) {
      const cell = cells.shift();
      if (!cell) break;
      occ.add(cell[0] + "," + cell[1]);
      placed.push({ base, side, col: cell[0], row: cell[1], area: area.name });
    }
  }
  const totals = {};
  placed.forEach((p) => { totals[p.base] = (totals[p.base] || 0) + 1; });
  const seen = {};
  return placed.map((p) => {
    seen[p.base] = (seen[p.base] || 0) + 1;
    return { name: totals[p.base] > 1 ? `${p.base} ${seen[p.base]}` : p.base, side: p.side, col: p.col, row: p.row, area: p.area };
  });
}

function layoutText(m) {
  if (!m || !Array.isArray(m.areas)) return "";
  return (
    `Map "${m.title}" ${m.cols}x${m.rows} cells. Walkable areas: ` +
    m.areas.map((a) => `${a.name} (${a.kind}) x${a.x}-${a.x + a.w - 1}, y${a.y}-${a.y + a.h - 1}`).join("; ") +
    ". Features: " +
    (m.features || []).map((f) => `${f.name} (${f.kind}) at x${f.x}-${f.x + f.w - 1}, y${f.y}-${f.y + f.h - 1}`).join("; ")
  );
}

// ---------- API ----------
function isGm(req) {
  return GM_CODE && req.headers["x-gm-code"] === GM_CODE;
}
function needGm(req, res) {
  if (!GM_CODE) { json(res, 403, { error: "GM tools are off: set a GM_CODE variable in Render." }); return false; }
  if (!isGm(req)) { json(res, 401, { error: "Wrong or missing GM code." }); return false; }
  return true;
}

async function handleApi(req, res, url, query) {
  try {
    if (ACCESS_CODE && req.headers["x-access-code"] !== ACCESS_CODE)
      return json(res, 401, { error: "Wrong or missing access code." });

    if (req.method === "GET" && url === "/api/log") {
      const r = getRoom(query.get("room"));
      const since = parseInt(query.get("since") || "0", 10) || 0;
      return json(res, 200, { msgs: r.msgs.filter((m) => m.id > since), latest: r.next - 1, epoch: r.epoch, busy: r.busy, ...(isGm(req) ? { actions: r.pending } : {}) });
    }
    if (req.method === "GET" && url === "/api/stream") return openStream(req, res, getRoom(query.get("room")));
    if (req.method === "GET" && url === "/api/gm/brief") {
      if (!needGm(req, res)) return;
      return json(res, 200, { brief: getRoom(query.get("room")).brief });
    }
    if (req.method !== "POST") return json(res, 404, { error: "Not found" });

    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: "Bad request." }); }
    const r = getRoom(body.room);

    if (url === "/api/say") {
      const text = str(body.text, 1000);
      const who = str(body.who, 40) || "Player";
      if (!text) return json(res, 400, { error: "Empty message." });
      addMsg(r, "player", who, text);
      return json(res, 200, { ok: true });
    }

    if (url === "/api/dm") {
      if (!API_KEY) return json(res, 500, { error: "Server has no GEMINI_API_KEY set." });
      if (r.busy) return json(res, 409, { error: "The DM is already thinking." });
      const lastMsg = r.msgs[r.msgs.length - 1];
      if (!lastMsg || lastMsg.role === "dm")
        return json(res, 400, { error: "Nothing new for the DM to respond to. Have players say what they do first." });
      const map = str(body.map, 5000);
      r.busy = true;
      notify(r);
      try {
        const stats = await statsBlock(creatureNames(r, body.creatures));
        let raw;
        try {
          raw = await gemini({
          system: SYSTEM_PROMPT + ACTIONS_PROMPT + briefBlock(r) + advBlock(r) + stats + (map ? "\n\nCurrent map snapshot:\n" + map : ""),
          contents: buildContents(r.msgs),
          json: true,
          maxTokens: 6144,
        });
        } catch (e) {
          if (!e.cutOff) throw e;
          raw = e.text; // cut off near the end: keep whatever story text arrived
        }
        let narration = raw, actions = [];
        try {
          const p = parseJson(raw);
          if (p && typeof p.narration === "string" && p.narration.trim()) {
            narration = p.narration.trim();
            actions = sanitizeActions(p.actions);
          }
        } catch (e) {
          // Broken JSON: pull out just the story text so players never see raw code.
          const m = raw.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/);
          if (m) { try { narration = JSON.parse('"' + m[1] + '"'); } catch (x) { narration = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'); } }
        }
        addMsg(r, "dm", "DM", narration);
        actions.forEach((a) => r.pending.push({ id: r.aseq++, ...a }));
        r.pending = r.pending.slice(-30);
      } finally {
        r.busy = false;
        notify(r);
      }
      return json(res, 200, { ok: true });
    }

    if (url === "/api/restore") {
      if (r.msgs.length) return json(res, 200, { ok: false });
      // Each story has an ID that changes when the GM clears it. An old backup (from before a clear) is never restored.
      const e = str(body.epoch, 40);
      if (r.epoch && e !== r.epoch) return json(res, 200, { ok: false, stale: true });
      if (!r.epoch && e) r.epoch = e;
      const list = (Array.isArray(body.msgs) ? body.msgs : []).slice(-60);
      for (const m of list) {
        const text = str(m && m.text, 1500);
        if (!text) continue;
        if (m.role === "dm") addMsg(r, "dm", "DM", text);
        else addMsg(r, "player", str(m.who, 40) || "Player", text);
      }
      return json(res, 200, { ok: true });
    }

    // ----- GM only -----
    if (!url.startsWith("/api/gm/") && url !== "/api/clear") return json(res, 404, { error: "Not found" });
    if (!needGm(req, res)) return;

    if (url === "/api/clear") {
      r.msgs = [];
      r.next = 1;
      r.pending = [];
      r.epoch = str(body.epoch, 40) || Math.random().toString(36).slice(2, 10);
      notify(r);
      return json(res, 200, { ok: true, epoch: r.epoch });
    }

    if (url === "/api/gm/brief") {
      r.brief = str(body.brief, 12000);
      return json(res, 200, { ok: true, length: r.brief.length });
    }

    if (url === "/api/gm/state") {
      const names = (v) => (Array.isArray(v) ? v : []).slice(0, 40).map((x) => str(x, 60)).filter(Boolean);
      r.adv = { layout: str(body.layout, 4000), areas: names(body.areas), revealed: names(body.revealed), creatures: names(body.creatures) };
      r.adv.creatures.slice(0, 12).forEach((n) => lookupCreature(n).catch(() => {}));
      return json(res, 200, { ok: true });
    }

    if (url === "/api/gm/art") {
      const cols = clampInt(body.cols, 10, 60, 40), rows = clampInt(body.rows, 8, 45, 30);
      const w = 1280, h = Math.max(512, Math.min(1280, Math.round((1280 * rows) / cols)));
      const art = str(body.art, 200) || "ancient stone dungeon floor, faint torchlight";
      const prompt = `seamless tileable top-down floor texture, ${art}, flat even ground filling the whole image, painted fantasy style, no walls, no rooms, no buildings, no doors, no furniture, no characters, no text, no grid lines, no border, no perspective`;
      r.art = await fetchArt(prompt, w, h);
      r.artV += 1;
      return json(res, 200, { url: `/art/${encodeURIComponent(r.id)}.jpg?v=${r.artV}`, mime: r.art.type.split(";")[0] });
    }

    if (url === "/api/gm/stats") {
      const text = await statsBlock(creatureNames(r, body.creatures), 12000, true);
      return json(res, 200, { text: text || "No official stat blocks found for the creatures on the map or in your built adventure." });
    }

    if (url === "/api/gm/actions/resolve") {
      const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(Number));
      r.pending = r.pending.filter((a) => !ids.has(a.id));
      notify(r);
      return json(res, 200, { ok: true });
    }

    if (!API_KEY) return json(res, 500, { error: "Server has no GEMINI_API_KEY set." });

    if (url === "/api/gm/oneshot") {
      const level = clampInt(body.level, 1, 20, 3);
      const players = clampInt(body.players, 1, 12, 5);
      const theme = str(body.theme, 400) || "classic fantasy dungeon adventure";
      const text = await gemini({
        model: PLAN_MODEL,
        system: "You are an expert Dungeons & Dragons (2024, 5.5e) adventure designer. Write clear, usable GM notes in plain text with simple headings. No markdown symbols other than line breaks and dashes.",
        contents: one(
          `Design a self-contained one-shot for ${players} players at level ${level}. Theme and tone: ${theme}.\n` +
          `It must be finishable in about 3 hours. Use these headings:\n` +
          `PREMISE AND HOOK\nSECRETS AND TWISTS (GM only)\nSCENES (3 or 4; for each: goal, challenge, NPCs, what the map needs)\n` +
          `MONSTERS (prefer official D&D 2024 monster names, e.g. "Goblin Warrior" rather than "Goblin"; name, CR, AC, HP, attacks with bonuses and damage, special traits)\nTREASURE\nENDINGS\n` +
          `Keep it under 900 words. Be concrete: names, numbers, DCs.`
        ),
      });
      return json(res, 200, { text });
    }

    if (url === "/api/gm/build") {
      if (!r.brief) return json(res, 400, { error: "Save a brief first (section 1). The map is built from it." });
      const cols = clampInt(body.cols, 20, 60, 60);
      const rows = clampInt(body.rows, 15, 45, 40);
      const notes = str(body.notes, 500);
      const parsed = await geminiJson({
        model: PLAN_MODEL,
        maxTokens: 16384,
        system: MAP_SYSTEM,
        contents: one(
          `Map size: cols=${cols}, rows=${rows}.\n` + (notes ? `Extra instructions from the GM: ${notes}\n` : "") +
          `\nADVENTURE NOTES:\n${r.brief.slice(0, 9000)}`
        ),
      });
      const spec = sanitizeMap({ ...parsed, cols, rows });
      if (!spec.areas.length) throw new Error("The AI didn't produce any rooms. Please try again.");
      const tokens = placeCreatures(spec, parsed.creatures);
      return json(res, 200, { spec, tokens });
    }

    if (url === "/api/gm/moves") {
      const tokens = (Array.isArray(body.tokens) ? body.tokens : []).slice(0, 60).map((t) => ({
        id: str(t.id, 80), name: str(t.name, 40) || "Token",
        side: ["enemy", "npc", "ally"].includes(t.side) ? t.side : "pc",
        col: clampInt(t.col, -100, 200, 0), row: clampInt(t.row, -100, 200, 0),
      }));
      const movable = tokens.filter((t) => t.side !== "pc");
      if (!movable.length) return json(res, 400, { error: "No enemy/NPC tokens found. Use Spawn tokens first." });
      const cols = clampInt(body.cols, 10, 200, 40);
      const rows = clampInt(body.rows, 8, 200, 30);
      const situation = str(body.situation, 500);
      const stats = await statsBlock(creatureNames(r, movable.map((k) => k.name)), 5000);
      const parsed = await geminiJson({
        model: PLAN_MODEL,
        maxTokens: 4096,
        system: MOVES_SYSTEM,
        contents: one(
          (str(body.layout, 4000) ? `${str(body.layout, 4000)}\n\n` : "") +
          `Tokens (col,row are grid cells):\n` + tokens.map((k) => `- id=${k.id} name="${k.name}" side=${k.side} at (${k.col},${k.row})`).join("\n") +
          (situation ? `\n\nGM note: ${situation}` : "") +
          `\n\nRecent story:\n${recentStory(r, 8)}` + briefBlock(r) + stats
        ),
      });
      const ids = new Set(movable.map((k) => k.id));
      const moves = (Array.isArray(parsed.moves) ? parsed.moves : [])
        .filter((m) => ids.has(m.id))
        .map((m) => ({ id: m.id, col: clampInt(m.col, 0, cols - 1, 0), row: clampInt(m.row, 0, rows - 1, 0), reason: str(m.reason, 120) }));
      return json(res, 200, { summary: str(parsed.summary, 300), moves });
    }

    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  const url = u.pathname;
  if (req.method === "OPTIONS") { res.writeHead(204, headers("text/plain")); return res.end(); }
  if (url.startsWith("/api/")) return handleApi(req, res, url, u.searchParams);
  if (req.method === "GET" && url.startsWith("/art/")) {
    let id = "";
    try { id = decodeURIComponent(url.slice(5).replace(/\.jpg$/, "")); } catch (e) {}
    const r = rooms[id];
    if (!r || !r.art) return json(res, 404, { error: "No art for this room yet." });
    res.writeHead(200, { ...headers(r.art.type), "Cache-Control": "public, max-age=3600" });
    return res.end(r.art.buf);
  }
  if (req.method === "GET" && FILES[url]) {
    const [file, type] = FILES[url];
    return fs.readFile(path.join(__dirname, file), (err, data) => {
      if (err) return json(res, 500, { error: "Missing file: " + file });
      res.writeHead(200, headers(type));
      res.end(data);
    });
  }
  json(res, 404, { error: "Not found" });
}).listen(PORT, () => console.log("AI DM running on port " + PORT));
