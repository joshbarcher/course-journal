<script lang="ts">
	// Ported from the near-identical _redrawGlobalBar() duplicated in
	// progress.js and progress-bars.js. Segments show their title text
	// (per this session's earlier change), falling back to "Task N"/"Bar N"
	// when untitled.
	import type { Segment } from '$lib/utils/progress-helpers';

	let { segments, emptyLabel, fallbackPrefix }: { segments: Segment[]; emptyLabel: string; fallbackPrefix: string } =
		$props();
</script>

<div class="progress-global-bar">
	{#if !segments.length}
		<span class="progress-global-empty">{emptyLabel}</span>
	{:else}
		{#each segments as seg (seg.num)}
			<div
				class="progress-global-seg"
				class:progress-global-seg--optional={seg.optional}
				style:background={seg.color}
				title={seg.label || `${fallbackPrefix} ${seg.num}`}
			>
				<span class="progress-seg-title">{seg.label || `${fallbackPrefix} ${seg.num}`}</span>
				{#if seg.stateLabel}<span class="progress-seg-state">{seg.stateLabel}</span>{/if}
			</div>
		{/each}
	{/if}
</div>
