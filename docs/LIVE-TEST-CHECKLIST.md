# Live test checklist (v0.7.1)

About 15 minutes. You need two browser windows: one for you (the GM) and one for a "player".
The easiest player window is a private window (Chrome: Ctrl+Shift+N; Edge: Ctrl+Shift+N; Firefox: Ctrl+Shift+P), signed in as a second free Owlbear account or joining as a guest.

Uses about 3–6 Gemini requests. Tick each box. If a step fails, write down the step number, what you saw and the exact message, then carry on with the next step if you can.

Replace `your-name` below with your real Render address.

## Before you start (not counted in the 15 minutes)

- [ ] **0a. Get the new files onto Render.** Merge the pull request on GitHub. If Render is connected to a different repository (the guide calls it `owlbear-dm`), upload the 5 changed app files there too: `server.js`, `index.html`, `manifest.json`, `icon.svg`, `package.json`. (The `test` and `docs` folders are not needed on Render.)
  **Expected:** Render shows a new deploy, then the green **Live** label.
- [ ] **0b. Wake the server and check the version.** Open `https://your-name.onrender.com/manifest.json`. The free server can take up to a minute to wake up.
  **Expected:** text containing `"version": "0.7.1"`. A blank page means `manifest.json` is empty: upload it again.
- [ ] **0c. Refresh the extension in Owlbear.** On your Owlbear profile page, remove AI Dungeon Master, then **Add Extension** with `https://your-name.onrender.com/manifest.json` again.
  **Expected:** the extension is listed again with the d20 icon.

## 1. Opening the panel (2 minutes)

- [ ] **1. GM opens the panel.** Open your room in your normal window. Make sure a scene is open (scenes menu; a blank scene is fine). Click the d20 icon at the top left.
  **Expected:** the panel opens with the story screen and a **GM tools** button. No red error text.
- [ ] **2. Unlock GM tools.** Click **GM tools**, type your GM code, press **Unlock**. Type the player access code in **Player access code** if it is empty, then click outside the box.
  **Expected:** a status line starting "Unlocked." and ending either "Your game is saved to the database." (Upstash is set up) or "No database is set up..." (it isn't). Write down which one.
- [ ] **3. Player opens the panel.** In the private window, join the same room (use the room link) and click the d20 icon.
  **Expected:** within about 5 seconds the player sees the story screen with **no** GM tools button and **no** "Waiting for the GM" message. (If "Waiting for the GM" stays, the access code did not reach the player: note it.)

## 2. Character card, dice and story (4 minutes)

- [ ] **4. Player saves a character.** Player window: **My character** → name "Ann", species, class, level 1, max HP 20, AC 15, initiative bonus 2 → **Save character** → back.
  **Expected:** "Saved. Your GM and the DM can see your character now."
- [ ] **5. GM sees the card.** GM window: GM tools → **Campaign (session zero)** → **Refresh party**.
  **Expected:** a line like "Ann: Elf Wizard 1, HP 20/20, AC 15 (player name)".
- [ ] **6. Dice.** Player window, in the roll box type `1d20+5 attack` and press **Roll**. Then type `+3 stealth` and press **Adv**.
  **Expected:** two green 🎲 lines appear in **both** windows within 1–2 seconds:
  "rolls 1d20+5 for attack: [n] + 5 = **total**" and "rolls adv+3 for stealth: [a, b → higher] + 3 = **total**". (Before v0.7.1 the second one lost the +3.)
- [ ] **7. Story and Ask DM.** Player types "I look around the room" and presses **Say**. GM presses **Ask DM**.
  **Expected:** the player's line appears in both windows at once. After 5–30 seconds the DM's narration appears in both windows. It must read like a story, never like code (`{"narration": ...`). If you see a "free AI quota" message, wait a minute and press Ask DM again.

## 3. A short combat (6 minutes)

- [ ] **8. Add a monster.** GM tools → **Add one more creature**: name `Goblin Warrior`, count 1, side Enemy → **Spawn**.
  **Expected:** a red square labelled "Goblin Warrior" appears on the map near cell 5,5 (zoom out if you can't see it).
- [ ] **9. Start combat.** GM tools → **Combat** → **Start combat**.
  **Expected:** a grey "⚔️ Combat!" line in both windows naming the goblin's initiative. Both windows show a combat tracker. The player window shows a **Roll initiative** button.
  Note: tokens you dragged in from Owlbear's own library count as *players* (only tokens made by this panel are marked as monsters).
- [ ] **10. Player rolls initiative.** Player presses **Roll initiative**.
  **Expected:** a green "Ann rolls initiative: [n] + 2 = **total**" line; the button disappears.
- [ ] **11. Begin round 1.** GM presses **Begin round 1**.
  **Expected:** a "Round 1. Turn order: ..." line. If Ann is first: "it's Ann's turn". If the goblin is first: after 5–30 seconds the DM narrates the goblin's attack with the dice maths, and the GM sees approval cards (for example "Ann takes 5 damage").
- [ ] **12. Monster health is hidden from players.** Look at the tracker in the player window.
  **Expected:** the goblin shows "Healthy" / "Bloodied" / "Down", not HP numbers. The GM window shows numbers and AC.
- [ ] **13. Next turn until the goblin acts.** GM presses **Next turn** (once or twice) until the goblin has had its turn, then **Approve** any damage card (if the goblin missed there is no damage card; that's fine).
  **Expected:** Ann's HP in the tracker drops by the damage in both windows. If the AI fails (for example the free quota), the GM sees the error ending in "Press Next turn to try the monsters' turn again." Pressing **Next turn** tries again instead of skipping the goblin (new in v0.7.1).
- [ ] **14. End combat.** GM presses **End combat**, then **Really end?** within 4 seconds.
  **Expected:** "Combat is over." in both windows, the tracker disappears. GM tools → Campaign → **Refresh party** shows Ann's HP after the damage (for example "HP 15/20").

## 4. Saving and clearing (3 minutes)

- [ ] **15. Server restart keeps the game** (only if step 2 said "saved to the database"). Wait 5 seconds after the last action. In Render, open your service → **Manual Deploy** → **Deploy latest commit**, wait for **Live**, then close and reopen the panel in both windows.
  **Expected:** the whole story (rolls, DM narration, combat lines) is still there, and **GM tools → Refresh party** still shows Ann. Map art is not saved (expected; use **Add art** again).
- [ ] **16. Clear story with a player watching.** GM tools → **Housekeeping** → **Clear story**, then **Really clear?** within 4 seconds.
  **Expected:** "Story cleared for everyone." The story empties in **both** windows and stays empty after 10 seconds.

## If you have 5 more minutes (optional, uses 2 more AI requests)

- [ ] **17. Campaign build.** GM tools → Campaign: type a one-line world idea → **Build campaign**.
  **Expected:** secret notes fill the notes box within about a minute, and a **Post intro to story** button appears. Press it: the intro appears in both windows.

## What to send back

The step numbers that failed, what you saw (a screenshot helps), and which message step 2 showed.
