# Changelog

Newest first. Full details for each version are in `AI-DM-Project-Handoff.md` (section number in brackets).

## v0.7.1 — 2026-10-25 [§22] — untested live
- Fix: Adv / Dis with a modifier ("+3 stealth" in the roll box, or typing `adv+3`) used to drop the +3 or fail; a label starting with "d" ("dex save") was dropped by the quick buttons.
- Fix: Begin round 1 with nobody in the combat crashed with a confusing error; now it explains what to do.
- Fix: if the AI fails during the monsters' turn (for example the free quota), the next Next turn tries the monsters again instead of silently skipping them (a second failure lets you skip).
- Added automatic tests (`npm test`, no packages needed) and `docs/LIVE-TEST-CHECKLIST.md` (15-minute live test).
- **Still to test in a real room:** everything in the checklist (all v0.7.0 features are still untested live).

## Earlier, unreleased
- Added `CLAUDE.md` and this changelog so the project can be worked on from Claude Code. No app changes.

## v0.7.0 — 2026-10-13 [§21] — untested live
- Dice rolled in the panel (server side), combat tracker with initiative and monster turns, character cards, session zero campaign builder, end-of-session recap and next-session prep, Upstash database so games survive Render restarts. Setup guide refreshed.
- **Still to test in a real room:** character cards; dice (Roll, d20, Adv, Dis); a full combat; campaign build + Post intro; End session recap + prep; server restart keeps the game; player view of the combat tracker.

## v0.6.2 [§20] — re-test folded into v0.7.0
- Clear story fix (re-test with a player window open).

## v0.6.1 [§19] — re-test folded into v0.7.0
- Fixes from the v0.6.0 test: AI spawn/move/remove actions, Build map + monsters, Suggest moves near player tokens.

## v0.6.0 [§18] — re-test folded into v0.7.0
- Players get the access code from the GM's panel (no typing), live updates via SSE, official SRD stat blocks from Open5e (GM only).

## v0.5.1 / v0.5.2 [§16–17] — passed live
- Floor art shown only inside revealed rooms; reveal works for players.

## v0.5 [§15]
- Scene art from Pollinations on the MAP layer.

## v0.4 [§14] — passed live
- Hidden rooms, scene awareness.

## v0.3 [§13]
- Build map + monsters, AI actions with GM approval.

## v0.2 and earlier [§1–6]
- Narrator DM with shared story, GM tools, one-shot drafter, enemy move suggestions.
