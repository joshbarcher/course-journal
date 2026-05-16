# course-journal — Build Results

> A running reference for what was built, how it works, and the patterns to carry forward into future projects (e.g. gaming-journal).

---

## What the app is

A self-hosted, single-page journal for tracking online courses. Each **Course** contains **Pages**. Pages come in five types. Everything persists to JSON on disk with no database.

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js v24 (ESM, `"type": "module"`) |
| Server | Express 5 |
| Frontend | Vanilla HTML + CSS + ES modules — no framework |
| Persistence | JSON files via `ManagedFile` (atomic writes, 30 s flush) |
| Process host | process-mgr (port 8060) |

---

## Data model

### Storage layout
```
$DATA_DIR/
  course-journal/
    courses.json          ← list of course records
    courses/
      {courseId}.json     ← one file per course, contains all pages
```

### Course record
```json
{ "id": "uuid", "title": "...", "createdAt": "ISO", "updatedAt": "ISO" }
```

### Page record (inside `{courseId}.json`)
```json
{
  "id": "uuid",
  "type": "list | progress | progress-bars | notes | page",
  "title": "...",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  // ...type-specific fields (see typeDefaults in journalService.js)
}
```

#### Per-type shape

| Type | Fields |
|---|---|
| `list` | `ordered: bool`, `items: [{ id, title, done, subtasks[] }]` |
| `progress` | `tasks: [{ id, title, state: null\|started\|working\|done, optional?: bool }]`, `notes: string` |
| `progress-bars` | `bars: [{ id, title, optional?: bool, steps: [{ id, title, state, optional?: bool }] }]`, `notes: string` |
| `notes` | `notes: [{ id, text }]` |
| `page` | `content: string` (rich text) |

---

## Backend architecture

### `ManagedFile` (`src/shared/managed-file.js`)
The backbone of persistence. Features:
- **Atomic writes** — write to `.tmp`, fsync, rename. Never a partial file.
- **Max-interval scheduling** — buffers rapid updates; guarantees a flush within `maxFlushIntervalMs` (set to 30 s). This is NOT a plain debounce — it guarantees a ceiling.
- **Checkpoint** — after each flush, writes a `.checkpoint.json` alongside the main file. If the main file is corrupt on load, the checkpoint is tried automatically.
- **Auditing** — pluggable validator at `set()` time. Violations are quarantined to a timestamped file and never written to disk.
- **Backup** — optional periodic full copy to a separate backup directory.
- **Graceful shutdown** — `close()` flushes pending state before process exits.

### `JournalService` (`src/services/journalService.js`)
Wraps a single `ManagedFile` (one per course). Exposes `getAll`, `getById`, `create`, `update`, `remove`, `reorder`. `update()` strips `id`, `type`, `createdAt` so callers cannot corrupt immutable fields.

### `CourseService` (`src/services/courseService.js`)
Top-level singleton. Owns `courses.json` and a `Map<courseId, JournalService>`. On `load()` it boots all per-course journals. On `copy()` it deep-copies all pages and resets progress state (tasks → `null`, notes → `''`).

### REST API (`src/routes/`)
```
GET    /api/courses
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
POST   /api/courses/:id/copy

GET    /api/courses/:courseId/pages
POST   /api/courses/:courseId/pages
GET    /api/courses/:courseId/pages/:id
PUT    /api/courses/:courseId/pages/:id
DELETE /api/courses/:courseId/pages/:id
PUT    /api/courses/:courseId/pages/order   ← body: { ids: [] }
```

---

## Frontend architecture

### Routing (`public/js/router.js`)
Hash-based. No library.

| Hash | View |
|---|---|
| `#` (empty) | Courses list |
| `#c:{courseId}` | Course home (heatmap) |
| `#c:{courseId}:toc` | Table of Contents |
| `#c:{courseId}:{pageId}` | Page view |

Key decisions:
- `history.replaceState` is used (not `pushState`) to avoid hashchange loops when navigating programmatically.
- Bare IDs in `navigate()` are resolved relative to the active course: `navigate('toc')` → `navigate('c:{id}:toc')`.
- `app.js` imports `router.js`; to close the mobile sidebar from within `router.js` without a circular dependency, `router.js` lazy-imports `app.js` at call time: `import('./app.js').then(m => m.closeMobileSidebar?.())`.

