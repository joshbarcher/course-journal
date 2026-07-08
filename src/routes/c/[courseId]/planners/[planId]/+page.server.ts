import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const service = resolveLecturePlans(params.courseId);
	// A missing plan returns { plan: null } rather than a hard 404 — matches
	// the [pageId] route's convention of an in-app "not found" message
	// instead of crashing the whole app shell over one missing id.
	const plan = service.getById(params.planId);
	return { courseId: params.courseId, plan };
};
