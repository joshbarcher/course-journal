import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const service = resolveLecturePlans(params.courseId);
	return { courseId: params.courseId, plans: service.getAll() };
};