### Renderer registry
```js
registerRenderer('list',          renderList)
registerRenderer('progress',      renderProgress)
registerRenderer('progress-bars', renderProgressBars)
registerRenderer('notes',         renderNotes)
registerRenderer('page',          renderPage)
```
Registered in `app.js`. Router calls `_renderers.get(page.type)(page, container)`.

### Course context singleton (`public/js/course-context.js`)
`getCourseId()` / `setCourseId()` — a one-line global so `api.js` can build page URLs without threading courseId through every call. `api.pagesFor(courseId)` bypasses this singleton for cross-course reads (e.g. heatmap).

### API client (`public/js/api.js`)
Thin fetch wrapper. All methods return parsed JSON or throw. `pagesBase()` calls `getCourseId()` at call time, not import time.

### Sidebar (`public/js/sidebar.js`)
- Each item: `⠿` drag handle + content div + `⧉` dup button + `×` delete button.
- `tabIndex = 0` on items + TOC button; ArrowUp/Down keyboard navigation via `_arrowNav()`.
- HTML5 drag-and-drop for reorder; `_persistOrder()` fires `api.pages.reorder(ids)` on `dragend`.
- Badges: list shows `done/total` (gold when all complete); notes shows count; progress/progress-bars shows a mini fill bar colored using `percentToColor()` (same teal/gold/blue thresholds as the heatmap).
- `refreshSidebarItem(updatedPage)` — replaces a single item in-place; all view modules call this after saving.

### Dialogs (`public/js/dialog.js`)
All browser-native `prompt`/`alert`/`confirm` replaced with Promise-based custom dialogs.

| Export | Purpose |
|---|---|
| `confirmDialog(title, body, label)` | Returns `bool`. Red confirm button. |
| `inputDialog(title, placeholder, default)` | Returns `string\|null`. Gold OK button. |
| `newPageDialog()` | Returns `{ title, type }\|null`. Radio selector for all 5 types. |
| `showError(message)` | Red slide-up toast, auto-dismisses after 4 s. |

Convention: **gold = create/ok**, **red = destructive confirm**.

### Particles (`public/js/particles.js`)
Canvas-based confetti burst. Fired when all **required** (non-optional) steps in a progress-bar bar reach `done`, and on full required-task completion in the progress tracker. Shows a slide-up toast with the bar/task name. Uses a queue offset so multiple simultaneous toasts don't overlap.

### Global plain-text paste handler (`app.js`)
A single `paste` listener on `document` strips rich text from all inputs and contentEditable elements app-wide:
```js
document.addEventListener('paste', e => {
    const t = e.target
    if (!t.isContentEditable && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (t.isContentEditable) document.execCommand('insertText', false, text)
    else {
        const start = t.selectionStart, end = t.selectionEnd
        t.value = t.value.slice(0, start) + text + t.value.slice(end)
        t.selectionStart = t.selectionEnd = start + text.length
    }
})
```

---

## Page views

### Progress tracker (`views/progress.js`)
- Tasks list with Start / Working / Done state buttons.
- State buttons styled with `--state-color` CSS var; active state gets colored border + tinted background via `color-mix()`.
- Global summary bar at top (colored segments, one per task). Optional task segments are dimmed with a dashed border.
- Completion detection: fires particles when all **required** (non-optional) tasks hit `done`.
- **Optional tasks**: right-click any task row → "Mark Optional" / "Unmark Optional". Optional tasks show a dashed row border and an `OPTIONAL` tag. They are excluded from `progressPercent()` and completion detection. The inline delete button is removed; delete is now in the context menu.
- **Drag-to-reorder tasks**: `⠿` handle (absolutely positioned, hover-reveal). Handle `mousedown` sets `row.draggable = true`; `dragend` resets it. This prevents accidental drags when clicking state buttons or editing title. `_persistTaskOrder()` syncs `_page.tasks` from DOM order and saves.
- **Right-click edit guard**: `mousedown` on the title contentEditable calls `e.preventDefault()` when `e.button === 2`, preventing right-click from focusing the field.

