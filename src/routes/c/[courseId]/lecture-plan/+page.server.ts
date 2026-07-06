import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const service = resolveLecturePlan(params.courseId);
	return { courseId: params.courseId, lecturePlan: service.getPlan() };
};
