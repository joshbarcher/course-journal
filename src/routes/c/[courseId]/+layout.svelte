<script lang="ts">
	// Ported from app.js's mobile sidebar toggle/overlay wiring, scoped
	// here since #sidebar only exists on course-scoped routes.
	import { afterNavigate } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let mobileOpen = $state(false);

	afterNavigate(() => {
		mobileOpen = false;
	});
</script>

<div id="app">
	<button
		id="sidebar-toggle"
		class="sidebar-toggle"
		aria-label="Toggle sidebar"
		onclick={() => (mobileOpen = !mobileOpen)}
	>&#9776;</button>
	<div
		id="sidebar-overlay"
		class="sidebar-overlay"
		class:visible={mobileOpen}
		onclick={() => (mobileOpen = false)}
		role="presentation"
	></div>

	<Sidebar courseId={data.course.id} courseTitle={data.course.title} pages={data.pages} open={mobileOpen} />

	<div id="content-column">
		<Breadcrumbs courseId={data.course.id} courseTitle={data.course.title} pages={data.pages} />
		<main id="main-content">
			{@render children()}
		</main>
	</div>
</div>
