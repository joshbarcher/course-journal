// Replaces the old Express middleware that resolved req.journal from
// getCourseService().getJournal(courseId), 404ing on an unknown course.
import { error } from '@sveltejs/kit';
import { getCourseService } from './persistence/course-service';
import type { JournalService } from './persistence/journal-service';

export function resolveJournal(courseId: string): JournalService {
	try {
		return getCourseService().getJournal(courseId);
	} catch {
		return error(404, { message: 'Course not found' });
	}
}
