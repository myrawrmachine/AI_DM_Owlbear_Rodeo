// Run with: npm test   (uses Node's built-in test runner; no npm packages needed)
// Starts the real server.js with Gemini, Upstash and Open5e mocked (see mock-fetch.js) and checks the API.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "aidm-test-"));
const DB_FILE = path.join(TMP, "db.json");
let server, port = 3900 + Math.floor(Math.random() * 500);

function start(extraEnv = {}) {
  return new Promise((ok, bad) => {
    const p = spawn(process.execPath, ["--require", path.join(__dirname, "mock-fetch.js"), path.join(ROOT, "server.js")], {
      env: {
        ...process.env, PORT: String(port), GEMINI_API_KEY: "test", ACCESS_CODE: "play", GM_CODE: "gm", MODEL: "test-model",
        UPSTASH_REDIS_REST_URL: "https://mock-upstash", UPSTASH_REDIS_REST_TOKEN: "t", MOCK_DB_FILE: DB_FILE, ...extraEnv,
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    p.stdout.on("data", (d) => { if (/running on port/.test(d)) ok(p); });
    p.on("exit", (code) => bad(new Error("server exited " + code)));
  });
}
async function stop() {
  if (!server) return;
  const p = server; server = null;
  p.removeAllListeners("exit");
  await new Promise((ok) => { p.once("exit", ok); p.kill(); });
}
async function call(pathname, body, gm) {
  const headers = { "Content-Type": "application/json", "X-Access-Code": "play" };
  if (gm) headers["X-GM-Code"] = "gm";
  const r = await fetch(`http://127.0.0.1:${port}${pathname}`, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const log = (room) => call(`/api/log?room=${room}&since=0`, null, true).then((x) => x.data);
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

before(async () => { server = await start(); });
after(async () => { await stop(); fs.rmSync(TMP, { recursive: true, force: true }); });

test("files are present and not empty, manifest is valid", () => {
  for (const f of ["server.js", "index.html", "manifest.json", "icon.svg", "package.json"])
    assert.ok(fs.statSync(path.join(ROOT, f)).size > 100, f + " is empty or truncated");
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.equal(m.action.popover, "/index.html");
  assert.equal(m.icon, "/icon.svg");
});

test("panel script parses and every element it looks up exists", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const js = html.split('<script type="module">')[1].split("</script>")[0];
  const file = path.join(TMP, "panel.mjs");
  fs.writeFileSync(file, js);
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const ids = [...js.matchAll(/\$\("([A-Za-z0-9_]+)"\)/g)].map((m) => m[1]);
  for (const id of new Set(ids)) assert.ok(html.includes(`id="${id}"`), `index.html has no element with id "${id}"`);
});

test("access code and GM code are enforced", async () => {
  const r = await fetch(`http://127.0.0.1:${port}/api/log?room=a`);
  assert.equal(r.status, 401);
  assert.equal((await call("/api/gm/brief", { room: "a", brief: "x" })).status, 401);
});

test("dice: plain rolls, labels, adv/dis with a modifier", async () => {
  for (const [text, re] of [
    ["1d20+5 attack", /rolls 1d20\+5 for attack: \[\d+\] \+ 5 = \*\*\d+\*\*/],
    ["d20", /rolls d20: \[\d+\]/],
    ["adv", /rolls adv: \[\d+, \d+ → \d+\]/],
    ["adv+3 stealth", /rolls adv\+3 for stealth: \[\d+, \d+ → \d+\] \+ 3 = /],
    ["dis -1 perception", /rolls dis-1 for perception: \[\d+, \d+ → \d+\] - 1 = /],
  ]) {
    const r = await call("/api/roll", { room: "dice", who: "Ann", text });
    assert.equal(r.status, 200, text + ": " + JSON.stringify(r.data));
    const msgs = (await log("dice")).msgs;
    assert.match(msgs[msgs.length - 1].text, re, text);
  }
  assert.equal((await call("/api/roll", { room: "dice", who: "Ann", text: "banana" })).status >= 400, true);
});

test("Ask DM posts narration and queues the camera action", async () => {
  await call("/api/say", { room: "dm", who: "Ann", text: "I look around." });
  assert.equal((await call("/api/dm", { room: "dm", map: "", creatures: [] })).status, 200);
  const d = await log("dm");
  assert.equal(d.msgs[d.msgs.length - 1].text, "The cave is dark. What do you do?");
  assert.equal(d.actions[0].type, "camera");
});

test("combat: begin with nobody in it gives a clear error, not a crash", async () => {
  assert.equal((await call("/api/gm/combat/start", { room: "empty", tokens: [] }, true)).status, 200);
  const r = await call("/api/gm/combat/begin", { room: "empty" }, true);
  assert.equal(r.status, 400);
  assert.doesNotMatch(r.data.error, /undefined|Cannot read/);
});

test("combat: card, start, initiative, monster turn, damage, end", async () => {
  const room = "fight";
  await call("/api/char", { room, who: "Rick", card: { name: "Ann", maxHp: 20, ac: 15, init: 3 } });
  const s = await call("/api/gm/combat/start", { room, tokens: [{ id: "g1", name: "Goblin Warrior 1", side: "enemy" }] }, true);
  assert.equal(s.data.count, 2);
  assert.equal((await call("/api/combat/init", { room, who: "Rick" })).status, 200);
  let d = await log(room);
  const gob = d.combat.list.find((x) => x.name === "Goblin Warrior 1");
  assert.equal(gob.maxHp, 10);
  assert.equal(gob.ac, 15);
  // make the goblin act first so the monster turn runs
  await call("/api/gm/combat/set", { room, id: gob.id, init: 50 }, true);
  assert.equal((await call("/api/gm/combat/begin", { room }, true)).status, 200);
  d = await log(room);
  assert.equal(d.combat.list[d.combat.turn].name, "Ann");
  assert.ok(d.msgs.some((m) => /goblin slashes/.test(m.text)));
  const dmg = d.actions.find((a) => a.type === "damage");
  assert.equal(dmg.name, "Ann");
  await call("/api/gm/combat/hp", { room, name: "Ann", delta: -dmg.amount }, true);
  // players see monsters as a word, not numbers
  const player = await call(`/api/log?room=${room}&since=0`).then((x) => x.data);
  assert.equal(player.combat.list.find((x) => x.name === "Goblin Warrior 1").hp, undefined);
  await call("/api/gm/combat/end", { room }, true);
  assert.equal((await call(`/api/char?room=${room}&who=Rick`)).data.card.hp, 15);
});

test("the game survives a server restart (database)", async () => {
  await call("/api/say", { room: "keep", who: "Ann", text: "Remember me." });
  await wait(2000); // saved 1.5 s after the change
  await stop();
  server = await start();
  const d = await log("keep");
  assert.ok(d.msgs.some((m) => m.text === "Remember me."));
});

test("AI quota errors are explained in plain words", async () => {
  await stop();
  server = await start({ MOCK_GEMINI: "quota" });
  await call("/api/say", { room: "quota", who: "Ann", text: "Hello?" });
  const r = await call("/api/dm", { room: "quota", map: "", creatures: [] });
  assert.equal(r.status, 500);
  assert.match(r.data.error, /free AI quota/);
  assert.equal((await log("quota")).busy, false);
});

test("a monster turn that fails (AI quota) is tried again on Next turn, not skipped", async () => {
  // still running with MOCK_GEMINI=quota from the test above
  const room = "retry";
  await call("/api/char", { room, who: "Rick", card: { name: "Ann", maxHp: 20, ac: 15 } });
  await call("/api/gm/combat/start", { room, tokens: [{ id: "g1", name: "Goblin Warrior", side: "enemy" }] }, true);
  const gob = (await log(room)).combat.list.find((x) => x.side === "enemy");
  await call("/api/gm/combat/set", { room, id: gob.id, init: 50 }, true);
  await call("/api/gm/combat/set", { room, id: "pc:Rick", init: 1 }, true);
  let r = await call("/api/gm/combat/begin", { room }, true);
  assert.equal(r.status, 500);
  assert.match(r.data.error, /try the monsters' turn again/);
  r = await call("/api/gm/combat/next", { room }, true);
  assert.match(r.data.error, /skip the monsters' turn/);
  let d = await log(room);
  assert.equal(d.combat.list[d.combat.turn].name, "Goblin Warrior"); // still the goblin's turn after two failures
  assert.equal((await call("/api/gm/combat/next", { room }, true)).status, 200); // third press skips to the player
  d = await log(room);
  assert.equal(d.combat.list[d.combat.turn].name, "Ann");
});
