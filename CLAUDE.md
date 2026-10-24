# Owlbear.Rodeo AI DM

An AI Dungeon Master extension for Owlbear Rodeo (D&D 2024 / 5.5e, 5+ players). Repo: https://github.com/myrawrmachine/AI_DM_Owlbear_Rodeo

## Read first
- `AI-DM-Project-Handoff.md` — full history (sections 1–21) and an old copy of the source. Newest status is the LAST numbered section (21), not section 5.
- `CHANGELOG.md` — short list of what changed in each version and what is still untested live.
- Drive summary handoff: `Owlbear-Rodeo-AI-DM-Handoff-2026-10-22.md` (Drive file id `1JWtPC6UI2uU_JuCshHWv34EnGMtcqlLu`).
- Setup and Play Guide (Claude Doc): https://claude.ai/code/artifact/8ee7ee67-5b42-442f-b418-dcc75136f8a4

## The user
- Not a programmer, works on Windows. Give step-by-step instructions with links ("a monkey could follow it").
- Ask clarifying questions before building anything big.
- **Everything stays on free tiers**: GitHub, Render free web service, Gemini API free tier, Owlbear Rodeo free account, Upstash free, Pollinations. Never suggest a paid service.

## Rules for changes
- **Never push to `main`.** Make a branch, commit, open a pull request for the user to review and merge.
- Each code change: bump `version` in `manifest.json`, add an entry to `CHANGELOG.md`, and add a new numbered section to the end of `AI-DM-Project-Handoff.md` (what changed, what was tested, what is untested live, next steps for the user).
- If a change affects setup or play, update the Setup and Play Guide too.
- Before committing, check no file is empty or truncated (an empty `manifest.json` once shipped by mistake).
- The Agamador/OwlBear-llm-chat project has no license: use only as evidence of SDK behavior, never copy its code or art.

## Architecture
- Flat repo, five app files: `server.js` (Node 18+, **zero npm dependencies**: static files + JSON API, Gemini REST, Open5e, Upstash REST, Pollinations, SSE), `index.html` (the Owlbear popover panel), `manifest.json`, `icon.svg`, `package.json`. Keep it dependency-free.
- Render: Node, build `npm install`, start `npm start`, Free instance. Merging to `main` doesn't help until the user deploys on Render.
- Env vars — required: `GEMINI_API_KEY`, `ACCESS_CODE`, `GM_CODE`, `MODEL`; optional: `PLAN_MODEL`, `POLLINATIONS_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Owlbear metadata keys: `com.aidm/story`, `com.aidm/access`, `com.aidm/generated`, `com.aidm/auto`, `com.aidm/side`, `com.aidm/mask`; broadcast channel `com.aidm/camera`. Upstash key `aidm:room:<roomId>`.
- AI actions on the map need GM approval, except camera moves. Avoid browser `confirm()` (may be blocked in Owlbear's frame); risky buttons use press-twice.

## Testing
- Run `npm test` (built-in Node test runner; mocks Gemini/Upstash/Open5e via `test/mock-fetch.js`). Live-room steps for the user: `docs/LIVE-TEST-CHECKLIST.md`.
- Claude can't open a live Owlbear room. Test locally: run `node server.js` with mocked Gemini/Upstash/Open5e, and load the panel in a browser with a stub Owlbear SDK (outside Owlbear the panel acts as GM).
- Always tell the user exactly what still needs a live-room test.
