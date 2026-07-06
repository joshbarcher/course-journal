<script lang="ts">
	// Ported from public/js/sidebar.js. Arrow-key nav between items is
	// handled via one delegated keydown listener on <nav> (bubbling),
	// replacing the original's per-item _arrowNav wiring.
	import { page as currentPage } from '$app/state';
	import { goto } from '$app/navigation';
	import SidebarItem from './SidebarItem.svelte';
	import { newPageDialog, showError } from '$lib/dialogs';
	import { createPage, reorderPages } from '$lib/api-client';
	import { reorderById, type DragReorderState } from '$lib/actions/dragReorder';
	import type { Page } from '$lib/schemas/page';

	let {
		courseId,
		courseTitle,
		pages: initialPages,
		open = false
	}: { courseId: string; courseTitle: string; pages: Page[]; open?: boolean } = $props();

	// Intentionally captures only the initial value — this component is
	// recreated whenever the course layout re-mounts (different courseId),
	// and mutated locally afterward to mirror server operations exactly
	// like the old sidebar.js's _pages array did (no full refetch).
	// svelte-ignore state_referenced_locally
	let pages = $state<Page[]>(initialPages);
	let dragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });

	let activeId = $derived.by(() => {
		if (currentPage.route.id?.endsWith('/toc')) return 'toc';
		if (currentPage.route.id?.endsWith('/lecture-plan')) return 'lecture-plan';
		const pageId = (currentPage.params as { pageId?: string }).pageId;
		return pageId ?? 'home';
	});

	function onItemDrop(draggedId: string, targetId: string) {
		pages = reorderById(pages, (p) => p.id, draggedId, targetId);
		reorderPages(
			courseId,
			pages.map((p) => p.id)
		).catch((err) => console.error('Failed to persist reorder', err));
	}

	function onDuplicated(copy: Page, afterId: string) {
		const idx = pages.findIndex((p) => p.id === afterId);
		pages = [...pages.slice(0, idx + 1), copy, ...pages.slice(idx + 1)];
	}

	function onDeleted(pageId: string) {
		pages = pages.filter((p) => p.id !== pageId);
	}

	function onReset(updated: Page) {
		pages = pages.map((p) => (p.id === updated.id ? updated : p));
	}

	async function addNewPage() {
		const result = await newPageDialog();
		if (!result) return;
		try {
			const created = await createPage(courseId, result);
			pages = [...pages, created];
			goto(`/c/${courseId}/${created.id}`);
		} catch (err) {
			showError(`Failed to create page: ${(err as Error).message}`);
		}
	}

	function onNavKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		const nav = e.currentTarget as HTMLElement;
		const focusable = Array.from(nav.querySelectorAll<HTMLElement>('.sidebar-toc-btn, .sidebar-item'));
		const idx = focusable.indexOf(document.activeElement as HTMLElement);
		if (idx === -1) return;
		e.preventDefault();
		if (e.key === 'ArrowDown' && idx < focusable.length - 1) focusable[idx + 1].focus();
		if (e.key === 'ArrowUp' && idx > 0) focusable[idx - 1].focus();
	}
</script>

<aside id="sidebar" class:sidebar--open={open}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<nav id="sidebar-nav" onkeydown={onNavKeydown}>
		<div class="sidebar-course-header">
			<a class="sidebar-back-link" href="/">← Courses</a>
			<a class="sidebar-course-name sidebar-course-name--clickable" href="/c/{courseId}">{courseTitle}</a>
		</div>

		<a class="sidebar-toc-btn" class:active={activeId === 'toc'} data-id="toc" href="/c/{courseId}/toc">
			<span class="sidebar-toc-icon">&#9776;</span> Table of Contents
		</a>

		<a
			class="sidebar-toc-btn"
			class:active={activeId === 'lecture-plan'}
			data-id="lecture-plan"
			href="/c/{courseId}/lecture-plan"
		>
			<span class="sidebar-toc-icon">&#128197;</span> Weekly Lecture Plan
		</a>

		{#if pages.length === 0}
			<div class="sidebar-empty">No pages yet</div>
		{:else}
			{#each pages as p (p.id)}
				<SidebarItem
					page={p}
					href="/c/{courseId}/{p.id}"
					isActive={activeId === p.id}
					{courseId}
					{dragState}
					setDragState={(s) => (dragState = s)}
					onDrop={onItemDrop}
					{onDuplicated}
					{onDeleted}
					{onReset}
				/>
			{/each}
		{/if}
	</nav>
	<button class="sidebar-add-btn" onclick={addNewPage}>+ New Page</button>
</aside>
