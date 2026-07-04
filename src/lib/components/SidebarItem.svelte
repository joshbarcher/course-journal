<script lang="ts">
	// Ported from the per-item logic in public/js/sidebar.js's buildItem()
	// and _showItemMenu(). Drag-to-reorder uses the shared dragReorder
	// action instead of a copy-pasted block.
	import { goto } from '$app/navigation';
	import { showContextMenu, type ContextMenuItem } from '$lib/context-menu';
	import { confirmDialog, showError } from '$lib/dialogs';
	import { listCourses, createPage, updatePage, removePage } from '$lib/api-client';
	import { progressPercent } from '$lib/utils/format';
	import { percentToColor } from '$lib/utils/progress-helpers';
	import { dragReorder, type DragReorderState } from '$lib/actions/dragReorder';
	import type { Page } from '$lib/schemas/page';

	let {
		page,
		href,
		isActive,
		courseId,
		dragState,
		setDragState,
		onDrop,
		onDuplicated,
		onDeleted,
		onReset
	}: {
		page: Page;
		href: string;
		isActive: boolean;
		courseId: string;
		dragState: DragReorderState;
		setDragState: (s: DragReorderState) => void;
		onDrop: (draggedId: string, targetId: string) => void;
		onDuplicated: (copy: Page, afterId: string) => void;
		onDeleted: (pageId: string) => void;
		onReset: (updated: Page) => void;
	} = $props();

	const PROGRESS_TYPES = new Set(['list', 'progress', 'progress-bars']);

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
			{ label: 'Copy to…', submenu: copyToItems }
		];

		if (PROGRESS_TYPES.has(page.type)) {
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
					if (isActive) goto(`/c/${courseId}/toc`);
				} catch (err) {
					showError(`Failed to delete: ${(err as Error).message}`);
				}
			}
		});

		showContextMenu(event, items);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			goto(href);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="sidebar-item"
	class:active={isActive}
	class:sidebar-item--dragging={dragState.draggingId === page.id}
	class:sidebar-item--drag-over={dragState.dragOverId === page.id}
	data-id={page.id}
	tabindex="0"
	role="link"
	oncontextmenu={onMenu}
	onkeydown={onKeydown}
	use:dragReorder={{
		id: page.id,
		getState: () => dragState,
		setState: setDragState,
		onDrop
	}}
>
	<span class="sidebar-drag-handle" title="Drag to reorder">⠿</span>

	<a class="sidebar-item-content" {href} onclick={(e) => e.stopPropagation()}>
		{#if page.type === 'list' || page.type === 'progress' || page.type === 'progress-bars'}
			{@const pct = progressPercent(page)}
			<span class="sidebar-item-title">{page.title}</span>
			<div class="sidebar-progress-track">
				<div class="sidebar-progress-fill" style:width="{pct}%" style:background={percentToColor(pct)}></div>
			</div>
		{:else if page.type === 'notes'}
			<div class="sidebar-item-row">
				<span class="sidebar-item-title">{page.title}</span>
				{#if page.notes.length > 0}<span class="sidebar-badge">{page.notes.length}</span>{/if}
			</div>
		{:else}
			<div class="sidebar-item-row">
				<span class="sidebar-item-title">{page.title}</span>
			</div>
		{/if}
	</a>

	<button class="sidebar-item-menu" title="Options" onclick={onMenu}>⋮</button>
</div>
