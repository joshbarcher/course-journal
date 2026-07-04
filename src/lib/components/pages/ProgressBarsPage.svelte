<script lang="ts">
	// Ported from public/js/views/progress-bars.js. Drag-to-reorder (bars,
	// steps within a bar) uses the shared dragReorder action, with two
	// independent DragReorderState instances (one for bars, one for
	// chips) — the action's internal stopPropagation() on dragover/drop
	// keeps the nested chip drag zone from also triggering the bar's.
	// The right-click context menus (Mark/Unmark Optional, Duplicate,
	// Delete) are temporarily inline buttons — a later pass could swap
	// the trigger UI to the shared context-menu.ts module; step deletion
	// is available via the chip's corner "×" (mirrors the state pin's
	// corner), but per-step "mark optional" has no UI trigger yet (it's a
	// rarely-used settings-like action, unlike delete) even though the
	// underlying data action already exists below.
	import { updatePage } from '$lib/api-client';
	import PageTitleHeader from '$lib/components/PageTitleHeader.svelte';
	import GlobalProgressBar from '$lib/components/GlobalProgressBar.svelte';
	import { segmentColor, stateLabel, barProgressPercent, globalSegments } from '$lib/utils/progress-helpers';
	import { dragReorder, reorderById, type DragReorderState } from '$lib/actions/dragReorder';
	import { fireParticles } from '$lib/particles';
	import type { ProgressBarsPage as ProgressBarsPageType, ProgressBar, ProgressTask } from '$lib/schemas/page';

	let { courseId, page }: { courseId: string; page: ProgressBarsPageType } = $props();

	const STATE_CYCLE: ProgressTask['state'][] = [null, 'started', 'working', 'done'];

	// svelte-ignore state_referenced_locally
	let bars = $state<ProgressBar[]>(page.bars.map((b) => ({ ...b, steps: b.steps.map((s) => ({ ...s })) })));
	// svelte-ignore state_referenced_locally
	let notes = $state(page.notes);

	let segments = $derived(globalSegments({ ...page, bars, notes }));

	let notesTimer: ReturnType<typeof setTimeout> | null = null;

	async function save() {
		await updatePage(courseId, page.id, { bars, notes });
	}

	function onNotesInput() {
		if (notesTimer) clearTimeout(notesTimer);
		notesTimer = setTimeout(save, 800);
	}

	function chipStyle(state: ProgressTask['state']) {
		const color = segmentColor(state);
		return {
			background: state ? `color-mix(in srgb, ${color} 18%, var(--clr-bg-raised))` : 'var(--clr-bg-raised)',
			borderColor: state ? color : 'var(--clr-border)'
		};
	}

	function pinColor(state: ProgressTask['state']) {
		return state ? segmentColor(state) : 'rgba(255,255,255,0.18)';
	}

	// ── Bar actions ───────────────────────────────────────────────────────────

	function addBar() {
		bars = [...bars, { id: crypto.randomUUID(), title: '', steps: [] }];
		save();
	}

	function deleteBar(barId: string) {
		bars = bars.filter((b) => b.id !== barId);
		save();
	}

	function copyBar(sourceBarId: string) {
		const source = bars.find((b) => b.id === sourceBarId);
		if (!source) return;
		const newBar: ProgressBar = {
			id: crypto.randomUUID(),
			title: source.title,
			optional: source.optional,
			steps: source.steps.map((s) => ({ ...s, id: crypto.randomUUID(), state: null }))
		};
		const idx = bars.findIndex((b) => b.id === sourceBarId);
		bars = [...bars.slice(0, idx + 1), newBar, ...bars.slice(idx + 1)];
		save();
	}

	function toggleBarOptional(barId: string) {
		const bar = bars.find((b) => b.id === barId);
		if (!bar) return;
		bar.optional = !bar.optional;
		save();
	}

	function onBarTitleBlur(barId: string, newTitle: string) {
		const bar = bars.find((b) => b.id === barId);
		if (!bar || bar.title === newTitle) return;
		bar.title = newTitle;
		save();
	}

	// ── Step actions ──────────────────────────────────────────────────────────

	function addStep(barId: string) {
		const bar = bars.find((b) => b.id === barId);
		if (!bar) return;
		const step: ProgressTask = { id: crypto.randomUUID(), title: '', subtitle: '', state: null };
		bar.steps = [...bar.steps, step];
		save();
		queueMicrotask(() => {
			document.querySelector<HTMLElement>(`.pb-chip[data-step-id="${step.id}"] .pb-chip-title`)?.focus();
		});
	}

	function deleteStep(barId: string, stepId: string) {
		const bar = bars.find((b) => b.id === barId);
		if (!bar) return;
		bar.steps = bar.steps.filter((s) => s.id !== stepId);
		save();
	}

	function toggleStepOptional(barId: string, stepId: string) {
		const bar = bars.find((b) => b.id === barId);
		const step = bar?.steps.find((s) => s.id === stepId);
		if (!step) return;
		step.optional = !step.optional;
		save();
	}

	function cycleStepState(barId: string, stepId: string, chipEl: HTMLElement) {
		const bar = bars.find((b) => b.id === barId);
		const step = bar?.steps.find((s) => s.id === stepId);
		if (!bar || !step) return;
		const prev = step.state;
		const idx = STATE_CYCLE.indexOf(step.state);
		step.state = STATE_CYCLE[(idx + 1) % STATE_CYCLE.length];
		if (step.state === 'done' && prev !== 'done') {
			const required = bar.steps.filter((s) => !s.optional);
			if (required.length > 0 && required.every((s) => s.state === 'done')) {
				fireParticles(chipEl, bar.title);
			}
		}
		save();
	}

	function onStepTitleBlur(barId: string, stepId: string, newTitle: string) {
		const bar = bars.find((b) => b.id === barId);
		const step = bar?.steps.find((s) => s.id === stepId);
		if (!step || step.title === newTitle) return;
		step.title = newTitle;
		save();
	}

	function onStepSubtitleBlur(barId: string, stepId: string, newSubtitle: string) {
		const bar = bars.find((b) => b.id === barId);
		const step = bar?.steps.find((s) => s.id === stepId);
		if (!step || step.subtitle === newSubtitle) return;
		step.subtitle = newSubtitle;
		save();
	}

	// ── Bar drag-to-reorder ───────────────────────────────────────────────────

	let barDragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });

	function onBarDrop(draggedId: string, targetId: string) {
		bars = reorderById(bars, (b) => b.id, draggedId, targetId);
		save();
	}

	// ── Chip drag-to-reorder (within one bar) ────────────────────────────────

	let chipDragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });

	function onChipDrop(barId: string, draggedStepId: string, targetStepId: string) {
		const bar = bars.find((b) => b.id === barId);
		if (!bar) return;
		bar.steps = reorderById(bar.steps, (s) => s.id, draggedStepId, targetStepId);
		save();
	}
