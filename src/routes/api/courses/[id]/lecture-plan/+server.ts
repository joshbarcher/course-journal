import { json } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { LecturePlanSchema } from '$lib/schemas/lecture-plan';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const service = resolveLecturePlan(params.id);
	return json(LecturePlanSchema.parse(service.getPlan()));
};
