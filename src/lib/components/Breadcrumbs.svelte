<script lang="ts">
	// Persistent path trail above the main content area — Courses / Course /
	// Category / Item — always visible, every ancestor segment clickable.
	// Replaces the old tiny "← Courses" text link buried at the top of the
	// sidebar, which was easy to miss and gave no sense of where you were
	// once inside a course.
	import { page as currentPage } from '$app/state';
	import { categoryHref, classifyPage, NAV_CATEGORY_LABELS, type NavCategory } from '$lib/utils/nav-category';
	import type { Page } from '$lib/schemas/page';

	let { courseId, courseTitle, pages }: { courseId: string; courseTitle: string; pages: Page[] } = $props();

	interface Crumb {
		label: string;
		href: string | null; // null = current page, not a link
	}

	let crumbs = $derived.by((): Crumb[] => {
		const routeId = currentPage.route.id ?? '';
		const pageId = (currentPage.params as { pageId?: string }).pageId;
		const planId = (currentPage.params as { planId?: string }).planId;

		const result: Crumb[] = [
			{ label: 'Courses', href: '/' },
			{ label: courseTitle, href: `/c/${courseId}` }
		];

		let category: NavCategory;
		if (routeId.includes('/documents')) category = 'documents';
		else if (routeId.includes('/planners')) category = 'planners';
		else category = classifyPage(pages, pageId) ?? 'trackers';

		result.push({ label: NAV_CATEGORY_LABELS[category], href: categoryHref(courseId, category) });

		if (pageId) {
			const p = pages.find((pg) => pg.id === pageId);
			result.push({ label: p?.title ?? 'Untitled', href: null });
		} else if (planId) {
			const planTitle = (currentPage.data as { plan?: { title: string } }).plan?.title;
			result.push({ label: planTitle ?? 'Untitled', href: null });
		}

		// The last segment is always "you are here" — never a link, even
		// when it was given one above (e.g. the category itself, when no
		// item is open beneath it).
		result[result.length - 1] = { ...result[result.length - 1], href: null };
		return result;
	});
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	{#each crumbs as crumb, i (i)}
		{#if i > 0}<span class="breadcrumb-sep">/</span>{/if}
		{#if crumb.href}
			<a class="breadcrumb-link" href={crumb.href}>{crumb.label}</a>
		{:else}
			<span class="breadcrumb-current">{crumb.label}</span>
		{/if}
	{/each}
</nav>
