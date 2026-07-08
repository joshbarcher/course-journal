import { error } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const result = await service.removeWeek(params.planId, params.weekId);
	if (!result) return error(404, { message: 'Plan or week not found' });
	return new Response(null, { status: 204 });
};
