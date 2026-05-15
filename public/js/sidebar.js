import { api } from './api.js'
import { escapeHtml, progressPercent } from './utils.js'

let _pages = []
let _onNavigate = null
let _courseTitle = null
let _courseId = null

export function getPages() {
    return _pages
}

export async function loadSidebar(activeId, onNavigate, courseTitle, courseId) {
    _onNavigate = onNavigate
    _courseTitle = courseTitle ?? null
    _courseId = courseId ?? null
    _pages = _courseTitle !== null ? await api.pages.list() : []
    renderSidebar(activeId)
}

export function refreshSidebarItem(updatedPage) {
    const idx = _pages.findIndex(p => p.id === updatedPage.id)
    if (idx !== -1) _pages[idx] = updatedPage
    const el = document.querySelector(`.sidebar-item[data-id="${updatedPage.id}"]`)
    if (!el) return
    const isActive = el.classList.contains('active')
    const fresh = buildItem(updatedPage, isActive)
    el.replaceWith(fresh)
}

export function setActiveItem(id) {
    document.querySelectorAll('.sidebar-item, .sidebar-toc-btn').forEach(el => {
        const elId = el.dataset.id ?? (el.classList.contains('sidebar-toc-btn') ? 'toc' : null)
        el.classList.toggle('active', elId === id)
    })
    // Refresh progress-bar items so the active colour updates
    if (id !== 'toc' && id !== 'home') {
        const page = _pages.find(p => p.id === id)
        if (page) refreshSidebarItem(page)
    }
}

function renderSidebar(activeId) {
    const nav = document.getElementById('sidebar-nav')
    nav.innerHTML = ''

    if (_courseTitle !== null) {
        nav.appendChild(buildCourseHeader())
    }

    const toc = buildTocButton(activeId === 'toc')
    nav.appendChild(toc)

    if (_pages.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'sidebar-empty'
        empty.textContent = 'No pages yet'
        nav.appendChild(empty)
        return
    }

    for (const page of _pages) {
        nav.appendChild(buildItem(page, page.id === activeId))
    }
}

function buildCourseHeader() {
    const el = document.createElement('div')
    el.className = 'sidebar-course-header'

    const backLink = document.createElement('a')
    backLink.className = 'sidebar-back-link'
    backLink.href = '#'
    backLink.textContent = '← Courses'

    const nameEl = document.createElement('div')
    nameEl.className = 'sidebar-course-name'
    nameEl.textContent = _courseTitle
    if (_courseId) {
        nameEl.classList.add('sidebar-course-name--clickable')
        nameEl.addEventListener('click', () => _onNavigate(`c:${_courseId}`))
    }

    el.appendChild(backLink)
    el.appendChild(nameEl)
    return el
}

function buildTocButton(isActive) {
    const el = document.createElement('div')
    el.className = 'sidebar-toc-btn' + (isActive ? ' active' : '')
    el.dataset.id = 'toc'
    el.innerHTML = `<span class="sidebar-toc-icon">&#9776;</span> Table of Contents`
    el.addEventListener('click', () => _onNavigate('toc'))
    return el
}

function buildItem(page, isActive) {
    const el = document.createElement('div')
    el.className = 'sidebar-item' + (isActive ? ' active' : '')
    el.dataset.id = page.id

    if (page.type === 'list') {
        el.innerHTML = `
            <div class="sidebar-item-row">
                <span class="sidebar-item-title">${escapeHtml(page.title)}</span>
                <span class="sidebar-badge">${page.items?.length ?? 0}</span>
            </div>`
    } else if (page.type === 'progress' || page.type === 'progress-bars') {
        const pct = progressPercent(page)
        el.innerHTML = `
            <span class="sidebar-item-title">${escapeHtml(page.title)}</span>
            <div class="sidebar-progress-track">
                <div class="sidebar-progress-fill" style="width:${pct}%"></div>
            </div>`
    } else if (page.type === 'notes') {
        const count = page.notes?.length ?? 0
        el.innerHTML = `
            <div class="sidebar-item-row">
                <span class="sidebar-item-title">${escapeHtml(page.title)}</span>
                ${count > 0 ? `<span class="sidebar-badge">${count}</span>` : ''}
            </div>`
    } else {
        el.innerHTML = `
            <div class="sidebar-item-row">
                <span class="sidebar-item-title">${escapeHtml(page.title)}</span>
            </div>`
    }

    el.addEventListener('click', () => _onNavigate(page.id))
    return el
}
