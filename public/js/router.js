import { api } from './api.js'
import { setCourseId } from './course-context.js'
import { escapeHtml } from './utils.js'
import { loadSidebar, setActiveItem, getPages } from './sidebar.js'
import { renderToc } from './views/toc.js'
import { renderHeatmap } from './views/heatmap.js'
import { renderCourses } from './views/courses.js'

const _renderers = new Map()

export function registerRenderer(type, fn) {
    _renderers.set(type, fn)
}

const mainEl = () => document.getElementById('main-content')

let _activeCourseId = null

// Parse hash string (without leading #) into a route descriptor
export function parseRoute(hash) {
    if (!hash) return { view: 'courses' }
    if (hash.startsWith('c:')) {
        const rest = hash.slice(2)
        const colonIdx = rest.indexOf(':')
        if (colonIdx === -1) return { view: 'course-home', courseId: rest }
        const courseId = rest.slice(0, colonIdx)
        const segment  = rest.slice(colonIdx + 1)
        if (segment === 'toc') return { view: 'toc', courseId }
        return { view: 'page', courseId, pageId: segment }
    }
    return { view: 'courses' }
}

export function getRouteFromHash() {
    return window.location.hash.slice(1)
}

export async function navigate(hash) {
    if (typeof hash !== 'string') hash = ''
    // Resolve relative navigation (bare 'toc' or pageId) when inside a course
    if (_activeCourseId && hash && !hash.startsWith('c:')) {
        hash = `c:${_activeCourseId}:${hash}`
    }
    const route = parseRoute(hash)

    if (route.view === 'courses') {
        _activeCourseId = null
        setCourseId(null)
        setSidebarVisible(false)
        setHash('')
        await renderCourseList()
        return
    }

    const { courseId } = route
    setSidebarVisible(true)

    if (courseId !== _activeCourseId) {
        let course
        try {
            course = await api.courses.get(courseId)
        } catch {
            // Unknown course — fall back to list
            await navigate('')
            return
        }
        _activeCourseId = courseId
        setCourseId(courseId)
        await loadSidebar(null, navigate, course.title, courseId)
    }

    if (route.view === 'course-home') {
        setHash(`c:${courseId}`)
        setActiveItem('home')
        renderHeatmap(getPages(), mainEl())
        return
    }

    if (route.view === 'toc') {
        setHash(`c:${courseId}:toc`)
        setActiveItem('toc')
        renderToc(getPages(), mainEl())
        return
    }

    if (route.view === 'page') {
        setHash(`c:${courseId}:${route.pageId}`)
        setActiveItem(route.pageId)
        await renderPageById(route.pageId)
    }
}

function setHash(hash) {
    const target = hash ? `#${hash}` : location.pathname + location.search
    history.replaceState(null, '', target)
}

function setSidebarVisible(visible) {
    document.getElementById('sidebar').style.display = visible ? '' : 'none'
    const addBtn = document.getElementById('sidebar-add-btn')
    if (addBtn) addBtn.style.display = visible ? '' : 'none'
}

async function renderPageById(id) {
    mainEl().innerHTML = `<p class="page-loading">Loading…</p>`
    let page
    try {
        page = await api.pages.get(id)
    } catch {
        mainEl().innerHTML = `<p class="page-error">Page not found.</p>`
        return
    }
    const renderer = _renderers.get(page.type)
    if (renderer) {
        renderer(page, mainEl())
    } else {
        renderPlaceholder(page)
    }
}

async function renderCourseList() {
    const courses = await api.courses.list()
    renderCourses(courses, mainEl(), navigate)
}

function renderPlaceholder(page) {
    const label = {
        list: 'List', progress: 'Progress Bar', notes: 'Notes', page: 'Page',
    }[page.type] ?? page.type
    mainEl().innerHTML = `
        <div class="page-header">
            <h1 class="page-title">${escapeHtml(page.title)}</h1>
            <p class="page-subtitle">(${label})</p>
        </div>`
}
