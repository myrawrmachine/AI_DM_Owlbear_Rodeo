# HANDOFF: AI Dungeon Master for Owlbear Rodeo (free-tier build)

> To the new Claude: read this whole file first. It is the complete state of a project built over a long previous chat. Do not restart or re-plan from scratch. Continue from the LAST numbered section at the end of this file (newest status); section 5 is older history. The full current source code is at the end of this file.

## 1. The user and their requirements
- Wants an AI that acts as an all-encompassing Dungeon Master inside Owlbear Rodeo (virtual tabletop): narrates, plays NPCs and monsters, knows D&D 2024 (5.5e) rules, builds the campaign/one-shot from scratch, generates maps, spawns monsters, and recommends enemy/NPC movement.
- **Everything must stay on free tiers** (GitHub, Render free web service, Google Gemini API free tier, Owlbear Rodeo free account). No paid services.
- Works on a **Windows computer**. **5 or more players** use it at once.
- **Wants this handoff file updated and re-sent after every code update.**
- Not a programmer. Wants **step-by-step, "a monkey could follow it"** instructions with links and files provided. Wants **clarifying questions asked before building** anything big. Likes downloadable documents.
- Already completed: GitHub repo `owlbear-dm`, Render web service, Gemini API key, extension added in Owlbear (it works; they tested chat and GM tools).

