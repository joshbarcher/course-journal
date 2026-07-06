import { error } from '@sveltejs/kit';
import { resolveLecturePlan } from '$lib/server/resolve-lecture-plan';
import { assertWritable } from '$lib/server/assert-writable';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	assertWritable();
	const service = resolveLecturePlan(params.id);
	const result = await service.removeWeek(params.weekId);
	if (!result) return error(404, { message: 'Week not found' });
	return new Response(null, { status: 204 });
};
