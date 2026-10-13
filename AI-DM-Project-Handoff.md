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
- **Render env vars:** `GEMINI_API_KEY` (required), `ACCESS_CODE`, `GM_CODE`, `MODEL` (live story model; user currently has `gemini-3.8-flash`), optional `PLAN_MODEL` (model for one-shots, maps, moves; defaults to MODEL).
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
Create each file with exactly these contents (current version: v0.5.2). `icon.svg` and `package.json` are unchanged since the first version.

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
- You cannot roll dice. When a roll is needed, tell the players exactly what to roll (e.g. "Roll a DC 13 Dexterity save") and wait for the results.
- If you are not sure about a rule, say so and give your best ruling instead of inventing an exact rule.
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
  if (!rooms[id]) rooms[id] = { id, msgs: [], next: 1, busy: false, brief: "", pending: [], aseq: 1, adv: null, art: null, artV: 0 };
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

    if (url === "/api/gm/art") {
      const cols = clampInt(body.cols, 10, 60, 40), rows = clampInt(body.rows, 8, 45, 30);
      const w = 1280, h = Math.max(512, Math.min(1280, Math.round((1280 * rows) / cols)));
      const art = str(body.art, 200) || "ancient stone dungeon floor, faint torchlight";
      const prompt = `seamless tileable top-down floor texture, ${art}, flat even ground filling the whole image, painted fantasy style, no walls, no rooms, no buildings, no doors, no furniture, no characters, no text, no grid lines, no border, no perspective`;
      r.art = await fetchArt(prompt, w, h);
      r.artV += 1;
      return json(res, 200, { url: `/art/${encodeURIComponent(r.id)}.jpg?v=${r.artV}`, mime: r.art.type.split(";")[0] });
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
  [hidden] { display: none !important; }
</style>
</head>
<body>

<div id="story">
  <div id="log"><div class="msg dm">Welcome, adventurers. Each player: type what your character does and press Say. When everyone has spoken, one person presses Ask DM.</div></div>
  <div id="status"></div>
  <div id="actions" hidden></div>
  <div class="row small">
    <label for="code">Access code</label><input id="code" type="password">
    <label><input type="checkbox" id="useMap" checked> send map</label>
    <label><input type="checkbox" id="followCam" checked> follow DM camera</label>
    <button id="gmToggle" class="alt" hidden>GM tools</button>
  </div>
  <div class="row">
    <textarea id="input" placeholder="What does your character do?"></textarea>
    <button id="sayBtn">Say</button>
    <button id="askBtn">Ask DM</button>
  </div>
</div>

<div id="gm" hidden>
 <div id="gmhead">
  <div class="line"><button id="gmBack" class="alt">Back to story</button></div>
  <div class="line"><label for="gmcode">GM code</label><input id="gmcode" type="password"><button id="gmUnlock">Unlock</button></div>
  <div id="gmstatus">Enter your GM code and press Unlock.</div>
 </div>
 <div id="gmbody">

  <h4>1. Secret adventure brief</h4>
  <div class="hint">Only you see this. The AI uses it as secret notes and never shows it to players directly.</div>
  <div class="line">
    Level <input type="number" id="lvl" value="3" min="1" max="20">
    Players <input type="number" id="plr" value="5" min="1" max="12">
    <input type="text" id="theme" placeholder="Theme / tone (e.g. spooky swamp mystery)">
  </div>
  <div class="line"><button id="draft">Draft one-shot</button><button id="saveBrief" class="alt">Save brief</button></div>
  <textarea id="brief" placeholder="Paste or write your secret notes here, or draft a one-shot above. Edit freely, then press Save brief."></textarea>

  <h4>2. Build the adventure map and monsters</h4>
  <div class="hint">Reads your saved brief, draws the whole adventure as one connected map, then places every monster and NPC from the brief in its room. Save the brief first. Pressing again replaces the previous generated map and creatures.</div>
  <div class="line"><input type="text" id="notes" placeholder="Optional extra instructions (e.g. make it a ruined swamp temple)"></div>
  <div class="line">Cols <input type="number" id="cols" value="60" min="20" max="60"> Rows <input type="number" id="rows" value="40" min="15" max="45"><button id="build">Build map + monsters</button></div>
  <div class="line"><label><input type="checkbox" id="hideRooms" checked> Hide unexplored rooms until revealed</label></div>
  <div class="line"><label><input type="checkbox" id="artOn" checked> Paint floor art inside revealed rooms (free image service)</label><button id="addArt" class="alt">Add art to current map</button></div>
  <div id="legend"></div>
  <div id="rooms"></div>

  <h4>3. Add one more creature (optional)</h4>
  <div class="hint">For anything the brief missed. Tokens made here can also be moved by the AI's suggestions. Col and Row are grid cells.</div>
  <div class="line"><input type="text" id="tname" placeholder="Name (e.g. Goblin)"> Count <input type="number" id="tcount" value="1" min="1" max="12"></div>
  <div class="line">Col <input type="number" id="tcol" value="5" min="0"> Row <input type="number" id="trow" value="5" min="0">
    <select id="tside"><option value="enemy">Enemy</option><option value="npc">NPC</option><option value="ally">Ally</option></select>
    <button id="spawn">Spawn</button></div>

  <h4>4. Enemy moves</h4>
  <div class="hint">The AI suggests where enemies and NPCs should go. Nothing moves until you press Apply.</div>
  <div class="line"><input type="text" id="situation" placeholder="Optional note (e.g. goblins are scared of fire)"></div>
  <div class="line"><button id="suggest">Suggest moves</button><button id="applyAll" class="alt" hidden>Apply all</button></div>
  <div id="moves"></div>

  <h4>Housekeeping</h4>
  <div class="line"><button id="clearBtn" class="alt">Clear story</button></div>
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
const MASK = "com.aidm/mask";
const OFF = 0.05; // token inset, as a fraction of a cell

let last = 0, roomId = "test-room", myName = "Player", lastErr = "", inflight = false, serverBusy = false, askBusy = false;
let dpiCache = 0, pendingMoves = [], tokenNames = {};
let isGmRole = false, msgCache = [], saveTimer = null, restoring = false;
const lights = {};

const ready = OBR.isAvailable ? new Promise((r) => OBR.onReady(r)) : Promise.resolve();

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
}
codeEl.value = store("dmcode") || "";
$("gmcode").value = store("gmcode") || "";
codeEl.addEventListener("change", () => store("dmcode", codeEl.value));

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
  if (cls === "dm") d.innerHTML = md(text); else d.textContent = text;
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
    try { await OBR.room.setMetadata({ [STORY]: trimStory(msgCache) }); } catch (e) {}
  }, 3000);
}