## 2. Architecture (what exists)
- **Owlbear extension** (popover panel, top-left d20 icon). Loads `/index.html` from the Render server. Manifest at `/manifest.json`.
- **Node server** (`server.js`, zero npm dependencies, Node 18+) hosted on Render free tier. Serves the 3 static files and a JSON API. Calls the Gemini REST API (`generateContent`).
- **Shared story:** one in-memory log per Owlbear room (resets when Render restarts or sleeps). Players press **Say** (adds a message, no AI call). One person presses **Ask DM** (one Gemini request for the whole round). Client polls `/api/log` every 3 seconds.
- **Two passwords (Render env vars):** `ACCESS_CODE` (all players, entered in the panel's "Access code" box on the story screen) and `GM_CODE` (GM only, entered in the GM tools screen). They must be different. Server enforces both. Common confusion: the error "Wrong or missing access code" means the ACCESS code box, not the GM code.
- **Render env vars:** `GEMINI_API_KEY` (required), `ACCESS_CODE`, `GM_CODE`, optional `POLLINATIONS_KEY` (free image key), optional `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (free database), `MODEL` (live story model; user currently has `gemini-3.8-flash`), optional `PLAN_MODEL` (model for one-shots, maps, moves; defaults to MODEL).
- Repo files (all in repo root, flat, exact names): `index.html`, `manifest.json`, `icon.svg`, `server.js`, `package.json`. Render settings: Node, build `npm install`, start `npm start`, Free instance.

## 3. Features built
1. Narrator DM with shared multi-player log, token names/positions read from the scene (`send map` checkbox).
2. **GM tools** (button shown only to the room's GM via `OBR.player.getRole()`; server requires `GM_CODE`):
   - Secret brief: textarea saved server-side; injected into the DM system prompt as SECRET DM NOTES. Also kept in the GM's localStorage and auto-restored to the server on Unlock after a server restart.
   - One-shot drafter: level, players, theme -> AI writes full one-shot (premise, secrets, scenes, monsters, treasure, endings) into the brief box for editing.
   - **Build map + monsters** (v0.3): ONE request. AI reads the saved brief, returns JSON of the whole adventure as one connected map (areas = walkable floor, features = objects) plus creatures (name, count, side, area). Server sanitizes and places creatures by code (nearest free cells to room center, avoiding blocking features, numbering duplicates across the map). Client deletes previous generated items (metadata `com.aidm/generated` and `com.aidm/auto`), draws rectangles on the MAP layer (locked), spawns colored square tokens with attached name labels on CHARACTER layer. Default map 60 x 40 cells. User chose "whole adventure as one big map", "spawn everything right away", "no PC start markers".
   - Manual spawn (optional extra creatures), metadata `com.aidm/side` = enemy|npc|ally.
   - **Enemy moves:** AI suggests moves (JSON) for spawned tokens only (players' own tokens are treated as PCs and never moved); GM presses Apply per move or Apply all. Uses Chebyshev distance, default speed 6 cells.
   - Clear story button (GM only).
3. No images are generated (Gemini image models are not free); maps are flat colored rectangles, no walls/fog/labels on areas.

## 4. Facts learned (important)
- `gemini-2.5-flash` is retired for new accounts (API error). Use `gemini-3.8-flash` (listed free on Google's pricing page). A forum report says its free cap is only about **20 requests/day**; Flash-Lite models reportedly ~500/day (exact Flash-Lite model ID not confirmed; copy from https://ai.google.dev/gemini-api/docs/pricing). Plan: MODEL = a Flash-Lite model for live story, PLAN_MODEL = gemini-3.8-flash for planning tools. Check https://ai.google.dev/gemini-api/docs/rate-limits.
- Free-tier Gemini: Google may use inputs to improve products; free tier may exclude commercial use.
- Each AI button = 1 request. Typical session 40 to 60 requests.
- Owlbear docs verified: extensions load via manifest URL (profile page -> Add Extension, or star icon -> Extensions -> Add +; enable per room in Create Room dialog). Manifest fields: name, version, manifest_version, description, icon, action {title, icon, popover, width, height}. SDK: `OBR.scene.items.getItems/addItems/updateItems/deleteItems`, `buildShape()` (.width .height .shapeType("RECTANGLE"|"CIRCLE"|"TRIANGLE"|"HEXAGON") .fillColor .fillOpacity .strokeColor .strokeWidth .position .layer .name .locked .metadata .attachedTo .build), `buildLabel()` (.plainText .pointerDirection .attachedTo ...). SDK imported in the panel via `https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm`.
- NOT verified (could be sources of bugs): whether a free Owlbear account can add custom extensions (it appears to, user has it working); shape `position` meaning for CIRCLE (code avoids circles, uses RECTANGLE where position = top-left); label position/offset behavior; `OBR.viewport.animateToBounds`; `OBR.scene.grid.getDpi`; `OBR.room.id`; `OBR.player.getRole()`.
- Free Render server sleeps when idle (first request slow) and in-memory story is lost on restart.
- Recommended extra Owlbear extensions (from community guide): official dice roller + initiative tracker (profile -> Starter Sets), dddice, Game Master's Grimoire (monster stat blocks + initiative), Stat Bubbles for D&D, Condition Markers, Smoke & Spectre (fog), DJinni Music Player, Owl20 (D&D Beyond rolls). Store: extensions.owlbear.rodeo ; community guide: obr-extensions-guide.onrender.com.

## 5. CURRENT STATUS / NEXT ACTION
- Latest version: server.js with `/api/gm/build`; index.html with fixed GM status header. Manifest v0.2.0 (unchanged since).
- **Open bug:** the user reported that clicking **Build map + monsters** "does nothing" (no map, no tokens). Cause not yet confirmed. Hypothesis: errors/progress were shown in a status line at the top of the scrolled GM panel (not visible). I shipped a fix: pinned red/grey status header, "Step 1/2/3 of 3" progress messages, a check that a scene is open (`OBR.scene.isReady()`), and "Drawing failed:" labelled errors. **The user has not yet reported whether the fixed `index.html` was uploaded to GitHub/Render or what the new message says.**
- Next: ask the user to (1) confirm the fixed index.html is on GitHub and Render shows Live, (2) press the button again and report the exact status text (or F12 -> Console red errors). Likely candidates: brief not saved, no scene open, Gemini quota/format error, slow response, or an Owlbear SDK call misbehaving (shape/label builders, `locked`, `attachedTo`).
- Test coverage so far: server endpoints tested locally with a mocked Gemini (all pass); client JS only syntax-checked; never run in a live Owlbear room by Claude.
- Ideas for later (user was told this order): persistent memory (needs free DB), SRD monster/rules lookup, system dice + combat tracker, area labels/walls/fog on generated maps, letting the DM spawn/move tokens itself with approval, "session zero" campaign builder, move Access code box into GM screen (offered, not yet requested).

## 6. Setup summary (for re-explaining to the user)
1. Gemini key: https://aistudio.google.com/apikey (do not enable billing).
2. Files in a folder `owlbear-dm`; Windows: enable View -> Show -> File name extensions; no ".txt" or "(1)" in names.
3. GitHub repo `owlbear-dm` (public), upload files; to update, Add file -> Upload files -> replace -> Commit.
4. Render: New + -> Web Service, Node, build `npm install`, start `npm start`, Free; env vars above; Manual Deploy after env changes.
5. Test `<render url>/manifest.json`, then the plain URL.
6. Owlbear: profile -> Add Extension -> paste `<render url>/manifest.json`; enable in room (Create Room dialog or star -> Extensions). If panel looks old, remove and re-add the extension.
7. Docs produced earlier (Claude Docs): free setup guide (Gemini), v0.2/v0.3 upgrade guide, plus a .docx of the guide. Content is summarized above; regenerate if the user wants them again.

## 8. Candidate features from https://github.com/Agamador/OwlBear-llm-chat (read README only, not source)
The user asked to add features from that project and integrate them into this build. Claude read only the README (no license visible), so any work should be an independent re-implementation of the ideas, not copied code. That project uses Anthropic Claude with a per-user API key (not free); ours uses Gemini free tier. Ideas to port, with free-tier notes:
1. Markdown rendering of chat messages (easy; must escape HTML, support bold/italic/lists).
2. Persistent chat history in Owlbear room metadata (fixes story reset on Render restart; watch metadata size limit, truncate/summarize; never store the secret brief there because players can read room metadata).
3. AI-executed actions via natural language: spawn tokens, move tokens, camera/viewport moves, clear areas. Plan: Gemini returns structured actions in the same Ask DM request (no extra quota), the GM approves before they run.
4. Fog of war and lighting control (AI reveals areas as the story progresses). Need to verify the SDK items/builders for fog, walls and lights in docs.owlbear.rodeo before building.
5. Richer scene awareness: include fog, lights, objects and token changes in the DM context (currently only token names/cells + saved map layout).
6. Server-Sent Events instead of 3-second polling (minor).
7. Cinematic viewport control for all players (needs a broadcast/metadata signal; each client moves its own camera).
Recommended order: 1 and 2, then 3, then 4 and 5. Fix the open "Build map + monsters" bug first.

## 9. Progress on candidate features
- Step 1 DONE: markdown rendering of DM messages (safe: HTML escaped first). Steps 2 to 6 from section 8 remain, in order: saved story history, AI actions with approval, fog/lighting, richer scene awareness, real-time updates + synced camera.

## 10. Added later: Step 7 "Scene art" (images)
- User asked whether the Agamador repo generates map images and whether our tool can generate and insert images. Claude read only that repo's README: it mentions custom character assets, spawning objects, fog and lighting, and a companion Hugging Face MCP server (not opened); it does NOT say it generates map images (unverified either way).
- Plan for ours: AI scene illustrations (and monster portraits/handouts) from a free image provider, shown in the chat and optionally placed on the Owlbear map as an image item (server hosts each image for the session; SDK `buildImage` with a URL, details to verify in docs). Candidate free sources (limits/terms NOT verified): Hugging Face inference free tier, Cloudflare Workers AI free allowance, Pollinations. Gemini image models were not free when last checked.
- Keep the rectangle layout as the playable battle map (it knows the grid for tokens and enemy moves). Text-to-image battle maps usually lack grids and consistent scale, so use images as art, not as the grid. Alternative: user uploads a grid map from a free tool (e.g. Dungeon Scrawl) as the scene image and our tools run on top.
- Open question for the user: illustrations in the chat for all players, or pictures placed straight onto the map layer?
- Also pending: user's "No scene is open" error means the room needs an active scene (add a blank/placeholder map in the scenes menu) before Build map + monsters can draw.

## 11. Decision: scene art goes straight onto the map layer
- User chose: generated pictures placed directly on the Owlbear MAP layer (not only shown in chat).
- Design: GM tools gets a "Map art" section (describe scene or use the brief) -> server requests an image from a free provider, stores it in memory, serves it at a URL on our Render server -> client uses SDK `buildImage` (url, width, height, mime; grid dpi chosen so the image covers N cells) on the MAP layer, locked. Replaces/sits beside the rectangle map. Verify `buildImage` signature in docs.owlbear.rodeo before building.
- Caveats to tell the user: AI art will not match our rectangle layout or cell grid, so enemy-move suggestions cannot know walls on an art map (they would use open positions only); images served from the free Render server vanish if it restarts (re-generate).
- Provider status (conflicting sources, NOT verified): Pollinations legacy endpoint `https://image.pollinations.ai/prompt/<prompt>?width=1024&height=1024` is reported to work with no key at ~1 request per 15 seconds and possible watermark; other sources say its API needs an account or trial credit. Hugging Face and Cloudflare Workers AI free tiers need accounts. Plan: ask the user to test the Pollinations URL in their browser, then pick the provider; keep the provider swappable via an env var.
- Next action: user tests the URL and reports what they see (image, watermark, error).

## 12. Code review of Agamador/OwlBear-llm-chat (user uploaded the ZIP; Claude read server.js, obr-chat-client.js, src/obr/obr-actions.js, Actions.md, docs/store.md)
No LICENSE file is in the ZIP, so do NOT copy their code or art assets. Use it only as evidence of how the Owlbear SDK behaves, and write our own code.
**How it works:** the extension is a thin chat panel (Vite). The "brain" is a separate agent (LangGraph + Claude, in a Hugging Face Gradio Space) that needs the user's paid Anthropic key. The agent runs board actions by calling an Express server `POST /execute/:tabId`; the server pushes the action over Server-Sent Events to the browser tab, the tab runs the OBR SDK call, then `POST /response/:tabId` returns the result. One random tabId per page load, tagged "single-player". Chat history is kept as one `history` array in room metadata (getRoomMetadata/setRoomMetadata) with no trimming, so it will eventually hit size limits. Before each message the tab sends a game state: player, shapes (id, type, color, cell position), image tokens (name, size, cell position, light radius), map image(s), and `OBR.scene.fog.getFilled()`.
**Their action list:** createShape, createToken (image URL, name label via `.plainText`, CHARACTER layer), moveItem, deleteItem, insertMap, fillFog, removeFog, addLightSource, animateViewport, notify, getGameState, emptyAll, get/setRoomMetadata, startRoom (fog + torch light). Bundled art library in src/assets (tokens, monsters, 5 maps); no image generation in this repo (story/image generation is said to be in a separate MCP server).
**SDK facts now VERIFIED from their working code (useful for us):**
- Map/art image: `buildImage({url,width,height,mime},{dpi,offset:{x:0,y:0}}).scale({x:s,y:s}).layer("MAP").locked(true).build()` where s = dpi*cells/imageWidth; width/height read by loading the image in the browser. Tokens: same with `.layer("CHARACTER").plainText(name)`.
- Fog: `OBR.scene.fog.setFilled(true|false)`, `OBR.scene.fog.getFilled()`; fog drawings are items on layer "FOG". Fog control in their code is whole-scene on/off only.
- Light: `buildLight().attachedTo(id).attenuationRadius(px).sourceRadius(px).lightType("PRIMARY").falloff(0.2)`, added with `OBR.scene.local.addItems` (local to that client).
- `OBR.scene.items.getItemBounds([id])` + `OBR.viewport.animateToBounds(bounds)` (camera moves; local to that client). `OBR.player.getRole()`, `OBR.scene.grid.getDpi()`, `OBR.room.getMetadata/setMetadata`, `OBR.notification.show(msg, mode)` all exist.
- Their moveItem treats Shape position as the shape's CENTER (adds width/2, height/2) and image position as top-left. Our rectangles assume top-left; UNVERIFIED, test early.
**Gaps vs ours:** AI that acts on the board (spawn/move/delete/map insert), fog and light control, camera control, token art (images), bundled map art, saved history in room metadata, richer game-state snapshot, external action bridge (SSE). **Ours that they lack:** free Gemini, multi-player round flow with one Ask DM, secret GM brief + one-shot drafter, whole-adventure map + monster placement, enemy move suggestions with approval, two passwords, free hosting and guides. Their README says to remove GM privileges to avoid spoilers; our server-side secret brief avoids that.
**Implications for our steps:** Step 2 (history): store a TRIMMED copy in room metadata (their unbounded array is a known risk); never store the brief there. Step 3 (actions): use their action list as the checklist, run with GM approval, bundled in the Ask DM request. Step 4 (fog): only whole-scene fog on/off and token lights are proven; fine-grained reveals need FOG-layer items, unverified. Step 7 (map art): `insertMap` approach is proven; we still need a free image source and hosting.

## 7. Full source code (current)
Create each file with exactly these contents (current version: v0.7.0). `icon.svg` and `package.json` are unchanged since the first version.

### package.json

```json
{
  "name": "owlbear-dm",
  "version": "0.1.0",
  "description": "AI Dungeon Master for Owlbear Rodeo",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18" }
}

```

### manifest.json

```json
{
  "name": "AI Dungeon Master",
  "version": "0.7.0",
  "manifest_version": 1,
  "description": "An AI DM that narrates, runs combat, builds campaigns and maps, and suggests enemy moves.",
  "author": "You",
  "icon": "/icon.svg",
  "action": {
    "title": "AI Dungeon Master",
    "icon": "/icon.svg",
    "popover": "/index.html",
    "width": 440,
    "height": 700
  }
}
```

### icon.svg

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" xmlns:c2pa="http://c2pa.org/manifest"><metadata><c2pa:manifest>AAAWgmp1bWIAAAAeanVtZGMycGEAEQAQgAAAqgA4m3EDYzJwYQAAABZcanVtYgAAAEdqdW1kYzJtYQARABCAAACqADibcQN1cm46YzJwYTo5Yzk3ODg3Zi05ZmEzLTRhNWUtYWNiZC0wZDEzMGFmZjg2YmIAAAADl2p1bWIAAAApanVtZGMyYXMAEQAQgAAAqgA4m3EDYzJwYS5hc3NlcnRpb25zAAAAALxqdW1iAAAARGp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuaW5ncmVkaWVudC52MwAAAAAYYzJzaHx7flhucWOuKCXhcZ/0rk4AAABwY2JvcqNpZGM6Zm9ybWF0bWltYWdlL3N2Zyt4bWxqaW5zdGFuY2VJRHgseG1wOmlpZDozODA3YmIzYy04NzZlLTQzNTctYjZkZS00M2Y4YmExZjRiMDJscmVsYXRpb25zaGlwaHBhcmVudE9mAAAB4mp1bWIAAABBanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5hY3Rpb25zLnYyAAAAABhjMnNoVO8F1AJRl3iRlm2IA+/KMQAAAZljYm9yomdhY3Rpb25zgqJmYWN0aW9ua2MycGEub3BlbmVkanBhcmFtZXRlcnOha2luZ3JlZGllbnRzgaJjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFggEOmyCvbxgNSYFWs/VR550D5PBv16FOLD9wRoeuxoPXukZmFjdGlvbngdY29tLmFudGhyb3BpYy5jbGF1ZGUucHJvdmlkZWRqcGFyYW1ldGVyc6F4H2NvbS5hbnRocm9waWMub3JpZ2luLWNvbmZpZGVuY2VndW5rbm93bmtkZXNjcmlwdGlvbnhmQ2xhdWRlIHByb3ZpZGVkIHRoaXMgZmlsZSBhdCB0aGUgcmVxdWVzdCBvZiBhIHVzZXIgYW5kIG1heSBoYXZlIGNyZWF0ZWQgb3IgbW9kaWZpZWQgdGhlIGZpbGUgY29udGVudHMubXNvZnR3YXJlQWdlbnShZG5hbWVmQ2xhdWRlcmFsbEFjdGlvbnNJbmNsdWRlZPUAAADIanVtYgAAAEBqdW1kY2JvcgARABCAAACqADibcRNjMnBhLmhhc2guZGF0YQAAAAAYYzJzaJ1dz0FluOB+YCATL3cBcYgAAACAY2JvcqVjYWxnZnNoYTI1NmNwYWRNAAAAAAAAAAAAAAAAAGRoYXNoWCAPFgkL5hXB1SQxzTO8dgTWkk4PNvm91gK8MCQwcxvMkmRuYW1lbmp1bWJmIG1hbmlmZXN0amV4Y2x1c2lvbnOBomVzdGFydBjDZmxlbmd0aBkeBAAAAj5qdW1iAAAAJ2p1bWRjMmNsABEAEIAAAKoAOJtxA2MycGEuY2xhaW0udjIAAAACD2Nib3KlY2FsZ2ZzaGEyNTZpc2lnbmF0dXJleE1zZWxmI2p1bWJmPS9jMnBhL3VybjpjMnBhOjljOTc4ODdmLTlmYTMtNGE1ZS1hY2JkLTBkMTMwYWZmODZiYi9jMnBhLnNpZ25hdHVyZWppbnN0YW5jZUlEeCx4bXA6aWlkOmU1ZDEyMjY2LThhYjMtNDQ0Yi04NjZmLTM3ZmFmN2U2MDI0ZnJjcmVhdGVkX2Fzc2VydGlvbnODomN1cmx4LXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaW5ncmVkaWVudC52M2RoYXNoWCAQ6bIK9vGA1JgVaz9VHnnQPk8G/XoU4sP3BGh67Gg9e6JjdXJseCpzZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmFjdGlvbnMudjJkaGFzaFggcgORlompYEn1KBa442QQhq/Q1fT1dJGDQj20Gmcs3YaiY3VybHgpc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5oYXNoLmRhdGFkaGFzaFgglI9jWN9mjDW2dI24XZUai7GUk6SXq+7PmryLsEbfDPF0Y2xhaW1fZ2VuZXJhdG9yX2luZm+jZG5hbWVvQW50aHJvcGljIEZpbGVzZ3ZlcnNpb25lMS4wLjBrc3BlY1ZlcnNpb25lMi40LjAAABA4anVtYgAAAChqdW1kYzJjcwARABCAAACqADibcQNjMnBhLnNpZ25hdHVyZQAAABAIY2JvctKEWQISogEmGCFZAgowggIGMIIBjaADAgECAhRA5aAK7sI50L64g/oGQgU9Z1UTADAKBggqhkjOPQQDAzBJMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEuMCwGA1UEAxMlQW50aHJvcGljIENvbnRlbnQgQ3JlZGVudGlhbHMgUm9vdCBDQTAeFw0yNjA4MDcxODQzNTZaFw0yODA4MDYxOTQzNTZaMEQxFzAVBgNVBAoTDkFudGhyb3BpYywgUEJDMSkwJwYDVQQDEyBBbnRocm9waWMgQ2xhdWRlIENvbnRlbnQgU2lnbmluZzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABJh6CmvLUBgFFNU0vUKlOVtE6djd17L5SuwX0LemFisBM3dkd/3cyjxFA3Qo5S46fX0/ihY0VZ7mfb9KF703t5OjWDBWMA4GA1UdDwEB/wQEAwIHgDAVBgNVHSUEDjAMBgorBgEEAYPoXgIBMAwGA1UdEwEB/wQCMAAwHwYDVR0jBBgwFoAUzlHiBIFOZFsj+OPEz5o+nMHXXMIwCgYIKoZIzj0EAwMDZwAwZAIwMXMdFJ4BetLLVY7ORuE9noqbbAZOZn/aArXyTwFAZfKrPzxF2vPoJNf1+UCdg1XGAjBwX1zd9WGqYkqmL5SFqw1QySjr1zJfpJM9+1rdDwSPLMOPOjKuiXjoU/pUUeG9RwmhY3BhZFkNngAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPZYQJVG7gDwbWq6xQkMjnlKqMYVz1thfkfaFSj65ytO8RB2fxTqfcse7QQJ3/IrYWkZvN3/wln3e4/O1ZEeHBtq6pg=</c2pa:manifest></metadata><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2l5 10H7zM7 12l5 10 5-10M3 7l4 5M21 7l-4 5"/></svg>

```

### server.js

```javascript
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
- Never roll for the players: when they need a roll, tell them exactly what to roll (e.g. "Roll a DC 13 Dexterity save") and wait. They roll in the panel and their results appear in the story as "rolls ...".
- For monsters and NPCs, use the PRE-ROLLED DICE list, in order, for every attack, save and damage roll, and show the math briefly. Never invent dice results.
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
- At most 6 actions, but damage and heal do not count toward that limit (up to 12 of them).
- Action types:
  {"type":"spawn","name":"Goblin","count":3,"side":"enemy"|"npc"|"ally","col":int,"row":int}   (creatures that enter the scene now)
  {"type":"move","name":"Goblin 1","col":int,"row":int,"reason":"short"}   (only enemy/npc/ally tokens, never player characters)
  {"type":"delete","name":"Goblin 2"}   (remove a defeated or departed creature; never a player character)
  {"type":"fog","on":true|false}   (true = cover the whole scene in fog, false = clear it)
  {"type":"camera","name":"Cult Leader"}  or  {"type":"camera","col":int,"row":int}   (focus everyone's view)
  {"type":"light","name":"Ann","radius":4}   (give a token a light, radius in cells)
  {"type":"reveal","area":"Scene 2: Altar Hall"}   (make a hidden area, and the creatures in it, appear on the map when the party reaches, opens or discovers it)
  {"type":"damage","name":"Goblin Warrior 1","amount":7}   (a creature or character in the combat tracker loses HP)
  {"type":"heal","name":"Ann","amount":5}   (a creature or character in the combat tracker regains HP)`;

function sanitizeActions(list) {
  const out = [];
  let count = 0;
  for (const a of (Array.isArray(list) ? list : []).slice(0, 30)) {
    if (!a || typeof a !== "object") continue;
    const type = str(a.type, 12);
    const name = str(a.name, 40);
    if (type === "damage" || type === "heal") continue;
    if (++count > 6) break;
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
  // damage / heal are bookkeeping for the combat tracker, so they get their own (larger) allowance
  for (const a of (Array.isArray(list) ? list : []).slice(0, 30)) {
    if (!a || typeof a !== "object") continue;
    const type = str(a.type, 12), name = str(a.name, 40);
    if ((type === "damage" || type === "heal") && name && out.filter((x) => x.type === "damage" || x.type === "heal").length < 12)
      out.push({ type, name, amount: clampInt(a.amount, 1, 500, 1) });
  }
  return out;
}

// Everything lives in memory, one entry per Owlbear room. It resets if the server restarts or sleeps.
const rooms = {};
function getRoom(id) {
  id = String(id || "default").slice(0, 100);
  if (!rooms[id]) rooms[id] = { id, msgs: [], next: 1, busy: false, brief: "", pending: [], aseq: 1, adv: null, advFull: null, art: null, artV: 0, epoch: "", chars: {}, campaign: null, combat: null };
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
// ---------- Database (optional, free Upstash Redis via its REST API) ----------
// With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, every room is saved there, so the story, brief, map,
// combat, campaign and characters survive restarts. Without them, everything stays in memory like before.
const DB_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
const DB_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const DB_ON = !!(DB_URL && DB_TOKEN);
const SAVE_FIELDS = ["msgs", "next", "brief", "epoch", "adv", "advFull", "combat", "campaign", "chars", "aseq"];
async function db(cmd) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(DB_URL, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || d.error) throw new Error("Database error: " + (d.error || resp.status));
    return d.result;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The database didn't answer in time.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
function touch(r) {
  if (!DB_ON || !r || !r.loaded) return;
  clearTimeout(r.saveT);
  r.saveT = setTimeout(() => saveRoom(r), 1500);
}
async function saveRoom(r) {
  const o = {};
  SAVE_FIELDS.forEach((k) => { o[k] = r[k]; });
  try {
    await db(["SET", "aidm:room:" + r.id, JSON.stringify(o), "EX", String(180 * 86400)]); // kept 180 days after last change
    r.dbErr = "";
  } catch (e) {
    r.dbErr = e.message;
    console.error("save", r.id, e.message);
  }
}
const loading = {};
// Gets a room, loading it from the database the first time. If the database can't be read, the request fails
// (instead of starting an empty room that would overwrite the saved one).
async function loadRoom(id) {
  id = String(id || "default").slice(0, 100);
  if (rooms[id] && rooms[id].loaded) return rooms[id];
  if (!DB_ON) { const r = getRoom(id); r.loaded = true; return r; }
  if (!loading[id]) {
    loading[id] = (async () => {
      let raw;
      try { raw = await db(["GET", "aidm:room:" + id]); }
      catch (e) { throw new Error("Couldn't read the saved game from the database (" + e.message + "). Try again in a moment."); }
      const r = getRoom(id);
      if (!r.loaded) {
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            SAVE_FIELDS.forEach((k) => { if (saved[k] !== undefined && saved[k] !== null) r[k] = saved[k]; });
          } catch (e) { console.error("bad saved room", id); }
        }
        r.loaded = true;
      }
      return r;
    })().finally(() => { delete loading[id]; });
  }
  return loading[id];
}

// ---------- Dice (rolled on the server, so everyone sees the same fair result) ----------
const crypto = require("crypto");
const die = (sides) => crypto.randomInt(1, sides + 1);
function rollDice(expr) {
  let s = String(expr || "").toLowerCase().replace(/\s+/g, "");
  if (s === "adv") s = "2d20kh1";
  if (s === "dis") s = "2d20kl1";
  if (!s || s.length > 60) throw new Error("Write a roll like 1d20+5, 2d6+3, adv or dis.");
  const re = /([+-])?(?:(\d*)d(\d+)(kh1|kl1|adv|dis)?|(\d+))/y;
  let pos = 0, total = 0, terms = 0, dice = 0, nat = 0;
  const parts = [];
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m || !m[0]) throw new Error(`I can't read "${expr}". Write a roll like 1d20+5.`);
    pos = re.lastIndex;
    if (++terms > 10) throw new Error("That roll has too many parts.");
    const neg = m[1] === "-";
    const join = parts.length ? (neg ? "- " : "+ ") : (neg ? "-" : "");
    if (m[3] !== undefined) {
      let n = m[2] === "" ? 1 : +m[2];
      const sides = +m[3];
      let mode = m[4] || "";
      if (mode === "adv") mode = "kh1";
      if (mode === "dis") mode = "kl1";
      if (mode) n = Math.max(n, 2);
      if (n < 1 || n > 50 || sides < 2 || sides > 1000) throw new Error("Use 1 to 50 dice with 2 to 1000 sides.");
      dice += n;
      const rolls = Array.from({ length: n }, () => die(sides));
      let val;
      if (mode === "kh1") val = Math.max(...rolls);
      else if (mode === "kl1") val = Math.min(...rolls);
      else val = rolls.reduce((a, b) => a + b, 0);
      if (sides === 20 && (n === 1 || mode) && !nat) nat = val;
      parts.push(join + `[${rolls.join(", ")}${mode ? " → " + val : ""}]`);
      total += neg ? -val : val;
    } else {
      parts.push(join + m[5]);
      total += neg ? -m[5] : +m[5];
    }
  }
  if (!dice) throw new Error("Include at least one die, like 1d20.");
  return { total, detail: parts.join(" "), nat };
}
// "1d20+5 attack with sword" -> roll "1d20+5", label "attack with sword"
function splitRoll(text) {
  const words = String(text || "").trim().split(/\s+/);
  const dice = [];
  while (words.length && /^([0-9d+\-]+|kh1|kl1|adv|dis|[0-9d+\-]+(kh1|kl1))$/i.test(words[0])) dice.push(words.shift());
  return { expr: dice.join(""), label: words.join(" ").slice(0, 60) };
}
function rollText(expr, label, res) {
  return `rolls ${expr}${label ? " for " + label : ""}: ${res.detail} = **${res.total}**` +
    (res.nat === 20 ? " (natural 20!)" : res.nat === 1 ? " (natural 1)" : "");
}
// A list of pre-rolled dice the AI must use, in order, for monsters and NPCs (it cannot roll by itself).
function diceBank() {
  const row = (sides, n) => `d${sides}: ` + Array.from({ length: n }, () => die(sides)).join(", ");
  return "\n\nPRE-ROLLED DICE for monsters and NPCs (use them in order, never reuse one, never invent results):\n" +
    [row(20, 12), row(4, 8), row(6, 12), row(8, 10), row(10, 8), row(12, 6)].join("\n");
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
    const text = m.role === "dm" ? m.text : m.role === "sys" ? `[Table] ${m.text}` : `${m.who}: ${m.text}`;
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


// ---------- Combat tracker ----------
// r.combat = { phase: "setup"|"fight", round, turn, v, list: [{ id, name, side, owner, init, initBonus, hp, maxHp, ac }] }
const alive = (c) => c.side === "pc" || !(c.maxHp > 0) || c.hp > 0;
function combatBump(r) { if (r.combat) r.combat.v = (r.combat.v || 0) + 1; }
function healthWord(c) {
  if (!(c.maxHp > 0)) return "";
  if (c.hp <= 0) return "Down";
  return c.hp <= c.maxHp / 2 ? "Bloodied" : "Healthy";
}
// Players see monsters' health as a word; the GM sees the numbers.
function combatView(r, gm) {
  const c = r.combat;
  if (!c) return null;
  return {
    phase: c.phase, round: c.round, turn: c.turn, v: c.v || 0,
    list: c.list.map((x) => (gm || x.side === "pc")
      ? { id: x.id, name: x.name, side: x.side, owner: x.owner || "", init: x.init, hp: x.hp, maxHp: x.maxHp, ac: x.ac }
      : { id: x.id, name: x.name, side: x.side, init: x.init, status: healthWord(x) }),
  };
}
function combatBlock(r) {
  const c = r.combat;
  if (!c) return "";
  const rows = c.list.map((x, i) =>
    `${i + 1}. ${x.name} (${x.side === "pc" ? "player character" : x.side}) initiative ${x.init === null ? "?" : x.init}` +
    (x.maxHp > 0 ? `, HP ${x.hp}/${x.maxHp}` : "") + (x.ac ? `, AC ${x.ac}` : "") + (!alive(x) ? ", DOWN" : "") +
    (c.phase === "fight" && i === c.turn ? "  <- current turn" : ""));
  return `\n\nCOMBAT IS ON (${c.phase === "setup" ? "rolling initiative" : "round " + c.round}). Turn order:\n` + rows.join("\n") +
    "\nWhen a hit or healing changes a creature's HP, propose a damage or heal action for it so the GM can update the tracker.";
}
function findCombatant(r, name) {
  const c = r.combat;
  if (!c) return null;
  const low = (s) => String(s || "").toLowerCase().trim();
  const exact = c.list.filter((x) => low(x.name) === low(name));
  if (exact.length === 1) return exact[0];
  const base = c.list.filter((x) => low(baseName(x.name)) === low(baseName(name)));
  return base.length === 1 ? base[0] : null;
}
function sortCombat(r) {
  const c = r.combat;
  const current = c.list[c.turn] && c.list[c.turn].id;
  c.list.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || (b.initBonus || 0) - (a.initBonus || 0) || (a.side === "pc" ? -1 : 1));
  const i = c.list.findIndex((x) => x.id === current);
  c.turn = i >= 0 ? i : 0;
}
async function startCombat(r, tokens) {
  const list = [];
  const chars = r.chars || {};
  for (const owner of Object.keys(chars)) {
    const ch = chars[owner];
    list.push({ id: "pc:" + owner, name: ch.name || owner, side: "pc", owner, init: null, initBonus: ch.init || 0,
      maxHp: ch.maxHp || 0, hp: ch.hp ?? ch.maxHp ?? 0, ac: ch.ac || 0 });
  }
  const known = new Set(list.map((x) => x.name.toLowerCase()));
  const toks = (Array.isArray(tokens) ? tokens : []).slice(0, 40);
  // Player tokens with no character card still get a row (no HP until someone types it in).
  for (const t of toks.filter((t) => t.side === "pc")) {
    const name = str(t.name, 40);
    if (name && !known.has(name.toLowerCase())) { known.add(name.toLowerCase()); list.push({ id: "pc:" + name, name, side: "pc", owner: "", init: null, initBonus: 0, maxHp: 0, hp: 0, ac: 0 }); }
  }
  const lines = [];
  for (const t of toks.filter((t) => ["enemy", "npc", "ally"].includes(t.side))) {
    const name = str(t.name, 40);
    if (!name) continue;
    const hit = await lookupCreature(name).catch(() => null);
    const d = (hit && hit.data) || {};
    const bonus = Number(d.initiative_bonus) || (d.modifiers && Number(d.modifiers.dexterity)) || 0;
    const roll = die(20);
    list.push({ id: "t:" + str(t.id, 80), name, side: t.side, owner: "", init: roll + bonus, initBonus: bonus,
      maxHp: Number(d.hit_points) || 0, hp: Number(d.hit_points) || 0, ac: Number(d.armor_class) || 0 });
    lines.push(`${name} ${roll}${bonus ? (bonus > 0 ? "+" : "") + bonus : ""} = ${roll + bonus}`);
  }
  r.combat = { phase: "setup", round: 0, turn: 0, v: 1, list };
  const pcs = list.filter((x) => x.side === "pc").map((x) => x.name);
  addMsg(r, "sys", "Table", "⚔️ Combat! " + (pcs.length ? "Players, press Roll initiative: " + pcs.join(", ") + "." : "") +
    (lines.length ? " Monster initiative: " + lines.join("; ") + "." : ""));
}
// Moves to the next creature that is still up. Returns false if nobody can act.
function stepTurn(r) {
  const c = r.combat;
  for (let k = 0; k < c.list.length; k++) {
    c.turn++;
    if (c.turn >= c.list.length) { c.turn = 0; c.round++; }
    if (alive(c.list[c.turn])) return true;
  }
  return false;
}
// The run of monsters/NPCs/allies (still up) that act in a row starting at the current turn.
function monsterBlock(r) {
  const c = r.combat, out = [];
  let i = c.turn, n = 0;
  while (n < c.list.length && c.list[i].side !== "pc") {
    if (alive(c.list[i])) out.push(c.list[i]);
    i = (i + 1) % c.list.length; n++;
  }
  return { list: out, steps: n };
}

