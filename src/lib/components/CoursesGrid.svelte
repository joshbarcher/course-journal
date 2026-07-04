<script lang="ts">
	// Ported from public/js/views/courses.js.
	import { goto } from '$app/navigation';
	import CourseCard from './CourseCard.svelte';
	import { inputDialog, showError } from '$lib/dialogs';
	import { createCourse } from '$lib/api-client';
	import type { Course } from '$lib/schemas/course';

	let { courses: initialCourses }: { courses: Course[] } = $props();

	// svelte-ignore state_referenced_locally
	let courses = $state<Course[]>(initialCourses);
	let recentlyCopiedIds = $state<Set<string>>(new Set());

	let sorted = $derived(
		[...courses].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
	);

	function onDeleted(id: string) {
		courses = courses.filter((c) => c.id !== id);
	}

	function onCopied(newCourse: Course) {
		courses = [...courses, newCourse];
		recentlyCopiedIds = new Set([...recentlyCopiedIds, newCourse.id]);
	}

	async function addCourse() {
		const title = await inputDialog('New Course', 'Course name…');
		if (!title) return;
		try {
			const course = await createCourse(title);
			goto(`/c/${course.id}`);
		} catch (err) {
			showError(`Failed to create course: ${(err as Error).message}`);
		}
	}
</script>

<div class="page-header">
	<h1 class="page-title">Courses</h1>
</div>

<div class="courses-grid">
	{#each sorted as course (course.id)}
		<CourseCard {course} autoRename={recentlyCopiedIds.has(course.id)} {onDeleted} {onCopied} />
	{/each}
</div>

{#if courses.length === 0}
	<p class="courses-empty">No courses yet. Add one below.</p>
{/if}

<button class="courses-add-btn" onclick={addCourse}>+ New Course</button>
