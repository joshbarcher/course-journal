// Mirrors resolve-course.ts's resolveJournal, for the sibling LecturePlansService.
import { error } from '@sveltejs/kit';
import { getCourseService } from './persistence/course-service';
import type { LecturePlansService } from './persistence/lecture-plans-service';

export function resolveLecturePlans(courseId: string): LecturePlansService {
	try {
		return getCourseService().getLecturePlans(courseId);
	} catch {
		return error(404, { message: 'Course not found' });
	}
}
