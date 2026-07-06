<script lang="ts">
	import { dragHandle, dropTarget, type DragReorderState } from '$lib/actions/dragReorder';
	import { autoGrow } from '$lib/actions/autoGrow';
	import { DURATION_OPTIONS_HOURS, formatDurationHours, type LectureCard } from '$lib/schemas/lecture-plan';

	let {
		card,
		dragState,
		setDragState,
		onCardDrop,
		onUpdate,
		onRemove
	}: {
		card: LectureCard;
		dragState: DragReorderState;
		setDragState: (s: DragReorderState) => void;
		onCardDrop: (draggedId: string, targetId: string) => void;
		onUpdate: (cardId: string, patch: Partial<{ durationHours: number; topics: string }>) => void;
		onRemove: (cardId: string) => void;
	} = $props();

	// One-time copy-in, committed back via onUpdate on change/blur — matches
	// the rest of the app's "no debounce, save on discrete action or blur"
	// convention (see NotesPage/ListPage).
	// svelte-ignore state_referenced_locally
	let topics = $state(card.topics);

	function onDurationChange(e: Event) {
		onUpdate(card.id, { durationHours: Number((e.currentTarget as HTMLSelectElement).value) });
	}

	function onTopicsBlur() {
		if (topics === card.topics) return;
		onUpdate(card.id, { topics });
	}
</script>

<!--
  draggable=true lives only on the handle (see dragHandle), not the card
  root — otherwise a mousedown-drag inside the textarea/select gets
  captured as a native drag instead of text selection / opening the select.
  dropTarget stays on the whole card so hovering/dropping still works
  anywhere on it, not just over the tiny handle.
-->
<div
	class="lecture-card"
	class:lecture-card--dragging={dragState.draggingId === card.id}
	class:lecture-card--drag-over={dragState.dragOverId === card.id}
	use:dropTarget={{ id: card.id, getState: () => dragState, setState: setDragState, onDrop: onCardDrop }}
>
	<div class="lecture-card-rail">
		<span
			class="lecture-card-handle"
			title="Drag to move"
			use:dragHandle={{ id: card.id, getState: () => dragState, setState: setDragState }}
		>⠿</span>
		<select
			class="lecture-card-duration"
			value={card.durationHours}
			onchange={onDurationChange}
			aria-label="Duration"
		>
			{#each DURATION_OPTIONS_HOURS as hours (hours)}
				<option value={hours}>{formatDurationHours(hours)}</option>
			{/each}
		</select>
		<button class="lecture-card-delete" aria-label="Delete card" onclick={() => onRemove(card.id)}>&times;</button>
	</div>
	<textarea
		class="lecture-card-topics"
		placeholder="Topics…"
		bind:value={topics}
		onblur={onTopicsBlur}
		use:autoGrow
	></textarea>
</div>