</script>

<PageTitleHeader {courseId} {page} subtitle="Multi-Bar Progress Tracker" />

<GlobalProgressBar {segments} emptyLabel="No bars yet" fallbackPrefix="Bar" />

<div class="pb-bars-list">
	{#each bars as bar, i (bar.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="pb-bar-row"
			class:pb-bar-row--optional={bar.optional && barProgressPercent(bar) < 100}
			class:pb-bar-row--optional-done={bar.optional && barProgressPercent(bar) >= 100}
			class:pb-bar-row--dragging={barDragState.draggingId === bar.id}
			class:pb-bar-row--drag-over={barDragState.dragOverId === bar.id}
			data-bar-id={bar.id}
			use:dragReorder={{
				id: bar.id,
				getState: () => barDragState,
				setState: (s) => (barDragState = s),
				onDrop: onBarDrop
			}}
		>
			<div class="pb-bar-handle" title="Drag to reorder">⠿</div>
			<div class="pb-bar-num">{i + 1}</div>
			<div
				class="pb-bar-title"
				contenteditable="true"
				aria-label="Bar title"
				role="textbox"
				tabindex="0"
				onblur={(e) => onBarTitleBlur(bar.id, (e.currentTarget as HTMLElement).textContent?.trim() ?? '')}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						(e.currentTarget as HTMLElement).blur();
					}
				}}
			>{bar.title}</div>

			<button
				class="progress-optional-tag"
				title={bar.optional ? 'Unmark optional' : 'Mark optional'}
				onclick={() => toggleBarOptional(bar.id)}
			>{bar.optional ? 'OPTIONAL' : 'Mark optional'}</button>
			<button class="list-item-delete" title="Duplicate bar" onclick={() => copyBar(bar.id)}>⧉</button>
			<button class="list-item-delete" title="Delete bar" onclick={() => deleteBar(bar.id)}>&times;</button>

			<div class="pb-chips">
				{#each bar.steps as step (step.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="pb-chip"
						class:pb-chip--optional={step.optional && step.state !== 'done'}
						class:pb-chip--optional-done={step.optional && step.state === 'done'}
						class:pb-chip--dragging={chipDragState.draggingId === step.id}
						class:pb-chip--drag-over={chipDragState.dragOverId === step.id}
						data-step-id={step.id}
						role="button"
						tabindex="0"
						style:background={chipStyle(step.state).background}
						style:border-color={chipStyle(step.state).borderColor}
						use:dragReorder={{
							id: step.id,
							getState: () => chipDragState,
							setState: (s) => (chipDragState = s),
							onDrop: (draggedId, targetId) => onChipDrop(bar.id, draggedId, targetId)
						}}
						onclick={(e) => {
							if ((e.target as HTMLElement).closest('.pb-chip-title, .pb-chip-subtitle, .pb-chip-delete')) return;
							cycleStepState(bar.id, step.id, e.currentTarget as HTMLElement);
						}}
						onkeydown={(e) => {
							if ((e.target as HTMLElement).closest('.pb-chip-title, .pb-chip-subtitle, .pb-chip-delete')) return;
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								cycleStepState(bar.id, step.id, e.currentTarget as HTMLElement);
							}
						}}
					>
						<span class="pb-chip-pin" style:background={pinColor(step.state)} title={stateLabel(step.state) || 'Not started'}
						></span>
						<button
							class="pb-chip-delete"
							title="Delete step"
							onclick={(e) => {
								e.stopPropagation();
								deleteStep(bar.id, step.id);
							}}
						>&times;</button>
						<span
							class="pb-chip-title"
							contenteditable="true"
							aria-label="Step title"
							role="textbox"
							tabindex="0"
							onblur={(e) => onStepTitleBlur(bar.id, step.id, (e.currentTarget as HTMLElement).textContent?.trim() ?? '')}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									(e.currentTarget as HTMLElement).blur();
								}
							}}
						>{step.title}</span>
						<span
							class="pb-chip-subtitle"
							contenteditable="true"
							aria-label="Step subtitle"
							role="textbox"
							tabindex="0"
							onblur={(e) =>
								onStepSubtitleBlur(bar.id, step.id, (e.currentTarget as HTMLElement).textContent?.trim() ?? '')}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									(e.currentTarget as HTMLElement).blur();
								}
							}}
						>{step.subtitle}</span>
					</div>
				{/each}
				<button class="pb-chip-add" title="Add step" onclick={() => addStep(bar.id)}>+</button>
			</div>
		</div>
	{/each}
</div>

<button class="progress-add-btn" onclick={addBar}>+ Add Bar</button>

<div class="progress-notes-wrap">
	<label class="progress-notes-label" for="pb-notes">Notes</label>
	<textarea id="pb-notes" class="progress-notes" placeholder="Add notes…" bind:value={notes} oninput={onNotesInput}
	></textarea>
</div>

<style>
	/* Temporary chip delete affordance — not part of the ported design
	   system (the old app used a right-click context menu here). Placed in
	   the opposite corner from the state pin. M4 replaces this with the
	   shared ContextMenu component and this rule goes away. */
	.pb-chip-delete {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 14px;
		height: 14px;
		line-height: 12px;
		font-size: 12px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.25);
		color: var(--clr-text-muted);
		opacity: 0;
		transition: opacity var(--transition);
	}

	.pb-chip:hover .pb-chip-delete {
		opacity: 1;
	}

	.pb-chip-delete:hover {
		color: var(--clr-text);
		background: rgba(0, 0, 0, 0.4);
	}
</style>
