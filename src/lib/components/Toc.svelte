<script lang="ts">
	// Ported from public/js/views/toc.js.
	import { groupPagesByType } from '$lib/utils/format';
	import type { Page } from '$lib/schemas/page';

	let { courseId, pages }: { courseId: string; pages: Page[] } = $props();

	let groups = $derived(groupPagesByType(pages));
</script>

<div class="page-header">
	<h1 class="page-title">Table of Contents</h1>
	<p class="page-subtitle">(Quicklinks)</p>
</div>

<div class="toc-body">
	{#if groups.length === 0}
		<p class="toc-empty">No pages yet — use "+ New Page" to get started.</p>
	{:else}
		{#each groups as group (group.type)}
			<div class="toc-section">
				<h2 class="toc-section-title">{group.label}</h2>
				<ul class="toc-list">
					{#each group.pages as p (p.id)}
						<li><a class="toc-link" href="/c/{courseId}/{p.id}">{p.title}</a></li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</div>