// ---------- Characters and campaign ----------
// r.chars = { [player name]: { name, species, cls, level, maxHp, hp, ac, init, story } }
// r.campaign = { world, sessions, bible, intro, recaps: [], session }
function cleanCard(c) {
  c = c || {};
  const maxHp = clampInt(c.maxHp, 0, 999, 0);
  return {
    name: str(c.name, 40), species: str(c.species, 30), cls: str(c.cls, 40), level: clampInt(c.level, 1, 20, 1),
    maxHp, hp: clampInt(c.hp === undefined || c.hp === "" ? maxHp : c.hp, 0, 999, maxHp),
    ac: clampInt(c.ac, 0, 40, 10), init: clampInt(c.init, -5, 20, 0), story: str(c.story, 1200),
  };
}
function partyText(r) {
  const chars = r.chars || {};
  const rows = Object.keys(chars).map((p) => {
    const c = chars[p];
    return `- ${c.name || p} (played by ${p}): ${[c.species, c.cls].filter(Boolean).join(" ")} level ${c.level}, AC ${c.ac}, HP ${c.hp}/${c.maxHp}.` +
      (c.story ? ` Backstory and goals: ${c.story}` : "");
  });
  return rows.join("\n");
}
function trimMiddle(t, head, tail) {
  t = String(t || "");
  return t.length <= head + tail ? t : t.slice(0, head) + "\n[...]\n" + t.slice(-tail);
}
function campaignBlock(r) {
  const camp = r.campaign || {};
  let out = "";
  const party = partyText(r);
  if (party) out += "\n\nTHE PARTY:\n" + party;
  if (camp.bible) out += "\n\nSECRET CAMPAIGN NOTES (never quote; reveal only through play):\n" + trimMiddle(camp.bible, 3000, 1500);
  const recaps = (camp.recaps || []).slice(-2);
  if (recaps.length) out += "\n\nPREVIOUSLY (recaps of recent sessions):\n" + recaps.map((x) => `Session ${x.n}: ${x.text}`).join("\n");
  return out;
}
const CAMPAIGN_SYSTEM = `You are an expert Dungeons & Dragons (2024, 5.5e) campaign designer. Output ONLY valid JSON: {"bible": string, "intro": string}.
"bible" = secret GM campaign notes in plain text (no markdown symbols other than line breaks and dashes), under 1500 words, with these headings:
PREMISE
WORLD AND TONE (respect the GM's lines and veils)
FACTIONS
VILLAIN AND THEIR PLAN
CAMPAIGN ARC (one short entry per session: goal, main location, big moment)
PLAYER HOOKS (one per character, tied to their backstory and goals)
RECURRING NPCS
SECRETS AND CLUES
"intro" = a player-facing opening narration for the first session, under 200 words, second person plural, no secrets.`;
const RECAP_SYSTEM = `You keep the campaign log for a D&D (2024) game. Output ONLY valid JSON: {"recap": string, "notes": string}.
"recap" = what happened this session, for the PLAYERS: under 220 words, past tense, no secrets they haven't discovered.
"notes" = an update for the GM's secret campaign notes, under 300 words, plain text with dashes: what changed (NPC fates, clues found, threads opened or closed, villain's reaction), loot and levels gained, and 2-3 ideas for the next session.`;

