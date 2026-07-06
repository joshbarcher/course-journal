<script lang="ts">
	import LecturePlanCard from './LecturePlanCard.svelte';
	import { containerKey } from '$lib/utils/lecture-plan-helpers';
	import { WEEKDAY_LABELS, type LectureCard, type Weekday } from '$lib/schemas/lecture-plan';
	import type { DragReorderState } from '$lib/actions/dragReorder';

	let {
		weekId,
		day,
		cards,
		isMeetingDay,
		dragState,
		setDragState,
		onCardDrop,
		onAddCard,
		onUpdateCard,
		onRemoveCard
	}: {
		weekId: string;
		day: Weekday;
		cards: LectureCard[];
		isMeetingDay: boolean;
		dragState: DragReorderState;
		setDragState: (s: DragReorderState) => void;
		onCardDrop: (draggedId: string, targetId: string) => void;
		onAddCard: (weekId: string, day: Weekday) => void;
		onUpdateCard: (cardId: string, patch: Partial<{ durationHours: number; topics: string }>) => void;
		onRemoveCard: (cardId: string) => void;
	} = $props();

	// Manual (non-action) drop zone for the day container itself, so a card
	// dropped on empty space (including a fully empty day) still resolves to
	// somewhere — per-card dragReorder handlers already stopPropagation(), so
	// this only fires when the drop doesn't land on a card first. Mirrors
	// ListPage.svelte's onContainerDragOver/onContainerDrop for subtask rows.
	function onContainerDragOver(e: DragEvent) {
		if (!dragState.draggingId) return;
		e.preventDefault();
		e.stopPropagation();
	}

	function onContainerDrop(e: DragEvent) {
		if (!dragState.draggingId) return;
		e.preventDefault();
		e.stopPropagation();
		const draggedId = dragState.draggingId;
		setDragState({ draggingId: null, dragOverId: null });
		onCardDrop(draggedId, containerKey(weekId, day));
	}
</script>

<!--
  Compact styling only applies to an EMPTY non-meeting day — a day that
  already holds a card always renders full-size regardless of the meeting
  pattern, since a 56px-wide column can't fit a duration input + textarea
  without them overflowing into the neighboring day's column.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="lecture-day"
	class:lecture-day--compact={!isMeetingDay && cards.length === 0}
	ondragover={onContainerDragOver}
	ondrop={onContainerDrop}
>
	<div class="lecture-day-header">{WEEKDAY_LABELS[day]}</div>
	<div class="lecture-day-cards">
		{#each cards as card (card.id)}
			<LecturePlanCard {card} {dragState} {setDragState} {onCardDrop} onUpdate={onUpdateCard} onRemove={onRemoveCard} />
		{/each}
	</div>
	<button class="lecture-day-add-btn" onclick={() => onAddCard(weekId, day)}>+ card</button>
</div>
