<script lang="ts">
	// Shared editable page-title header, ported from the near-identical
	// _buildPageTitle() repeated in list.js/notes.js/page.js/progress.js/
	// progress-bars.js. Sidebar-refresh-on-rename (refreshSidebarItem in the
	// old code) is wired up once the sidebar exists (M4) — for now a rename
	// just persists.
	import { updatePage } from '$lib/api-client';
	import { showExportMenu } from '$lib/export-menu';
	import type { Exportable } from '$lib/utils/export-page';

	let {
		courseId,
		page,
		subtitle,
		onSave,
		record,
		children
	}: {
		courseId: string;
		page: { id: string; title: string };
		subtitle?: string;
		// Defaults to the page-rename convention (updatePage); pass this to
		// reuse the same editable-title UI for a non-page record (e.g. a
		// named lecture plan) that persists its title differently.
		onSave?: (title: string) => Promise<unknown>;
		// Supplying this adds the Export button. It's a getter, not the
		// record itself, because every page component keeps the live edited
		// copy in local $state — reading it at click time is what makes the
		// export match what's on screen, including changes whose debounced
		// save hasn't fired yet.
		record?: () => Exportable;
		children?: import('svelte').Snippet;
	} = $props();

	let save = $derived(onSave ?? ((title: string) => updatePage(courseId, page.id, { title })));

	// Intentionally captures only the initial value: the parent keys this
	// component by page.id (see the [pageId] route), so a genuinely new
	// page always gets a fresh component instance rather than this local
	// state going stale across navigations.
	// svelte-ignore state_referenced_locally
	let title = $state(page.title);
	let titleEl: HTMLHeadingElement;

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			titleEl.blur();
		}
	}

	async function onBlur() {
		const t = titleEl.textContent?.trim() ?? '';
		if (!t || t === page.title) {
			title = page.title;
			return;
		}
		title = t;
		await save(t);
	}
</script>

<div class="page-header">
	<div class="page-header-top">
		<h1
			bind:this={titleEl}
			class="page-title page-title--editable"
			contenteditable="true"
			aria-label="Page title"
			onkeydown={onKeydown}
			onblur={onBlur}
		>{title}</h1>
		{#if record}
			<button
				class="page-export-btn"
				title="Copy or download this page as Markdown or plain text"
				onclick={(e) => showExportMenu(e, record)}
			>Export</button>
		{/if}
	</div>
	{#if subtitle}<p class="page-subtitle">{subtitle}</p>{/if}
	{@render children?.()}
</div>
