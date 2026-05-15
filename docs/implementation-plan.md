Step 1 — Project scaffolding & infrastructure
Set up package.json, folder structure (/src/routes, /src/controllers, /src/services), copy in logger.js, managed-file.js, boot.js, wire up server.js with /health endpoint and .env. Verify with a basic server test.

Step 2 — Data layer & API
Design the JSON schema for journal pages (all 5 types). Build journalService.js to read/write via managed-file.js with in-memory caching. Expose REST endpoints: GET /api/pages, GET /api/pages/:id, POST /api/pages, PUT /api/pages/:id, DELETE /api/pages/:id. Unit tests covering CRUD + cache behavior without touching real NAS.

Step 3 — Shell UI (layout + navigation)
Build the persistent two-column shell: left sidebar (Table of Contents button + journal page list with badges/progress bars) and the main content area. Wire up client-side routing so clicking a sidebar item fetches and renders the page. No page content yet — just navigation working end-to-end.

Step 4 — Table of Contents page
Render the ToC page grouped by page type, with clickable links. This is read-only and exercises the full fetch → render pipeline.

Step 5 — Lists page (ordered + unordered)
Ordered/unordered list view with prominent numbers, subtask chips, drag-to-reorder. Add/edit/delete items. Sidebar badge updates on change.

Step 6 — Progress Bar page
Global progress bar at top, per-task STARTED/WORKING/DONE state chips, optional notes column. Sidebar mini-bar updates on change. Heatmap data fed from this page type.

Step 7 — Notes page
Top input area + multi-column card grid of saved notes. Add/delete notes with delta DOM updates.

Step 8 — Rich Text (Page) page
Toolbar (B/I/U, font size, font family) + contenteditable editor. Save/load rich text content.

Step 9 — Home page heatmap
Aggregate progress across all progress-bar pages into a color-coded grid heatmap. Rendered on the home/default view.

Step 10 — Gamification polish
Achievement/completion fanfare (CSS animations, sound optional), visual rewards on task completion, thematic game-journal styling throughout (badge glows, chip transitions, etc.).