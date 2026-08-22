<script lang="ts">
	import { goto } from '$app/navigation';
	import { createLecturePlan, removeLecturePlan, renameLecturePlan } from '$lib/api-client';
	import { inputDialog, confirmDialog, showError } from '$lib/dialogs';
	import { showContextMenu, type ContextMenuItem } from '$lib/context-menu';
	import { exportSubmenu } from '$lib/export-menu';
	import { WEEKDAYS, type LecturePlan } from '$lib/schemas/lecture-plan';

	let { courseId, plans: initialPlans }: { courseId: string; plans: LecturePlan[] } = $props();

	// svelte-ignore state_referenced_locally
	let plans = $state<LecturePlan[]>(initialPlans);

	function summary(plan: LecturePlan): string {
		const weekCount = plan.weeks.length;
		const cardCount = plan.weeks.reduce((sum, w) => sum + WEEKDAYS.reduce((s, d) => s + w.days[d].length, 0), 0);
		return `${weekCount} week${weekCount === 1 ? '' : 's'} · ${cardCount} lecture${cardCount === 1 ? '' : 's'}`;
	}

	async function addPlanner() {
		const title = await inputDialog('New Weekly Planner', 'e.g. 8 Week Summer Schedule');
		if (!title) return;
		try {
			const created = await createLecturePlan(courseId, title);
			plans = [...plans, created];
			goto(`/c/${courseId}/planners/${created.id}`);
		} catch (err) {
			showError(`Failed to create planner: ${(err as Error).message}`);
		}
	}

	async function onMenu(event: MouseEvent, plan: LecturePlan) {
		const items: ContextMenuItem[] = [
			{
				label: 'Rename',
				action: async () => {
					const title = await inputDialog('Rename planner', '', plan.title);
					if (!title || title === plan.title) return;
					try {
						const updated = await renameLecturePlan(courseId, plan.id, title);
						plans = plans.map((p) => (p.id === updated.id ? updated : p));
					} catch (err) {
						showError(`Failed to rename: ${(err as Error).message}`);
					}
				}
			},
			'separator',
			exportSubmenu(() => plan),
			'separator',
			{
				label: 'Delete',
				danger: true,
				action: async () => {
					const confirmed = await confirmDialog(
						`Delete "${plan.title}"?`,
						'This will permanently remove this weekly planner.',
						'Delete'
					);
					if (!confirmed) return;
					try {
						await removeLecturePlan(courseId, plan.id);
						plans = plans.filter((p) => p.id !== plan.id);
					} catch (err) {
						showError(`Failed to delete: ${(err as Error).message}`);
					}
				}
			}
		];
		showContextMenu(event, items);
	}
</script>

<div class="page-header">
	<h1 class="page-title">Weekly Planners</h1>
</div>

{#if plans.length === 0}
	<p class="list-panel-empty">No weekly planners yet.</p>
{:else}
	<div class="list-panel">
		{#each plans as plan (plan.id)}
			<div class="list-panel-row">
				<a class="list-panel-row-content" href="/c/{courseId}/planners/{plan.id}">
					<span class="list-panel-row-title">{plan.title}</span>
					<span class="list-panel-row-meta">{summary(plan)}</span>
				</a>
				<button class="list-panel-row-menu" title="Options" onclick={(e) => onMenu(e, plan)}>⋮</button>
			</div>
		{/each}
	</div>
{/if}

<button class="list-panel-add-btn" onclick={addPlanner}>+ New Planner</button>