### Multi-bar progress (`views/progress-bars.js`)
- Multiple named bars, each containing N step chips.
- Global bar shows all bars as colored segments. Optional bar segments are dimmed.
- Chips fill available horizontal space (`flex: 1`); `+` add-chip button aligned center (`align-self: center`).
- Bar actions moved to **right-click context menu**: "Mark/Unmark Optional", "Duplicate" (states reset), "Delete". Inline copy/delete buttons removed.
- Chip actions also in right-click menu: "Mark/Unmark Optional", "Delete". Inline delete button removed.
- Copy preserves `optional` flags on bar and steps; all step states reset to `null`.
- Completion: fires particles when all **required** (non-optional) chips in a bar reach `done`.
- **Optional bars**: dashed border when incomplete; solid teal border with bright layered `box-shadow` glow when all required steps are done. `_refreshBarRowClass(barId)` updates this live as chips are cycled.
- **Optional chips**: dashed outline when incomplete; same teal glow outline (`pb-chip--optional-done`) when done. `_applyChipState(chip, state, optional)` owns both class and style so they stay in sync.
- **Drag-to-reorder bars**: `⠿` handle, same handle-only pattern as progress tracker. `_persistBarOrder()` syncs `_page.bars`, refreshes numbers, redraws global bar.
- **Drag-to-reorder chips**: whole chip is `draggable="true"`. `dragstart` calls `stopPropagation()` so it never triggers a bar drag. Drop only accepted within the same bar (`parentElement` check). `_persistChipOrder(barId)` syncs `bar.steps` from DOM.
- **Right-click edit guard**: `mousedown` with `e.button === 2` preventDefault on bar title and chip label to prevent focus on right-click.

### List (`views/list.js`)
- **Ordered/unordered toggle**: small `# Ordered` / `• Unordered` button in header. Swaps number circles ↔ empty circles in-place (no full redraw). `ordered` field is included in every save so it persists across reloads.
- **Number circles**: always show the position number — never replaced by a checkmark. `_renumber()` just sets `textContent = i + 1`.
- **Bullet circles**: same 48×48px circle style as number circles, empty (no text or `::before` content). Purely decorative — uniform with ordered lists.
- **Done button**: dedicated `✓` circle button (28px) on the right side of each row. Green (`#4ade80`) when done, transparent/dim when not. Marking done has no visual effect on the title (no strikethrough, no opacity change) — it's not a to-do list.
- **Subtask chips**: inline add, drag-to-reorder within same item, drag to a different list item (chip moves to target item's subtask row, both items' arrays synced from DOM in one save).
- **Item drag**: handle-only (`⠿`, absolutely positioned). `mousedown` on handle sets `el.draggable = true`; `dragend` resets it. This prevents chip drags from accidentally moving whole items.
- **Cross-item chip drop**: handled in `_setupDragDrop`'s `drop` listener. When `_dragChipSrc` is set and the drop target is a `.list-item`, the chip is moved to that item's subtask row and both items' subtask arrays are synced from DOM.
- List pages contribute to the heatmap and achievement badges (same as progress/progress-bars pages).

### Notes (`views/notes.js`)
- Masonry 2-column grid (`columns: 2` CSS).
- Cards are `contentEditable` inline — click to edit, blur to save.
- Delete button uses `mousedown → preventDefault` to prevent premature blur before the click fires.

### Heatmap (`views/heatmap.js`)
Course home view. One row per page (progress, progress-bars, and list); cells are colored by progress/completion state. Clicking a cell navigates to that page. Labels link to pages.

**Optional cell styling:**
- Optional + incomplete: dashed outline on the cell.
- Optional + done: bright white `box-shadow` glow (always-on, no animation) — radiates outward from the cell.

**Achievement badges** appear below the heatmap when any eligible page reaches 100%:
- One badge per completed page; icon and theme cycle independently so adjacent badges always differ.
- Gold star "Course Complete" badge appears when all eligible pages are done.
- **Super badge**: if a completed page also has `isSuperComplete()` true (all optional items done too), its badge gets a double icon (two of the same symbol side-by-side) and a pulsing `box-shadow` glow. Implemented by passing `isSuper` to `_buildBadge()` which renders two `<span>` children inside `.badge-icon`.

### Table of Contents (`views/toc.js`)
Renders all pages as linked list. Links use full `#c:{courseId}:{pageId}` format (not bare IDs).

### Rich text page (`views/page.js`)
`contentEditable` div. Saves on blur.

---

## Page title editing (all views)
All five views expose an editable `<h1>` built by `_buildPageTitle(subtitle)`. It's a `contentEditable` heading that:
1. On `Enter` key: blurs (saves).
2. On blur: trims, skips save if unchanged, calls `api.pages.update()`, then `refreshSidebarItem()`.

This pattern is copy-pasted (not abstracted) into each view module.

---

## CSS architecture

All CSS lives in `public/css/`. No build step. Split by concern:

