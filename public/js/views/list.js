import { api } from '../api.js'
import { escapeHtml } from '../utils.js'
import { refreshSidebarItem } from '../sidebar.js'

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

export function sortedItems(page) {
    return [...page.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function reorderItems(items, fromIdx, toIdx) {
    const result = [...items]
    const [moved] = result.splice(fromIdx, 1)
    result.splice(toIdx, 0, moved)
    return result.map((item, i) => ({ ...item, order: i }))
}

// ── Module state ──────────────────────────────────────────────────────────────

let _page = null
let _container = null

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderList(page, container) {
    _page = deepCopy(page)
    _container = container
    _draw()
}

function deepCopy(page) {
    return {
        ...page,
        items: page.items.map(item => ({
            ...item,
            subtasks: [...(item.subtasks ?? [])],
        })),
    }
}

// ── Full render (called once on navigation) ───────────────────────────────────

function _draw() {
    _container.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'page-header'
    header.innerHTML = `
        <h1 class="page-title">${escapeHtml(_page.title)}</h1>
        <p class="page-subtitle">(${_page.ordered ? 'Ordered List' : 'Unordered List'})</p>`
    _container.appendChild(header)

    const listEl = document.createElement('div')
    listEl.className = 'list-items'
    _container.appendChild(listEl)

    for (const [i, item] of sortedItems(_page).entries()) {
        listEl.appendChild(buildItemEl(item, i + 1))
    }

    _setupDragDrop(listEl)

    const addBtn = document.createElement('button')
    addBtn.className = 'list-add-btn'
    addBtn.textContent = '+ Add Item'
    addBtn.addEventListener('click', _addItem)
    _container.appendChild(addBtn)
}

// ── Item element builder ──────────────────────────────────────────────────────

function buildItemEl(item, position) {
    const el = document.createElement('div')
    el.className = 'list-item'
    el.dataset.id = item.id
    el.draggable = true

    // Main row: number/bullet + title + delete
    const mainRow = document.createElement('div')
    mainRow.className = 'list-item-main'

    if (_page.ordered) {
        const num = document.createElement('span')
        num.className = 'list-item-num'
        num.textContent = position
        mainRow.appendChild(num)
    } else {
        const bullet = document.createElement('span')
        bullet.className = 'list-item-bullet'
        mainRow.appendChild(bullet)
    }

    const titleEl = document.createElement('span')
    titleEl.className = 'list-item-title'
    titleEl.contentEditable = 'true'
    titleEl.spellcheck = false
    titleEl.textContent = item.title
    titleEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); titleEl.blur() }
        if (e.key === 'Escape') { titleEl.textContent = item.title; titleEl.blur() }
    })
    titleEl.addEventListener('blur', () => _saveTitle(item.id, titleEl.textContent.trim()))
    mainRow.appendChild(titleEl)

    const delBtn = document.createElement('button')
    delBtn.className = 'list-item-delete'
    delBtn.innerHTML = '&times;'
    delBtn.addEventListener('click', () => _deleteItem(item.id, el))
    mainRow.appendChild(delBtn)

    el.appendChild(mainRow)
    el.appendChild(buildSubtasksEl(item))

    return el
}

// ── Subtask section builder ───────────────────────────────────────────────────

function buildSubtasksEl(item) {
    const row = document.createElement('div')
    row.className = 'list-subtasks'

    for (const sub of item.subtasks) {
        row.appendChild(buildChipEl(item.id, sub))
    }

    const addBtn = document.createElement('button')
    addBtn.className = 'subtask-add-btn'
    addBtn.textContent = '+ subtask'
    addBtn.addEventListener('click', () => _showSubtaskInput(item.id, row, addBtn))
    row.appendChild(addBtn)

    return row
}

function buildChipEl(itemId, text) {
    const chip = document.createElement('span')
    chip.className = 'subtask-chip'

    const label = document.createElement('span')
    label.textContent = text
    chip.appendChild(label)

    const removeBtn = document.createElement('button')
    removeBtn.className = 'subtask-chip-remove'
    removeBtn.innerHTML = '&times;'
    removeBtn.addEventListener('click', () => {
        chip.remove()
        _removeSubtask(itemId, text)
    })
    chip.appendChild(removeBtn)

    return chip
}

