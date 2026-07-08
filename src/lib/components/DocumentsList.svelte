<script lang="ts">
	import { goto } from '$app/navigation';
	import PageListRow from './lists/PageListRow.svelte';
	import { newPageDialog, showError } from '$lib/dialogs';
	import { createPage } from '$lib/api-client';
	import { groupPagesByType } from '$lib/utils/format';
	import type { Page } from '$lib/schemas/page';

	let { courseId, pages: initialPages }: { courseId: string; pages: Page[] } = $props();

	// svelte-ignore state_referenced_locally
	let pages = $state<Page[]>(initialPages);

	const DOCUMENT_TYPES = new Set(['notes', 'page']);

	let documents = $derived(pages.filter((p) => DOCUMENT_TYPES.has(p.type)));
	let groups = $derived(groupPagesByType(documents));

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

	async function addDocument() {
		const result = await newPageDialog({ dialogTitle: 'New Document', allowedTypes: ['notes', 'page'] });
		if (!result) return;
		try {
			const created = await createPage(courseId, result);
			pages = [...pages, created];
			goto(`/c/${courseId}/${created.id}`);
		} catch (err) {
			showError(`Failed to create document: ${(err as Error).message}`);
		}
	}
</script>

<div class="page-header">
	<h1 class="page-title">Documents</h1>
</div>

{#if !documents.length}
	<p class="list-panel-empty">No documents yet. Create a Notes or Page document to see it here.</p>
{:else}
	{#each groups as group (group.type)}
		<div class="list-panel-group">
			<h2 class="list-panel-group-title">{group.label}</h2>
			<div class="list-panel">
				{#each group.pages as p (p.id)}
					<PageListRow page={p} {courseId} variant="document" {onDuplicated} {onDeleted} {onReset} />
				{/each}
			</div>
		</div>
	{/each}
{/if}

<button class="list-panel-add-btn" onclick={addDocument}>+ New Document</button>
