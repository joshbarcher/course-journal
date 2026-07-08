<script lang="ts">
	// Reduced to 3 persistent category selectors — individual pages/planners
	// no longer live in the sidebar at all, they're managed from their
	// category's list view in the main content area (Heatmap.svelte,
	// DocumentsList.svelte, PlannersList.svelte).
	import { page as currentPage } from '$app/state';
	import TrackerCollageIcon from './TrackerCollageIcon.svelte';
	import { classifyPage } from '$lib/utils/nav-category';
	import type { Page } from '$lib/schemas/page';

	let {
		courseId,
		courseTitle,
		pages,
		open = false
	}: { courseId: string; courseTitle: string; pages: Page[]; open?: boolean } = $props();

	// Classifies the current route into one of the 3 categories so the
	// right selector stays highlighted — including while an individual
	// tracker or document is open (routed at /c/{courseId}/{pageId}, which
	// carries no category info of its own, so its type is looked up from
	// the already-loaded `pages` list).
	let category = $derived.by(() => {
		const routeId = currentPage.route.id ?? '';
		if (routeId.includes('/documents')) return 'documents';
		if (routeId.includes('/planners')) return 'planners';
		const pageId = (currentPage.params as { pageId?: string }).pageId;
		return classifyPage(pages, pageId) ?? 'trackers';
	});
</script>

<aside id="sidebar" class:sidebar--open={open}>
	<nav id="sidebar-nav">
		<div class="sidebar-course-header">
			<a class="sidebar-course-name sidebar-course-name--clickable" href="/c/{courseId}">{courseTitle}</a>
		</div>

		<a class="sidebar-category" class:active={category === 'trackers'} href="/c/{courseId}">
			<TrackerCollageIcon {pages} />
			<span class="sidebar-category-label">Progress Trackers</span>
		</a>

		<a class="sidebar-category" class:active={category === 'documents'} href="/c/{courseId}/documents">
			<span class="sidebar-category-icon">&#128196;</span>
			<span class="sidebar-category-label">Documents</span>
		</a>

		<a class="sidebar-category" class:active={category === 'planners'} href="/c/{courseId}/planners">
			<span class="sidebar-category-icon">&#128197;</span>
			<span class="sidebar-category-label">Weekly Planners</span>
		</a>
	</nav>
</aside>
