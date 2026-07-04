<script lang="ts">
	// Ported from public/js/views/courses.js's buildCourseCard() +
	// loadMiniHeatmap(). The old "triggerRename" return value (used to
	// immediately prompt a rename right after a copy) becomes an
	// autoRename prop that fires the same flow on mount instead.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { inputDialog, confirmDialog, showError } from '$lib/dialogs';
	import { updateCourse, removeCourse, copyCourse } from '$lib/api-client';
	import { heatmapRows } from '$lib/utils/progress-helpers';
	import type { Course } from '$lib/schemas/course';
	import type { Page } from '$lib/schemas/page';

	let {
		course,
		autoRename = false,
		onDeleted,
		onCopied
	}: {
		course: Course;
		autoRename?: boolean;
		onDeleted: (id: string) => void;
		onCopied: (newCourse: Course) => void;
	} = $props();

	// Each card owns one course.id for its whole lifetime (the {#each} key
	// in CoursesGrid is course.id), so capturing only the initial title is
	// intentional — a real title change comes through rename(), not a new
	// `course` prop reference.
	// svelte-ignore state_referenced_locally
	let title = $state(course.title);
	let copying = $state(false);
	let heatRows = $state<ReturnType<typeof heatmapRows>>([]);

	async function rename() {
		const newTitle = await inputDialog('Rename Course', 'Course name…', title);
		if (!newTitle || newTitle === title) return;
		try {
			await updateCourse(course.id, newTitle);
			title = newTitle;
		} catch (err) {
			showError(`Failed to rename: ${(err as Error).message}`);
		}
	}

	async function copy() {
		copying = true;
		try {
			const newCourse = await copyCourse(course.id);
			onCopied(newCourse);
		} catch (err) {
			showError(`Failed to copy: ${(err as Error).message}`);
		} finally {
			copying = false;
		}
	}

	async function del() {
		const confirmed = await confirmDialog(`Delete "${title}"?`, 'This will permanently delete the course and all its pages.', 'Delete');
		if (!confirmed) return;
		try {
			await removeCourse(course.id);
			onDeleted(course.id);
		} catch (err) {
			showError(`Failed to delete: ${(err as Error).message}`);
		}
	}

	async function loadMiniHeatmap() {
		try {
			const res = await fetch(`/api/courses/${course.id}/pages`);
			if (!res.ok) return;
			const pages: Page[] = await res.json();
			heatRows = heatmapRows(pages).filter((r) => r.cells.length > 0);
		} catch {
			// Silently skip — no heatmap if pages can't be loaded
		}
	}

	function cellTitle(rowTitle: string, cell: { label: string; num: number; stateLabel: string }) {
		return [rowTitle, cell.label || `#${cell.num}`, cell.stateLabel].filter(Boolean).join(' · ');
	}

	onMount(() => {
		loadMiniHeatmap();
		if (autoRename) rename();
	});
</script>

<div
	class="course-card"
	onclick={() => goto(`/c/${course.id}`)}
	onkeydown={(e) => {
		if (e.key === 'Enter') goto(`/c/${course.id}`);
	}}
	role="button"
	tabindex="0"
>
	<div class="course-card-name">{title}</div>

	<div class="course-card-heat">
		{#each heatRows as row (row.id)}
			<div class="mini-heat-row">
				{#each row.cells as cell (cell.num)}
					<div class="mini-heat-cell" style:background={cell.color} title={cellTitle(row.title, cell)}></div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="course-card-actions">
		<button class="course-card-btn" onclick={(e) => { e.stopPropagation(); rename(); }}>Rename</button>
		<button class="course-card-btn" disabled={copying} onclick={(e) => { e.stopPropagation(); copy(); }}>
			{copying ? 'Copying…' : 'Copy'}
		</button>
		<button class="course-card-btn course-card-btn--danger" onclick={(e) => { e.stopPropagation(); del(); }}>Delete</button>
	</div>
</div>
