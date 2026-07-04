import { error } from '@sveltejs/kit';
import { getCourseService } from '$lib/server/persistence/course-service';
import { resolveJournal } from '$lib/server/resolve-course';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const course = getCourseService().getById(params.courseId);
	if (!course) error(404, { message: 'Course not found' });
	const journal = resolveJournal(params.courseId);
	return { course, pages: journal.getAll() };
};
