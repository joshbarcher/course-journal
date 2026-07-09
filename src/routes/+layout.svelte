<script lang="ts">

	let { children } = $props();

	// Ported from app.js's global paste handler: pastes as plain text into
	// any editable surface (contentEditable or input/textarea), stripping
	// rich formatting from the clipboard.
	function onPaste(e: ClipboardEvent) {
		const target = e.target as HTMLElement;
		const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
		if (!target.isContentEditable && !isInput) return;
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (target.isContentEditable) {
			document.execCommand('insertText', false, text);
		} else {
			const el = target as HTMLInputElement | HTMLTextAreaElement;
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? el.value.length;
			el.value = el.value.slice(0, start) + text + el.value.slice(end);
			el.selectionStart = el.selectionEnd = start + text.length;
		}
	}
</script>

<svelte:document onpaste={onPaste} />

<svelte:head>
	<link rel="icon" href="/favicon.ico" />
</svelte:head>

<!--
  Deliberately bare: the old app always keeps #sidebar in the DOM (hidden
  via display:none on the courses list), but it's simpler and equivalent to
  just not render it there. So the "/" route builds its own #app/#main-content
  wrapper (no sidebar), and the course-scoped layout
  (routes/c/[courseId]/+layout.svelte) builds its own #app wrapper with
  #sidebar as a sibling of #main-content — they can't share one wrapper here
  since this layout is the parent of both.
-->
{@render children()}
