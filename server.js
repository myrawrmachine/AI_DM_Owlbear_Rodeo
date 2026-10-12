const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || "gemini-2.5-flash";
const ACCESS_CODE = process.env.ACCESS_CODE || "";

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
- End scenes with a prompt like "What do you do?"`;

// The story lives in memory, one log per Owlbear room. It resets if the server restarts or sleeps.
const rooms = {};
function getRoom(id) {
  id = String(id || "default").slice(0, 100);
  if (!rooms[id]) rooms[id] = { msgs: [], next: 1, busy: false };
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
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Code",
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
      if (d.length > 100000) { bad(new Error("Too big")); req.destroy(); }
    });
    req.on("end", () => ok(d));
    req.on("error", bad);
  });
}

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

async function askGemini(r, map) {
  const contents = buildContents(r.msgs);
  const system = SYSTEM_PROMPT + (map ? "\n\nCurrent map snapshot:\n" + map : "");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("The free AI quota is used up for the moment. Wait a minute and try again.");
    throw new Error("AI error: " + ((data.error && data.error.message) || resp.status));
  }
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const reply = (parts || []).map((p) => p.text || "").join("").trim();
  if (!reply) throw new Error("The AI returned an empty answer (it may have been blocked). Try rephrasing.");
  return reply;
}

async function handleApi(req, res, url, query) {
  try {
    if (ACCESS_CODE && req.headers["x-access-code"] !== ACCESS_CODE)
      return json(res, 401, { error: "Wrong or missing access code." });

    if (req.method === "GET" && url === "/api/log") {
      const r = getRoom(query.get("room"));
      const since = parseInt(query.get("since") || "0", 10) || 0;
      return json(res, 200, {
        msgs: r.msgs.filter((m) => m.id > since),
        latest: r.next - 1,
        busy: r.busy,
      });
    }

    if (req.method !== "POST") return json(res, 404, { error: "Not found" });
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: "Bad request." }); }
    const r = getRoom(body.room);

    if (url === "/api/say") {
      const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
      const who = typeof body.who === "string" ? body.who.trim().slice(0, 40) || "Player" : "Player";
      if (!text) return json(res, 400, { error: "Empty message." });
      addMsg(r, "player", who, text);
      return json(res, 200, { ok: true });
    }

    if (url === "/api/clear") {
      r.msgs = [];
      r.next = 1;
      return json(res, 200, { ok: true });
    }

    if (url === "/api/dm") {
      if (!API_KEY) return json(res, 500, { error: "Server has no GEMINI_API_KEY set." });
      if (r.busy) return json(res, 409, { error: "The DM is already thinking." });
      const lastMsg = r.msgs[r.msgs.length - 1];
      if (!lastMsg || lastMsg.role === "dm")
        return json(res, 400, { error: "Nothing new for the DM to respond to. Have players say what they do first." });
      const map = typeof body.map === "string" ? body.map.slice(0, 4000) : "";
      r.busy = true;
      try {
        const reply = await askGemini(r, map);
        addMsg(r, "dm", "DM", reply);
      } finally {
        r.busy = false;
      }
      return json(res, 200, { ok: true });
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
