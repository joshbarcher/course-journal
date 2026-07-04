<script lang="ts">
	// Ported from public/js/views/progress.js. Drag-to-reorder uses the
	// shared dragReorder action. The right-click context menu (Mark/Unmark
	// Optional, Delete) is temporarily a pair of always-visible buttons —
	// a later pass could replace this with the shared context-menu.ts
	// module used by the sidebar; the underlying actions
	// (toggleOptional/deleteTask) are already final.
	import { updatePage } from '$lib/api-client';
	import PageTitleHeader from '$lib/components/PageTitleHeader.svelte';
	import GlobalProgressBar from '$lib/components/GlobalProgressBar.svelte';
	import { segmentColor, globalSegments, type TaskState } from '$lib/utils/progress-helpers';
	import { dragReorder, reorderById, type DragReorderState } from '$lib/actions/dragReorder';
	import { fireParticles } from '$lib/particles';
	import type { ProgressPage as ProgressPageType, ProgressTask } from '$lib/schemas/page';

	let { courseId, page }: { courseId: string; page: ProgressPageType } = $props();

	const STATES: NonNullable<TaskState>[] = ['started', 'working', 'done'];
	const STATE_LABELS: Record<string, string> = { started: 'STARTED', working: 'WORKING', done: 'DONE' };

	// svelte-ignore state_referenced_locally
	let tasks = $state<ProgressTask[]>(page.tasks.map((t) => ({ ...t })));
	// svelte-ignore state_referenced_locally
	let notes = $state(page.notes);

	let segments = $derived(globalSegments({ ...page, tasks, notes }));

	let notesTimer: ReturnType<typeof setTimeout> | null = null;

	async function save() {
		await updatePage(courseId, page.id, { tasks, notes });
	}

	function onNotesInput() {
		if (notesTimer) clearTimeout(notesTimer);
		notesTimer = setTimeout(save, 800);
	}

	function onStateClick(taskId: string, state: NonNullable<TaskState>, btnEl: HTMLElement) {
		const task = tasks.find((t) => t.id === taskId);
		if (!task) return;
		const prev = task.state;
		task.state = task.state === state ? null : state;
		if (task.state === 'done' && prev !== 'done') {
			const required = tasks.filter((t) => !t.optional);
			if (required.length > 0 && required.every((t) => t.state === 'done')) {
				fireParticles(btnEl, page.title);
			}
		}
		save();
	}

	function onTitleBlur(taskId: string, newTitle: string) {
		const task = tasks.find((t) => t.id === taskId);
		if (!task || task.title === newTitle) return;
		task.title = newTitle;
		save();
	}

	function onSubtitleBlur(taskId: string, newSubtitle: string) {
		const task = tasks.find((t) => t.id === taskId);
		if (!task || task.subtitle === newSubtitle) return;
		task.subtitle = newSubtitle;
		save();
	}

	function addTask() {
		const task: ProgressTask = { id: crypto.randomUUID(), title: '', subtitle: '', state: null };
		tasks = [...tasks, task];
		save();
		queueMicrotask(() => {
			document.querySelector<HTMLElement>(`.progress-task[data-id="${task.id}"] .progress-task-title`)?.focus();
		});
	}

	function deleteTask(taskId: string) {
		tasks = tasks.filter((t) => t.id !== taskId);
		save();
	}

	function toggleTaskOptional(taskId: string) {
		const task = tasks.find((t) => t.id === taskId);
		if (!task) return;
		task.optional = !task.optional;
		save();
	}

	// ── Drag-to-reorder ───────────────────────────────────────────────────────

	let dragState = $state<DragReorderState>({ draggingId: null, dragOverId: null });

	function onTaskDrop(draggedId: string, targetId: string) {
		tasks = reorderById(tasks, (t) => t.id, draggedId, targetId);
		save();
	}
</script>

<PageTitleHeader {courseId} {page} subtitle="Progress Tracker" />

<GlobalProgressBar {segments} emptyLabel="No tasks yet" fallbackPrefix="Task" />

<div class="progress-tasks">
	{#each tasks as task (task.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="progress-task"
			class:progress-task--optional={task.optional}
			class:progress-task--dragging={dragState.draggingId === task.id}
			class:progress-task--drag-over={dragState.dragOverId === task.id}
			data-id={task.id}
			use:dragReorder={{ id: task.id, getState: () => dragState, setState: (s) => (dragState = s), onDrop: onTaskDrop }}
		>
			<div class="progress-task-handle" title="Drag to reorder">⠿</div>

			<div class="progress-task-text">
				<div
					class="progress-task-title"
					contenteditable="true"
					aria-label="Task title"
					role="textbox"
					tabindex="0"
					onblur={(e) => onTitleBlur(task.id, (e.currentTarget as HTMLElement).textContent?.trim() ?? '')}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							(e.currentTarget as HTMLElement).blur();
						}
					}}
				>{task.title}</div>
				<div
					class="progress-task-subtitle"
					contenteditable="true"
					aria-label="Task subtitle"
					role="textbox"
					tabindex="0"
					onblur={(e) => onSubtitleBlur(task.id, (e.currentTarget as HTMLElement).textContent?.trim() ?? '')}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							(e.currentTarget as HTMLElement).blur();
						}
					}}
				>{task.subtitle}</div>
			</div>

			<button
				class="progress-optional-tag"
				title={task.optional ? 'Unmark optional' : 'Mark optional'}
				onclick={() => toggleTaskOptional(task.id)}
			>
				{task.optional ? 'OPTIONAL' : 'Mark optional'}
			</button>

			<div class="progress-state-btns">
				{#each STATES as state (state)}
					<button
						class="progress-state-btn"
						class:active={task.state === state}
						style:--state-color={segmentColor(state)}
						onclick={(e) => onStateClick(task.id, state, e.currentTarget)}
					>{STATE_LABELS[state]}</button>
				{/each}
			</div>

			<button class="list-item-delete" title="Delete task" onclick={() => deleteTask(task.id)}>&times;</button>
		</div>
	{/each}
</div>

<button class="progress-add-btn" onclick={addTask}>+ Add Task</button>

<div class="progress-notes-wrap">
	<label class="progress-notes-label" for="progress-notes">Notes</label>
	<textarea
		id="progress-notes"
		class="progress-notes"
		placeholder="Add notes…"
		bind:value={notes}
		oninput={onNotesInput}
	></textarea>
</div>
