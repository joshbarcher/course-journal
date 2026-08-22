<script lang="ts">
	// Shared row for the Trackers and Documents list views — extracted from
	// the old Sidebar's per-item menu (Duplicate / Copy to… / Reset progress
	// / Delete), which now lives here instead since individual pages no
	// longer appear in the sidebar. Unlike the old sidebar row, this one
	// never coexists with the page it represents being open in the same
	// view, so there's no "redirect away if this was the active page" case
	// to handle on delete — deleting just removes the row from the list.
	import { goto } from '$app/navigation';
	import { showContextMenu, type ContextMenuItem } from '$lib/context-menu';
	import { exportSubmenu } from '$lib/export-menu';
	import { confirmDialog, showError } from '$lib/dialogs';
	import { listCourses, createPage, updatePage, removePage } from '$lib/api-client';
	import { progressPercent } from '$lib/utils/format';
	import { percentToColor, globalSegments } from '$lib/utils/progress-helpers';
	import type { Page } from '$lib/schemas/page';

	let {
		page,
		courseId,
		variant,
		onDuplicated,
		onDeleted,
		onReset
	}: {
		page: Page;
		courseId: string;
		variant: 'tracker' | 'document';
		onDuplicated: (copy: Page, afterId: string) => void;
		onDeleted: (pageId: string) => void;
		onReset: (updated: Page) => void;
	} = $props();

	let href = $derived(`/c/${courseId}/${page.id}`);
	let cells = $derived(variant === 'tracker' ? globalSegments(page) : []);

	function resetPageData(p: Page): Record<string, unknown> {
		if (p.type === 'list') {
			return { items: (p.items ?? []).map((i) => ({ ...i, done: false })) };
		}
		if (p.type === 'progress') {
			return { tasks: (p.tasks ?? []).map((t) => ({ ...t, state: null })), notes: '' };
		}
		if (p.type === 'progress-bars') {
			return { bars: (p.bars ?? []).map((b) => ({ ...b, steps: (b.steps ?? []).map((s) => ({ ...s, state: null })) })) };
		}
		return {};
	}

	async function onMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		let otherCourses: { id: string; title: string }[] = [];
		try {
			otherCourses = (await listCourses()).filter((c) => c.id !== courseId);
		} catch {
			/* show menu anyway */
		}

		const copyToItems: ContextMenuItem[] = otherCourses.length
			? otherCourses.map((c) => ({
					label: c.title,
					action: async () => {
						try {
							// eslint-disable-next-line @typescript-eslint/no-unused-vars
							const { id: _id, createdAt: _c, updatedAt: _u, ...data } = page as unknown as Record<string, unknown>;
							await createPage(c.id, data as { type: Page['type']; title: string });
						} catch (err) {
							showError(`Failed to copy: ${(err as Error).message}`);
						}
					}
				}))
			: [{ label: '(No other courses)', action: () => {} }];

		const items: ContextMenuItem[] = [
			{
				label: 'Duplicate',
				action: async () => {
					try {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { id: _id, createdAt: _c, updatedAt: _u, ...data } = page as unknown as Record<string, unknown>;
						const copy = await createPage(courseId, {
							...data,
							title: `${page.title} (copy)`
						} as { type: Page['type']; title: string });
						onDuplicated(copy, page.id);
						goto(`/c/${courseId}/${copy.id}`);
					} catch (err) {
						showError(`Failed to duplicate: ${(err as Error).message}`);
					}
				}
			},
			'separator',
			{ label: 'Copy to…', submenu: copyToItems },
			// The row's `page` prop is the persisted record, which is exactly
			// what should be exported from a list view — unlike the open-page
			// header, there's no unsaved local state here to prefer over it.
			exportSubmenu(() => page)
		];

		if (variant === 'tracker') {
			items.push('separator', {
				label: 'Reset progress',
				action: async () => {
					const confirmed = await confirmDialog(
						`Reset "${page.title}"?`,
						'This will clear all progress on this page.',
						'Reset'
					);
					if (!confirmed) return;
					try {
						const updated = await updatePage(courseId, page.id, resetPageData(page));
						onReset(updated);
					} catch (err) {
						showError(`Failed to reset: ${(err as Error).message}`);
					}
				}
			});
		}

		items.push('separator', {
			label: 'Delete',
			danger: true,
			action: async () => {
				const confirmed = await confirmDialog(`Delete "${page.title}"?`, 'This will permanently remove this page.', 'Delete');
				if (!confirmed) return;
				try {
					await removePage(courseId, page.id);
					onDeleted(page.id);
				} catch (err) {
					showError(`Failed to delete: ${(err as Error).message}`);
				}
			}
		});

		showContextMenu(event, items);
	}
</script>

<div class="list-panel-row">
	<a class="list-panel-row-content" {href}>
		<span class="list-panel-row-title">{page.title}</span>

		{#if variant === 'tracker'}
			{@const pct = progressPercent(page)}
			<div class="list-panel-row-heat">
				{#if cells.length}
					{#each cells as cell (cell.num)}
						<span class="list-panel-heat-cell" style:background={cell.color} title={cell.label}></span>
					{/each}
				{:else}
					<div class="list-panel-progress-track">
						<div class="list-panel-progress-fill" style:width="{pct}%" style:background={percentToColor(pct)}></div>
					</div>
				{/if}
			</div>
		{:else if page.type === 'notes'}
			<span class="list-panel-row-meta">{page.notes.length} note{page.notes.length === 1 ? '' : 's'}</span>
		{:else}
			<span class="list-panel-row-meta">Page</span>
		{/if}
	</a>

	<button class="list-panel-row-menu" title="Options" onclick={onMenu}>⋮</button>
</div>
