<script lang="ts">
	// Ported from public/js/views/page.js. Deliberately imperative — a
	// contentEditable + document.execCommand editor must not be
	// re-rendered by Svelte's reactivity on every keystroke, so this owns
	// a raw editor div via bind:this and mutates it directly, same as the
	// original vanilla implementation. parseListItems/applyIndent/
	// renderListItems (page-helpers.ts) are the only pure/tested part.
	//
	// The pre-existing Shift+Tab outdent bug (docs/bugs.md in the old repo)
	// is ported as-is, not fixed as part of this migration.
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { updatePage } from '$lib/api-client';
	import PageTitleHeader from '$lib/components/PageTitleHeader.svelte';
	import { parseListItems, applyIndent, renderListItems, type FlatListItem } from '$lib/utils/page-helpers';
	import type { ContentPage } from '$lib/schemas/page';

	let { courseId, page }: { courseId: string; page: ContentPage } = $props();

	const TOGGLE_CMDS = [
		{ cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)' },
		{ cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)' },
		{ cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)' }
	];
	const FONT_SIZES = [
		{ label: 'Small', value: '2' },
		{ label: 'Normal', value: '3' },
		{ label: 'Large', value: '5' },
		{ label: 'XL', value: '7' }
	];
	const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];

	let editorEl: HTMLDivElement;
	let toolbarEl: HTMLDivElement;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	// Intentionally captures only the initial value — this component is
	// keyed by page.id in the parent route, so a real navigation always
	// gets a fresh instance rather than this going stale.
	// svelte-ignore state_referenced_locally
	let lastSavedContent = page.content;
	let fontSize = $state('3');
	let fontFamily = $state(FONT_FAMILIES[0]);

	function updateToolbarState() {
		if (!toolbarEl) return;
		for (const { cmd } of TOGGLE_CMDS) {
			const btn = toolbarEl.querySelector(`[data-cmd="${cmd}"]`);
			btn?.classList.toggle('active', document.queryCommandState(cmd));
		}
		const listBtn = toolbarEl.querySelector('[data-cmd="insertUnorderedList"]');
		listBtn?.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
	}

	function onSelectionChange() {
		if (!document.activeElement || (!editorEl?.contains(document.activeElement) && document.activeElement !== editorEl)) {
			return;
		}
		updateToolbarState();
	}

	const CARET_SCROLL_KEYS = new Set([
		'Enter',
		'ArrowUp',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'Home',
		'End',
		'PageUp',
		'PageDown',
		'Backspace',
		'Delete'
	]);

	function scrollCaretIntoView() {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		if (!editorEl || !editorEl.contains(sel.getRangeAt(0).startContainer)) return;
		const range = sel.getRangeAt(0).cloneRange();
		range.collapse(false);
		const caretRect = range.getBoundingClientRect();
		if (!caretRect || caretRect.height === 0) return;
		const editorRect = editorEl.getBoundingClientRect();
		if (caretRect.bottom > editorRect.bottom) {
			editorEl.scrollTop += caretRect.bottom - editorRect.bottom + 4;
		} else if (caretRect.top < editorRect.top) {
			editorEl.scrollTop -= editorRect.top - caretRect.top + 4;
		}
	}

	async function save() {
		const content = editorEl.innerHTML;
		if (content === lastSavedContent) return;
		lastSavedContent = content;
		await updatePage(courseId, page.id, { content });
	}

	function onInput() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 600);
	}

	function containingList(): HTMLElement | null {
		const sel = window.getSelection();
		if (!sel?.rangeCount) return null;
		let node: Node | null = sel.getRangeAt(0).startContainer;
		while (node && node !== editorEl) {
			const el = node as HTMLElement;
			if (el.tagName === 'UL' || el.tagName === 'OL') return el;
			node = el.parentElement;
		}
		return null;
	}

	function handleListIndent(list: HTMLElement, outdent: boolean) {
		const sel = window.getSelection();
		if (!sel?.rangeCount) return;

		const range = sel.getRangeAt(0);
		const allLis = Array.from(list.querySelectorAll('li'));

		const liOf = (node: Node) => {
			const el = (node.nodeType === 3 ? node.parentElement : (node as HTMLElement)) as HTMLElement;
			return el.closest('li');
		};

		const startIdx = allLis.indexOf(liOf(range.startContainer)!);
		if (startIdx === -1) return;

		let endIdx = startIdx;
		if (!range.collapsed) {
			const endLi = liOf(range.endContainer);
			const endPos = allLis.indexOf(endLi!);
			if (endPos > startIdx) endIdx = endPos;
		}

		const tag = list.tagName.toLowerCase();
		const items: FlatListItem[] = parseListItems(list);
		const updated = applyIndent(items, startIdx, endIdx, outdent);
		list.innerHTML = renderListItems(updated, tag);

		const newLis = Array.from(list.querySelectorAll('li'));
		const first = newLis[Math.min(startIdx, newLis.length - 1)];
		const last = newLis[Math.min(endIdx, newLis.length - 1)];
		if (first) {
			const r = document.createRange();
			r.setStart(first, 0);
			r.setEnd(last, last.childNodes.length);
			sel.removeAllRanges();
			sel.addRange(r);
		}

		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 600);
	}

	function onKeydown(e: KeyboardEvent) {
		// Auto-list: typing "- " or "* " at start of a line creates a bullet list
		if (e.key === ' ') {
			const sel = window.getSelection();
			if (sel?.rangeCount) {
				const range = sel.getRangeAt(0);
				if (range.collapsed) {
					const node = range.startContainer;
					if (node.nodeType === 3) {
						const textBefore = (node.textContent ?? '').slice(0, range.startOffset);
						if (textBefore === '-' || textBefore === '*') {
							e.preventDefault();
							document.execCommand('selectAll', false);
							const r2 = document.createRange();
							r2.setStart(node, 0);
							r2.setEnd(node, range.startOffset);
							sel.removeAllRanges();
							sel.addRange(r2);
							document.execCommand('delete', false);
							document.execCommand('insertUnorderedList', false);
							return;
						}
					}
				}
			}
		}

		// Tab / Shift+Tab: indent/outdent inside a list
		if (e.key === 'Tab') {
			const list = containingList();
			if (list) {
				e.preventDefault();
				handleListIndent(list, e.shiftKey);
			}
		}

		if (CARET_SCROLL_KEYS.has(e.key)) {
			setTimeout(scrollCaretIntoView, 0);
		}
	}

	function execToggle(cmd: string, e: MouseEvent) {
		e.preventDefault();
		document.execCommand(cmd, false);
		updateToolbarState();
	}

	function onSizeChange() {
		document.execCommand('fontSize', false, fontSize);
		editorEl.focus();
	}
	function onFontChange() {
		document.execCommand('fontName', false, fontFamily);
		editorEl.focus();
	}

	onMount(() => {
		editorEl.innerHTML = page.content || '<p><br></p>';
		document.addEventListener('selectionchange', onSelectionChange);
	});
	onDestroy(() => {
		// onDestroy callbacks run during SSR too (unlike onMount, whose body
		// never executes server-side) — guard the DOM access or this throws
		// "document is not defined" on every server render of this page type.
		if (!browser) return;
		document.removeEventListener('selectionchange', onSelectionChange);
		if (saveTimer) clearTimeout(saveTimer);
	});
