// Loaded with `node --require ./test/mock-fetch.js server.js` by the tests.
// Replaces fetch for the outside services so the server can be tested without keys or network:
// Gemini, Upstash (stored in the file MOCK_DB_FILE, so a "restart" keeps the data) and Open5e.
const fs = require("fs");

const DB_FILE = process.env.MOCK_DB_FILE;
const readDb = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) { return {}; } };
const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const GOBLIN = {
  name: "Goblin Warrior", document: { key: "srd-2024" }, size: { name: "Small" }, type: { name: "Fey" },
  challenge_rating: 0.25, armor_class: 15, hit_points: 10, hit_dice: "3d6", initiative_bonus: 2,
  speed: { walk: 30 }, ability_scores: { dexterity: 15 }, modifiers: { dexterity: 2 },
  actions: [{ name: "Scimitar", desc: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage.", action_type: "ACTION" }],
};

global.fetch = async (url, opts = {}) => {
  url = String(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  if (url.includes("generativelanguage.googleapis.com")) {
    const mode = process.env.MOCK_GEMINI || "ok";
    if (mode === "quota") return reply(429, { error: { message: "Resource exhausted" } });
    const system = body.systemInstruction.parts[0].text;
    const asked = body.contents.map((c) => c.parts[0].text).join("\n");
    let text;
    if (/It is now the turn of/.test(asked))
      text = JSON.stringify({ narration: "The goblin slashes at Ann: 14 + 4 = 18 vs AC 15, hit, 5 slashing damage.", actions: [{ type: "damage", name: "Ann", amount: 5 }] });
    else if (/OUTPUT FORMAT/.test(system))
      text = JSON.stringify({ narration: "The cave is dark. What do you do?", actions: [{ type: "camera", col: 1, row: 1 }] });
    else text = "A plain text answer.";
    return reply(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
  }
  if (url.startsWith("https://mock-upstash")) {
    const db = readDb();
    const [cmd, key, value] = body;
    if (cmd === "SET") { db[key] = value; fs.writeFileSync(DB_FILE, JSON.stringify(db)); return reply(200, { result: "OK" }); }
    if (cmd === "GET") return reply(200, { result: db[key] ?? null });
    return reply(400, { error: "unknown command" });
  }
  if (url.startsWith("https://api.open5e.com/")) {
    const q = new URL(url).searchParams;
    const want = (q.get("name__iexact") || q.get("name__icontains") || "").toLowerCase();
    return reply(200, { results: "goblin warrior".startsWith(want) && want ? [GOBLIN] : [] });
  }
  throw new Error("Unexpected fetch in test: " + url);
};
