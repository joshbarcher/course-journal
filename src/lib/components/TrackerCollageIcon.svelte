<script lang="ts">
	// The "fun" bit of the nav facelift: a small mosaic sampled evenly from
	// every tracker's actual cell colors (same builder the full Trackers
	// list uses), so it's a genuine compact snapshot of the course's real
	// progress state rather than a generic icon.
	import { heatmapRows } from '$lib/utils/progress-helpers';
	import type { Page } from '$lib/schemas/page';

	let { pages }: { pages: Page[] } = $props();

	const GRID_SIZE = 16;
	const DIM = 'rgba(255,255,255,0.10)';

	let tiles = $derived.by(() => {
		const cells = heatmapRows(pages).flatMap((r) => r.cells);
		if (!cells.length) return Array.from({ length: GRID_SIZE }, () => DIM);
		return Array.from({ length: GRID_SIZE }, (_, i) => cells[Math.floor((i / GRID_SIZE) * cells.length)].color);
	});
</script>

<div class="tracker-collage" aria-hidden="true">
	{#each tiles as color, i (i)}
		<span class="tracker-collage-tile" style:background={color}></span>
	{/each}
</div>
