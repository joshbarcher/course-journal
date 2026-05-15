import { navigate, getRouteFromHash, registerRenderer, addNewPage } from './router.js'
import { renderList } from './views/list.js'
import { renderProgress } from './views/progress.js'
import { renderProgressBars } from './views/progress-bars.js'
import { renderNotes } from './views/notes.js'
import { renderPage } from './views/page.js'

registerRenderer('list', renderList)
registerRenderer('progress', renderProgress)
registerRenderer('progress-bars', renderProgressBars)
registerRenderer('notes', renderNotes)
registerRenderer('page', renderPage)

// ── Mobile sidebar toggle ──────────────────────────────────────────────────────
const toggleBtn  = document.getElementById('sidebar-toggle')
const sidebarEl  = document.getElementById('sidebar')
const overlayEl  = document.getElementById('sidebar-overlay')

export function closeMobileSidebar() {
    sidebarEl.classList.remove('sidebar--open')
    overlayEl.classList.remove('visible')
}

toggleBtn.addEventListener('click', () => {
    const isOpen = sidebarEl.classList.toggle('sidebar--open')
    overlayEl.classList.toggle('visible', isOpen)
})

overlayEl.addEventListener('click', closeMobileSidebar)

async function init() {
    document.getElementById('sidebar-add-btn')?.addEventListener('click', addNewPage)
    await navigate(getRouteFromHash())
}

window.addEventListener('hashchange', () => {
    navigate(getRouteFromHash())
})

init().catch(err => {
    console.error('App init failed', err)
    document.getElementById('main-content').innerHTML =
        `<p class="page-error">Failed to load. Is the server running?</p>`
})
