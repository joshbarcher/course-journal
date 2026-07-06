// Mirrors resolve-course.ts's resolveJournal, for the sibling LecturePlanService.
import { error } from '@sveltejs/kit';
import { getCourseService } from './persistence/course-service';
import type { LecturePlanService } from './persistence/lecture-plan-service';

export function resolveLecturePlan(courseId: string): LecturePlanService {
	try {
		return getCourseService().getLecturePlan(courseId);
	} catch {
		return error(404, { message: 'Course not found' });
	}
}
