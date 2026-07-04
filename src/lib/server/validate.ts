// Shared request-body parsing for +server.ts route handlers: reads JSON,
// validates against a Zod schema, and 400s with the validation issues on
// failure — the same "title is required" / "type must be one of: ..."
// shape the old Express controllers returned, just produced generically
// instead of hand-written per route.
import { error } from '@sveltejs/kit';
import type { ZodType } from 'zod';

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return error(400, { message: 'Invalid JSON body' });
	}
	const result = schema.safeParse(raw);
	if (!result.success) {
		return error(400, { message: result.error.issues.map((i) => i.message).join('; ') });
	}
	return result.data;
}