async function tryRestore() {
  if (restoring || !OBR.isAvailable) return;
  restoring = true;
  try {
    await ready;
    const story = (await OBR.room.getMetadata())[STORY];
    if (Array.isArray(story) && story.length) {
      await api("/api/restore", {
        room: roomId,
        msgs: story.map((m) => ({ role: m.r === "d" ? "dm" : "player", who: m.w, text: m.t })),
      });
      setTimeout(fetchLog, 300);
    }
  } catch (e) {} finally { restoring = false; }
}

async function fetchLog() {
  if (inflight) return;
  inflight = true;
  try {
    const d = await api(`/api/log?room=${encodeURIComponent(roomId)}&since=${last}`, null, isGmRole && !!$("gmcode").value);
    if (d.latest < last) { log.innerHTML = ""; last = 0; msgCache = []; }
    else {
      for (const m of d.msgs) {
        last = m.id;
        add(m.role === "dm" ? "dm" : "you", m.role === "dm" ? m.text : `${m.who}: ${m.text}`);
        msgCache.push({ r: m.role === "dm" ? "d" : "p", w: m.who, t: m.text });
      }
      if (d.msgs.length) scheduleSave();
    }
    serverBusy = d.busy;
    lastErr = "";
    if (d.latest === 0) tryRestore();
    if (isGmRole && Array.isArray(d.actions)) handleActions(d.actions);
  } catch (e) {
    if (e.message !== lastErr) { add("sys", e.message); lastErr = e.message; }
  } finally {
    inflight = false;
    refreshUi();
  }
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
    col: Math.round(i.position.x / dpi),
    row: Math.round(i.position.y / dpi),
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
    await api("/api/dm", { room: roomId, map });
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

$("gmToggle").addEventListener("click", () => { $("story").hidden = true; $("gm").hidden = false; });
$("gmBack").addEventListener("click", () => { $("gm").hidden = true; $("story").hidden = false; });

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
  const m = savedMap();
  if (m) $("legend").textContent = layoutText(m);
  if (advGet()) { renderRooms(); try { await syncAdv(); } catch (e) {} }
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
  await api("/api/gm/state", { room: roomId, layout: layoutText(adv.spec), areas: adv.spec.areas.map((a) => a.name), revealed: adv.revealed }, true);
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

async function applyMoves(moves) {
  await ready;
  const dpi = await getDpi();
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
    setTimeout(() => { clearArmed = false; b.textContent = "Clear story"; }, 4000);
    return;
  }
  clearArmed = false; b.textContent = "Clear story";
  try {
    msgCache = [];
    try { await OBR.room.setMetadata({ [STORY]: [] }); } catch (e) {}
    await api("/api/clear", { room: roomId }, true); gmStatus("Story cleared."); await fetchLog();
  }
  catch (e) { gmStatus("Problem: " + e.message); }
});

