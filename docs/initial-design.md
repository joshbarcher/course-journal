# General App Info
This app will allow me to gamify + self motivate progress in my courses.
The analogy for the web app is a journal, with many progress indicators
to identify + encourage long term process. Pages are displayed in the
journal. Notes (short text) + pages (long text, rich text) can be stored
in the journal as well.

# Coding Principles
Use ESM modules, prefer await/async rather than promise.then(), no IIFE's
Use express.js for the web server
Plain HTML/CSS/JS only, no frameworks (besides express)
No embedded CSS with style-tag or embedded JS with script tag. Break up things up, a separation of concerns
No SSR, prefer API endpoints + front-end fetch() calls + UI updates
Break up app into services + controllers + routers
UI is built with night mode
UI has a modern, professional interface, with usability in mind
All data is stored in JSON files, under the /data folder (no formal databases)
Don't overengineer the app. KISS principle.
.env files should be loaded using the --env-file flag and not dotenv. 
PORT should be an expected value in the .env file
Unit tests are provided at each step verifying the work. Use the built-in Node test features.
Unit tests should never work on the real data in the NAS folder $DATA_DIR.
Updates to files should not hammer the NAS folder, taking into account caching + healthy updates sent
to the NAS.
No full UI or full component lazy rerendering code. Apply deltas to the UI by writing performant updates, only adding/removing what changed.
Never use prompt/confirm/alert. Use custom dialogs and only when appropriate. These should be used sparingly.

# Server design
All code is under /src
Entrypoint is /src/server.js
Unit tests are located under /src/tests   
Server should support a /health endpoint using this code + format:

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

export function getHealth(req, res) {
    res.json({ status: 'ok', uptime: formatUptime(process.uptime()) });
}

Server should stored PORT=8060, DATA_DIR=\\192.168.86.74\data-dir in the .env file. 
All slides are stored in the $DATA_DIR\course-journal folder.

The project should use the logger found here. Follow the migration guide: C:\dev\process-mgr\logger.js.

The project should copy across the C:\dev\media-server\shared\utility\managed-file.js script to this project folder
and use it to provide files that are robust, recoverable, and backed up. Double check that the use of the features
in this script match the problem.

The project should copy across the C:\dev\urls\src\boot.js script and use it to prevent ports from
being locked when server starts. I use pm2 on ubuntu when deployed, so I won't need this there, but
this works on my dev boxes.

# App Description
The application should have a home page:
- Shows table of contents + journal pages in a left scroll area
- Shows a heatmap with global progress in the right area
- There should be a button on the page for adding/selecting a new journal page

The application should have a table of contents:
- High level, one page view, with links to all journal pages

The application should have support different types of pages:
- Ordered lists - contain tasks + subtasks, progress is identified by whether the tasks have title text and whether subtasks are added, numbers are prominent and list is sorted, list items can be dragged around
- Unordered lists - same as ordered list, but no numbers, original insert order is default, list items can be dragged around
- Progress bar - multi level progress bar, with tasks, each task has started - in-progress - done states, with a global progress bar at the top (also supports notes on the page)
- Notes - lets you add multiple related short plaintext notes on a journal page
- Page - lets you add long richtext content to track things like lectures, plan course changes, reminders, etc...

All progress bars need to be synced to the API (read below) and the heatmap on the home page, and the progress bars shown on the journal pages in the left panel on the home page.

# Mockups
Each page (home, table of contents, view list, view progress bar, view notes, view page) has mockups that should be used to align your decisions and determine the definition of done (generaly speaking). They mock up how the UI should look like when finished.

# Web API
The application should expose the data per course, so that other apps can track/consume progress or notes/pages.

# App theme
The app should be gamified and resemble a journal you might open in a game, being designed for encouraging the user to track their progress, be very visual, feel rewarding to use and push me to complete tasks. Not nag. Achievement awards + completion fanfair. Make it fun + visually interesting.

For inspiration, you can view the screenshots of the gaming journals from games I enjoy. These can be used to gauge how aligned you are thematically, just make sure the app is nightmode, which the games are not.