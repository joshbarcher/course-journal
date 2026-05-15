import { api } from '../api.js'
import { escapeHtml } from '../utils.js'
import { refreshSidebarItem } from '../sidebar.js'

// ── Module state ──────────────────────────────────────────────────────────────

let _page = null
let _container = null

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderNotes(page, container) {
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
        <p class="page-subtitle">(Note)</p>`
    _container.appendChild(header)

    const inputWrap = document.createElement('div')
    inputWrap.className = 'notes-input-wrap'

    const textarea = document.createElement('textarea')
    textarea.className = 'notes-input'
    textarea.placeholder = 'Notes…'
    textarea.setAttribute('aria-label', 'New note')
    inputWrap.appendChild(textarea)

    const hint = document.createElement('p')
    hint.className = 'notes-input-hint'
    hint.textContent = 'Ctrl + Enter to add'
    inputWrap.appendChild(hint)

    _container.appendChild(inputWrap)

    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            _addNote(textarea)
        }
    })

    const grid = document.createElement('div')
    grid.className = 'notes-grid'
    grid.dataset.role = 'notes-grid'
    _container.appendChild(grid)

    for (const note of (_page.notes ?? [])) {
        grid.appendChild(_buildCard(note))
    }
}

// ── Card ──────────────────────────────────────────────────────────────────────

function _buildCard(note) {
    const card = document.createElement('div')
    card.className = 'notes-card'
    card.dataset.id = note.id

    const text = document.createElement('p')
    text.className = 'notes-card-text'
    text.textContent = note.text
    card.appendChild(text)

    const del = document.createElement('button')
    del.className = 'notes-card-delete'
    del.innerHTML = '&times;'
    del.setAttribute('aria-label', 'Delete note')
    del.addEventListener('click', () => _deleteNote(note.id))
    card.appendChild(del)

    return card
}

// ── Interactions ──────────────────────────────────────────────────────────────

async function _addNote(textarea) {
    const text = textarea.value.trim()
    if (!text) return

    const note = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }
    _page.notes = [note, ...(_page.notes ?? [])]

    const grid = _container.querySelector('[data-role="notes-grid"]')
    const card = _buildCard(note)
    grid.prepend(card)

    textarea.value = ''
    textarea.focus()

    await _save()
}

async function _deleteNote(noteId) {
    _page.notes = (_page.notes ?? []).filter(n => n.id !== noteId)
    _container.querySelector(`.notes-card[data-id="${noteId}"]`)?.remove()
    await _save()
}

// ── Persist ───────────────────────────────────────────────────────────────────

async function _save() {
    const updated = await api.pages.update(_page.id, { notes: _page.notes })
    if (updated) refreshSidebarItem(updated)
}
