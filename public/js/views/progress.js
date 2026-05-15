import { api } from '../api.js'
import { escapeHtml } from '../utils.js'
import { refreshSidebarItem } from '../sidebar.js'
import { segmentColor, globalSegments } from './progress-helpers.js'

const STATES = ['started', 'working', 'done']
const STATE_LABELS = { started: 'STARTED', working: 'WORKING', done: 'DONE' }

// ── Module state ──────────────────────────────────────────────────────────────

let _page = null
let _container = null

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderProgress(page, container) {
    _page = JSON.parse(JSON.stringify(page))
    _container = container
    _draw()
}

// ── Full render ───────────────────────────────────────────────────────────────

function _draw() {
    _container.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'page-header'
    header.innerHTML = `
        <h1 class="page-title">${escapeHtml(_page.title)}</h1>
        <p class="page-subtitle">Progress Tracker</p>`
    _container.appendChild(header)

    const globalBar = document.createElement('div')
    globalBar.className = 'progress-global-bar'
    globalBar.dataset.role = 'global-bar'
    _container.appendChild(globalBar)
    _redrawGlobalBar()

    const taskList = document.createElement('div')
    taskList.className = 'progress-tasks'
    taskList.dataset.role = 'task-list'
    _container.appendChild(taskList)

    for (const task of (_page.tasks ?? [])) {
        taskList.appendChild(_buildTaskEl(task))
    }

    const addBtn = document.createElement('button')
    addBtn.className = 'progress-add-btn'
    addBtn.dataset.role = 'add-task'
    addBtn.textContent = '+ Add Task'
    _container.appendChild(addBtn)
    addBtn.addEventListener('click', _addTask)

    const notesWrap = document.createElement('div')
    notesWrap.className = 'progress-notes-wrap'
    notesWrap.dataset.role = 'notes-wrap'
    notesWrap.innerHTML = `
        <label class="progress-notes-label">Notes</label>
        <textarea class="progress-notes" placeholder="Add notes…">${escapeHtml(_page.notes ?? '')}</textarea>`
    _container.appendChild(notesWrap)

    notesWrap.querySelector('textarea').addEventListener('input', _onNotesInput)
}

// ── Global bar ────────────────────────────────────────────────────────────────

function _redrawGlobalBar() {
    const bar = _container.querySelector('[data-role="global-bar"]')
    if (!bar) return
    const segs = globalSegments(_page)
    bar.innerHTML = ''
    if (!segs.length) {
        bar.innerHTML = '<span class="progress-global-empty">No tasks yet</span>'
        return
    }
    for (const seg of segs) {
        const el = document.createElement('div')
        el.className = 'progress-global-seg'
        el.style.background = seg.color
        el.title = seg.label || `Task ${seg.num}`
        el.dataset.num = seg.num
        el.innerHTML = `
            <span class="progress-seg-num">${seg.num}</span>
            ${seg.stateLabel ? `<span class="progress-seg-state">${seg.stateLabel}</span>` : ''}`
        bar.appendChild(el)
    }
}

// ── Task element ──────────────────────────────────────────────────────────────

function _buildTaskEl(task) {
    const el = document.createElement('div')
    el.className = 'progress-task'
    el.dataset.id = task.id

    const titleEl = document.createElement('div')
    titleEl.className = 'progress-task-title'
    titleEl.contentEditable = 'true'
    titleEl.textContent = task.title ?? ''
    titleEl.setAttribute('aria-label', 'Task title')
    titleEl.addEventListener('blur', e => _onTitleBlur(task.id, e.target.textContent.trim()))
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } })
    el.appendChild(titleEl)

    const btns = document.createElement('div')
    btns.className = 'progress-state-btns'
    for (const state of STATES) {
        const btn = document.createElement('button')
        btn.className = 'progress-state-btn'
        btn.dataset.state = state
        btn.textContent = STATE_LABELS[state]
        if (task.state === state) btn.classList.add('active')
        btn.style.setProperty('--state-color', segmentColor(state))
        btn.addEventListener('click', () => _onStateClick(task.id, state))
        btns.appendChild(btn)
    }
    el.appendChild(btns)

    const del = document.createElement('button')
    del.className = 'progress-task-delete'
    del.innerHTML = '&times;'
    del.setAttribute('aria-label', 'Delete task')
    del.addEventListener('click', () => _deleteTask(task.id))
    el.appendChild(del)

    return el
}

function _refreshTaskEl(taskId) {
    const task = (_page.tasks ?? []).find(t => t.id === taskId)
    if (!task) return
    const el = _container.querySelector(`.progress-task[data-id="${taskId}"]`)
    if (!el) return
    for (const btn of el.querySelectorAll('.progress-state-btn')) {
        btn.classList.toggle('active', btn.dataset.state === task.state)
    }
}

// ── Interactions ──────────────────────────────────────────────────────────────

async function _onStateClick(taskId, state) {
    const task = (_page.tasks ?? []).find(t => t.id === taskId)
    if (!task) return
    task.state = task.state === state ? null : state
    _refreshTaskEl(taskId)
    _redrawGlobalBar()
    await _save()
}

async function _onTitleBlur(taskId, newTitle) {
    const task = (_page.tasks ?? []).find(t => t.id === taskId)
    if (!task || task.title === newTitle) return
    task.title = newTitle
    _redrawGlobalBar()
    await _save()
}

let _notesTimer = null
function _onNotesInput(e) {
    _page.notes = e.target.value
    clearTimeout(_notesTimer)
    _notesTimer = setTimeout(_save, 800)
}

async function _addTask() {
    const task = { id: crypto.randomUUID(), title: '', state: null }
    _page.tasks = [...(_page.tasks ?? []), task]

    const list = _container.querySelector('[data-role="task-list"]')
    const addBtn = _container.querySelector('[data-role="add-task"]')
    const el = _buildTaskEl(task)
    list.insertBefore(el, null)
    _redrawGlobalBar()
    el.querySelector('.progress-task-title').focus()
    await _save()
}

async function _deleteTask(taskId) {
    _page.tasks = (_page.tasks ?? []).filter(t => t.id !== taskId)
    const el = _container.querySelector(`.progress-task[data-id="${taskId}"]`)
    el?.remove()
    _redrawGlobalBar()
    await _save()
}

// ── Persist ───────────────────────────────────────────────────────────────────

async function _save() {
    const updated = await api.pages.update(_page.id, {
        tasks: _page.tasks,
        notes: _page.notes,
    })
    if (updated) refreshSidebarItem(updated)
}
