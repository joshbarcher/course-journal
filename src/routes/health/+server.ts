import { json } from '@sveltejs/kit';
import { getHealthPayload } from '$lib/server/health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(getHealthPayload());
};