| File | Contents |
|---|---|
| `base.css` | CSS variables, reset, typography, dialog styles, toast styles |
| `layout.css` | App shell, sidebar, main content, mobile breakpoints |
| `sidebar.css` | Sidebar items, badges, progress track, drag states |
| `courses.css` | Course cards, heatmap mini-grid |
| `pages.css` | Page header, page title editing styles |
| `progress.css` | Progress tracker + multi-bar tracker; optional item styles and glow states |
| `list.css` | List items, subtask chips |
| `notes.css` | Notes input, card grid, card editing |
| `heatmap.css` | Heatmap rows, cells, labels, optional cell glow |
| `badges.css` | Shared badge component; super badge glow |
| `context-menu.css` | Right-click context menu (fixed position, fade-in animation, danger variant) |
| `page.css` | Rich text page |

### Design tokens (CSS variables in `base.css`)
```css
--clr-bg:          #1a1917   /* warm dark base */
--clr-bg-raised:   #222120
--clr-bg-hover:    #2a2928
--clr-border:      rgba(255,255,255,0.09)
--clr-border-hi:   rgba(255,255,255,0.20)
--clr-text:        #e8e3dc
--clr-text-muted:  rgba(232,227,220,0.45)
--clr-accent:      #c9a84c   /* gold */
--clr-accent-bg:   rgba(201,168,76,0.12)
--radius:          6px
--transition:      0.15s ease
--font-ui:         'Inter', system-ui, sans-serif
```

### Mobile layout (≤ 768px)
- Sidebar becomes a fixed overlay (`position: fixed; transform: translateX(-100%)`).
- `.sidebar--open` class slides it in.
- Hamburger button (`#sidebar-toggle`) in the top bar toggles the class.
- Overlay div (`#sidebar-overlay`) covers main content; clicking it closes the sidebar.
- Sidebar has `background: var(--clr-bg)` so it's opaque.
- `#sidebar-nav` has `padding-top: 62px` to clear the hamburger button.

---

## Patterns worth reusing

### Atomic file persistence
`ManagedFile` is fully generic and has no domain knowledge. Drop it into any project. Pair it with a service wrapper that handles the domain schema (see `JournalService` as the template).

### Renderer registry
Decouples routing from rendering. The router just does `renderers.get(type)(data, container)`. Adding a new view type = one `registerRenderer` call. Works cleanly without a framework.

### Promise-based custom dialogs
`dialog.js` is fully self-contained (no dependencies). The pattern — create DOM, append to `<body>`, resolve Promise on close — works for any modal. Copy the file wholesale.

### `refreshSidebarItem(page)`
Any module that saves a page calls this after the API responds. It replaces the sidebar item DOM in-place without re-rendering the whole sidebar. The pattern requires no global event bus.

### `courseContext` singleton
Avoids threading a `courseId` parameter through every API call. When switching contexts (navigate to a different course), call `setCourseId()` once and all subsequent `api.pages.*` calls are automatically scoped. Works because JS modules are singletons.

### `color-mix()` for tinted active states
```css
background: color-mix(in srgb, var(--state-color) 12%, transparent);
```
Gives a subtle tinted background that matches the border color exactly, with no hardcoded hex values.

### Hover-reveal action buttons
Ghost buttons (`opacity: 0`) become visible on parent hover (`opacity: 1`). On mobile (no hover), set `opacity: 0.6` at the breakpoint so they're always accessible.

### Handle-only drag pattern
Used for sidebar items, progress tasks, progress-bars bar rows, and list items. The row itself is NOT `draggable` by default. A `⠿` handle element has `mousedown → el.draggable = true`; the row's own `dragend` resets it to `false`. This prevents child interactive elements (chips, contentEditable titles, state buttons) from accidentally triggering a parent drag. The handle can be `position: absolute` so it takes no layout space and doesn't push sibling elements.

### Child drag inside draggable parent
When chips inside a bar row or list item need their own drag, the chip's `dragstart` calls `e.stopPropagation()` to prevent the parent row's handler from firing. Combined with the handle-only pattern on the parent, the two drag systems are fully independent. A module-level `_dragChipSrc` variable lets sibling event handlers (`dragover`, `drop`) detect which type of drag is active and branch accordingly.

