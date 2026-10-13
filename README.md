AI Dungeon Master: Setup and Play Guide
Oct 13, 2026 · @Rawr
What you're building
An AI Dungeon Master that lives inside Owlbear Rodeo and runs D&D 2024 (5.5e) games for 5 or more players, on free services only. This guide covers version 0.7.0: setup from scratch, then how to play.
The AI DM narrates, plays monsters and NPCs, builds campaigns and session briefs, draws maps with monsters in them, runs combat turns for the monsters, and proposes map changes that you approve. Players type what they do, roll dice in the panel, and keep a character card.
Four free pieces work together:
Piece	What it does	Where
Owlbear Rodeo	The virtual tabletop your group plays in	owlbear.rodeo
GitHub	Stores the 5 project files	github.com
Render	Runs the small server those files make (free web service)	render.com
Google Gemini	The AI that writes the DM's words	aistudio.google.com
Two optional free extras: Upstash (a database that keeps your game safe between sessions) and a Pollinations key (more reliable floor art).
Part 1: Core setup (about 30 minutes, once)
You already did this part. Use it to rebuild from scratch or to check a setting.
1. Get a Gemini key
Go to aistudio.google.com/apikey and sign in with a Google account.
Click Create API key and copy it somewhere safe.
Do not turn on billing. The free tier is enough.
2. Put the 5 files in one folder
On Windows, open File Explorer, click View, then Show, and tick File name extensions.
Make a folder called owlbear-dm.
Put these 5 files in it: index.html, manifest.json, icon.svg, server.js, package.json.
Check the names exactly: no .txt on the end and no (1) from a second download.
Check no file shows 0 KB. An empty file breaks the extension.
3. Upload to GitHub
Sign in at github.com and create a public repository named owlbear-dm.
Click Add file, then Upload files, drag in all 5 files, and click Commit changes.
To update later: the same steps. Files with the same name are replaced.
4. Create the server on Render
Sign in at render.com with your GitHub account.
Click New +, then Web Service, and pick the owlbear-dm repository.
Set Language to Node, Build command to npm install, Start command to npm start, and Instance type to Free.
Add the environment variables from the table below, then create the service.
Wait for the green Live label. Your server address looks like https://your-name.onrender.com.
Environment variables (Render: your service, then Environment)
Name	Required?	What to put
GEMINI_API_KEY	Yes	Your Gemini key from step 1
ACCESS_CODE	Yes	A password for everyone at the table
GM_CODE	Yes	A different password, only for you
MODEL	Recommended	The model for live story turns. A Flash-Lite model has the biggest free daily allowance
PLAN_MODEL	Recommended	The model for planning (campaigns, briefs, maps, moves), e.g. gemini-3.8-flash
UPSTASH_REDIS_REST_URL	Optional	Database address (Part 2)
UPSTASH_REDIS_REST_TOKEN	Optional	Database token (Part 2)
POLLINATIONS_KEY	Optional	Free image key (Part 2)
After changing any variable, click Manual Deploy, then Deploy latest commit, and wait for Live. Copy exact model names from Google's pricing page, because they change over time.
5. Check the server
Open https://your-name.onrender.com/manifest.json in your browser. You should see text that includes "version": "0.7.0". A blank page means manifest.json on GitHub is empty: upload it again.
Part 2: Free extras (about 10 minutes)
Set up the database before your first real session. Without it, the story, campaign, characters and combat live only in the server's memory, and Render's free server forgets everything when it restarts or falls asleep.
Database: Upstash (recommended)
The free plan gives 500,000 database operations a month and 256 MB, far more than a weekly game uses. Each room is kept for 180 days after its last change.
Go to console.upstash.com and sign up with GitHub or Google. No card is needed.
Open the Redis tab and click + Create Database.
Name it owlbear-dm. For Primary Region, pick the one closest to your Render server (for example a US region). Click Next.
Choose the Free plan and create the database.
On the database page, find the Connect section and choose the REST tab. It shows two values: UPSTASH_REDIS_REST_URL (starts with https:// and ends in upstash.io) and UPSTASH_REDIS_REST_TOKEN (a long code).
In Render, open your service, then Environment. Add both, with exactly those names and values.
Click Manual Deploy, then Deploy latest commit, and wait for Live.
To check: open GM tools and press Unlock. The status line should end with "Your game is saved to the database."
Keep the token private. Anyone who has it can read and change your saved games.
Floor art: Pollinations key (optional)
The map can paint floor art inside revealed rooms. Without a key it uses Pollinations' anonymous service, which is slow, adds a small watermark, and is sometimes refused (error 402).
Go to enter.pollinations.ai and sign in. Do not add payment.
Copy the API key from your dashboard.
In Render, add an environment variable named POLLINATIONS_KEY with that key, then Manual Deploy.
Art pictures are not saved in the database. After a server restart, press Add art to current map to paint them again.
Part 3: Add the extension to Owlbear
First time
Sign in at owlbear.rodeo and open your profile page.
Click Add Extension and paste https://your-name.onrender.com/manifest.json.
Open your room. If the extension isn't on, turn it on: the star icon, then Extensions, then AI Dungeon Master.
Make sure the room has a scene open (the scenes menu). The map tools need one; a blank scene is fine.
Click the d20 icon at the top left to open the panel.
Open GM tools, type your GM code and press Unlock. Type the player access code in Player access code. Your panel shares it with every player in the room, so players never type it.
Open your panel before the players open theirs. Until you do, players see "Waiting for the GM".
After every update
Upload the changed files to GitHub and commit.
Wait for Render to show Live (it usually starts by itself; if not, Manual Deploy).
Open /manifest.json and check the version number changed.
In Owlbear, remove the extension from your profile and add it again with the same address. Owlbear keeps an old copy of the panel otherwise.
Part 4: Session zero (start a campaign)
Session zero turns your world idea and the players' characters into secret campaign notes, with a personal hook for every character. It uses 1 AI request, plus 1 for session 1's brief.
Players: fill in your character card
On the story screen, click My character.
Fill in name, species, class, level, max HP, AC, initiative bonus, and a few lines of backstory and goals.
Click Save character. Update it any time, for example when you level up.
The card is tied to your Owlbear player name, so keep the same name every session. The AI DM sees every card; max HP and AC also go into the combat tracker.
GM: build the campaign
Open GM tools, unlock, and open the Campaign (session zero) section.
Press Refresh party to check every player's card arrived.
Set Sessions planned and describe your world: setting, tone, themes, and lines and veils (topics to avoid or keep off-screen).
Press Build campaign and wait up to a minute.
Read the secret campaign notes. Edit anything you like, then press Save notes. The DM uses them in every reply but never quotes them.
Press Post intro to story to show the players the opening narration.
Press Prep next session only to draft session 1's brief. It lands in Session brief and is saved.
Pressing Build campaign again replaces your notes, so it asks you to press twice.
Part 5: Running a session
Before players arrive (GM, about 5 minutes)
Session brief: use the brief from Prep next session, or press Draft one-shot for a standalone game (set level, players and theme first). Edit it and press Save brief.
Build the map and monsters: press Build map + monsters. Leave Hide unexplored rooms ticked so only the first room shows. Tick Paint floor art for a painted floor inside revealed rooms.
Check the Rooms list under the map. Reveal rooms there as the party explores, or approve the DM's reveal suggestions.
Rebuilding replaces the old generated map and its monsters. If the build fails with a format error, it already retried once; press it again.
Playing (everyone)
Each player types what their character does and presses Say. This does not use the AI.
When everyone has spoken, one person presses Ask DM. That is 1 AI request for the whole round.
When the DM asks for a roll, roll in the panel: type it in the roll box (for example 1d20+5 attack) and press Roll, or use d20, Adv or Dis. Words after a quick button's roll become its label: type stealth then press d20.
Rolls show in green with a die and are visible to everyone, including the DM.
Leave send map ticked so the DM knows where tokens stand. Untick follow DM camera if you don't want your view moved.
The DM's suggestions (GM)
After Ask DM, the DM may propose map changes. They appear in a gold card on your story screen only. Press Approve or Skip for each, or Approve all.
Suggestion	What happens when you approve
Reveal a room	The room, its corridors and its monsters appear
Spawn	New creatures appear; the card says how many of that kind are already on the map
Move	The token moves; if the square is taken or a wall, it goes to the nearest open square
Remove	One named creature is removed
Damage / heal	The combat tracker's HP changes
Fog, light	Whole-scene fog on or off; a light on a token
Camera	Runs without approval and moves everyone's view
Useful GM extras
Enemy moves: press Suggest moves for tactical positions outside the combat tracker. Nothing moves until you press Apply.
Add one more creature: place anything the brief missed.
Monster stat blocks: shows the official stats the DM is using for monsters on the map (2024 rules first, 2014 if needed).
Part 6: Combat
The tracker keeps the turn order and HP, and the AI runs all the monsters whose turns come together in one request.

combat turn loop · 3 setup steps, 1 decision
After setup, every Next turn goes back to the same question: a player's turn waits for Ask DM, a run of monsters is handled in one request.
Starting a fight (GM)
Make sure every monster is on the map: reveal its room, or approve the DM's spawn.
In GM tools, open Combat and press Start combat. Everyone on the map joins: player characters from their cards, and monsters, NPCs and allies with official HP and AC. Monster initiative is rolled and shown in the story.
Players press Roll initiative in the red combat box on the story screen. If a player rolls physical dice, type their result into the box next to their name.
Press Begin round 1 (in the combat box or GM tools). Anyone who hasn't rolled is rolled for automatically.
Each turn
A player's turn: the player says what they do and rolls in the panel; someone presses Ask DM. If the DM says a monster is hit, approve its damage suggestion and the tracker updates.
Next turn (GM): moves to the next creature. When it reaches monsters, the DM handles every monster in a row in one request. It uses fair dice the server rolled in advance, shows the math, and proposes moves and damage for you to approve. Then it announces whose turn is next.
HP: the GM can type any number in the tracker. Each player can change their own HP. Players see monsters as Healthy, Bloodied or Down; only the GM sees the numbers.
Down: a monster at 0 HP is crossed out and skipped. Remove its token when you like.
Ending a fight
Press End combat twice. Players' current HP is saved on their cards for next time.
A fight of 3 rounds with one block of monsters per round uses about 3 requests for the monsters, plus 1 per Ask DM.
Part 7: Ending a session
One button closes the session and prepares the next one, using 2 AI requests.
In GM tools, open Campaign and type any wishes for next time in the box (optional).
Press End session: recap + prep next twice.
The DM posts a player-safe recap to the story, adds "After session N" notes to your secret campaign notes, and drafts the next session's brief into Session brief.
Read the brief and edit it if you like. Build its map when you're ready to play, or at the start of next session.
At the start of the next session
Optionally press Clear story (Housekeeping, press twice) for a fresh log. The campaign, characters, brief and map are kept.
Press Post last recap to story so everyone remembers where they left off.
With the database on, all of this survives server restarts. Without it, play the session in one sitting.
Free limits and troubleshooting
A typical session uses 40 to 60 AI requests. Say, rolls, the tracker and room reveals use none.
What uses AI requests	Requests
Ask DM	1
A run of monster turns in combat	1
Build campaign, Prep next session, Draft one-shot	1 each
Build map + monsters	1 (2 if it retries)
Suggest moves	1
End session (recap + prep)	2
The free Gemini allowance differs by model and changes over time. Check Google's rate limits page. Use a Flash-Lite model for MODEL (live story) to stretch it. Google may use free-tier inputs to improve its products.
Problem	What to do
"Waiting for the GM"	The GM opens the panel once so the access code is shared
"Wrong or missing GM code"	Retype the GM code in GM tools and press Unlock
Adding the extension fails with a JSON error	manifest.json on GitHub is empty or wrong: upload it again
Panel looks like an old version	Remove and re-add the extension in Owlbear
"The free AI quota is used up"	Wait a minute, or until tomorrow if it's the daily cap
First message is slow	The free Render server was asleep; it wakes in about a minute
"Couldn't read the saved game from the database"	Upstash didn't answer; wait a moment and try again. Nothing was lost
"No scene is open"	Open or create a scene in Owlbear, then build again
Art missing after a restart	Press Add art to current map
Image service error 402	Add a free POLLINATIONS_KEY (Part 2), or try later
A token moved to a different square	The target was taken or a wall; the GM status line says where it went
"could mean Goblin Warrior 1, Goblin Warrior 2"	Two creatures share that name; move it by hand or ask the DM to name one
A player can't roll initiative	Their Owlbear name must match the name on their character card; the GM can type it instead
Sources
Upstash Redis REST API
Upstash free plan limits (snapdeploy, Sept 2026)
Pollinations API (GitHub)
Owlbear Rodeo docs: Fog
Open5e API: monster stats from the D&D SRD 5.1 and 5.2 (CC BY 4.0, Wizards of the Coast)
