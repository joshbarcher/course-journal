<script lang="ts">
	// Ported from public/js/views/notes.js. Every mutation persists the
	// whole `notes` array in one PUT, matching the old _save()'s behavior
	// (no per-note diffing).
	import { updatePage } from '$lib/api-client';
	import PageTitleHeader from '$lib/components/PageTitleHeader.svelte';
	import type { NotesPage as NotesPageType, Note } from '$lib/schemas/page';

	let { courseId, page }: { courseId: string; page: NotesPageType } = $props();

	// Intentionally captures only the initial value — see PageTitleHeader.svelte
	// for why (the parent route keys this component by page.id).
	// svelte-ignore state_referenced_locally
	let notes = $state<Note[]>([...page.notes]);
	let newNoteText = $state('');

	async function saveNotes() {
		await updatePage(courseId, page.id, { notes });
	}

	function addNote() {
		const text = newNoteText.trim();
		if (!text) return;
		notes = [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...notes];
		newNoteText = '';
		saveNotes();
	}

	function onTextareaKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			addNote();
		}
	}

	function editNote(id: string, newText: string) {
		const note = notes.find((n) => n.id === id);
		if (!note || note.text === newText) return;
		note.text = newText;
		saveNotes();
	}

	function deleteNote(id: string) {
		notes = notes.filter((n) => n.id !== id);
		saveNotes();
	}

	function onCardKeydown(e: KeyboardEvent, el: HTMLElement, originalText: string) {
		if (e.key === 'Escape') {
			el.textContent = originalText;
			el.blur();
		}
		if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			el.blur();
		}
	}

	function onCardBlur(e: FocusEvent, id: string, originalText: string) {
		const el = e.currentTarget as HTMLElement;
		el.classList.remove('notes-card--editing');
		const newText = el.textContent?.trim() ?? '';
		if (!newText) {
			el.textContent = originalText;
			return;
		}
		editNote(id, newText);
	}
</script>

<PageTitleHeader {courseId} {page} subtitle="(Note)" record={() => ({ ...page, notes })} />

<div class="notes-input-wrap">
	<textarea
		class="notes-input"
		placeholder="Notes…"
		aria-label="New note"
		bind:value={newNoteText}
		onkeydown={onTextareaKeydown}
	></textarea>
	<p class="notes-input-hint">Ctrl + Enter to add</p>
</div>

<div class="notes-grid">
	{#each notes as note (note.id)}
		<div class="notes-card">
			<p
				class="notes-card-text"
				contenteditable="true"
				spellcheck="true"
				aria-label="Note text"
				onfocus={(e) => (e.currentTarget as HTMLElement).classList.add('notes-card--editing')}
				onblur={(e) => onCardBlur(e, note.id, note.text)}
				onkeydown={(e) => onCardKeydown(e, e.currentTarget as HTMLElement, note.text)}
			>{note.text}</p>
			<button
				class="notes-card-delete"
				aria-label="Delete note"
				onmousedown={(e) => e.preventDefault()}
				onclick={() => deleteNote(note.id)}
			>&times;</button>
		</div>
	{/each}
</div>
