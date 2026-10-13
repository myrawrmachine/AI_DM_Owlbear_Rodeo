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
- Each player message begins with that player's name. Several players may act in one round: respond to all of them, addressing players by name.
- If a map snapshot is provided, use it for positions. Distances are in grid cells (1 cell = 5 ft).
- When new enemies or NPCs appear, say clearly who and how many so the GM can place their tokens.
- End scenes with a prompt like "What do you do?"`;

const ACTIONS_PROMPT = `

OUTPUT FORMAT: reply with ONLY valid JSON: {"narration": string, "actions": [ ... ]}
- "narration" is what you say to the players (markdown allowed). Never reveal secret notes in it.
- "actions" is optional (use [] when nothing is needed). The GM approves actions before anything happens, so only propose them when the story clearly calls for it. At most 6.
- Use grid cells from the map snapshot (col and row start at 0 in the top-left).
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
      out.push({ type, name, count: clampInt(a.count, 1, 12, 1), side: ["enemy", "npc", "ally"].includes(a.side) ? a.side : "enemy", col: clampInt(a.col, 0, 200, 0), row: clampInt(a.row, 0, 200, 0) });
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
  if (!rooms[id]) rooms[id] = { msgs: [], next: 1, busy: false, brief: "", pending: [], aseq: 1, adv: null };
  return rooms[id];
}
function addMsg(r, role, who, text) {
  r.msgs.push({ id: r.next++, role, who, text });
  if (r.msgs.length > 200) r.msgs.splice(0, r.msgs.length - 200);
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
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const text = (parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("The AI returned an empty answer (it may have been blocked). Try rephrasing.");
  return text;
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
 "creatures": [{"name": string, "count": int, "side": "enemy"|"npc"|"ally", "area": string}]}
Rules:
- All numbers are whole grid cells (1 cell = 5 feet). x and y are the top-left cell, starting at 0. Everything must fit inside cols x rows.
- "areas" are the walkable floor. Anything not covered by an area is solid rock or wall.
- Lay out EVERY scene or location in the adventure notes, in story order, from one end of the map to the other. Name each main area after its scene or location (for example "Scene 1: Flooded Entry"). Link areas with corridors (kind "corridor", 2 cells wide) so everything is reachable.
- Use 6 to 16 areas. Rooms should be at least 5x5 cells, and big encounter rooms 8x8 or larger. Leave empty space between rooms.
- Put "features" inside areas: cover, hazards, doors at area edges, and interesting objects that fit the story. Use 10 to 40 features. Keep each 1 to 3 cells.
- "creatures": include EVERY monster and NPC from the notes, in the area where the party meets them. Use the exact area name. Use the counts in the notes (maximum 12 per entry). Give the creature name without numbers. Leave out the player characters.`;

const MOVES_SYSTEM = `You control the enemies and NPCs in a tabletop D&D (2024, 5.5e) combat. Output ONLY valid JSON, no commentary.
Schema: {"summary": string (one sentence on the enemy plan), "moves": [{"id": string, "col": int, "row": int, "reason": string (max 12 words)}]}
Rules:
- Only move tokens whose side is "enemy", "npc" or "ally". Tokens with side "pc" are the players: never move them.
- Grid cells: 1 cell = 5 ft. Unless told otherwise, a token can move at most 6 cells per turn (diagonals count as 1 cell).
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
      return json(res, 200, { msgs: r.msgs.filter((m) => m.id > since), latest: r.next - 1, busy: r.busy, ...(isGm(req) ? { actions: r.pending } : {}) });
    }
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
      try {
        const raw = await gemini({
          system: SYSTEM_PROMPT + ACTIONS_PROMPT + briefBlock(r) + advBlock(r) + (map ? "\n\nCurrent map snapshot:\n" + map : ""),
          contents: buildContents(r.msgs),
          json: true,
          maxTokens: 4096,
        });
        let narration = raw, actions = [];
        try {
          const p = parseJson(raw);
          if (p && typeof p.narration === "string" && p.narration.trim()) {
            narration = p.narration.trim();
            actions = sanitizeActions(p.actions);
          }
        } catch (e) {}
        addMsg(r, "dm", "DM", narration);
        actions.forEach((a) => r.pending.push({ id: r.aseq++, ...a }));
        r.pending = r.pending.slice(-30);
      } finally {
        r.busy = false;
      }
      return json(res, 200, { ok: true });
    }

    if (url === "/api/restore") {
      if (r.msgs.length) return json(res, 200, { ok: false });
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
      return json(res, 200, { ok: true });
    }

    if (url === "/api/gm/brief") {
      r.brief = str(body.brief, 12000);
      return json(res, 200, { ok: true, length: r.brief.length });
    }

    if (url === "/api/gm/state") {
      const names = (v) => (Array.isArray(v) ? v : []).slice(0, 40).map((x) => str(x, 60)).filter(Boolean);
      r.adv = { layout: str(body.layout, 4000), areas: names(body.areas), revealed: names(body.revealed) };
      return json(res, 200, { ok: true });
    }

    if (url === "/api/gm/actions/resolve") {
      const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(Number));
      r.pending = r.pending.filter((a) => !ids.has(a.id));
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
          `MONSTERS (name, CR, AC, HP, attacks with bonuses and damage, special traits)\nTREASURE\nENDINGS\n` +
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
      const t = await gemini({
        model: PLAN_MODEL,
        json: true,
        maxTokens: 8192,
        system: MAP_SYSTEM,
        contents: one(
          `Map size: cols=${cols}, rows=${rows}.\n` + (notes ? `Extra instructions from the GM: ${notes}\n` : "") +
          `\nADVENTURE NOTES:\n${r.brief.slice(0, 9000)}`
        ),
      });
      const parsed = parseJson(t);
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
      const t = await gemini({
        model: PLAN_MODEL,
        json: true,
        system: MOVES_SYSTEM,
        contents: one(
          (str(body.layout, 4000) ? `${str(body.layout, 4000)}\n\n` : "") +
          `Tokens (col,row are grid cells):\n` + tokens.map((k) => `- id=${k.id} name="${k.name}" side=${k.side} at (${k.col},${k.row})`).join("\n") +
          (situation ? `\n\nGM note: ${situation}` : "") +
          `\n\nRecent story:\n${recentStory(r, 8)}` + briefBlock(r)
        ),
      });
      const parsed = parseJson(t);
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