// ── Subtask inline input ──────────────────────────────────────────────────────

function _showSubtaskInput(itemId, row, addBtn) {
    addBtn.style.display = 'none'

    const input = document.createElement('input')
    input.className = 'subtask-input'
    input.type = 'text'
    input.placeholder = 'Subtask name…'
    input.maxLength = 80

    const confirm = () => {
        const val = input.value.trim()
        input.remove()
        addBtn.style.display = ''
        if (val) _addSubtask(itemId, val, row, addBtn)
    }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); confirm() }
        if (e.key === 'Escape') { input.remove(); addBtn.style.display = '' }
    })
    input.addEventListener('blur', confirm)

    row.insertBefore(input, addBtn)
    input.focus()
}

// ── Data mutation + save helpers ──────────────────────────────────────────────

async function _saveTitle(itemId, newTitle) {
    const item = _page.items.find(i => i.id === itemId)
    if (!item || item.title === newTitle) return
    item.title = newTitle
    await _save()
}

async function _deleteItem(itemId, el) {
    _page.items = _page.items.filter(i => i.id !== itemId)
    el.remove()
    _renumber()
    await _save()
}

async function _addItem() {
    const newItem = {
        id: crypto.randomUUID(),
        title: '',
        subtasks: [],
        order: _page.items.length,
    }
    _page.items.push(newItem)

    const listEl = _container.querySelector('.list-items')
    const el = buildItemEl(newItem, _page.items.length)
    listEl.appendChild(el)
    el.querySelector('.list-item-title')?.focus()

    await _save()
}

async function _addSubtask(itemId, text, row, addBtn) {
    const item = _page.items.find(i => i.id === itemId)
    if (!item || item.subtasks.includes(text)) return
    item.subtasks.push(text)
    row.insertBefore(buildChipEl(itemId, text), addBtn)
    await _save()
}

async function _removeSubtask(itemId, text) {
    const item = _page.items.find(i => i.id === itemId)
    if (!item) return
    item.subtasks = item.subtasks.filter(s => s !== text)
    await _save()
}

// ── Save to API ───────────────────────────────────────────────────────────────

async function _save() {
    try {
        const updated = await api.pages.update(_page.id, { items: _page.items })
        Object.assign(_page, updated)
        refreshSidebarItem({ ..._page })
    } catch (err) {
        console.error('Failed to save list', err)
    }
}

// ── Renumber ordered items after delete / reorder ─────────────────────────────

function _renumber() {
    if (!_page.ordered) return
    _container.querySelectorAll('.list-item .list-item-num').forEach((el, i) => {
        el.textContent = i + 1
    })
}

// ── Drag and drop ─────────────────────────────────────────────────────────────

function _setupDragDrop(listEl) {
    let dragId = null

    listEl.addEventListener('dragstart', e => {
        const item = e.target.closest('.list-item')
        if (!item) return
        dragId = item.dataset.id
        item.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
    })

    listEl.addEventListener('dragend', e => {
        const item = e.target.closest('.list-item')
        item?.classList.remove('dragging')
        listEl.querySelectorAll('.list-item.drag-over').forEach(el => el.classList.remove('drag-over'))
        dragId = null
    })

    listEl.addEventListener('dragover', e => {
        e.preventDefault()
        const target = e.target.closest('.list-item')
        if (!target || target.dataset.id === dragId) return
        listEl.querySelectorAll('.list-item.drag-over').forEach(el => el.classList.remove('drag-over'))
        target.classList.add('drag-over')
    })

    listEl.addEventListener('drop', e => {
        e.preventDefault()
        const target = e.target.closest('.list-item')
        if (!target || target.dataset.id === dragId) return

        const els = [...listEl.querySelectorAll('.list-item')]
        const fromIdx = els.findIndex(el => el.dataset.id === dragId)
        const toIdx   = els.findIndex(el => el === target)
        if (fromIdx === -1 || toIdx === -1) return

        // Move DOM element
        if (fromIdx < toIdx) target.after(els[fromIdx])
        else target.before(els[fromIdx])

        // Update data order and save
        _page.items = reorderItems(_page.items, fromIdx, toIdx)
        _renumber()
        _save()
    })
}