// Runs one DM turn: the story so far (+ an optional extra instruction) -> narration posted to the story + proposed actions queued for the GM.
async function runDm(r, { map, creatures, instruction }) {
  if (!API_KEY) throw new Error("Server has no GEMINI_API_KEY set.");
  if (r.busy) { const e = new Error("The DM is already thinking."); e.status = 409; throw e; }
  r.busy = true;
  notify(r);
  try {
    const names = creatureNames(r, [...(creatures || []), ...(r.combat ? r.combat.list.filter((x) => x.side !== "pc").map((x) => x.name) : [])]);
    const stats = await statsBlock(names);
    const contents = buildContents(r.msgs);
    if (instruction) {
      const last = contents[contents.length - 1];
      if (last && last.role === "user") last.parts[0].text += "\n" + instruction;
      else contents.push({ role: "user", parts: [{ text: instruction }] });
    }
    let raw;
    try {
      raw = await gemini({
        system: SYSTEM_PROMPT + ACTIONS_PROMPT + briefBlock(r) + campaignBlock(r) + advBlock(r) + stats + combatBlock(r) + diceBank() + (map ? "\n\nCurrent map snapshot:\n" + map : ""),
        contents,
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
}

// After "Begin" or "Next turn": while it's the monsters' turn, run them (one AI request per run of monsters), then announce the next player.
async function runMonsterTurns(r, opts) {
  const c = r.combat;
  if (!c.list.some((x) => x.side === "pc")) { addMsg(r, "sys", "Table", "There are no player characters in the turn order."); return; }
  let guard = 0;
  while (r.combat && c.list[c.turn].side !== "pc" && guard++ < 3) {
    const block = monsterBlock(r);
    if (block.list.length) {
      const names = block.list.map((x) => x.name).join(", ");
      addMsg(r, "sys", "Table", `Round ${c.round}: ${names} ${block.list.length > 1 ? "act" : "acts"}.`);
      await runDm(r, {
        ...opts,
        instruction: `[Combat, round ${c.round}] It is now the turn of: ${names} (in this order). Run each one's turn now: ` +
          `movement (propose move actions; never onto an occupied cell), then attacks, spells or abilities from its stat block. ` +
          `Use the PRE-ROLLED DICE in order for every attack roll, save and damage roll, and show the math briefly ` +
          `(for example "Scimitar: 14 + 4 = 18 vs AC 15, hit, 5 slashing damage"). Compare attack totals with the targets' AC from the turn order. ` +
          `Propose a damage action for every creature in the turn order that takes damage. Do not act for player characters. End by naming whose turn is next.`,
      });
    }
    for (let k = 0; k < block.steps; k++) { c.turn++; if (c.turn >= c.list.length) { c.turn = 0; c.round++; } }
    if (!alive(c.list[c.turn])) stepTurn(r);
  }
  combatBump(r);
  if (r.combat && c.list[c.turn].side === "pc") addMsg(r, "sys", "Table", `Round ${c.round}: it's ${c.list[c.turn].name}'s turn.`);
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
      const r = await loadRoom(query.get("room"));
      const since = parseInt(query.get("since") || "0", 10) || 0;
      const gm = isGm(req);
      return json(res, 200, {
        msgs: r.msgs.filter((m) => m.id > since), latest: r.next - 1, epoch: r.epoch, busy: r.busy,
        combat: combatView(r, gm), ...(gm ? { actions: r.pending } : {}),
      });
    }
    if (req.method === "GET" && url === "/api/stream") return openStream(req, res, await loadRoom(query.get("room")));
    if (req.method === "GET" && url === "/api/char") {
      const r = await loadRoom(query.get("room"));
      return json(res, 200, { card: (r.chars || {})[str(query.get("who"), 40)] || null });
    }
    if (req.method === "GET" && url === "/api/gm/brief") {
      if (!needGm(req, res)) return;
      const r = await loadRoom(query.get("room"));
      return json(res, 200, { brief: r.brief, db: DB_ON, dbErr: r.dbErr || "" });
    }
    if (req.method !== "POST") return json(res, 404, { error: "Not found" });

    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: "Bad request." }); }
    const r = await loadRoom(body.room);
    res.on("finish", () => touch(r)); // save the room after every change

    if (url === "/api/say") {
      const text = str(body.text, 1000);
      const who = str(body.who, 40) || "Player";
      if (!text) return json(res, 400, { error: "Empty message." });
      addMsg(r, "player", who, text);
      return json(res, 200, { ok: true });
    }

    if (url === "/api/dm") {
      if (r.busy) return json(res, 409, { error: "The DM is already thinking." });
      const lastMsg = r.msgs[r.msgs.length - 1];
      if (!lastMsg || lastMsg.role === "dm")
        return json(res, 400, { error: "Nothing new for the DM to respond to. Have players say what they do first." });
      await runDm(r, { map: str(body.map, 5000), creatures: Array.isArray(body.creatures) ? body.creatures : [] });
      return json(res, 200, { ok: true });
    }

    // ----- dice -----
    if (url === "/api/roll") {
      const who = str(body.who, 40) || "Player";
      const { expr, label } = splitRoll(str(body.text, 120));
      const res2 = rollDice(expr || str(body.text, 60));
      addMsg(r, "roll", who, rollText(expr || str(body.text, 60), label, res2));
      return json(res, 200, { ok: true, total: res2.total });
    }

    // ----- characters (each player edits their own card) -----
    if (url === "/api/char") {
      const who = str(body.who, 40);
      if (!who) return json(res, 400, { error: "No player name." });
      r.chars = r.chars || {};
      if (body.card === null) delete r.chars[who];
      else r.chars[who] = cleanCard(body.card);
      notify(r);
      return json(res, 200, { ok: true, card: r.chars[who] || null });
    }

    // ----- combat actions any player may take for their own character -----
    if (url === "/api/combat/init" || url === "/api/combat/hp") {
      const c = r.combat;
      if (!c) return json(res, 400, { error: "There is no combat right now." });
      const who = str(body.who, 40).toLowerCase();
      const mine = c.list.find((x) => x.side === "pc" && ((x.owner && x.owner.toLowerCase() === who) || (!x.owner && x.name.toLowerCase() === who)));
      if (!mine) return json(res, 400, { error: "You have no character in this combat. Fill in My character, or ask the GM." });
      if (url === "/api/combat/init") {
        if (mine.init !== null && c.phase === "fight") return json(res, 400, { error: "Initiative is already set." });
        const roll = die(20);
        mine.init = roll + (mine.initBonus || 0);
        addMsg(r, "roll", mine.name, `rolls initiative: [${roll}]${mine.initBonus ? (mine.initBonus > 0 ? " + " : " - ") + Math.abs(mine.initBonus) : ""} = **${mine.init}**`);
        if (c.phase === "fight") sortCombat(r);
      } else {
        mine.hp = clampInt(body.hp, 0, 999, mine.hp);
        if (body.maxHp !== undefined) mine.maxHp = clampInt(body.maxHp, 0, 999, mine.maxHp);
        if (mine.owner && r.chars && r.chars[mine.owner]) { r.chars[mine.owner].hp = mine.hp; r.chars[mine.owner].maxHp = mine.maxHp; }
      }
      combatBump(r);
      notify(r);
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
        else addMsg(r, ["roll", "sys"].includes(m.role) ? m.role : "player", str(m.who, 40) || "Player", text);
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
      if (body.full && typeof body.full === "object" && JSON.stringify(body.full).length < 150000) r.advFull = body.full;
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

    if (url === "/api/gm/adv") {
      return json(res, 200, { adv: r.advFull || null });
    }

    // ----- combat (GM) -----
    if (url === "/api/gm/combat/start") {
      await startCombat(r, body.tokens);
      notify(r);
      return json(res, 200, { ok: true, count: r.combat.list.length });
    }
    if (url === "/api/gm/combat/set") {
      const c = r.combat;
      const x = c && c.list.find((y) => y.id === str(body.id, 120));
      if (!x) return json(res, 400, { error: "That creature isn't in the combat." });
      if (body.hp !== undefined) x.hp = clampInt(body.hp, 0, 999, x.hp);
      if (body.maxHp !== undefined) x.maxHp = clampInt(body.maxHp, 0, 999, x.maxHp);
      if (body.init !== undefined) { x.init = body.init === "" || body.init === null ? null : clampInt(body.init, -10, 60, 0); if (c.phase === "fight") sortCombat(r); }
      if (x.owner && r.chars && r.chars[x.owner]) { r.chars[x.owner].hp = x.hp; r.chars[x.owner].maxHp = x.maxHp; }
      if (body.remove) { c.list = c.list.filter((y) => y !== x); if (c.turn >= c.list.length) c.turn = 0; }
      combatBump(r);
      notify(r);
      return json(res, 200, { ok: true });
    }
    if (url === "/api/gm/combat/hp") {
      const x = findCombatant(r, str(body.name, 60));
      if (!x) return json(res, 400, { error: `"${str(body.name, 60)}" isn't in the combat tracker (or the name matches several).` });
      const delta = clampInt(body.delta, -999, 999, 0);
      const top = x.maxHp > 0 ? x.maxHp : 999;
      x.hp = Math.max(0, Math.min(top, (x.hp || 0) + delta));
      if (x.owner && r.chars && r.chars[x.owner]) r.chars[x.owner].hp = x.hp;
      if (x.side !== "pc" && x.maxHp > 0 && x.hp <= 0) addMsg(r, "sys", "Table", `${x.name} is down.`);
      combatBump(r);
      notify(r);
      return json(res, 200, { ok: true, hp: x.hp });
    }
    if (url === "/api/gm/combat/end") {
      if (r.combat) {
        for (const x of r.combat.list) if (x.owner && r.chars && r.chars[x.owner]) r.chars[x.owner].hp = x.hp;
        r.combat = null;
        addMsg(r, "sys", "Table", "Combat is over.");
      }
      notify(r);
      return json(res, 200, { ok: true });
    }
    if (url === "/api/gm/combat/begin" || url === "/api/gm/combat/next") {
      const c = r.combat;
      if (!c) return json(res, 400, { error: "Start combat first." });
      if (r.busy) return json(res, 409, { error: "The DM is still thinking. Wait a moment." });
      const opts = { map: str(body.map, 5000), creatures: Array.isArray(body.creatures) ? body.creatures : [] };
      if (url.endsWith("/begin")) {
        if (c.phase === "fight") return json(res, 400, { error: "Combat has already begun. Use Next turn." });
        const auto = [];
        for (const x of c.list) if (x.init === null) { const roll = die(20); x.init = roll + (x.initBonus || 0); auto.push(`${x.name} ${x.init}`); }
        if (auto.length) addMsg(r, "sys", "Table", "Initiative rolled automatically for: " + auto.join(", ") + ".");
        c.phase = "fight"; c.round = 1; c.turn = 0;
        sortCombat(r); c.turn = 0;
        if (!alive(c.list[0])) stepTurn(r);
        addMsg(r, "sys", "Table", "Round 1. Turn order: " + c.list.map((x) => `${x.name} (${x.init})`).join(", ") + ".");
      } else {
        if (c.phase !== "fight") return json(res, 400, { error: "Press Begin round 1 first." });
        if (!stepTurn(r)) return json(res, 400, { error: "Nobody in the combat can act." });
      }
      combatBump(r);
      if (c.list[c.turn].side === "pc") addMsg(r, "sys", "Table", `Round ${c.round}: it's ${c.list[c.turn].name}'s turn.`);
      else await runMonsterTurns(r, opts);
      notify(r);
      return json(res, 200, { ok: true });
    }

    // ----- campaign (GM) -----
    if (url === "/api/gm/campaign") {
      return json(res, 200, { campaign: r.campaign || {}, chars: r.chars || {}, db: DB_ON, dbErr: r.dbErr || "" });
    }
    if (url === "/api/gm/campaign/save") {
      r.campaign = r.campaign || { recaps: [], session: 1 };
      if (body.world !== undefined) r.campaign.world = str(body.world, 3000);
      if (body.sessions !== undefined) r.campaign.sessions = clampInt(body.sessions, 1, 30, 6);
      if (body.bible !== undefined) r.campaign.bible = str(body.bible, 20000);
      if (body.session !== undefined) r.campaign.session = clampInt(body.session, 1, 99, 1);
      return json(res, 200, { ok: true, campaign: r.campaign });
    }
    if (url === "/api/gm/campaign/intro") {
      const text = str((r.campaign || {}).intro, 3000);
      if (!text) return json(res, 400, { error: "Build the campaign first." });
      addMsg(r, "dm", "DM", text);
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

    if (url === "/api/gm/campaign/build") {
      const camp = (r.campaign = r.campaign || { recaps: [], session: 1 });
      if (body.world !== undefined) camp.world = str(body.world, 3000);
      if (body.sessions !== undefined) camp.sessions = clampInt(body.sessions, 1, 30, 6);
      if (!camp.world) return json(res, 400, { error: "Describe your world idea first." });
      const party = partyText(r);
      const out = await geminiJson({
        model: PLAN_MODEL, maxTokens: 8192, system: CAMPAIGN_SYSTEM,
        contents: one(`Sessions planned: ${camp.sessions || 6}.\nGM's world idea, tone, lines and veils:\n${camp.world}\n\n` +
          (party ? `PLAYER CHARACTERS:\n${party}` : "No character cards yet: write general hooks the GM can adapt.")),
      });
      camp.bible = str(out.bible, 20000);
      camp.intro = str(out.intro, 3000);
      if (!camp.bible) throw new Error("The AI didn't write the campaign notes. Please try again.");
      return json(res, 200, { campaign: camp });
    }
    if (url === "/api/gm/campaign/end") {
      const camp = (r.campaign = r.campaign || { recaps: [], session: 1 });
      if (!r.msgs.length) return json(res, 400, { error: "The story is empty, so there is nothing to recap." });
      const n = camp.session || 1;
      const story = r.msgs.slice(-150).map((m) => (m.role === "dm" ? "DM: " : m.who + ": ") + String(m.text).slice(0, 400)).join("\n");
      const out = await geminiJson({
        model: PLAN_MODEL, maxTokens: 4096, system: RECAP_SYSTEM,
        contents: one(`This was session ${n}.\n\nSTORY LOG:\n${story}\n\n` + (camp.bible ? `CAMPAIGN NOTES:\n${trimMiddle(camp.bible, 3000, 1500)}\n\n` : "") +
          (r.brief ? `SESSION BRIEF:\n${r.brief.slice(0, 3000)}\n\n` : "") + (partyText(r) ? `PARTY:\n${partyText(r)}` : "")),
      });
      const recap = str(out.recap, 2500), notes = str(out.notes, 3000);
      if (!recap) throw new Error("The AI didn't write a recap. Please try again.");
      camp.recaps = [...(camp.recaps || []), { n, text: recap }].slice(-20);
      camp.bible = ((camp.bible || "") + `\n\nAFTER SESSION ${n}:\n${notes}`).trim().slice(-20000);
      camp.session = n + 1;
      addMsg(r, "dm", "DM", `**Session ${n} recap**\n${recap}`);
      return json(res, 200, { recap, notes, campaign: camp });
    }
    if (url === "/api/gm/campaign/prep") {
      const camp = r.campaign || {};
      const chars = Object.values(r.chars || {});
      const level = chars.length ? Math.round(chars.reduce((a, c) => a + (c.level || 1), 0) / chars.length) : clampInt(body.level, 1, 20, 3);
      const n = camp.session || 1;
      const text = await gemini({
        model: PLAN_MODEL, maxTokens: 6144,
        system: "You are an expert Dungeons & Dragons (2024, 5.5e) adventure designer. Write clear, usable GM notes in plain text with simple headings. No markdown symbols other than line breaks and dashes.",
        contents: one(
          `Design session ${n} of an ongoing campaign for ${chars.length || clampInt(body.players, 1, 12, 5)} players at level ${level}. ` +
          `Continue naturally from the notes and recaps, follow the campaign arc, and give at least one player character a personal moment from their hooks.\n` +
          (str(body.note, 400) ? `GM wishes for this session: ${str(body.note, 400)}\n` : "") +
          `It must be finishable in about 3 hours. Use these headings:\n` +
          `PREMISE AND HOOK\nSECRETS AND TWISTS (GM only)\nSCENES (3 or 4; for each: goal, challenge, NPCs, what the map needs)\n` +
          `MONSTERS (prefer official D&D 2024 monster names, e.g. "Goblin Warrior" rather than "Goblin"; name, CR, AC, HP, attacks with bonuses and damage, special traits)\nTREASURE\nENDINGS\n` +
          `Keep it under 900 words. Be concrete: names, numbers, DCs.\n\n` +
          (camp.bible ? `CAMPAIGN NOTES:\n${trimMiddle(camp.bible, 4000, 2500)}\n\n` : "") +
          ((camp.recaps || []).length ? `RECAPS:\n${camp.recaps.slice(-3).map((x) => `Session ${x.n}: ${x.text}`).join("\n")}\n\n` : "") +
          (partyText(r) ? `PARTY:\n${partyText(r)}` : "")
        ),
      });
      r.brief = str(text, 12000);
      return json(res, 200, { text: r.brief });
    }

    if (url === "/api/gm/build") {
      if (!r.brief) return json(res, 400, { error: "Save a session brief first. The map is built from it." });
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
    if (!res.headersSent) json(res, e.status || 500, { error: e.message });
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
}).listen(PORT, () => console.log("AI DM running on port " + PORT + (DB_ON ? " (saving to the database)" : " (no database: memory only)")));
```

### index.html

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Dungeon Master</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body { background: #1e2231; color: #e8e8f0; font: 14px system-ui, sans-serif; display: flex; flex-direction: column; }
  .msg { margin: 0 0 10px; white-space: pre-wrap; line-height: 1.4; }
  code { background: #2a3045; padding: 1px 4px; border-radius: 4px; }
  .you { color: #9db4ff; } .dm { color: #f1e3b0; } .sys { color: #ff9d9d; font-style: italic; }
  #story { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  #log { flex: 1; overflow-y: auto; padding: 10px; }
  #status { padding: 0 10px 4px; font-size: 12px; color: #aab; min-height: 16px; }
  .row { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #3a4057; align-items: center; flex-wrap: wrap; }
  .row.small { font-size: 12px; }
  textarea, input, select { background: #2a3045; color: inherit; border: 1px solid #3a4057; border-radius: 6px; padding: 6px; font: inherit; }
  textarea { flex: 1; height: 48px; resize: none; }
  input[type=text], input[type=password] { flex: 1; min-width: 70px; }
  input[type=number] { width: 54px; }
  button { background: #6b5bd6; color: #fff; border: 0; border-radius: 6px; padding: 0 12px; height: 34px; cursor: pointer; font: inherit; }
  #sayBtn, #askBtn { height: 48px; }
  #askBtn { background: #b8862b; }
  button.alt { background: #444b66; }
  button:disabled { opacity: .5; cursor: default; }
  #gm { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  #gmhead { padding: 8px 10px 0; border-bottom: 1px solid #3a4057; }
  #gmbody { flex: 1; overflow-y: auto; padding: 0 10px 12px; }
  #gmstatus { margin: 6px 0 8px; padding: 6px 8px; background: #2a3045; border-radius: 6px; font-size: 13px; line-height: 1.35; min-height: 18px; }
  #gmstatus.bad { background: #5a2a2f; color: #ffd4d4; }
  #gm h4 { margin: 14px 0 6px; color: #f1e3b0; }
  #gm details > .line:first-of-type { margin-top: 0; }
  #gm .hint { font-size: 12px; color: #aab; margin: 2px 0 6px; }
  #gm .line { display: flex; gap: 6px; margin: 4px 0; flex-wrap: wrap; align-items: center; }
  #brief { width: 100%; height: 150px; box-sizing: border-box; resize: vertical; }
  #legend { font-size: 12px; color: #c7c9d9; white-space: pre-wrap; margin-top: 6px; }
  .move { display: flex; gap: 6px; align-items: center; margin: 4px 0; font-size: 13px; }
  .move span { flex: 1; }
  #actions { margin: 0 10px 6px; padding: 8px; background: #2a3045; border: 1px solid #b8862b; border-radius: 8px; font-size: 13px; }
  #actions .arow { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
  #actions .arow span { flex: 1; }
  #actions button { height: 28px; font-size: 12px; }
  #rooms .rrow { display: flex; gap: 6px; align-items: center; margin: 3px 0; font-size: 13px; }
  #rooms .rrow span { flex: 1; }
  #rooms button { height: 26px; font-size: 12px; }
  #stats { white-space: pre-wrap; font: 12px/1.4 system-ui, sans-serif; color: #d9dbe8; background: #2a3045; border-radius: 6px; padding: 0 8px; margin: 6px 0; max-height: 320px; overflow-y: auto; }
  #stats:not(:empty) { padding: 8px; }
  .roll { color: #b8f2c7; } .table { color: #aab0c8; font-style: italic; font-size: 13px; }
  #combat { margin: 0 10px 6px; padding: 6px 8px; background: #262b3d; border: 1px solid #c0392b; border-radius: 8px; font-size: 13px; }
  #combat .chead { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
  #combat .chead b { flex: 1; color: #ffb3a8; }
  #combat button { height: 26px; font-size: 12px; padding: 0 8px; }
  #clist { max-height: 150px; overflow-y: auto; }
  .crow { display: flex; gap: 6px; align-items: center; padding: 2px 4px; border-radius: 4px; }
  .crow.now { background: #4a3a1e; }
  .crow.down { opacity: .5; text-decoration: line-through; }
  .crow .cn { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .crow .ci { width: 26px; text-align: right; color: #f1e3b0; }
  .crow input { width: 44px; padding: 2px 4px; }
  .pc { color: #9db4ff; } .enemy { color: #ff9d9d; } .npc { color: #e6c86e; } .ally { color: #8fd0ff; }
  #dice { flex: 1; min-width: 90px; }
  .row.small button { height: 28px; font-size: 12px; padding: 0 8px; }
  #charScreen { flex: 1; overflow-y: auto; padding: 10px; }
  #charScreen label { display: block; font-size: 12px; color: #aab; margin: 8px 0 2px; }
  #charScreen input, #charScreen textarea { width: 100%; box-sizing: border-box; }
  #charScreen textarea { height: 110px; resize: vertical; }
  #charScreen .two { display: flex; gap: 8px; } #charScreen .two > div { flex: 1; }
  #gm details { border-top: 1px solid #3a4057; padding: 4px 0; }
  #gm summary { cursor: pointer; padding: 8px 0 4px; color: #f1e3b0; font-weight: 600; }
  #world, #bible { width: 100%; box-sizing: border-box; resize: vertical; }
  #world { height: 80px; } #bible { height: 160px; }
  #party, #intro { font-size: 12px; color: #c7c9d9; white-space: pre-wrap; margin: 4px 0; }
  [hidden] { display: none !important; }
</style>
</head>
<body>

<div id="story">
  <div id="log"><div class="msg dm">Welcome, adventurers. Each player: type what your character does and press Say. When everyone has spoken, one person presses Ask DM.</div></div>
  <div id="status"></div>
  <div id="actions" hidden></div>
  <div id="combat" hidden>
    <div class="chead"><b id="ctitle">Combat</b>
      <button id="cInit" hidden>Roll initiative</button>
      <button id="cBegin" hidden>Begin round 1</button>
      <button id="cNext" hidden>Next turn</button></div>
    <div id="clist"></div>
  </div>
  <div class="row small">
    <input id="dice" type="text" placeholder="Roll: 1d20+5 attack">
    <button id="rollBtn">Roll</button>
    <button class="alt" data-roll="1d20">d20</button>
    <button class="alt" data-roll="adv" title="Advantage: roll 2d20, keep the higher">Adv</button>
    <button class="alt" data-roll="dis" title="Disadvantage: roll 2d20, keep the lower">Dis</button>
  </div>
  <div class="row small">
    <label><input type="checkbox" id="useMap" checked> send map</label>
    <label><input type="checkbox" id="followCam" checked> follow DM camera</label>
    <button id="charToggle" class="alt">My character</button>
    <button id="gmToggle" class="alt" hidden>GM tools</button>
  </div>
  <div class="row">
    <textarea id="input" placeholder="What does your character do?"></textarea>
    <button id="sayBtn">Say</button>
    <button id="askBtn">Ask DM</button>
  </div>
</div>

<div id="charScreen" hidden>
  <div class="line"><button id="charBack" class="alt">Back to story</button></div>
  <h4 style="color:#f1e3b0;margin:10px 0 4px">My character</h4>
  <div style="font-size:12px;color:#aab">Your GM and the AI DM use this card. Max HP and AC also go into the combat tracker.</div>
  <label for="cName">Character name</label><input id="cName" type="text" maxlength="40">
  <div class="two"><div><label for="cSpecies">Species</label><input id="cSpecies" type="text" maxlength="30" placeholder="e.g. Elf"></div>
    <div><label for="cCls">Class</label><input id="cCls" type="text" maxlength="40" placeholder="e.g. Wizard"></div></div>
  <div class="two"><div><label for="cLevel">Level</label><input id="cLevel" type="number" min="1" max="20" value="1"></div>
    <div><label for="cMaxHp">Max HP</label><input id="cMaxHp" type="number" min="0" max="999"></div>
    <div><label for="cAc">AC</label><input id="cAc" type="number" min="0" max="40"></div>
    <div><label for="cInitB">Initiative bonus</label><input id="cInitB" type="number" min="-5" max="20" value="0"></div></div>
  <label for="cStory">Backstory and goals (a few lines)</label>
  <textarea id="cStory" maxlength="1200" placeholder="Where you come from, what you want, who you're looking for..."></textarea>
  <div class="line" style="margin-top:8px"><button id="charSave">Save character</button></div>
  <div id="charStatus" style="font-size:12px;color:#aab;margin-top:6px"></div>
</div>

<div id="gm" hidden>
 <div id="gmhead">
  <div class="line"><button id="gmBack" class="alt">Back to story</button></div>
  <div class="line"><label for="gmcode">GM code</label><input id="gmcode" type="password"><button id="gmUnlock">Unlock</button></div>
  <div class="line"><label for="code">Player access code</label><input id="code" type="password" title="Shared automatically with every player in this room"></div>
  <div id="gmstatus">Enter your GM code and press Unlock.</div>
 </div>
 <div id="gmbody">

  <details id="campSec">
  <summary>Campaign (session zero)</summary>
  <div class="hint">1. Each player opens <b>My character</b> on the story screen and fills in their card. 2. Describe your world here and press Build campaign. 3. Play sessions. 4. At the end of each session press End session: the AI writes a recap and drafts the next session's brief.</div>
  <div class="line"><button id="partyBtn" class="alt">Refresh party</button></div>
  <div id="party">No character cards yet.</div>
  <div class="line">Sessions planned <input type="number" id="cSessions" value="6" min="1" max="30"></div>
  <textarea id="world" placeholder="Your world idea: setting, tone, themes, and lines and veils (things to avoid or keep off-screen)."></textarea>
  <div class="line"><button id="campBuild">Build campaign</button><button id="campSave" class="alt">Save notes</button></div>
  <textarea id="bible" placeholder="Secret campaign notes appear here. Edit freely, then press Save notes."></textarea>
  <div id="intro"></div>
  <div class="line"><button id="introBtn" class="alt" hidden>Post intro to story</button><button id="recapBtn" class="alt" hidden>Post last recap to story</button></div>
  <div class="line">Next: session <span id="sessNo">1</span> <input type="text" id="prepNote" placeholder="Wishes for the next session (optional)"></div>
  <div class="line"><button id="endSess">End session: recap + prep next</button><button id="prepOnly" class="alt">Prep next session only</button></div>
  </details>

  <details id="briefSec" open>
  <summary>Session brief (secret)</summary>
  <div class="hint">Only you see this. The AI uses it as secret notes and never shows it to players directly.</div>
  <div class="line">
    Level <input type="number" id="lvl" value="3" min="1" max="20">
    Players <input type="number" id="plr" value="5" min="1" max="12">
    <input type="text" id="theme" placeholder="Theme / tone (e.g. spooky swamp mystery)">
  </div>
  <div class="line"><button id="draft">Draft one-shot</button><button id="saveBrief" class="alt">Save brief</button></div>
  <textarea id="brief" placeholder="Paste or write your secret notes here, or draft a one-shot above. Edit freely, then press Save brief."></textarea>

  </details>

  <details open>
  <summary>Build the map and monsters</summary>
  <div class="hint">Reads your saved brief, draws the whole adventure as one connected map, then places every monster and NPC from the brief in its room. Save the brief first. Pressing again replaces the previous generated map and creatures.</div>
  <div class="line"><input type="text" id="notes" placeholder="Optional extra instructions (e.g. make it a ruined swamp temple)"></div>
  <div class="line">Cols <input type="number" id="cols" value="60" min="20" max="60"> Rows <input type="number" id="rows" value="40" min="15" max="45"><button id="build">Build map + monsters</button></div>
  <div class="line"><label><input type="checkbox" id="hideRooms" checked> Hide unexplored rooms until revealed</label></div>
  <div class="line"><label><input type="checkbox" id="artOn" checked> Paint floor art inside revealed rooms (free image service)</label><button id="addArt" class="alt">Add art to current map</button></div>
  <div id="legend"></div>
  <div id="rooms"></div>

  </details>

  <details id="combatSec">
  <summary>Combat</summary>
  <div class="hint">Start combat puts everyone into the turn order: player characters from their cards (or their tokens) and every monster, NPC and ally on the map, with official HP and AC. Players press Roll initiative on the story screen (anyone who hasn't is rolled for automatically when you press Begin). Next turn moves on; when it reaches the monsters, the AI runs all of them in one go (one AI request) and proposes moves and damage for you to approve.</div>
  <div class="line"><button id="cStart">Start combat</button><button id="cBegin2" class="alt">Begin round 1</button><button id="cNext2" class="alt">Next turn</button><button id="cEnd" class="alt">End combat</button></div>
  </details>

  <details>
  <summary>Add one more creature</summary>
  <div class="hint">For anything the brief missed. Tokens made here can also be moved by the AI's suggestions. Col and Row are grid cells.</div>
  <div class="line"><input type="text" id="tname" placeholder="Name (e.g. Goblin)"> Count <input type="number" id="tcount" value="1" min="1" max="12"></div>
  <div class="line">Col <input type="number" id="tcol" value="5" min="0"> Row <input type="number" id="trow" value="5" min="0">
    <select id="tside"><option value="enemy">Enemy</option><option value="npc">NPC</option><option value="ally">Ally</option></select>
    <button id="spawn">Spawn</button></div>

  </details>

  <details>
  <summary>Enemy moves</summary>
  <div class="hint">The AI suggests where enemies and NPCs should go. Nothing moves until you press Apply.</div>
  <div class="line"><input type="text" id="situation" placeholder="Optional note (e.g. goblins are scared of fire)"></div>
  <div class="line"><button id="suggest">Suggest moves</button><button id="applyAll" class="alt" hidden>Apply all</button></div>
  <div id="moves"></div>

  </details>

  <details>
  <summary>Monster stat blocks (only you see these)</summary>
  <div class="hint">The DM automatically gets the official stats for monsters on the map and in your built adventure. This shows what it gets. 2024 rules first, 2014 if a monster isn't in the 2024 rules yet.</div>
  <div class="line"><button id="statsBtn" class="alt">Show stat blocks</button></div>
  <pre id="stats"></pre>
  <div class="hint">Stat data from the D&amp;D System Reference Documents 5.1 and 5.2 by Wizards of the Coast LLC (CC BY 4.0, dndbeyond.com/srd), via the free Open5e API.</div>

  </details>

  <details>
  <summary>Housekeeping</summary>
  <div class="line"><button id="clearBtn" class="alt">Clear story</button></div>
  </details>
</div>
</div>

<script type="module">
import OBR, { buildShape, buildLabel, buildLight, buildImage } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";

const $ = (id) => document.getElementById(id);
const log = $("log"), input = $("input"), codeEl = $("code"), useMap = $("useMap");
const sayBtn = $("sayBtn"), askBtn = $("askBtn"), status = $("status");

const GEN = "com.aidm/generated";
const SIDE = "com.aidm/side";
const AUTO = "com.aidm/auto";
const FOR = "com.aidm/for";
const STORY = "com.aidm/story";
const CAM = "com.aidm/camera";
const LIGHT = "com.aidm/light";
const ACCESS = "com.aidm/access";
const MASK = "com.aidm/mask";
const OFF = 0.05; // token inset, as a fraction of a cell

let last = 0, roomId = "test-room", myName = "Player", lastErr = "", inflight = false, serverBusy = false, askBusy = false;
let dpiCache = 0, pendingMoves = [], tokenNames = {};
let isGmRole = false, msgCache = [], saveTimer = null, restoring = false, epoch = null;
const lights = {};

const ready = OBR.isAvailable ? new Promise((r) => OBR.onReady(r)) : Promise.resolve();

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
}
codeEl.value = store("dmcode") || "";
$("gmcode").value = store("gmcode") || "";
codeEl.addEventListener("change", () => { store("dmcode", codeEl.value); shareCode(); openStream(); fetchLog(); });

// The GM's panel puts the player access code into the room's shared data, so players never type it.
async function shareCode() {
  if (!isGmRole || !OBR.isAvailable || !codeEl.value) return;
  try {
    await ready;
    const meta = await OBR.room.getMetadata();
    if (meta[ACCESS] !== codeEl.value) await OBR.room.setMetadata({ [ACCESS]: codeEl.value });
  } catch (e) { console.error("share code", e); }
}

// Minimal, safe markdown: HTML is escaped first, then bold, italic, code, headings and bullets are added.
function md(t) {
  const esc = String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/^#{1,6}\s*(.+)$/gm, "<strong>$1</strong>")
    .replace(/^\s*[-*]\s+/gm, "\u2022 ")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function add(cls, text) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  if (cls === "dm" || cls === "roll") d.innerHTML = md(text); else d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

async function api(path, body, gm) {
  const headers = { "Content-Type": "application/json", "X-Access-Code": codeEl.value };
  if (gm) headers["X-GM-Code"] = $("gmcode").value;
  const opts = { headers };
  if (body) { opts.method = "POST"; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Error " + r.status);
  return d;
}

/* ---------- shared story ---------- */
function refreshUi() {
  const thinking = serverBusy || askBusy;
  askBtn.disabled = thinking;
  status.textContent = thinking ? "The DM is thinking..." : "";
}

function trimStory(msgs) {
  const out = [];
  let size = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = { r: msgs[i].r, w: msgs[i].w, t: String(msgs[i].t).slice(0, 800) };
    const n = JSON.stringify(m).length + 1;
    if (size + n > 8000) break;
    size += n;
    out.unshift(m);
  }
  return out;
}

function scheduleSave() {
  if (!isGmRole || !OBR.isAvailable || saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try { await OBR.room.setMetadata({ [STORY]: { e: epoch || "", m: trimStory(msgCache) } }); } catch (e) {}
  }, 3000);
}

async function tryRestore() {
  if (restoring || !OBR.isAvailable) return;
  restoring = true;
  try {
    await ready;
    const saved = (await OBR.room.getMetadata())[STORY];
    // Saved as { e: story ID, m: messages }; very old versions saved a plain list.
    const list = Array.isArray(saved) ? saved : (saved && Array.isArray(saved.m) ? saved.m : []);
    const e = saved && !Array.isArray(saved) ? String(saved.e || "") : "";
    if (list.length) {
      await api("/api/restore", {
        room: roomId, epoch: e,
        msgs: list.map((m) => ({ role: { d: "dm", r: "roll", s: "sys" }[m.r] || "player", who: m.w, text: m.t })),
      });
      setTimeout(fetchLog, 300);
    }
  } catch (e) {} finally { restoring = false; }
}

let again = false;
async function fetchLog() {
  if (inflight) { again = true; return; }
  inflight = true;
  try {
    const d = await api(`/api/log?room=${encodeURIComponent(roomId)}&since=${last}`, null, isGmRole && !!$("gmcode").value);
    const newStory = epoch !== null && (d.epoch || "") !== epoch;
    epoch = d.epoch || "";
    if (newStory || d.latest < last) {
      // The GM cleared the story: wipe the screen and fetch again from the start.
      log.innerHTML = ""; last = 0; msgCache = [];
      again = true;
    } else {
      for (const m of d.msgs) {
        last = m.id;
        if (m.role === "dm") add("dm", m.text);
        else if (m.role === "roll") add("roll", `\u{1F3B2} ${m.who} ${m.text}`);
        else if (m.role === "sys") add("table", m.text);
        else add("you", `${m.who}: ${m.text}`);
        msgCache.push({ r: { dm: "d", roll: "r", sys: "s" }[m.role] || "p", w: m.who, t: m.text });
      }
      if (d.msgs.length) scheduleSave();
    }
    serverBusy = d.busy;
    lastErr = "";
    renderCombat(d.combat || null);
    if (d.latest === 0) tryRestore();
    if (isGmRole && Array.isArray(d.actions)) handleActions(d.actions);
  } catch (e) {
    let msg = e.message;
    if (/access code/i.test(msg)) msg = isGmRole
      ? "Enter the player access code in GM tools (it is shared with your players automatically)."
      : "Waiting for the GM: the GM needs to open this panel so the access code is shared with you.";
    if (msg !== lastErr) { add("sys", msg); lastErr = msg; }
  } finally {
    inflight = false;
    refreshUi();
    if (again) { again = false; setTimeout(fetchLog, 50); }
  }
}

/* ---------- live updates (with polling as a backup) ---------- */
let streamOk = false, streamCtrl = null, lastStreamData = 0, streamRetry = null;
async function openStream() {
  if (streamCtrl) streamCtrl.abort();
  clearTimeout(streamRetry);
  const ctrl = new AbortController();
  streamCtrl = ctrl;
  try {
    const r = await fetch(`/api/stream?room=${encodeURIComponent(roomId)}`, {
      headers: { "X-Access-Code": codeEl.value }, signal: ctrl.signal, cache: "no-store",
    });
    if (!r.ok || !r.body) throw new Error("no stream");
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    streamOk = true; lastStreamData = Date.now();
    fetchLog();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      lastStreamData = Date.now();
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (/^data:/m.test(ev)) fetchLog();
      }
    }
  } catch (e) {}
  if (streamCtrl === ctrl) {
    streamOk = false; streamCtrl = null;
    streamRetry = setTimeout(openStream, 5000);
  }
}
let tick = 0;
function poll() {
  tick++;
  // If the stream went quiet (no heartbeat for 45 s), treat it as broken and reconnect.
  if (streamOk && Date.now() - lastStreamData > 45000) { streamOk = false; openStream(); }
  if (!streamOk || tick % 5 === 0) fetchLog(); // every 3 s without a stream, every 15 s with one
}

/* ---------- map helpers ---------- */
async function getDpi() {
  if (dpiCache) return dpiCache;
  let dpi = 150;
  try { if (OBR.isAvailable) { await ready; dpi = (await OBR.scene.grid.getDpi()) || 150; } } catch (e) {}
  dpiCache = dpi;
  return dpi;
}

async function readTokens() {
  if (!OBR.isAvailable) return [];
  await ready;
  if (!(await OBR.scene.isReady())) return [];
  const dpi = await getDpi();
  const items = await OBR.scene.items.getItems(
    (i) => (i.layer === "CHARACTER" || i.layer === "MOUNT") && (i.type === "IMAGE" || i.type === "SHAPE")
  );
  return items.map((i) => ({
    id: i.id,
    name: i.name || "Unnamed",
    side: (i.metadata && i.metadata[SIDE]) || "pc",
    col: Math.floor(i.position.x / dpi),
    row: Math.floor(i.position.y / dpi),
  }));
}

function savedMap() {
  try { return JSON.parse(store("map-" + roomId) || "null"); } catch (e) { return null; }
}
function layoutText(m) {
  if (!m || !Array.isArray(m.areas)) return "";
  return `Map "${m.title}" ${m.cols}x${m.rows} cells. Walkable areas: ` +
    m.areas.map((a) => `${a.name} (${a.kind}) x${a.x}-${a.x + a.w - 1}, y${a.y}-${a.y + a.h - 1}`).join("; ") +
    ". Features: " + (m.features || []).map((f) => `${f.name} (${f.kind}) at x${f.x}-${f.x + f.w - 1}, y${f.y}-${f.y + f.h - 1}`).join("; ");
}

async function mapContext() {
  try {
    const tokens = await readTokens();
    let extra = "";
    try { await ready; extra += `Fog: ${(await OBR.scene.fog.getFilled()) ? "on (whole scene covered)" : "off"}\n`; } catch (e) {}
    const lit = tokens.filter((t) => lights[t.id]).map((t) => t.name);
    if (lit.length) extra += `Lit tokens: ${lit.join(", ")}\n`;
    const lines = tokens.map((t) => `${t.name}${t.side !== "pc" ? " [" + t.side + "]" : " [player]"} at cell (${t.col}, ${t.row})`);
    return extra + lines.join("\n");
  } catch (e) { return ""; }
}

/* ---------- player actions ---------- */
async function say() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  try {
    await api("/api/say", { room: roomId, who: myName, text });
    await fetchLog();
  } catch (e) { add("sys", "Problem: " + e.message); input.value = text; }
}

async function askDm() {
  askBusy = true; refreshUi();
  try {
    const map = useMap.checked ? await mapContext() : "";
    let creatures = [];
    try { creatures = (await readTokens()).filter((t) => t.side !== "pc").map((t) => t.name); } catch (e) {}
    await api("/api/dm", { room: roomId, map, creatures });
  } catch (e) { add("sys", "Problem: " + e.message); }
  askBusy = false;
  await fetchLog();
}

sayBtn.addEventListener("click", say);
askBtn.addEventListener("click", askDm);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); say(); }
});

/* ---------- GM tools ---------- */
const gmStatus = (t) => { const el = $("gmstatus"); el.textContent = t; el.classList.toggle("bad", /^Problem/.test(t)); };
function busyBtn(btn, label, fn) {
  btn.addEventListener("click", async () => {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { await fn(); } catch (e) { console.error(e); gmStatus("Problem: " + e.message); }
    btn.disabled = false; btn.textContent = old;
  });
}

$("gmToggle").addEventListener("click", () => showScreen("gm"));
$("gmBack").addEventListener("click", () => showScreen("story"));

busyBtn($("gmUnlock"), "Checking...", async () => {
  store("gmcode", $("gmcode").value);
  const d = await api(`/api/gm/brief?room=${encodeURIComponent(roomId)}`, null, true);
  const local = store("brief-" + roomId) || "";
  if (!d.brief && local) {
    await api("/api/gm/brief", { room: roomId, brief: local }, true);
    $("brief").value = local;
    gmStatus("Unlocked. Your saved brief was restored to the server.");
  } else {
    $("brief").value = d.brief || "";
    gmStatus("Unlocked.");
  }
  try {
    const srv = (await api("/api/gm/adv", { room: roomId }, true)).adv;
    if (srv && srv.spec) { advSet(srv); store("map-" + roomId, JSON.stringify(srv.spec)); } // the server's copy wins (it may come from another device)
  } catch (e) {}
  const m = savedMap();
  if (m) $("legend").textContent = layoutText(m);
  if (advGet()) { renderRooms(); try { await syncAdv(); } catch (e) {} }
  try { await loadCampaign(); } catch (e) {}
  const el = $("gmstatus");
  el.textContent += d.db ? (d.dbErr ? " Warning: the last save to the database failed (" + d.dbErr + ")." : " Your game is saved to the database.")
    : " No database is set up, so the game lives in memory until the server restarts.";
});

busyBtn($("draft"), "Drafting...", async () => {
  const d = await api("/api/gm/oneshot", {
    room: roomId, level: +$("lvl").value, players: +$("plr").value, theme: $("theme").value,
  }, true);
  $("brief").value = d.text;
  gmStatus("Draft ready. Read it, edit it, then press Save brief.");
});

busyBtn($("saveBrief"), "Saving...", async () => {
  const text = $("brief").value;
  store("brief-" + roomId, text);
  const d = await api("/api/gm/brief", { room: roomId, brief: text }, true);
  gmStatus(`Brief saved (${d.length} characters). The DM will use it from the next Ask DM.`);
});

const FLOOR = { room: "#3a3f55", corridor: "#4a4f66", outdoor: "#3f5a3a", water: "#2f5d8a" };
const THING = { pillar: "#8a8a99", door: "#a8742f", table: "#7a5a3a", statue: "#9a9aa8", water: "#3d78b5", hazard: "#b5483d", stairs: "#b9b9c9", tree: "#2f7a3a", chest: "#d4a72c", altar: "#8d5bb5" };

async function clearGenerated() {
  const old = await OBR.scene.items.getItems(
    (i) => i.metadata && (i.metadata[GEN] === true || i.metadata[AUTO] === true)
  );
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
}

function mapRect(dpi, x, y, w, h, fill, stroke, name, z, op) {
  return buildShape().width(w * dpi).height(h * dpi).shapeType("RECTANGLE")
    .position({ x: x * dpi, y: y * dpi }).fillColor(fill).fillOpacity(op === undefined ? 1 : op)
    .strokeColor(stroke).strokeWidth(2).layer("MAP").name(name).zIndex(z).locked(true)
    .metadata({ [GEN]: true }).build();
}

const imageSize = (url) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok({ width: i.naturalWidth, height: i.naturalHeight });
  i.onerror = () => bad(new Error("The art picture could not be loaded."));
  i.src = url;
});

// Lines the art up exactly with the dark background rectangle, whatever Owlbear's position rules are.
async function alignArt(artId, bgId) {
  const fit = async () => {
    const [bg, art] = [await OBR.scene.items.getItemBounds([bgId]), await OBR.scene.items.getItemBounds([artId])];
    return { bg, art };
  };
  let { bg, art } = await fit();
  if (art.width > 0 && art.height > 0 && (Math.abs(art.width - bg.width) > 1 || Math.abs(art.height - bg.height) > 1)) {
    const fx = bg.width / art.width, fy = bg.height / art.height;
    await OBR.scene.items.updateItems([artId], (items) => {
      for (const it of items) it.scale = { x: it.scale.x * fx, y: it.scale.y * fy };
    });
    ({ bg, art } = await fit());
  }
  const dx = bg.min.x - art.min.x, dy = bg.min.y - art.min.y;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)
    await OBR.scene.items.updateItems([artId], (items) => {
      for (const it of items) it.position = { x: it.position.x + dx, y: it.position.y + dy };
    });
}

// Background (and optional painted art with a dark shade over it). Returns true if the art was used.
async function drawBase(spec, art) {
  const dpi = await getDpi();
  const bg = mapRect(dpi, 0, 0, spec.cols, spec.rows, "#15171f", "#15171f", spec.title, 0);
  const items = [bg];
  let artItem = null;
  if (art && art.url) {
    try {
      const { width, height } = await imageSize(art.url);
      // The picture's own grid is set so its width covers exactly "cols" cells; then it is stretched to "rows" cells tall.
      artItem = buildImage({ url: art.url, width, height, mime: art.mime || "image/jpeg" }, { dpi: width / spec.cols, offset: { x: 0, y: 0 } })
        .layer("MAP").scale({ x: 1, y: (spec.rows * width) / (spec.cols * height) }).position({ x: 0, y: 0 })
        .zIndex(1).locked(true).name("Map art").metadata({ [GEN]: true }).build();
      items.push(artItem);
    } catch (e) { console.error(e); artItem = null; }
  }
  await OBR.scene.items.addItems(items);
  if (artItem) { try { await alignArt(artItem.id, bg.id); } catch (e) { console.error("align", e); } }
  try {
    await OBR.viewport.animateToBounds({ min: { x: 0, y: 0 }, max: { x: spec.cols * dpi, y: spec.rows * dpi }, width: spec.cols * dpi, height: spec.rows * dpi, center: { x: spec.cols * dpi / 2, y: spec.rows * dpi / 2 } });
  } catch (e) {}
  return !!artItem;
}

function areaItems(dpi, spec, a, artOn) {
  const items = [mapRect(dpi, a.x, a.y, a.w, a.h, FLOOR[a.kind] || FLOOR.room, "#6b7090", a.name, 3, artOn ? 0.3 : 1)];
  for (const f of spec.features.filter((x) => featureOwner(spec, x) === a.name))
    items.push(mapRect(dpi, f.x, f.y, f.w, f.h, THING[f.kind] || "#8a8a99", "#222", f.name, 4, 1));
  return items;
}

async function getArt(spec) {
  const d = await api("/api/gm/art", { room: roomId, art: spec.art, cols: spec.cols, rows: spec.rows }, true);
  return { url: location.origin + d.url, mime: d.mime || "image/jpeg" };
}

/* ---- adventure state: map, creatures per room, which rooms are revealed (kept on this device) ---- */
const advKey = () => "adv-" + roomId;
function advGet() { try { return JSON.parse(store(advKey()) || "null"); } catch (e) { return null; } }
function advSet(a) { store(advKey(), JSON.stringify(a)); }
const touches = (c, a) => c.x < a.x + a.w + 1 && c.x + c.w > a.x - 1 && c.y < a.y + a.h + 1 && c.y + c.h > a.y - 1;
function featureOwner(spec, f) {
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  const inside = spec.areas.find((a) => cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h);
  if (inside) return inside.name;
  let best = spec.areas[0], bd = Infinity;
  for (const a of spec.areas) {
    const d = Math.hypot(cx - (a.x + a.w / 2), cy - (a.y + a.h / 2));
    if (d < bd) { bd = d; best = a; }
  }
  return best.name;
}

async function syncAdv() {
  const adv = advGet();
  if (!adv) return;
  const creatures = [...new Set((adv.tokens || []).map((t) => String(t.name).replace(/\s+\d+$/, "")))];
  await api("/api/gm/state", { room: roomId, layout: layoutText(adv.spec), areas: adv.spec.areas.map((a) => a.name), revealed: adv.revealed, creatures, full: adv }, true);
}

// Covers every cell that is NOT a revealed area with solid "rock", so the painted art only shows inside revealed rooms.
// Rows of uncovered cells are merged into as few rectangles as possible.
async function updateMask() {
  const adv = advGet();
  if (!adv || !OBR.isAvailable) return;
  await ready;
  const old = await OBR.scene.items.getItems((i) => i.metadata && i.metadata[MASK] === true);
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
  if (!adv.art) return; // no art: the dark background already hides everything
  const { cols, rows } = adv.spec;
  const open = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const a of adv.spec.areas.filter((x) => adv.revealed.includes(x.name)))
    for (let y = a.y; y < Math.min(rows, a.y + a.h); y++)
      for (let x = a.x; x < Math.min(cols, a.x + a.w); x++) open[y][x] = true;
  const rects = [], active = {};
  for (let y = 0; y <= rows; y++) {
    const runs = {};
    if (y < rows) {
      let x = 0;
      while (x < cols) {
        if (open[y][x]) { x++; continue; }
        const x0 = x;
        while (x < cols && !open[y][x]) x++;
        runs[x0 + ":" + x] = true;
      }
    }
    for (const k of Object.keys(active)) if (!runs[k]) { rects.push(active[k]); delete active[k]; }
    for (const k of Object.keys(runs)) {
      if (active[k]) active[k].h++;
      else { const [x0, x1] = k.split(":").map(Number); active[k] = { x: x0, y, w: x1 - x0, h: 1 }; }
    }
  }
  const dpi = await getDpi();
  const items = rects.map((r) => {
    const it = mapRect(dpi, r.x, r.y, r.w, r.h, "#15171f", "#15171f", "Rock", 2, 1);
    it.metadata[MASK] = true;
    it.disableHit = true;
    return it;
  });
  for (let i = 0; i < items.length; i += 100) await OBR.scene.items.addItems(items.slice(i, i + 100));
}

// Draws a room (plus corridors touching it) and spawns the creatures that belong in it. Returns false if already visible.
async function revealArea(name, quiet) {
  const adv = advGet();
  if (!adv) throw new Error("There is no generated map yet. Press Build map + monsters first.");
  await ready;
  const low = (s) => String(s).toLowerCase();
  const spec = adv.spec;
  const target = spec.areas.find((a) => low(a.name) === low(name)) ||
    spec.areas.find((a) => low(a.name).includes(low(name)) || low(name).includes(low(a.name)));
  if (!target) throw new Error(`There is no area named "${name}".`);
  const group = [target, ...(target.kind !== "corridor" ? spec.areas.filter((c) => c.kind === "corridor" && touches(c, target)) : [])]
    .filter((a) => !adv.revealed.includes(a.name));
  if (!group.length) return false;
  const dpi = await getDpi();
  const items = [], spawns = [];
  for (const a of group) {
    items.push(...areaItems(dpi, spec, a, !!adv.art));
    spawns.push(...adv.tokens.filter((t) => t.area === a.name));
    adv.revealed.push(a.name);
  }
  await OBR.scene.items.addItems(items);
  await spawnTokens(spawns, true);
  advSet(adv);
  if (!quiet) { try { await updateMask(); } catch (e) { console.error("mask", e); } try { await syncAdv(); } catch (e) {} renderRooms(); }
  return true;
}

function renderRooms() {
  const box = $("rooms");
  box.innerHTML = "";
  const adv = advGet();
  if (!adv) return;
  const title = document.createElement("div");
  title.textContent = "Rooms";
  title.style.cssText = "margin-top:8px;color:#f1e3b0";
  box.appendChild(title);
  adv.spec.areas.filter((a) => a.kind !== "corridor").forEach((a) => {
    const row = document.createElement("div");
    row.className = "rrow";
    const span = document.createElement("span");
    const seen = adv.revealed.includes(a.name);
    span.textContent = (seen ? "\u2713 " : "\u25CB ") + a.name;
    row.appendChild(span);
    if (!seen) {
      const b = document.createElement("button");
      b.textContent = "Reveal";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try { await revealArea(a.name); gmStatus(`Revealed ${a.name}.`); } catch (e) { gmStatus("Problem: " + e.message); b.disabled = false; }
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  });
  if (adv.spec.areas.some((a) => a.kind !== "corridor" && !adv.revealed.includes(a.name))) {
    const all = document.createElement("button");
    all.textContent = "Reveal all rooms";
    all.className = "alt";
    all.addEventListener("click", async () => {
      all.disabled = true;
      try {
        for (const a of adv.spec.areas) await revealArea(a.name, true);
        try { await updateMask(); } catch (e) {}
        try { await syncAdv(); } catch (e) {}
        renderRooms(); gmStatus("Everything is revealed.");
      } catch (e) { gmStatus("Problem: " + e.message); all.disabled = false; }
    });
    box.appendChild(all);
  }
}

async function spawnTokens(list, auto) {
  const dpi = await getDpi();
  const colors = { enemy: "#c0392b", npc: "#d4a72c", ally: "#2e86c1" };
  const items = [];
  for (const t of list) {
    const meta = { [SIDE]: t.side };
    if (auto) meta[AUTO] = true;
    const shape = buildShape().width(dpi * (1 - 2 * OFF)).height(dpi * (1 - 2 * OFF)).shapeType("RECTANGLE")
      .position({ x: (t.col + OFF) * dpi, y: (t.row + OFF) * dpi }).fillColor(colors[t.side] || colors.enemy)
      .fillOpacity(0.9).strokeColor("#ffffff").strokeWidth(3).layer("CHARACTER").name(t.name)
      .metadata(meta).build();
    const tag = buildLabel().plainText(t.name).position({ x: (t.col + 0.5) * dpi, y: t.row * dpi })
      .attachedTo(shape.id).pointerDirection("DOWN").metadata(auto ? { [AUTO]: true, [FOR]: shape.id } : { [FOR]: shape.id }).build();
    items.push(shape, tag);
  }
  if (items.length) await OBR.scene.items.addItems(items);
}

busyBtn($("build"), "Building...", async () => {
  if (!OBR.isAvailable) throw new Error("Open this panel inside an Owlbear room to build the map.");
  await ready;
  if (!(await OBR.scene.isReady())) throw new Error("No scene is open. In Owlbear, create or open a scene first (the scenes menu), then try again.");
  const text = $("brief").value;
  if (!text.trim()) throw new Error("Write or draft a brief in section 1 first.");
  gmStatus("Step 1 of 4: saving your brief...");
  store("brief-" + roomId, text);
  await api("/api/gm/brief", { room: roomId, brief: text }, true);
  gmStatus("Step 2 of 4: the AI is designing the map and monsters. This can take up to a minute...");
  const d = await api("/api/gm/build", {
    room: roomId, notes: $("notes").value, cols: +$("cols").value, rows: +$("rows").value,
  }, true);
  let art = null, artNote = "";
  if ($("artOn").checked) {
    gmStatus("Step 3 of 4: painting the background art (this can take up to a minute)...");
    try { art = await getArt(d.spec); } catch (e) { artNote = " The art was skipped: " + e.message; }
  }
  gmStatus("Step 4 of 4: drawing the map...");
  try {
    await clearGenerated();
    const used = await drawBase(d.spec, art);
    if (art && !used) artNote = " The art picture could not be loaded.";
    advSet({ spec: d.spec, tokens: d.tokens, revealed: [], art: used ? art.url : "" });
    store("map-" + roomId, JSON.stringify(d.spec));
    const start = d.spec.areas.find((a) => a.kind !== "corridor") || d.spec.areas[0];
    if ($("hideRooms").checked) await revealArea(start.name, true);
    else for (const a of d.spec.areas) await revealArea(a.name, true);
    await updateMask();
    await syncAdv();
  } catch (e) { throw new Error("Drawing failed: " + e.message); }
  const byArea = {};
  d.tokens.forEach((t) => { (byArea[t.area] = byArea[t.area] || []).push(t.name); });
  $("legend").textContent = layoutText(d.spec) + "\n\nCreatures by room (they appear when the room is revealed):\n" +
    (Object.keys(byArea).map((a) => `${a}: ${byArea[a].join(", ")}`).join("\n") || "none");
  renderRooms();
  gmStatus($("hideRooms").checked
    ? `Done. Only the first room is visible. ${d.spec.areas.length} areas and ${d.tokens.length} creatures are ready; reveal rooms below or let the DM propose it.${artNote}`
    : `Done. Built ${d.spec.areas.length} areas and ${d.tokens.length} creatures. If you can't see the map, zoom out in Owlbear.${artNote}`);
});

