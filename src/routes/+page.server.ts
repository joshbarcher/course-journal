import { getCourseService } from '$lib/server/persistence/course-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { courses: getCourseService().getAll() };
};
