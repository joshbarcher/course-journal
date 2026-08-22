import { error } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { exportResponse } from '$lib/server/export-response';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

// GET /api/courses/:id/lecture-plans/:planId/export?format=md|txt[&download=0]
// Sibling of the pages export route — see it for the why.
export const GET: RequestHandler = async ({ params, url }) => {
	const service = resolveLecturePlans(params.id);
	const plan = service.getById(params.planId);
	if (!plan) return error(404, { message: 'Weekly Lecture Plan not found' });
	return exportResponse(LecturePlanSchema.parse(plan), url);
};
