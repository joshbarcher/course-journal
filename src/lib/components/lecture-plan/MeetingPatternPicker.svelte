<script lang="ts">
	import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '$lib/schemas/lecture-plan';

	let { selected, onChange }: { selected: Weekday[]; onChange: (days: Weekday[]) => void } = $props();

	let selectedSet = $derived(new Set(selected));

	function toggle(day: Weekday) {
		const next = selectedSet.has(day) ? selected.filter((d) => d !== day) : [...selected, day];
		onChange(WEEKDAYS.filter((d) => next.includes(d)));
	}
</script>

<div class="lecture-plan-pattern">
	<span class="lecture-plan-pattern-label">Meets on:</span>
	{#each WEEKDAYS as day (day)}
		<button
			type="button"
			class="lecture-plan-pattern-day"
			class:lecture-plan-pattern-day--active={selectedSet.has(day)}
			onclick={() => toggle(day)}
		>
			{WEEKDAY_LABELS[day]}
		</button>
	{/each}
</div>
