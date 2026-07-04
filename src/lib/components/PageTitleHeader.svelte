<script lang="ts">
	// Shared editable page-title header, ported from the near-identical
	// _buildPageTitle() repeated in list.js/notes.js/page.js/progress.js/
	// progress-bars.js. Sidebar-refresh-on-rename (refreshSidebarItem in the
	// old code) is wired up once the sidebar exists (M4) — for now a rename
	// just persists.
	import { updatePage } from '$lib/api-client';

	let {
		courseId,
		page,
		subtitle,
		children
	}: {
		courseId: string;
		page: { id: string; title: string };
		subtitle?: string;
		children?: import('svelte').Snippet;
	} = $props();

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
		await updatePage(courseId, page.id, { title: t });
	}
</script>

<div class="page-header">
	<h1
		bind:this={titleEl}
		class="page-title page-title--editable"
		contenteditable="true"
		aria-label="Page title"
		onkeydown={onKeydown}
		onblur={onBlur}
	>{title}</h1>
	{#if subtitle}<p class="page-subtitle">{subtitle}</p>{/if}
	{@render children?.()}
</div>
