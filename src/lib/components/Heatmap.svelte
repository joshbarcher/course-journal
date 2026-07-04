<script lang="ts">
	// Ported from public/js/views/heatmap.js (course home / per-course
	// progress overview + achievements).
	import Badge from './Badge.svelte';
	import { heatmapRows } from '$lib/utils/progress-helpers';
	import { progressPercent, isSuperComplete } from '$lib/utils/format';
	import type { Page } from '$lib/schemas/page';

	let { courseId, pages }: { courseId: string; pages: Page[] } = $props();

	const BADGE_THEMES = ['badge--teal', 'badge--purple', 'badge--blue', 'badge--rose', 'badge--amber'];
	const BADGE_ICONS = ['✦', '◈', '✸', '⬡', '◆', '✤'];

	let rows = $derived(heatmapRows(pages));

	let eligible = $derived(pages.filter((p) => p.type === 'progress' || p.type === 'progress-bars' || p.type === 'list'));
	let completed = $derived(eligible.filter((p) => progressPercent(p) === 100));
	let allDone = $derived(completed.length === eligible.length && eligible.length > 0);

	function cellTitle(rowTitle: string, cell: { label: string; num: number; stateLabel: string; optional: boolean }) {
		return [rowTitle, cell.label || `#${cell.num}`, cell.stateLabel, cell.optional ? '(optional)' : null]
			.filter(Boolean)
			.join(' · ');
	}
</script>

<div class="page-header">
	<h1 class="page-title">Progress</h1>
	<p class="page-subtitle">(Heatmap)</p>
</div>

{#if !rows.length}
	<p class="page-subtitle">No progress pages yet. Create a Progress or Multi-Bar page to see data here.</p>
{:else}
	<div class="heatmap-grid">
		{#each rows as row (row.id)}
			<div class="heatmap-row">
				<a class="heatmap-label" href="/c/{courseId}/{row.id}" title={row.title}>{row.title}</a>
				<div class="heatmap-cells">
					{#if !row.cells.length}
						<div class="heatmap-cell heatmap-cell--dim" title="{row.title} · no tasks"></div>
					{:else}
						{#each row.cells as cell (cell.num)}
							<a
								class="heatmap-cell"
								class:heatmap-cell--optional-done={cell.optional && cell.done}
								class:heatmap-cell--optional={cell.optional && !cell.done}
								href="/c/{courseId}/{row.id}"
								style:background={cell.color}
								title={cellTitle(row.title, cell)}
							></a>
						{/each}
					{/if}
				</div>
			</div>
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
