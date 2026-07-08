import { error, json } from '@sveltejs/kit';
import { resolveLecturePlans } from '$lib/server/resolve-lecture-plans';
import { assertWritable } from '$lib/server/assert-writable';
import { parseJsonBody } from '$lib/server/validate';
import { MoveLectureCardBodySchema } from '$lib/schemas/api';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	assertWritable();
	const service = resolveLecturePlans(params.id);
	const body = await parseJsonBody(request, MoveLectureCardBodySchema);
	const moved = await service.moveCard(params.planId, params.cardId, {
		weekId: body.targetWeekId,
		day: body.targetDay,
		beforeCardId: body.targetCardId
	});
	if (!moved) return error(404, { message: 'Plan, card, or target week not found' });
	return json({ ok: true });
};
