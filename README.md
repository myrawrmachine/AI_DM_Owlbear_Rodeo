AI Dungeon Master for Owlbear Rodeo: Free Setup Guide (Gemini)
This guide takes you from nothing to a working AI DM panel in your Owlbear Rodeo room, using only free services. It is written for a Windows computer and for a group of 5 or more players. Follow every step in order. Total time: about 45 minutes.
What you're building: a panel inside Owlbear Rodeo that all your players share. Players type what their characters do, then one person presses Ask DM. Google's Gemini AI replies as the Dungeon Master (2024 / 5.5e rules) to everyone at once. It can also see the names and positions of tokens on your map.
Why one "Ask DM" button: the free Gemini tier limits how many requests you can send per minute and per day. With 5+ players, one request per round (instead of one per person per message) keeps you well inside those limits.
Cost: $0, as long as you never switch on billing in Google or Render. Free tiers can change, so check the links in Step 1.
What you need: a Windows computer, a Google account, an email address, and the five files from this chat.
Step 0: Check that your Owlbear account can add extensions
Go to owlbear.rodeo and log in (create a free account if you don't have one).
Open your profile and look for an Add Extension button (or an Extensions section with an Add button).
If you can see it, carry on. If it is locked or asks you to upgrade, stop and tell me exactly what it says.
Step 1: Get a free Gemini API key
Go to aistudio.google.com/apikey and sign in with your Google account.
Click Create API key. If it asks for a project, choose to create a new one.
Copy the key immediately and paste it into Notepad. Save that note somewhere only you can see.
Do not enable billing if Google offers it. That keeps you on the free tier.
Good to know:
The free tier only covers certain models, and Google changes which ones. The server uses gemini-2.5-flash by default. To see which models are currently marked free, open ai.google.dev/gemini-api/docs/pricing and look for models with "Free of charge" under the free tier.
Current request limits are listed at ai.google.dev/gemini-api/docs/rate-limits.
On the free tier, Google may use what you send to improve its products. That's fine for a D&D game. Don't type anything personal.
Never post your key publicly or send it to anyone.
Step 2: Save the five files
First, make file extensions visible so Windows doesn't hide a bad name:
Open File Explorer.
Click View, then Show, then tick File name extensions.
Then:
Download all five files from this chat: index.html, manifest.json, icon.svg, server.js, package.json.
Create a new folder on your Desktop called owlbear-dm and move all five files into it.
Check each name. It must be exactly as written, with no .txt on the end and no "(1)" in the name. If Windows renamed one, right-click it, choose Rename, and fix it.
Step 3: Put the files on GitHub
GitHub is where Render will fetch your files from.
Go to github.com and create a free account.
Click the + at the top right, then New repository.
Name it owlbear-dm. Leave it Public. Don't tick any extra boxes. Click Create repository.
On the next page, click the link that says uploading an existing file.
Open your owlbear-dm folder, select all five files, and drag them into the browser box. Drag the files themselves, not the folder.
Wait until all five show as uploaded, scroll down, and click Commit changes.
Your API key is not in these files, so a public repository is safe.
Step 4: Put it online with Render
Render runs your server for free and gives it a web address.
Go to render.com and sign up with Sign in with GitHub.
Click New +, then Web Service.
Choose your owlbear-dm repository. If it isn't listed, use the option to configure GitHub access and allow that repository.
Fill in the settings:
Language / Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
Under Environment Variables, add these:
Name GEMINI_API_KEY, value: the key from Step 1.
Name ACCESS_CODE, value: a password you invent, like dragon-fruit-42. This stops strangers from using your free quota.
Optional: name MODEL, value: a different free model name from the Google pricing page (only if the default doesn't work).
Click Create Web Service and wait for the status to say Live. This can take a few minutes.
Copy your web address from the top of the page. It looks like https://owlbear-dm-abcd.onrender.com.
Step 5: Test it before touching Owlbear
In a new browser tab, open your web address followed by /manifest.json. You should see text starting with { "name": "AI Dungeon Master".
Open the plain web address. You should see a dark chat panel.
Type your access code in the Access code box, type "Test: I enter the tavern" in the message box, and click Say. Your message should appear in the log.
Click Ask DM. After a few seconds, a DM reply should appear. The first request may take up to a minute if the server was asleep.
If you see a DM reply, the hard part is done.
Step 6: Add it to Owlbear Rodeo
Menu names can shift slightly over time, but the idea is the same:
In Owlbear Rodeo, open your profile and click Add Extension. (From inside a room you can also click the star icon at the bottom left, then Extensions, then Add +.)
Paste your manifest link: your web address plus /manifest.json. Click Add.
New room: when you create a room, tick your extension in the Create Room dialog.
Existing room: open the room's Extensions menu and make sure your extension is switched on.
In the room, look at the top left for a new d20-shaped icon. Click it and the DM panel opens.
Every player needs to add the extension to their own account with the same link, and enter the access code once in the panel. Players you invite to your room should be able to use it, but check on game night before everyone arrives.
Step 7: Run a session
Everyone opens the panel and enters the access code once. It is remembered on that device.
Name the tokens after your characters. The DM reads token names and grid positions when send map is ticked.
Each player types what their character does and presses Say. Everyone sees everyone's messages.
When most players have spoken, one person presses Ask DM. The DM replies to everyone.
Players roll the dice themselves and type the results with Say.
Repeat.
Tip: pick one player to be the "Ask DM" person so you don't accidentally trigger it twice.
Troubleshooting
/manifest.json says "Not found": a file name is wrong (extra ".txt", a "(1)", different capitals) or a file didn't upload. Check the GitHub repository.
Render build failed: make sure package.json is in the repository exactly as provided, and the build and start commands match Step 4.
"Wrong or missing access code": the code in the panel must exactly match ACCESS_CODE in Render, with no extra spaces.
"Server has no GEMINI_API_KEY set": add or fix that variable in Render, then use Manual Deploy.
"AI error" about an API key not being valid: re-copy the key from Google AI Studio into Render. No spaces before or after.
"AI error" mentioning the model: open Google's pricing page, find a model marked free, put its exact name in a MODEL variable in Render, and redeploy.
"The free AI quota is used up": you hit a rate limit. Wait a minute, or until the next day if it's the daily cap, and press Ask DM less often.
"The AI returned an empty answer": Google may have blocked the reply. Rephrase or add a new player action and ask again.
Panel blank inside Owlbear but works in a normal tab: the Render server is asleep. Open your web address in a tab, wait for it to load, then reopen the panel.
Changed an environment variable and nothing happened: Render needs to redeploy. Use Manual Deploy.
Know the limits (so nothing surprises you)
The story is stored in the server's memory. If Render restarts or puts the free server to sleep after you've all left, the story is cleared. At the start of each session, say a short recap in the panel so the DM has context.
Free server sleeps after a period of no use, so the first request of the night can be slow. Open your web address in a browser tab a few minutes before the game.
Free quota is shared by everyone. It is per Google project, not per player.
Free models are weaker than paid ones, so expect the DM to occasionally forget details or misquote a rule.
The DM can't roll dice or move tokens yet. It only reads the map.
Anyone with your access code can use your quota, so only share it with your players.
Free tiers change. If Google removes the model you use, switch MODEL to another free one.
What to build next
Come back to this chat and ask for the next step, in this order:
Saved campaign memory that survives restarts.
Monster and rules data the DM looks up.
Dice rolled by the system, and combat tracking.
Letting the DM move tokens and spawn monsters, with your approval.
A "session zero" flow that builds the whole campaign with your group.
Links you'll need
Owlbear Rodeo: owlbear.rodeo
Owlbear extension docs: docs.owlbear.rodeo/extensions/getting-started
Google AI Studio (get your key): aistudio.google.com/apikey
Gemini pricing and free models: ai.google.dev/gemini-api/docs/pricing
Gemini rate limits: ai.google.dev/gemini-api/docs/rate-limits
GitHub: github.com
Render: render.com
