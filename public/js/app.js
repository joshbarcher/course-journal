import { navigate, getRouteFromHash, registerRenderer } from './router.js'
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

async function init() {
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
