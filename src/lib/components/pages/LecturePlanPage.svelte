<script lang="ts">
	import {
		addLectureCard,
		addLectureWeek,
		moveLectureCard,
		removeLectureCard,
		removeLectureWeek,
		setMeetingPattern,
		updateLectureCard
	} from '$lib/api-client';
	import MeetingPatternPicker from '$lib/components/lecture-plan/MeetingPatternPicker.svelte';
	import LecturePlanWeek from '$lib/components/lecture-plan/LecturePlanWeek.svelte';
	import { emptyDayCards, findCard, moveCard, parseContainerKey } from '$lib/utils/lecture-plan-helpers';
	import type { DragReorderState } from '$lib/actions/dragReorder';
	import type { LecturePlan, LectureCard, Weekday } from '$lib/schemas/lecture-plan';

	let { courseId, plan: initialPlan }: { courseId: string; plan: LecturePlan } = $props();

	// One-time copy-in — safe because the parent route keys this component by
	// courseId (see +page.svelte), so a real navigation always gets a fresh instance.
	// svelte-ignore state_referenced_locally
	let plan = $state<LecturePlan>(structuredClone(initialPlan));
	let dragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });

	let meetingSet = $derived(new Set(plan.meetingDays));

	function onPatternChange(days: Weekday[]) {
		plan = { ...plan, meetingDays: days };
		setMeetingPattern(courseId, days).catch((err) => console.error('Failed to save meeting pattern', err));
	}

	// Optimistic like every other mutator here: render the new week/card
	// immediately with a client-generated id, persist in the background.
	// These two used to await the round trip before updating `plan`, which
	// is what made adding a week/card feel like it blocked for a couple of
	// seconds — every other action here was already fire-and-forget.
	function addWeek() {
		const id = crypto.randomUUID();
		plan = { ...plan, weeks: [...plan.weeks, { id, days: emptyDayCards() }] };
		addLectureWeek(courseId, id).catch((err) => console.error('Failed to save new week', err));
	}

	function onRemoveWeek(weekId: string) {
		plan = { ...plan, weeks: plan.weeks.filter((w) => w.id !== weekId) };
		removeLectureWeek(courseId, weekId).catch((err) => console.error('Failed to remove week', err));
	}

	function onAddCard(weekId: string, day: Weekday) {
		const card: LectureCard = { id: crypto.randomUUID(), durationHours: 1, topics: '' };
		plan = {
			...plan,
			weeks: plan.weeks.map((w) =>
				w.id === weekId ? { ...w, days: { ...w.days, [day]: [...w.days[day], card] } } : w
			)
		};
		addLectureCard(courseId, weekId, { id: card.id, day, durationHours: card.durationHours }).catch((err) =>
			console.error('Failed to save new card', err)
		);
	}

	function onUpdateCard(cardId: string, patch: Partial<{ durationHours: number; topics: string }>) {
		const loc = findCard(plan, cardId);
		if (!loc) return;
		const weeks = [...plan.weeks];
		const week = weeks[loc.weekIdx];
		const dayArr = [...week.days[loc.day]];
		dayArr[loc.cardIdx] = { ...dayArr[loc.cardIdx], ...patch };
		weeks[loc.weekIdx] = { ...week, days: { ...week.days, [loc.day]: dayArr } };
		plan = { ...plan, weeks };
		updateLectureCard(courseId, cardId, patch).catch((err) => console.error('Failed to save card', err));
	}

	function onRemoveCard(cardId: string) {
		const loc = findCard(plan, cardId);
		if (!loc) return;
		const weeks = [...plan.weeks];
		const week = weeks[loc.weekIdx];
		weeks[loc.weekIdx] = { ...week, days: { ...week.days, [loc.day]: week.days[loc.day].filter((c) => c.id !== cardId) } };
		plan = { ...plan, weeks };
		removeLectureCard(courseId, cardId).catch((err) => console.error('Failed to remove card', err));
	}

	function onCardDrop(draggedId: string, targetId: string) {
		const asContainer = parseContainerKey(targetId);
		let weekId: string;
		let day: Weekday;
		let beforeCardId: string | null;

		if (asContainer) {
			weekId = asContainer.weekId;
			day = asContainer.day;
			beforeCardId = null;
		} else {
			const loc = findCard(plan, targetId);
			if (!loc) return;
			weekId = plan.weeks[loc.weekIdx].id;
			day = loc.day;
			beforeCardId = targetId;
		}

		plan = moveCard(plan, draggedId, { weekId, day, beforeCardId });
		moveLectureCard(courseId, draggedId, { targetWeekId: weekId, targetDay: day, targetCardId: beforeCardId }).catch(
			(err) => console.error('Failed to save card move', err)
		);
	}
</script>

<div class="page-header">
	<h1 class="page-title">Weekly Lecture Plan</h1>
</div>

<div class="lecture-plan-toolbar">
	<MeetingPatternPicker selected={plan.meetingDays} onChange={onPatternChange} />
	<button class="lecture-plan-add-week-btn" onclick={addWeek}>+ Add Week</button>
</div>

<div class="lecture-plan-weeks">
	{#each plan.weeks as week, i (week.id)}
		<LecturePlanWeek
			{week}
			label={`Week ${i + 1}`}
			{meetingSet}
			{dragState}
			setDragState={(s) => (dragState = s)}
			{onCardDrop}
			{onAddCard}
			{onUpdateCard}
			{onRemoveCard}
			{onRemoveWeek}
		/>
	{/each}
</div>
