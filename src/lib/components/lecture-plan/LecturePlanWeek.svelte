<script lang="ts">
	import { confirmDialog } from '$lib/dialogs';
	import LecturePlanDay from './LecturePlanDay.svelte';
	import { WEEKDAYS, type LectureWeek, type Weekday } from '$lib/schemas/lecture-plan';
	import type { DragReorderState } from '$lib/actions/dragReorder';

	let {
		week,
		label,
		meetingSet,
		dragState,
		setDragState,
		onCardDrop,
		onAddCard,
		onUpdateCard,
		onRemoveCard,
		onRemoveWeek
	}: {
		week: LectureWeek;
		label: string;
		meetingSet: Set<Weekday>;
		dragState: DragReorderState;
		setDragState: (s: DragReorderState) => void;
		onCardDrop: (draggedId: string, targetId: string) => void;
		onAddCard: (weekId: string, day: Weekday) => void;
		onUpdateCard: (cardId: string, patch: Partial<{ durationHours: number; topics: string }>) => void;
		onRemoveCard: (cardId: string) => void;
		onRemoveWeek: (weekId: string) => void;
	} = $props();

	async function removeWeek() {
		const ok = await confirmDialog('Remove week?', `This deletes all lecture cards in ${label}.`, 'Remove');
		if (ok) onRemoveWeek(week.id);
	}
</script>

<!--
  <fieldset>/<legend> puts the week label directly in the border for free.
  The remove button can't live in the (single, native) legend if it's meant
  to sit at the opposite corner — it's a separately absolutely-positioned
  sibling instead, styled to sit on the border the same way the legend does.
-->
<fieldset class="lecture-week">
	<legend class="lecture-week-legend">
		<span class="lecture-week-label">{label}</span>
	</legend>
	<button class="lecture-week-remove" aria-label="Remove week" onclick={removeWeek}>&times;</button>
	<div class="lecture-week-days">
		{#each WEEKDAYS as day (day)}
			<!-- Before any meeting day is chosen, every day renders full-size —
			     otherwise a brand-new plan looks broken by default. -->
			<LecturePlanDay
				weekId={week.id}
				{day}
				cards={week.days[day]}
				isMeetingDay={meetingSet.size === 0 || meetingSet.has(day)}
				{dragState}
				{setDragState}
				{onCardDrop}
				{onAddCard}
				{onUpdateCard}
				{onRemoveCard}
			/>
		{/each}
	</div>
</fieldset>