/* ---------- AI actions (GM approves, camera auto-runs) ---------- */
const handled = new Set();
let pendingActions = [], shownKey = "";

function describe(a) {
  if (a.type === "spawn") return `Spawn ${a.count} x ${a.name} (${a.side}) near (${a.col}, ${a.row})`;
  if (a.type === "move") return `Move ${a.name} to (${a.col}, ${a.row})${a.reason ? ": " + a.reason : ""}`;
  if (a.type === "delete") return `Remove ${a.name}`;
  if (a.type === "fog") return a.on ? "Cover the scene in fog" : "Clear the fog";
  if (a.type === "light") return `Give ${a.name} a light (${a.radius} cells)`;
  if (a.type === "reveal") return `Reveal "${a.area}" on the map`;
  return a.type;
}

function resolveActions(ids) { api("/api/gm/actions/resolve", { room: roomId, ids }, true).catch(() => {}); }

function freeCell(taken, c, r) {
  for (let ring = 0; ring <= 6; ring++)
    for (let dx = -ring; dx <= ring; dx++)
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = c + dx, y = r + dy;
        if (x >= 0 && y >= 0 && !taken.has(x + "," + y)) return [x, y];
      }
  return [c, r];
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
  if (!OBR.isAvailable) throw new Error("Open this panel inside an Owlbear room.");
  await ready;
  const tokens = await readTokens();
  const lower = (s) => String(s).toLowerCase();
  const find = (name) => {
    const own = tokens.filter((t) => t.side !== "pc");
    return own.find((t) => lower(t.name) === lower(name)) || own.find((t) => lower(t.name).startsWith(lower(name)));
  };
  if (a.type === "spawn") {
    const taken = new Set(tokens.map((t) => t.col + "," + t.row));
    const existing = tokens.filter((t) => lower(t.name).startsWith(lower(a.name))).length;
    const list = [];
    for (let i = 0; i < a.count; i++) {
      const cell = freeCell(taken, a.col, a.row);
      taken.add(cell.join(","));
      const n = a.count > 1 || existing ? existing + i + 1 : 0;
      list.push({ name: n ? `${a.name} ${n}` : a.name, side: a.side, col: cell[0], row: cell[1] });
    }
    await spawnTokens(list, false);
  } else if (a.type === "move") {
    const t = find(a.name);
    if (!t) throw new Error(`No creature named "${a.name}" to move.`);
    await applyMoves([{ id: t.id, col: a.col, row: a.row }]);
  } else if (a.type === "delete") {
    const n = lower(a.name);
    const targets = tokens.filter((t) => t.side !== "pc" && (lower(t.name) === n || lower(t.name).startsWith(n + " ")));
    if (!targets.length) throw new Error(`No creature named "${a.name}" to remove.`);
    const ids = targets.map((t) => t.id);
    const labels = await OBR.scene.items.getItems((i) => i.metadata && ids.includes(i.metadata[FOR]));
    await OBR.scene.items.deleteItems([...ids, ...labels.map((l) => l.id)]);
  } else if (a.type === "reveal") {
    if (!(await revealArea(a.area))) throw new Error(`"${a.area}" is already revealed.`);
  } else if (a.type === "fog") {
    await OBR.scene.fog.setFilled(!!a.on);
  } else if (a.type === "camera") {
    let col = a.col, row = a.row;
    if (a.name) {
      const t = find(a.name) || tokens.find((x) => lower(x.name) === lower(a.name));
      if (!t) throw new Error(`No token named "${a.name}" to focus on.`);
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
  if (key !== shownKey) { shownKey = key; renderActions(); }
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
  fetchLog();
  setInterval(fetchLog, 3000);
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
- Manifest version 0.5.2.
**Next:** user uploads v0.5.2, rebuilds, reports (a) whether art now appears only inside revealed rooms and looks like floor texture, (b) players' view after revealing a room, (c) how fog was turned on (AI action, Owlbear Fill Fog button) and whether players saw the art faintly or with no fog at all. If fog-based hiding is still wanted, investigate why `OBR.scene.fog.setFilled(true)` does not hide MAP items for players.
Remaining after that: Item 4 polish (move Access code box into GM tools, SSE instead of polling, refresh setup guide).