busyBtn($("addArt"), "Painting...", async () => {
  const adv = advGet();
  if (!adv) throw new Error("Build the map first.");
  if (!OBR.isAvailable) throw new Error("Open this panel inside an Owlbear room.");
  await ready;
  gmStatus("Painting the background art (this can take up to a minute)...");
  const art = await getArt(adv.spec);
  const old = await OBR.scene.items.getItems((i) => i.metadata && i.metadata[GEN] === true);
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
  adv.art = (await drawBase(adv.spec, art)) ? art.url : "";
  const dpi = await getDpi();
  const items = [];
  for (const a of adv.spec.areas.filter((x) => adv.revealed.includes(x.name))) items.push(...areaItems(dpi, adv.spec, a, !!adv.art));
  if (items.length) await OBR.scene.items.addItems(items);
  advSet(adv);
  await updateMask();
  gmStatus(adv.art ? "Art added. Revealed rooms keep their creatures." : "The picture could not be loaded. The flat map was kept.");
});

busyBtn($("statsBtn"), "Looking up...", async () => {
  let creatures = [];
  try { creatures = (await readTokens()).filter((t) => t.side !== "pc").map((t) => t.name); } catch (e) {}
  try { await syncAdv(); } catch (e) {}
  const d = await api("/api/gm/stats", { room: roomId, creatures }, true);
  $("stats").textContent = d.text;
  gmStatus("Stat blocks loaded. The DM uses these automatically.");
});

