<script lang="ts">
	// Course root / Progress Trackers view. Ported from public/js/views/
	// heatmap.js, then extended to double as the Trackers list (add/
	// duplicate/reset/delete), since individual pages no longer have a home
	// in the sidebar — this view now owns page-management for every
	// progress/progress-bars/list page the same way the old sidebar did.
	import { goto } from '$app/navigation';
	import Badge from './Badge.svelte';
	import PageListRow from './lists/PageListRow.svelte';
	import { newPageDialog, showError } from '$lib/dialogs';
	import { createPage } from '$lib/api-client';
	import { progressPercent, isSuperComplete } from '$lib/utils/format';
	import type { Page } from '$lib/schemas/page';

	let { courseId, pages: initialPages }: { courseId: string; pages: Page[] } = $props();

	// svelte-ignore state_referenced_locally
	let pages = $state<Page[]>(initialPages);

	const TRACKER_TYPES = new Set(['progress', 'progress-bars', 'list']);
	const BADGE_THEMES = ['badge--teal', 'badge--purple', 'badge--blue', 'badge--rose', 'badge--amber'];
	const BADGE_ICONS = ['✦', '◈', '✸', '⬡', '◆', '✤'];

	let trackers = $derived(pages.filter((p) => TRACKER_TYPES.has(p.type)));
	let completed = $derived(trackers.filter((p) => progressPercent(p) === 100));
	let allDone = $derived(completed.length === trackers.length && trackers.length > 0);

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

	async function addTracker() {
		const result = await newPageDialog({
			dialogTitle: 'New Tracker',
			allowedTypes: ['progress', 'progress-bars', 'list']
		});
		if (!result) return;
		try {
			const created = await createPage(courseId, result);
			pages = [...pages, created];
			goto(`/c/${courseId}/${created.id}`);
		} catch (err) {
			showError(`Failed to create tracker: ${(err as Error).message}`);
		}
	}
</script>

<div class="page-header">
	<h1 class="page-title">Progress Trackers</h1>
</div>

{#if !trackers.length}
	<p class="list-panel-empty">No trackers yet. Create a Progress, Multi-Bar, or List tracker to see data here.</p>
{:else}
	<div class="list-panel">
		{#each trackers as p (p.id)}
			<PageListRow page={p} {courseId} variant="tracker" {onDuplicated} {onDeleted} {onReset} />
		{/each}
	</div>

	{#if completed.length}
		<div class="badges-section">
			<div class="badges-heading">Achievements</div>
			<div class="badges-row">
				{#if allDone}
					<Badge icon="★" title={'Course\nComplete'} themeClass="badge--gold badge--star" large />
				{/if}
				{#each completed as p, i (p.id)}
					<Badge
						icon={BADGE_ICONS[(i + 2) % BADGE_ICONS.length]}
						title={p.title}
						themeClass="{BADGE_THEMES[i % BADGE_THEMES.length]}{isSuperComplete(p) ? ' badge--super' : ''}"
						isSuper={isSuperComplete(p)}
					/>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<button class="list-panel-add-btn" onclick={addTracker}>+ New Tracker</button>
