// Phase-A verification safety valve: when READ_ONLY is set, every mutating
// +server.ts handler calls this first so the new app cannot write to the
// real network share while pointed at it read-only alongside Express.
import { error } from '@sveltejs/kit';
import { getEnv } from './env';

export function assertWritable(): void {
	if (getEnv().readOnly) {
		error(503, { message: 'Server is running in READ_ONLY verification mode' });
	}
}