busyBtn($("spawn"), "Spawning...", async () => {
  if (!OBR.isAvailable) throw new Error("Open this panel inside an Owlbear room to spawn tokens.");
  await ready;
  const name = $("tname").value.trim() || "Creature";
  const count = Math.max(1, Math.min(12, +$("tcount").value || 1));
  const col = +$("tcol").value || 0, row = +$("trow").value || 0, side = $("tside").value;
  const list = [];
  for (let n = 0; n < count; n++) {
    list.push({ name: count > 1 ? `${name} ${n + 1}` : name, side, col: col + (n % 4), row: row + Math.floor(n / 4) });
  }
  await spawnTokens(list, false);
  gmStatus(`Spawned ${count} x ${name}.`);
});

function renderMoves() {
  const box = $("moves");
  box.innerHTML = "";
  $("applyAll").hidden = pendingMoves.length < 2;
  pendingMoves.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "move";
    const span = document.createElement("span");
    span.textContent = `${tokenNames[m.id] || "Token"} to (${m.col}, ${m.row}): ${m.reason}`;
    const b = document.createElement("button");
    b.textContent = "Apply";
    b.addEventListener("click", async () => {
      try { await applyMoves([m]); pendingMoves.splice(idx, 1); renderMoves(); }
      catch (e) { gmStatus("Problem: " + e.message); }
    });
    row.append(span, b);
    box.appendChild(row);
  });
}

const BLOCK_KINDS = new Set(["pillar", "statue", "table", "water", "tree", "altar", "chest"]);
// Cells a creature may stand on: inside a revealed area and not on a blocking feature. null = no built map (anything goes).
function walkableCells() {
  const adv = advGet();
  if (!adv || !adv.spec) return null;
  const ok = new Set();
  for (const a of adv.spec.areas.filter((x) => adv.revealed.includes(x.name)))
    for (let x = a.x; x < a.x + a.w; x++) for (let y = a.y; y < a.y + a.h; y++) ok.add(x + "," + y);
  for (const f of adv.spec.features || [])
    if (BLOCK_KINDS.has(f.kind)) for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.h; y++) ok.delete(x + "," + y);
  return ok;
}

// Adjusts each move so it ends on a free, walkable cell (the nearest one to where the AI wanted). Returns a note per changed move.
async function safeMoves(moves) {
  const tokens = await readTokens();
  const walk = walkableCells();
  const moving = new Set(moves.map((m) => m.id));
  const taken = new Set(tokens.filter((t) => !moving.has(t.id)).map((t) => t.col + "," + t.row));
  const notes = [];
  const out = moves.map((m) => {
    const cell = freeCell(taken, m.col, m.row, walk);
    taken.add(cell.join(","));
    if (cell[0] !== m.col || cell[1] !== m.row) notes.push(`${tokenNames[m.id] || "Token"} went to (${cell[0]}, ${cell[1]}) instead (target was taken or blocked)`);
    return { ...m, col: cell[0], row: cell[1] };
  });
  return { moves: out, notes };
}

async function applyMoves(moves) {
  await ready;
  const dpi = await getDpi();
  const fixed = await safeMoves(moves);
  moves = fixed.moves;
  if (fixed.notes.length) gmStatus(fixed.notes.join(". ") + ".");
  const byId = {};
  moves.forEach((m) => { byId[m.id] = m; });
  await OBR.scene.items.updateItems(moves.map((m) => m.id), (items) => {
    for (const it of items) {
      const m = byId[it.id];
      if (m) it.position = { x: (m.col + OFF) * dpi, y: (m.row + OFF) * dpi };
    }
  });
}

busyBtn($("suggest"), "Thinking...", async () => {
  const tokens = await readTokens();
  tokenNames = {};
  tokens.forEach((t) => { tokenNames[t.id] = t.name; });
  const m = savedMap();
  const d = await api("/api/gm/moves", {
    room: roomId, tokens, situation: $("situation").value,
    layout: layoutText(m), cols: m ? m.cols : 40, rows: m ? m.rows : 30,
  }, true);
  pendingMoves = d.moves;
  renderMoves();
  gmStatus(d.moves.length ? (d.summary || "Moves suggested. Press Apply to make them.") : "The AI suggests no movement.");
});

$("applyAll").addEventListener("click", async () => {
  try { await applyMoves(pendingMoves); pendingMoves = []; renderMoves(); gmStatus("All moves applied."); }
  catch (e) { gmStatus("Problem: " + e.message); }
});

let clearArmed = false;
$("clearBtn").addEventListener("click", async () => {
  const b = $("clearBtn");
  if (!clearArmed) {
    clearArmed = true; b.textContent = "Really clear?";
    gmStatus("Press \"Really clear?\" again within 4 seconds to erase the story for everyone.");
    setTimeout(() => { clearArmed = false; b.textContent = "Clear story"; }, 4000);
    return;
  }
  clearArmed = false; b.textContent = "Clear story";
  try {
    const fresh = Math.random().toString(36).slice(2, 10);
    clearTimeout(saveTimer); saveTimer = null;
    msgCache = [];
    try { await OBR.room.setMetadata({ [STORY]: { e: fresh, m: [] } }); } catch (e) {}
    await api("/api/clear", { room: roomId, epoch: fresh }, true);
    epoch = fresh; log.innerHTML = ""; last = 0;
    gmStatus("Story cleared for everyone.");
    await fetchLog();
  }
  catch (e) { gmStatus("Problem: " + e.message); }
});


// For risky buttons: the first press only warns; a second press within 4 seconds goes ahead.
function twice(btn, warning) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
  btn.dataset.armed = "1";
  gmStatus(warning);
  setTimeout(() => { delete btn.dataset.armed; }, 4000);
  return false;
}

/* ---------- screens ---------- */
function showScreen(id) {
  for (const s of ["story", "gm", "charScreen"]) $(s).hidden = s !== id;
}

/* ---------- dice ---------- */
async function roll(text) {
  text = String(text || "").trim();
  if (!text) return;
  try { await api("/api/roll", { room: roomId, who: myName, text }); $("dice").value = ""; }
  catch (e) { add("sys", "Roll: " + e.message); }
}
$("rollBtn").addEventListener("click", () => roll($("dice").value));
$("dice").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); roll($("dice").value); } });
document.querySelectorAll("[data-roll]").forEach((b) => b.addEventListener("click", () => {
  const extra = $("dice").value.trim();
  roll(b.dataset.roll + (extra && !/^[0-9d+\-]/i.test(extra) ? " " + extra : ""));
}));

/* ---------- my character ---------- */
const CARD = { name: "cName", species: "cSpecies", cls: "cCls", level: "cLevel", maxHp: "cMaxHp", ac: "cAc", init: "cInitB", story: "cStory" };
$("charToggle").addEventListener("click", async () => {
  showScreen("charScreen");
  $("charStatus").textContent = "Loading...";
  try {
    const d = await api(`/api/char?room=${encodeURIComponent(roomId)}&who=${encodeURIComponent(myName)}`);
    const c = d.card || {};
    for (const k in CARD) $(CARD[k]).value = c[k] ?? (k === "level" ? 1 : k === "init" ? 0 : "");
    $("charStatus").textContent = d.card ? "This is your saved card." : "No card yet: fill it in and press Save character.";
  } catch (e) { $("charStatus").textContent = "Problem: " + e.message; }
});
$("charBack").addEventListener("click", () => showScreen("story"));
$("charSave").addEventListener("click", async () => {
  const card = {};
  for (const k in CARD) card[k] = $(CARD[k]).value;
  if (!card.name.trim()) { $("charStatus").textContent = "Give your character a name first."; return; }
  try {
    await api("/api/char", { room: roomId, who: myName, card });
    $("charStatus").textContent = "Saved. Your GM and the DM can see your character now.";
  } catch (e) { $("charStatus").textContent = "Problem: " + e.message; }
});

/* ---------- combat tracker ---------- */
let combat = null, combatKey = "";
function renderCombat(c) {
  const key = JSON.stringify(c);
  if (key === combatKey) return;
  combatKey = key;
  combat = c;
  const box = $("combat"), list = $("clist");
  box.hidden = !c;
  if (!c) return;
  const fight = c.phase === "fight";
  $("ctitle").textContent = fight ? `Combat · Round ${c.round}` : "Combat · roll initiative";
  const me = c.list.find((x) => x.side === "pc" && ((x.owner && x.owner === myName) || (!x.owner && x.name === myName)));
  $("cInit").hidden = !me || me.init !== null;
  $("cBegin").hidden = !isGmRole || fight;
  $("cNext").hidden = !isGmRole || !fight;
  list.innerHTML = "";
  c.list.forEach((x, i) => {
    const row = document.createElement("div");
    const down = x.side !== "pc" && (x.status === "Down" || (x.maxHp > 0 && x.hp <= 0));
    row.className = "crow" + (fight && i === c.turn ? " now" : "") + (down ? " down" : "");
    const ini = document.createElement("span");
    ini.className = "ci";
    ini.textContent = x.init === null || x.init === undefined ? "?" : x.init;
    const nm = document.createElement("span");
    nm.className = "cn " + x.side;
    nm.textContent = (fight && i === c.turn ? "▶ " : "") + x.name;
    row.append(ini, nm);
    const mine = x === me;
    if (x.hp !== undefined && (isGmRole || mine)) {
      // GM can edit everyone; a player edits their own HP
      const hp = document.createElement("input");
      hp.type = "number"; hp.min = 0; hp.value = x.hp; hp.title = "Current HP";
      hp.addEventListener("change", async () => {
        try {
          if (isGmRole) await api("/api/gm/combat/set", { room: roomId, id: x.id, hp: +hp.value }, true);
          else await api("/api/combat/hp", { room: roomId, who: myName, hp: +hp.value });
        } catch (e) { add("sys", "HP: " + e.message); }
      });
      const of = document.createElement("span");
      of.textContent = x.maxHp ? `/${x.maxHp}` + (x.ac ? ` AC ${x.ac}` : "") : (x.ac ? `AC ${x.ac}` : "");
      row.append(hp, of);
      if (isGmRole && !fight) {
        const ii = document.createElement("input");
        ii.type = "number"; ii.value = x.init ?? ""; ii.title = "Initiative (type a player's physical roll here)"; ii.placeholder = "init";
        ii.addEventListener("change", () => api("/api/gm/combat/set", { room: roomId, id: x.id, init: ii.value }, true).catch((e) => add("sys", e.message)));
        row.append(ii);
      }
    } else if (x.hp !== undefined) {
      const t = document.createElement("span");
      t.textContent = x.maxHp ? `${x.hp}/${x.maxHp}` : "";
      row.append(t);
    } else {
      const t = document.createElement("span");
      t.textContent = x.status || "";
      row.append(t);
    }
    list.appendChild(row);
  });
  const now = list.querySelector(".now");
  if (now) now.scrollIntoView({ block: "nearest" });
}
$("cInit").addEventListener("click", async () => {
  try { await api("/api/combat/init", { room: roomId, who: myName }); } catch (e) { add("sys", e.message); }
});
async function combatTurn(path, btns) {
  btns.forEach((b) => { b.disabled = true; });
  try {
    const map = useMap.checked ? await mapContext() : "";
    let creatures = [];
    try { creatures = (await readTokens()).filter((t) => t.side !== "pc").map((t) => t.name); } catch (e) {}
    status.textContent = "Next turn... (if it's the monsters' turn, the DM is thinking)";
    await api(path, { room: roomId, map, creatures }, true);
    status.textContent = "";
  } catch (e) { status.textContent = ""; add("sys", "Combat: " + e.message); gmStatus("Problem: " + e.message); }
  btns.forEach((b) => { b.disabled = false; });
}
const beginBtns = [$("cBegin"), $("cBegin2")], nextBtns = [$("cNext"), $("cNext2")];
beginBtns.forEach((b) => b.addEventListener("click", () => combatTurn("/api/gm/combat/begin", beginBtns)));
nextBtns.forEach((b) => b.addEventListener("click", () => combatTurn("/api/gm/combat/next", nextBtns)));
busyBtn($("cStart"), "Starting...", async () => {
  if (combat && !twice($("cStart"), "A combat is already running. Press Start combat again within 4 seconds to replace it.")) return;
  const tokens = await readTokens();
  await api("/api/gm/combat/start", { room: roomId, tokens: tokens.map((t) => ({ id: t.id, name: t.name, side: t.side })) }, true);
  gmStatus("Combat started. Players roll initiative on the story screen; press Begin round 1 when ready.");
});
let endArmed = false;
$("cEnd").addEventListener("click", async () => {
  if (!endArmed) { endArmed = true; $("cEnd").textContent = "Really end?"; setTimeout(() => { endArmed = false; $("cEnd").textContent = "End combat"; }, 4000); return; }
  endArmed = false; $("cEnd").textContent = "End combat";
  try { await api("/api/gm/combat/end", { room: roomId }, true); gmStatus("Combat ended. Players' HP is kept on their cards."); }
  catch (e) { gmStatus("Problem: " + e.message); }
});

/* ---------- campaign (GM) ---------- */
let camp = {};
function renderCampaign(d) {
  camp = d.campaign || {};
  const chars = d.chars || {};
  const names = Object.keys(chars);
  $("party").textContent = names.length
    ? names.map((p) => { const c = chars[p]; return `${c.name || "?"}: ${[c.species, c.cls].filter(Boolean).join(" ")} ${c.level}, HP ${c.hp}/${c.maxHp}, AC ${c.ac} (${p})`; }).join("\n")
    : "No character cards yet. Players fill them in with My character.";
  if (camp.world !== undefined && !$("world").value) $("world").value = camp.world;
  if (camp.sessions) $("cSessions").value = camp.sessions;
  if (camp.bible !== undefined) $("bible").value = camp.bible;
  $("intro").textContent = camp.intro ? "Opening narration (players haven't seen it yet unless you posted it):\n" + camp.intro : "";
  $("introBtn").hidden = !camp.intro;
  $("recapBtn").hidden = !(camp.recaps && camp.recaps.length);
  $("sessNo").textContent = camp.session || 1;
}
async function loadCampaign() {
  const d = await api("/api/gm/campaign", { room: roomId }, true);
  renderCampaign(d);
  return d;
}
busyBtn($("partyBtn"), "Loading...", async () => { await loadCampaign(); gmStatus("Party refreshed."); });
busyBtn($("campSave"), "Saving...", async () => {
  const d = await api("/api/gm/campaign/save", { room: roomId, world: $("world").value, bible: $("bible").value, sessions: +$("cSessions").value }, true);
  camp = d.campaign;
  gmStatus("Campaign notes saved. The DM uses them from the next Ask DM.");
});
busyBtn($("campBuild"), "Building...", async () => {
  if (!$("world").value.trim()) throw new Error("Describe your world idea first.");
  if ($("bible").value.trim() && !twice($("campBuild"), "You already have campaign notes. Press Build campaign again within 4 seconds to replace them.")) return;
  gmStatus("The AI is writing the campaign (world, factions, villain, session arc, a hook for each character). This can take a minute...");
  const d = await api("/api/gm/campaign/build", { room: roomId, world: $("world").value, sessions: +$("cSessions").value }, true);
  renderCampaign({ campaign: d.campaign, chars: (await api("/api/gm/campaign", { room: roomId }, true)).chars });
  gmStatus("Campaign ready. Read and edit the notes (then Save notes). When the players are ready, post the intro, then press Prep next session only to draft session 1's brief.");
});
busyBtn($("introBtn"), "Posting...", async () => { await api("/api/gm/campaign/intro", { room: roomId }, true); gmStatus("Intro posted to the story."); });
busyBtn($("recapBtn"), "Posting...", async () => {
  const r = (camp.recaps || [])[camp.recaps.length - 1];
  if (!r) throw new Error("No recap yet.");
  await api("/api/say", { room: roomId, who: "Previously", text: `Session ${r.n} recap: ${r.text}` });
  gmStatus("Last recap posted to the story.");
});
async function prepNext() {
  gmStatus(`Drafting the brief for session ${camp.session || 1} (this can take a minute)...`);
  const d = await api("/api/gm/campaign/prep", { room: roomId, note: $("prepNote").value, players: +$("plr").value }, true);
  $("brief").value = d.text;
  store("brief-" + roomId, d.text);
  $("briefSec").open = true;
  gmStatus(`Session ${camp.session || 1} brief is ready and saved in Session brief. Edit it if you like, then Build map + monsters when you're ready to play.`);
}
busyBtn($("prepOnly"), "Drafting...", prepNext);
let sessArmed = false;
$("endSess").addEventListener("click", async () => {
  const b = $("endSess");
  if (!sessArmed) {
    sessArmed = true; b.textContent = "Really end the session?";
    gmStatus("Press again within 4 seconds. The AI writes a recap (posted to the story), updates your campaign notes and drafts the next session's brief (2 AI requests).");
    setTimeout(() => { sessArmed = false; b.textContent = "End session: recap + prep next"; }, 4000);
    return;
  }
  sessArmed = false; b.disabled = true; b.textContent = "Working...";
  try {
    gmStatus("Step 1 of 2: writing the recap and updating your notes...");
    const d = await api("/api/gm/campaign/end", { room: roomId }, true);
    renderCampaign({ campaign: d.campaign, chars: (await api("/api/gm/campaign", { room: roomId }, true)).chars });
    gmStatus("Step 2 of 2: drafting the next session...");
    await prepNext();
  } catch (e) { gmStatus("Problem: " + e.message); }
  b.disabled = false; b.textContent = "End session: recap + prep next";
});

