<script lang="ts">
	import type { PageProps } from './$types';
	import NotesPage from '$lib/components/pages/NotesPage.svelte';
	import ListPage from '$lib/components/pages/ListPage.svelte';
	import ProgressPage from '$lib/components/pages/ProgressPage.svelte';
	import ProgressBarsPage from '$lib/components/pages/ProgressBarsPage.svelte';
	import RichTextPage from '$lib/components/pages/RichTextPage.svelte';

	let { data }: PageProps = $props();
</script>

<!--
  Keyed by page.id so navigating between pages of the same type gets a
  fresh component instance (fresh local $state) instead of Svelte reusing
  the mounted instance across different underlying records — mirrors the
  old router's full _draw() redraw per navigation.
-->
{#if !data.page}
	<p class="page-error">Page not found.</p>
{:else}
	{#key data.page.id}
		{#if data.page.type === 'notes'}
			<NotesPage courseId={data.courseId} page={data.page} />
		{:else if data.page.type === 'list'}
			<ListPage courseId={data.courseId} page={data.page} />
		{:else if data.page.type === 'progress'}
			<ProgressPage courseId={data.courseId} page={data.page} />
		{:else if data.page.type === 'progress-bars'}
			<ProgressBarsPage courseId={data.courseId} page={data.page} />
		{:else}
			<RichTextPage courseId={data.courseId} page={data.page} />
		{/if}
	{/key}
{/if}