### Shared context menu (`views/context-menu.js`)
`showContextMenu(event, items)` builds a fixed-position menu at the cursor, clamps it to the viewport, and auto-dismisses on outside `mousedown` or Escape. Items are `{ label, action, danger? }` or the string `'separator'`. One active menu at a time — a second call removes the first. Works for both desktop right-click and Android long-press (`contextmenu` event fires on both). Usage pattern in each view:
```js
el.addEventListener('contextmenu', e => {
    showContextMenu(e, [
        { label: 'Mark Optional', action: () => _toggleOptional(id) },
        'separator',
        { label: 'Delete', danger: true, action: () => _delete(id) },
    ])
})
```
To prevent right-click from focusing a `contentEditable` sibling, add a `mousedown` guard on the editable element:
```js
titleEl.addEventListener('mousedown', e => { if (e.button === 2) e.preventDefault() })
```

### Optional items pattern
Any item type can carry an `optional: bool` flag. The contract:
- `progressPercent()` in `utils.js` excludes optional items from the denominator — 100% means all *required* items are done.
- `isSuperComplete(page)` returns true when all optional items are also done.
- Particles fire on required-only completion. Super badge fires on `isSuperComplete`.
- Visual layer: dashed border/outline when optional+incomplete; bright teal `box-shadow` glow when optional+done.
- Toggle is in the right-click menu, not an inline button.

### Graceful shutdown with a boot process (Windows/Node)
When `boot.js` spawns `server.js` as a child process, Ctrl-C sends SIGINT to both. If boot.js has no handler it exits immediately, killing the async continuation in server.js before it can flush. Fix:
```js
// boot.js
process.on('SIGINT',  () => {})           // ignore — let the child handle it
process.on('SIGTERM', () => child.kill('SIGTERM'))
```
In `server.js`, drain in-flight HTTP connections before flushing:
```js
server.closeAllConnections?.()
await new Promise(resolve => server.close(resolve))
await getCourseService().close()          // now guaranteed to run
```
This pattern applies to any boot.js + child server setup on Windows.

---

## What's not built (potential gaps)

- **Search** — no way to search across pages or courses
- **Tags / filtering** — pages have no tagging system
- **Import / export** — no way to export a course to markdown or import from another format
- **Auth** — no login; intended for single-user self-hosting
- **Undo** — no undo for deletes or state changes

---

## Integration with other services

### process-mgr
Added to `/c/dev/process-mgr/data/apps.config.json`:
```json
{
  "name": "course-journal",
  "group": "course-journal",
  "port": 8060,
  "cwd": "/home/jarcher/course-journal",
  "script": "src/server.js",
  "node_args": "--env-file=/home/jarcher/course-journal/.env"
}
```

### productivity launch menu
Added to `LAUNCH_ICONS` in `menubar.js` in the productivity app:
```js
'course-journal': { icon: 'book-open', color: '#c9a84c' },
```
Note: verify `book-open` is valid in the installed Lucide version — it showed a globe fallback at one point. Check `lucide.createIcons` or the installed icon set.

---

## gaming-journal — carry-forward notes

The same stack and architecture apply directly. Key differences to plan for:

### Data model additions
- **Game** record (equivalent to Course): `steamAppId`, `coverUrl`, `genre[]`, `platform[]`, `status: wishlist|playing|completed|dropped`, `rating`, `hoursPlayed`
- **Achievement** (like a progress-bars bar): `steamAchievementId`, `unlocked: bool`, `unlockedAt`, `globalUnlockPct`
- **Discovery** log (like a notes page): where you heard about a game, first impression
- **Wishlist** is just a filtered view of games with `status: wishlist`

### Steam data
- Steam Web API: `IPlayerService/GetOwnedGames`, `ISteamUserStats/GetPlayerAchievements`, `ISteamApps/GetAppList`
- Consider a background sync job (cron via process-mgr) that pulls Steam data on a schedule and merges it into the JSON store — same `ManagedFile` pattern
- Store raw Steam data in a separate `steam-cache.json` (also `ManagedFile`) so the game records stay clean

### View types to add
- `game-log` — session diary (date, duration, notes) — like a timestamped notes page
- `achievements` — same as `progress-bars` but backed by Steam achievement data
- `discovery` — minimal card for "how I found this game"

### Reuse as-is
- `ManagedFile` — no changes needed
- `dialog.js` — copy unchanged
- CSS variables / design tokens — copy `base.css` and adjust accent color
- Renderer registry pattern — identical
- Sidebar drag-reorder + badge pattern — identical
- Mobile overlay sidebar — identical
- Particle system — fires on game completion / achievement unlock