/* ---------- AI actions (GM approves, camera auto-runs) ---------- */
const handled = new Set();
let pendingActions = [], shownKey = "", lastTokens = [];

function describe(a) {
  if (a.type === "spawn") {
    const base = String(a.name).replace(/\s+\d+$/, "").trim();
    const have = lastTokens.filter((t) => baseOf(t.name) === base.toLowerCase()).length;
    return `Spawn ${a.count} more x ${base} (${a.side}) near (${a.col}, ${a.row})` + (have ? ` (${have} already on the map)` : "");
  }
  if (a.type === "move") return `Move ${a.name} to (${a.col}, ${a.row})${a.reason ? ": " + a.reason : ""}`;
  if (a.type === "delete") return `Remove ${a.name}`;
  if (a.type === "fog") return a.on ? "Cover the scene in fog" : "Clear the fog";
  if (a.type === "light") return `Give ${a.name} a light (${a.radius} cells)`;
  if (a.type === "reveal") return `Reveal "${a.area}" on the map`;
  if (a.type === "damage") return `${a.name} takes ${a.amount} damage`;
  if (a.type === "heal") return `${a.name} regains ${a.amount} HP`;
  return a.type;
}

function resolveActions(ids) { api("/api/gm/actions/resolve", { room: roomId, ids }, true).catch(() => {}); }

// Nearest cell to (c, r) that is not taken and (if a walkable set is given) is walkable.
function freeCell(taken, c, r, walk) {
  for (let ring = 0; ring <= 12; ring++)
    for (let dx = -ring; dx <= ring; dx++)
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = c + dx, y = r + dy, k = x + "," + y;
        if (x >= 0 && y >= 0 && !taken.has(k) && (!walk || walk.has(k))) return [x, y];
      }
  return [c, r];
}

// Finds exactly one non-player token by name. Exact name first; a plain name like "Goblin Warrior" only works if just one matches.
const baseOf = (n) => String(n).replace(/\s+\d+$/, "").trim().toLowerCase();
function matchToken(tokens, name, includePcs) {
  const low = (s) => String(s).toLowerCase().trim();
  const pool = includePcs ? tokens : tokens.filter((t) => t.side !== "pc");
  const exact = pool.filter((t) => low(t.name) === low(name));
  if (exact.length === 1) return exact[0];
  const same = exact.length ? exact : pool.filter((t) => baseOf(t.name) === baseOf(name));
  if (same.length === 1) return same[0];
  if (!same.length) throw new Error(`No creature named "${name}" on the map.`);
  throw new Error(`"${name}" could mean ${same.map((t) => t.name).join(", ")}. Move or remove it by hand, or ask the DM to name one.`);
}

async function focusCell(col, row, span) {
  const dpi = await getDpi();
  const w = span * dpi, hgt = span * 0.7 * dpi;
  const cx = (col + 0.5) * dpi, cy = (row + 0.5) * dpi;
  await OBR.viewport.animateToBounds({
    min: { x: cx - w / 2, y: cy - hgt / 2 }, max: { x: cx + w / 2, y: cy + hgt / 2 },
    width: w, height: hgt, center: { x: cx, y: cy },
  });
}

async function addLight(id, radius) {
  const dpi = await getDpi();
  const found = await OBR.scene.items.getItems([id]);
  if (!found.length) return;
  if (lights[id]) { try { await OBR.scene.local.deleteItems([lights[id]]); } catch (e) {} }
  const px = radius * dpi;
  const light = buildLight().attachedTo(id).attenuationRadius(px).sourceRadius(px)
    .lightType("PRIMARY").falloff(0.2)
    .position({ x: found[0].position.x + dpi * 0.5, y: found[0].position.y + dpi * 0.5 }).build();
  await OBR.scene.local.addItems([light]);
  lights[id] = light.id;
}

async function broadcast(channel, data, fallback) {
  try { await OBR.broadcast.sendMessage(channel, data, { destination: "ALL" }); }
  catch (e) { await fallback(); }
}

async function runAction(a) {
  if (a.type === "damage" || a.type === "heal") // only the tracker changes; nothing on the map
    return api("/api/gm/combat/hp", { room: roomId, name: a.name, delta: a.type === "damage" ? -a.amount : a.amount }, true);
  if (!OBR.isAvailable) throw new Error("Open this panel inside an Owlbear room.");
  await ready;
  const tokens = await readTokens();
  const lower = (s) => String(s).toLowerCase();
  if (a.type === "spawn") {
    const base = String(a.name).replace(/\s+\d+$/, "").trim();
    const taken = new Set(tokens.map((t) => t.col + "," + t.row));
    const walk = walkableCells();
    // Number new creatures after the highest existing number for that name ("Goblin Warrior 3" follows 1 and 2).
    const same = tokens.filter((t) => baseOf(t.name) === base.toLowerCase());
    let top = 0;
    same.forEach((t) => { const m = String(t.name).match(/\s(\d+)$/); top = Math.max(top, m ? +m[1] : 1); });
    const list = [];
    for (let i = 0; i < a.count; i++) {
      const cell = freeCell(taken, a.col, a.row, walk);
      taken.add(cell.join(","));
      const n = a.count > 1 || same.length ? top + i + 1 : 0;
      list.push({ name: n ? `${base} ${n}` : base, side: a.side, col: cell[0], row: cell[1] });
    }
    await spawnTokens(list, false);
  } else if (a.type === "move") {
    const t = matchToken(tokens, a.name);
    tokenNames[t.id] = t.name;
    await applyMoves([{ id: t.id, col: a.col, row: a.row }]);
  } else if (a.type === "delete") {
    const ids = [matchToken(tokens, a.name).id];
    const labels = await OBR.scene.items.getItems((i) => i.metadata && ids.includes(i.metadata[FOR]));
    await OBR.scene.items.deleteItems([...ids, ...labels.map((l) => l.id)]);
  } else if (a.type === "reveal") {
    if (!(await revealArea(a.area))) throw new Error(`"${a.area}" is already revealed.`);
  } else if (a.type === "fog") {
    await OBR.scene.fog.setFilled(!!a.on);
  } else if (a.type === "camera") {
    let col = a.col, row = a.row;
    if (a.name) {
      const t = matchToken(tokens, a.name, true);
      col = t.col; row = t.row;
    }
    await broadcast(CAM, { col, row, span: 12 }, () => focusCell(col, row, 12));
  } else if (a.type === "light") {
    const t = tokens.find((x) => lower(x.name) === lower(a.name));
    if (!t) throw new Error(`No token named "${a.name}" for a light.`);
    await broadcast(LIGHT, { id: t.id, radius: a.radius }, () => addLight(t.id, a.radius));
  }
}

function renderActions() {
  const box = $("actions");
  box.innerHTML = "";
  if (!isGmRole || !pendingActions.length) { box.hidden = true; return; }
  box.hidden = false;
  const title = document.createElement("div");
  title.textContent = "The DM suggests (you approve):";
  box.appendChild(title);
  pendingActions.forEach((a) => {
    const row = document.createElement("div");
    row.className = "arow";
    const span = document.createElement("span");
    span.textContent = describe(a);
    const ok = document.createElement("button");
    ok.textContent = "Approve";
    ok.addEventListener("click", () => approve(a));
    const no = document.createElement("button");
    no.textContent = "Skip"; no.className = "alt";
    no.addEventListener("click", () => skip(a));
    row.append(span, ok, no);
    box.appendChild(row);
  });
  if (pendingActions.length > 1) {
    const row = document.createElement("div");
    row.className = "arow";
    const all = document.createElement("button");
    all.textContent = "Approve all";
    all.addEventListener("click", async () => { for (const a of [...pendingActions]) await approve(a); });
    const none = document.createElement("button");
    none.textContent = "Skip all"; none.className = "alt";
    none.addEventListener("click", () => { [...pendingActions].forEach(skip); });
    row.append(all, none);
    box.appendChild(row);
  }
}

async function approve(a) {
  try {
    await runAction(a);
    handled.add(a.id); resolveActions([a.id]);
    pendingActions = pendingActions.filter((x) => x.id !== a.id);
    status.textContent = "";
  } catch (e) { console.error(e); status.textContent = "Action failed: " + e.message; }
  shownKey = ""; renderActions();
}

function skip(a) {
  handled.add(a.id); resolveActions([a.id]);
  pendingActions = pendingActions.filter((x) => x.id !== a.id);
  renderActions();
}

async function handleActions(list) {
  const auto = list.filter((a) => a.type === "camera" && !handled.has(a.id));
  for (const a of auto) {
    handled.add(a.id);
    try { await runAction(a); } catch (e) { status.textContent = "Camera: " + e.message; }
    resolveActions([a.id]);
  }
  pendingActions = list.filter((a) => a.type !== "camera" && !handled.has(a.id));
  const key = pendingActions.map((a) => a.id).join(",");
  if (key !== shownKey) {
    shownKey = key;
    try { lastTokens = await readTokens(); } catch (e) {}
    renderActions();
  }
}