</script>

<!--
  The editor owns its content imperatively (see the component header), so
  there's no reactive `content` to hand over — the live innerHTML is read
  at export time instead, which also covers edits the debounced save
  hasn't flushed yet.
-->
<PageTitleHeader
	{courseId}
	{page}
	subtitle="Page · Rich Text"
	record={() => ({ ...page, content: editorEl?.innerHTML ?? page.content })}
/>

<div class="rt-toolbar" bind:this={toolbarEl}>
	{#each TOGGLE_CMDS as { cmd, label, title } (cmd)}
		<button class="rt-btn" data-cmd={cmd} {title} onmousedown={(e) => execToggle(cmd, e)}>{label}</button>
	{/each}

	<div class="rt-sep"></div>

	<button
		class="rt-btn"
		data-cmd="insertUnorderedList"
		title="Bullet list (Tab/Shift+Tab to indent)"
		onmousedown={(e) => execToggle('insertUnorderedList', e)}
	>&#8226; List</button>

	<div class="rt-sep"></div>

	<span class="rt-toolbar-label">Size</span>
	<select
		class="rt-select"
		title="Font size"
		bind:value={fontSize}
		onmousedown={(e) => e.stopPropagation()}
		onchange={onSizeChange}
	>
		{#each FONT_SIZES as { label, value } (value)}
			<option {value}>{label}</option>
		{/each}
	</select>

	<div class="rt-sep"></div>

	<span class="rt-toolbar-label">Font</span>
	<select
		class="rt-select rt-select--font"
		title="Font family"
		bind:value={fontFamily}
		onmousedown={(e) => e.stopPropagation()}
		onchange={onFontChange}
	>
		{#each FONT_FAMILIES as font (font)}
			<option value={font} style:font-family={font}>{font}</option>
		{/each}
	</select>
</div>

<div
	class="rt-editor"
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="Page content"
	bind:this={editorEl}
	oninput={onInput}
	onkeydown={onKeydown}
></div>