/* ---------- start ---------- */
(async () => {
  let isGm = !OBR.isAvailable; // outside Owlbear (testing) show GM tools
  try {
    if (OBR.isAvailable) {
      await ready;
      roomId = OBR.room.id || roomId;
      myName = (await OBR.player.getName()) || myName;
      isGm = (await OBR.player.getRole()) === "GM";
    }
  } catch (e) {}
  isGmRole = isGm;
  if (OBR.isAvailable) {
    try {
      OBR.broadcast.onMessage(CAM, (e) => { if ($("followCam").checked) focusCell(e.data.col, e.data.row, e.data.span || 12).catch(() => {}); });
      OBR.broadcast.onMessage(LIGHT, (e) => { addLight(e.data.id, e.data.radius).catch(() => {}); });
    } catch (e) {}
  }
  if (isGm) $("gmToggle").hidden = false;
  if (OBR.isAvailable) {
    try {
      if (isGm) await shareCode();
      else {
        const meta = await OBR.room.getMetadata();
        if (meta[ACCESS]) codeEl.value = meta[ACCESS];
      }
      OBR.room.onMetadataChange((meta) => {
        if (!isGmRole && meta[ACCESS] && meta[ACCESS] !== codeEl.value) {
          codeEl.value = meta[ACCESS]; lastErr = ""; openStream(); fetchLog();
        }
      });
    } catch (e) { console.error(e); }
  }
  fetchLog();
  openStream();
  setInterval(poll, 3000);
})();
</script>
</body>
</html>
```

## 13. Progress: Steps 1 to 3 built (v0.3 + actions), answers from the user
- User confirmed **Build map + monsters worked** after adding a scene.
- User chose: GM approves AI actions, EXCEPT camera moves which run automatically. Actions wanted: spawn creatures, move tokens, fog on/off, camera focus, delete tokens, torch lights.
- Step 2 DONE (untested live): GM client saves a trimmed story (max ~8000 chars, last messages, 800 chars each) to room metadata key `com.aidm/story` 3 seconds after new messages; any client restores it to the server via `/api/restore` when the server log is empty (server accepts only when empty). Clear story empties the saved copy first. The brief is never stored in room metadata. UNVERIFIED: whether players or only the GM may write room metadata (only the GM writes), and the room metadata size limit (kept small to be safe).
- Step 3 DONE (untested live): Ask DM now uses Gemini JSON mode returning `{narration, actions[]}`; server sanitizes actions (spawn, move, delete, fog, camera, light; max 6) and queues them in `room.pending`; only requests with the GM code receive them in `/api/log`; GM panel shows an approval card (Approve / Skip / Approve all / Skip all); `/api/gm/actions/resolve` clears them. Camera actions auto-run and are broadcast to everyone with `OBR.broadcast.sendMessage("com.aidm/camera", ..., {destination:"ALL"})` (players can untick "follow DM camera"). Lights are broadcast so every client adds a local `buildLight()` (lights are local-only items). If JSON parsing fails, the raw reply is shown as narration with no actions.
- UNVERIFIED in a live room: `OBR.broadcast` API shape, light visibility (may need Owlbear dynamic fog), shape position origin (their code treats shapes as center-positioned; ours assume top-left), fog `setFilled`.
- Still to do from the list: Step 4 finer fog (reveal by room; needs FOG-layer items, unverified), Step 5 richer scene awareness (fog and lights in the snapshot), Step 6 SSE + synced camera polish, Step 7 map art on the map layer (provider test pending: user should test the Pollinations URL).

## 14. Progress: Steps 1 and 2 of the "next steps" list built (v0.4), user test results
- User tested: Steps 2 and 3 of the earlier plan PASSED (saved history survives a Render restart; AI action approval works). Pollinations test URL returned an image with a watermark in the lower right (user is OK with the watermark). User set MODEL (Flash-Lite) and PLAN_MODEL (gemini-3.8-flash).
- Item 1 DONE (untested live): the Ask DM map snapshot now includes fog status (`OBR.scene.fog.getFilled()`), tokens that have lights, and each token tagged [player] or [enemy|npc|ally] with cell positions. The map layout and room visibility now come from the SERVER.
- Item 2 DONE (untested live): **hidden rooms**. Build map + monsters draws only a dark background plus the first non-corridor room (and corridors touching it) when "Hide unexplored rooms" is ticked; other rooms and their creatures are NOT drawn/spawned until revealed. Reveal happens via the GM's Rooms list (Reveal / Reveal all) or an AI action `{"type":"reveal","area":"<room name>"}` that the GM approves. Revealing a room draws its floor (zIndex 2), the features it owns (zIndex 3), touching corridors, and spawns its creatures (tagged AUTO). The adventure state (spec, creatures per room, revealed list) is kept in the GM browser's localStorage key `adv-<roomId>` and mirrored to the server with `POST /api/gm/state` (GM code) so the DM prompt includes MAP LAYOUT, areas players can see, and hidden areas. State is re-sent on Unlock after a server restart. Limitation: reveal only works from the GM's browser/device that holds the saved state.
- Design note: we hide rooms by not drawing them (no layer-order or fog-layer assumptions needed), so there is no "cover" shape and the GM also cannot see hidden rooms on the board (they appear in the Rooms list and legend).
- Remaining: Item 3 map art on the map layer (image source: Pollinations legacy endpoint works for the user with a watermark; need server-side fetch + hosting + `buildImage` insertion), Item 4 polish (move Access code box into GM tools, SSE instead of polling, refresh setup guide).

## 15. Progress: Item 3 map art built (v0.5), untested live
- User tested v0.4 (hidden rooms + scene awareness): PASSED. User chose ONE big art image for the whole adventure (not per room).
- Build map + monsters now has 4 steps. If "Paint a background picture" is ticked, the server fetches ONE image from Pollinations (`image.pollinations.ai/prompt/...&nologo=true`, 1280 wide, aspect from map size; 1 retry on 429; 70 s timeout; max 6 MB), stores it in memory per room and serves it at `/art/<roomId>.jpg?v=N` (public GET, no code needed so players' Owlbear can load it). The AI map JSON now includes an `art` field (10-20 word ground/mood description) used as the prompt.
- Client draws on MAP layer: dark background (z0), art image via `buildImage` scaled to cover `cols` cells and locked (z1), 55% black shade (z2), then revealed room floors at 50% opacity (z3) and features (z4), so rooms stay readable on top of the art. Hidden rooms still hidden (art is only a mood backdrop, so it shows the whole backdrop, not room contents). Art failure never blocks the build (status says art was skipped).
- New GM button "Add art to current map" repaints the art on an existing map and redraws revealed rooms.
- Caveats: art lives in Render memory, so after a restart the image URL 404s (press Add art to current map to regenerate; the flat map keeps working). Art does not match the rectangle layout (backdrop only). Pollinations nologo may or may not remove the watermark; free anonymous tier is rate limited (about 1 request per 15 s).
- UNVERIFIED live: `buildImage` call with a server URL (their code uses the same shape), whether Owlbear loads cross-origin images from our Render URL, art alignment at the scene origin.
- Remaining: Item 4 polish (move Access code box into GM tools, SSE instead of polling, refresh setup guide to match everything built).

## 16. v0.5.1 and v0.5.2 (latest), from user test of v0.5
User test of v0.5: art appeared but did not line up with the grid; fog did not hide the art; "Add art to current map" failed with "The image service answered 402."
**Facts learned:**
- Pollinations 402 = Payment Required: it now runs on "pollen" credits. `nologo=true` is not part of free anonymous use. Anonymous use is heavily rate limited. A free account at https://enter.pollinations.ai gives a free pollen allowance and an API key; new API: `https://gen.pollinations.ai/image/<prompt>?model=flux&width=&height=&seed=` with header `Authorization: Bearer <key>`.
- Owlbear fog is semi-transparent for the GM by design (Fog tool -> Fog Preview shows the player view).
**v0.5.1 changes:**
- server.js `fetchArt`: no more `nologo` (user accepts the watermark). Optional Render env var `POLLINATIONS_KEY`: if set, uses gen.pollinations.ai with Bearer auth; otherwise the legacy anonymous endpoint. Friendly messages for 402/401/403. `/api/gm/art` also returns the image `mime`.
- index.html: art is built with image grid dpi = imageWidth/cols and y-scale = rows*width/(cols*height) so it covers exactly cols x rows cells, then `alignArt()` reads `OBR.scene.items.getItemBounds` of the dark background rectangle and of the art, and rescales/moves the art to match (works whatever the position origin rules are).
**User test of v0.5.1:** art edges now line up with the whole map, BUT the painted rooms/walls don't match our real rooms. Players (incognito) can still see the art through the fog (how fog was turned on, and whether it was faint or absent, not yet reported).
**v0.5.2 changes (untested live):**
- Art prompt is now a floor texture only (MAP_SYSTEM "art" field asks for floor materials/mood only; image prompt says seamless tileable floor texture, no walls/rooms/buildings/doors/furniture).
- "Rock mask": new `updateMask()` covers every cell that is not a revealed area with solid dark rectangles (MAP layer, zIndex 2, metadata `com.aidm/mask` + `com.aidm/generated`, locked, disableHit), merged row-runs into few rectangles (tested: exact coverage). So the art shows only inside revealed rooms/corridors, and unexplored parts stay dark for everyone without relying on fog. Runs after Build, Reveal, Reveal all, AI reveal action, and Add art. The old 55% "Shade" rectangle was removed; room floors over art now use 30% opacity. Only drawn when art is used. Checkbox label changed to "Paint floor art inside revealed rooms".
- Manifest version 0.5.2. (A bug in Claude's edit command first shipped an EMPTY manifest.json; Owlbear showed "JSON.parse: unexpected end of data". Fixed file re-sent. Always check file sizes before sending.)
**Next:** user uploads v0.5.2, rebuilds, reports (a) whether art now appears only inside revealed rooms and looks like floor texture, (b) players' view after revealing a room, (c) how fog was turned on (AI action, Owlbear Fill Fog button) and whether players saw the art faintly or with no fog at all. If fog-based hiding is still wanted, investigate why `OBR.scene.fog.setFilled(true)` does not hide MAP items for players.
Remaining after that: Item 4 polish (move Access code box into GM tools, SSE instead of polling, refresh setup guide).

## 17. v0.5.2 test result (2026-10-13)
- User tested v0.5.2 with the fixed manifest: PASSED. Art shows only inside revealed rooms, and reveal works for players ("test passed with the fog reveal"). The fog question (why `setFilled` did not hide MAP items for players) is moot for now; the rock mask handles hiding.
- Next: user picks the next feature. Options offered: (a) Item 4 polish: move the Access code box into the GM screen, Server-Sent Events instead of 3-second polling, refreshed setup guide covering everything built; (b) later-ideas list: SRD monster/rules lookup, dice + combat tracker, session-zero campaign builder, persistent storage in a free database.

## 18. v0.6.0: shared access code, live updates, official stat blocks (untested live)
User chose (via questions): GM shares the access code automatically; stat blocks are fed to the DM; stat blocks visible to the GM only; if a monster is not in the 2024 data, use the 2014 version.
**Shared access code:** the "Access code" box moved from the story screen into the GM screen ("Player access code", under the GM code). The GM's panel writes it to room metadata key `com.aidm/access` (on startup and when changed); player panels read it at startup and via `OBR.room.onMetadataChange`, so players never type it. Players without it see "Waiting for the GM: the GM needs to open this panel...". Security note: anyone in the Owlbear room can read room metadata, so the code protects the server from strangers, not from people in the room. UNVERIFIED live: players can read room metadata (expected), `onMetadataChange` name.
**Live updates:** server `GET /api/stream?room=` (needs X-Access-Code header) keeps a Server-Sent Events connection per panel (max 60 per room, heartbeat comment every 20 s) and sends `data: u` whenever the room changes (`notify(r)` in addMsg, DM busy on/off, clear, action resolve). The client reads it with fetch + ReadableStream (not EventSource, so the code stays in a header) and then calls /api/log. Fallback: polling every 3 s if no stream, every 15 s with a stream; reconnect after 5 s, or if no data for 45 s. fetchLog no longer drops an update that arrives mid-request. Tested locally: 4 events for say + Ask DM. UNVERIFIED: Render passes streams through without buffering (the 45 s watchdog falls back to polling if not).
**Stat blocks:** server looks up creatures in the free Open5e API `https://api.open5e.com/v2/creatures/?name__iexact=<name>&document__key__in=srd-2024` (verified real response format: name, document.key, size.name, type.name, challenge_rating, armor_class, armor_detail, hit_points, hit_dice, initiative_bonus, speed/speed_all, ability_scores, modifiers, skill_bonuses, resistances_and_immunities.*_display, darkvision_range etc., passive_perception, traits[{name,desc}], actions[{name,desc,action_type ACTION|BONUS_ACTION|..., order_in_statblock}]). Order tried: full name 2024 exact, 2014 exact (`srd-2014`), 2024 name-starts-with (shortest), then last word, then first word ("Swamp Troll" -> Troll, marked "closest official match"). Trailing numbers stripped ("Goblin 2"). Cache per server (no cache on network errors). Note 2024 renamed some monsters ("Goblin" -> "Goblin Warrior"), so the one-shot and map prompts now ask for official 2024 names.
- Names come from the client (non-PC tokens on the map, sent with Ask DM and Suggest moves) plus `r.adv.creatures` (base names of all creatures in the built adventure, sent by the GM in /api/gm/state; also warms the cache). Max 10 names, 7000 chars, injected as MONSTER STAT BLOCKS into the Ask DM system prompt and the enemy-moves prompt (moves now use each creature's walking speed). DM rule added: use exact numbers, never tell players exact HP/AC.
- GM tools section 5 "Monster stat blocks (only you see these)" with "Show stat blocks" (`POST /api/gm/stats`, GM code) showing what the DM gets, plus the CC-BY 4.0 SRD attribution line.
- Tested locally with a mocked Open5e and mocked Gemini: lookups, fallbacks, prompt injection, GM-only access all pass. The sandbox cannot reach Open5e, so the real API was only checked by reading its responses.
**Next:** user uploads v0.6.0 and tests: (1) players no longer see an access code box and still play; (2) messages and DM replies appear instantly for everyone; (3) GM tools -> Show stat blocks lists real stats; (4) DM narration uses correct monster numbers. Then remaining options: refreshed setup guide, dice + combat tracker, session-zero campaign builder, persistent storage in a free database.

## 19. v0.6.1: bug fixes from the v0.6.0 test (untested live)
User test of v0.6.0: (1) first "Build map + monsters" failed with "The AI's answer wasn't in the expected format", second click worked; (2) a stray token "Goblin Warrior 1 2" appeared in room 2; (3) an AI move action moved that token when another was meant, onto a square a player already occupied. (Shared access code, live updates and stat blocks were not reported as broken.)
**Root causes found:**
- Positions were read with Math.round(position / dpi). Our square tokens are placed at the cell's top-left (+5% inset) but Owlbear player image tokens are placed at the cell CENTRE, so rounding put every player one cell right and down. The AI (and enemy moves) were given wrong player positions. Fix: Math.floor (correct for both).
- The AI DM proposed spawning "Goblin Warrior 1" although it already existed (revealed rooms auto-spawn their creatures); the client appended " 2" to the given name. Name matching for move/delete took the first token whose name STARTED WITH the given name (could pick the wrong one; delete could remove several).
- Long map JSON got cut off (output token limit; model thinking may also use the budget).
**Fixes:**
- Server: `gemini()` now detects finishReason MAX_TOKENS and ignores `thought` parts. New `geminiJson()` retries ONCE (costs one extra request) when the answer is cut off or malformed, with a note asking for complete short JSON. Build uses 16384 max tokens; maps limited to 6-14 areas, 10-30 features, short names. Ask DM: 6144 tokens; if the JSON is broken or cut off, the narration text is rescued with a regex so players never see raw JSON. Spawn action names lose trailing numbers. ACTIONS_PROMPT: use exact token names from the snapshot; never spawn creatures already on the map or belonging to hidden areas (use reveal); never move onto an occupied cell.
- Client: `matchToken()` = exact name, else a base name only if exactly one token matches, else an error listing the candidates (move, delete, camera). Spawn numbering continues after the highest existing number ("Goblin Warrior 3"); the approval card says "Spawn N more x Name (K already on the map)". `safeMoves()` runs before every move (AI action, Apply, Apply all): each move ends on the nearest cell that is free (no other token, including other moves in the same batch) and walkable (inside a revealed area, not a blocking feature), and the GM status explains any adjustment. `freeCell()` takes an optional walkable set (radius 12). Spawns also use walkable cells.
- Tested locally: map retry after a cut-off answer, narration rescue, and unit tests of matchToken/freeCell/spawn numbering/floor all pass.
**Next:** user uploads v0.6.1 and re-tests build, AI spawn/move/remove actions, and Suggest moves near player tokens. Then remaining options: refreshed setup guide, dice + combat tracker, session-zero campaign builder, persistent storage in a free database.

## 20. v0.6.2: Clear story fix (untested live)
User report: "the story did not clear when clicking the clear story button".
**Cause (race made worse by v0.6.0 live updates):** Clear empties the server log and writes an empty backup to room metadata. The server's notify now reaches every panel instantly, faster than Owlbear syncs the GM's metadata write to other clients. A player panel sees an empty log (latest 0), calls tryRestore, reads its still-old local copy of the room metadata, and restores the old story to the server.
**Fix: story IDs ("epoch").** Server room has `epoch` (string). `/api/clear` sets it to the ID the GM sends (random); `/api/log` returns it. `/api/restore` is refused (`stale: true`) if the server has an epoch and the backup's epoch differs; a fresh server (epoch "") accepts any backup and adopts its epoch. Room metadata `com.aidm/story` is now `{ e: epoch, m: [messages] }` (old plain-array format still read, as epoch ""). Clients reset their display when the epoch changes (as well as when latest < last) and then refetch. Clear button: writes `{e: fresh, m: []}` first, cancels any pending backup save, then calls /api/clear with the same ID; GM status explains the two-press confirm ("Really clear?" within 4 s) and confirms "Story cleared for everyone."
Tested locally: old-format restore on a fresh server, clear, stale restore refused, play continues, restore with the new ID after a restart.
**Next:** user re-tests Clear story with a player window open; continue the v0.6.1 tests (build, AI spawn/move/remove, Suggest moves near players).

## 21. v0.7.0 (latest): dice, combat tracker, session zero / campaign, Upstash database (untested live)
User chose (via questions): build all four remaining items (dice + combat tracker, session zero / campaign builder, free database, refreshed setup guide). Dice rolled in our panel. Monster turns: ONE AI request per run of consecutive monster turns. HP: monsters automatic from stat blocks (DM proposes damage, GM approves), players set their own. Session zero: GM + players together; players fill a short character card (name, species, class, level, max HP, AC, initiative bonus, backstory/goals). Between sessions: AI recap + next-session prep. Database: Upstash (free: 500,000 commands/month, 256 MB; Supabase rejected because free projects pause after 7 days idle).
**Database (server):** env `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (REST API via fetch, no npm). Each room saved as JSON at key `aidm:room:<roomId>` (SET ... EX 180 days) 1.5 s after every POST (`res.on("finish", touch)`). Saved fields: msgs, next, brief, epoch, adv, advFull, combat, campaign, chars, aseq (art images are NOT saved; Add art regenerates). `loadRoom()` loads from the database on first use; if the database can't be read the request fails with a clear error instead of starting an empty room that would overwrite the save. Without the env vars everything stays in memory as before. The full adventure state (map spec, creatures, revealed rooms, art URL) is now sent to the server (`/api/gm/state` field `full`) and pulled on Unlock (`POST /api/gm/adv`; server copy wins), so room reveal works from any GM device. Unlock status says whether the game is saved to the database. Room-metadata story backup still exists as a fallback.
**Dice:** `POST /api/roll {who, text}`: server rolls with crypto.randomInt. Accepts "1d20+5 label", "2d6+3", "d20", "adv"/"dis" (2d20 keep high/low), kh1/kl1, up to 10 terms, 50 dice, 1000 sides. Posted as message role "roll" (shown green with a die emoji; natural 20/1 noted). UI: roll box + Roll, d20, Adv, Dis buttons (text after a quick button's expression is used as the label). The DM sees rolls in the story. For monsters/NPCs the server adds a fresh PRE-ROLLED DICE list (12 d20, 8 d4, 12 d6, 10 d8, 8 d10, 6 d12) to every DM request; the system prompt tells it to use them in order and show the math, never to roll for players.
**Combat tracker:** `r.combat = {phase: setup|fight, round, turn, v, list:[{id, name, side, owner, init, initBonus, hp, maxHp, ac}]}`. Start combat (GM tools > Combat) sends all tokens on the map: player characters come from character cards (owner = Owlbear player name), player tokens without a card get a row with no HP; enemies/NPCs/allies get official HP/AC/initiative bonus from the SRD lookup and auto-rolled initiative (announced). Players press Roll initiative on the story screen (`/api/combat/init`); GM can type initiatives during setup. Begin round 1 auto-rolls anyone missing, sorts (init, then bonus, players first on ties). Next turn skips downed monsters; when the current creature is not a player, `runMonsterTurns()` runs every consecutive non-player creature in ONE DM request (instruction includes order, use pre-rolled dice, compare vs AC, propose move + damage actions, don't act for players) and then announces the next player's turn. "Table" messages (role "sys", grey italic) narrate turn changes. Players see monsters' health as Healthy/Bloodied/Down; the GM sees and can edit numbers (`/api/gm/combat/set`). Players edit their own HP (`/api/combat/hp`), which also updates their card. New AI action types `damage`/`heal` {name, amount} (up to 12 per reply, separate from the 6-action cap) -> GM approval card -> `/api/gm/combat/hp` (exact name or unique base name). A monster reaching 0 HP is announced as down. End combat (press twice) writes players' HP back to their cards. Combat state is also given to the DM in every request (turn order with HP/AC, current turn). Ask DM and combat turns share one function `runDm()`.
**Characters & campaign:** story screen button "My character" opens a card form (`GET/POST /api/char`, keyed by Owlbear player name). GM tools > Campaign (session zero): party list (Refresh party), sessions planned, world idea (tone, lines and veils) -> Build campaign (`/api/gm/campaign/build`, PLAN_MODEL, JSON {bible, intro}; press twice to replace existing notes) -> secret campaign notes (editable, Save notes) + opening narration (Post intro to story). "End session: recap + prep next" (press twice): `/api/gm/campaign/end` (JSON {recap, notes}: player-safe recap posted to the story, notes appended to the campaign notes as "AFTER SESSION n", session number +1) then `/api/gm/campaign/prep` (writes the next session's brief in the one-shot format with campaign context; saved as the server brief and put in the brief box). "Prep next session only" does just the second step (use it for session 1). "Post last recap to story" for the start of the next session. Every DM request now includes THE PARTY (cards incl. backstory), SECRET CAMPAIGN NOTES (first 3000 + last 1500 chars) and the last 2 recaps.
**UI:** GM tools sections are now fold-open panels (Campaign, Session brief, Build the map and monsters, Combat, Add one more creature, Enemy moves, Monster stat blocks, Housekeeping); headings no longer numbered. Panel height 700. Browser pop-up confirms are avoided (may be blocked in Owlbear's frame); risky buttons use press-twice.
**Testing:** server tested locally with mocked Upstash/Gemini/Open5e (cards, dice, combat start/begin/next with a monster block, damage, player HP, restart restoring everything from the database, database-down refusal, campaign build/intro/end/prep). Panel tested in headless Chromium against the local server with a stub Owlbear SDK (outside Owlbear the panel acts as GM): rolls, character card, unlock, campaign build/intro, combat start/initiative/begin/monster turn/approve damage/next, end session; no JS errors. NOT tested: inside a real Owlbear room, player-role rendering of the tracker, real Upstash, real Gemini output quality for monster turns.
**Next:** user sets up Upstash (guide), uploads v0.7.0, tests: character cards, dice, a full combat, session zero campaign build, end session, server restart keeps the game.
**Setup guide refreshed (v0.7.0):** Claude Doc "AI Dungeon Master: Setup and Play Guide" at https://claude.ai/code/artifact/8ee7ee67-5b42-442f-b418-dcc75136f8a4 . Parts: overview; core setup (Gemini key, files, GitHub, Render, env var table); free extras (Upstash steps: console.upstash.com > Redis > + Create Database > Free plan > Connect > REST tab gives UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN; Pollinations key); adding/updating the extension; session zero; running a session (approval table); combat (with a turn-loop diagram); ending a session; AI request costs and a troubleshooting table; sources. Update it when features change.


## 22. v0.7.1: pre-live review fixes, tests, live-test checklist (untested live)
Unattended overnight review (2026-10-24/25) aimed at making v0.7.0 work on the first live try. No new features.
**Checks before:** no build, lint, typecheck or tests existed. `npm install` (nothing to install), `node --check server.js` OK, panel script syntax OK, every `$("id")` in the panel has a matching element, no API keys or secrets in the repo. Every Owlbear SDK call in the panel was checked against the type definitions of `@owlbear-rodeo/sdk` 3.1.0 (the version the `@3` CDN import currently loads): `OBR.isAvailable`, `onReady`, `room.id/getMetadata/setMetadata/onMetadataChange`, `player.getName/getRole`, `scene.isReady`, `scene.grid.getDpi`, `scene.items.getItems/addItems/updateItems/deleteItems/getItemBounds`, `scene.fog.getFilled/setFilled`, `scene.local.addItems/deleteItems`, `viewport.animateToBounds`, `broadcast.sendMessage` (destination "ALL") / `onMessage`, `buildShape/buildLabel/buildImage/buildLight` and their builder methods: all exist with the arguments used. Gemini REST (v1beta generateContent, `x-goog-api-key`, `systemInstruction`, `responseMimeType`) and Upstash REST (POST JSON command array, `SET key value EX`, `GET`) match their docs.
**Bugs found and fixed (smallest change each):**
- Dice: `adv+3` / `dis-1` were rejected ("I can't read"), and the Adv/Dis quick buttons silently dropped a "+3 stealth" modifier typed in the roll box; a label starting with "d" ("dex save") was also dropped. Server `rollDice` now turns a standalone adv/dis term into 2d20kh1/kl1 anywhere in the roll, `splitRoll` accepts words like `adv+3`; the panel appends a "+N" / "-N" from the box to the quick button's dice and only ignores the box when it holds another dice roll.
- Combat: Begin round 1 / Next turn with an empty turn order crashed (`Cannot read properties of undefined`, HTTP 500). Now a 400 with "Nobody is in the combat...".
- Combat: when the AI request for the monsters' turn failed (quota, overload), the turn stayed on the monsters, and the next Next turn skipped them silently. Now `c.retry` makes the next Next turn run the monsters again; if that also fails, the following Next turn skips them. The error tells the GM which will happen.
**Tests added:** `npm test` (Node's built-in test runner, no packages). `test/mock-fetch.js` is preloaded with `--require` and replaces fetch for Gemini, Upstash (stored in a temp file, so a restart can be tested) and Open5e. `test/server.test.js` starts the real server and checks: files present and not empty, manifest valid, panel parses, element ids, access/GM codes, dice (incl. adv+3), Ask DM narration + camera action, empty combat, full combat (card, start, initiative, monster turn with official HP/AC, damage, players see words not HP, end writes HP back to the card), restart keeps the story, quota error wording, monster-turn retry. Results: 2 failed before the fixes (dice, empty combat), 10/10 pass after. Panel smoke test in headless Chromium with a stub SDK: no JS errors; Adv with "+3 stealth" and d20 with "dex save" roll correctly.
**Untested live:** everything in v0.7.0 plus these fixes. Run `docs/LIVE-TEST-CHECKLIST.md` (about 15 minutes, two browser windows).
**Decisions for the user:** see the pull request ("Decisions for Rick"): which GitHub repository Render deploys from; whether the Setup and Play Guide should mention `adv+3`; whether tokens dragged from Owlbear's own library should count as monsters in combat (today they count as players).
**Next:** merge the PR, deploy on Render, run the checklist, report the step numbers that failed.
