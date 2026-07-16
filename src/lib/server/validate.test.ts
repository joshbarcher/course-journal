// Adversarial tests (new) for parseJsonBody — the shared request-body reader
// every mutating route funnels through. It must turn malformed JSON and
// schema violations into 400s (SvelteKit HttpErrors), and pass clean bodies
// through untouched.
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { parseJsonBody } from './validate';

const Schema = z.object({ title: z.string().min(1, 'title is required') });

function jsonRequest(rawBody: string): Request {
	return new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: rawBody
	});
}

describe('parseJsonBody', () => {
	it('returns the parsed data for a valid body', async () => {
		const data = await parseJsonBody(jsonRequest(JSON.stringify({ title: 'ok' })), Schema);
		assert.deepEqual(data, { title: 'ok' });
	});

	it('throws a 400 for a body that is not valid JSON', async () => {
		await assert.rejects(
			() => parseJsonBody(jsonRequest('{ not json'), Schema),
			(err: any) => {
				assert.equal(err.status, 400);
				assert.match(err.body.message, /Invalid JSON body/);
				return true;
			}
		);
	});

	it('throws a 400 with the schema issue message on validation failure', async () => {
		await assert.rejects(
			() => parseJsonBody(jsonRequest(JSON.stringify({ title: '' })), Schema),
			(err: any) => {
				assert.equal(err.status, 400);
				assert.match(err.body.message, /title is required/);
				return true;
			}
		);
	});

	it('joins multiple validation issues into one message', async () => {
		const Multi = z.object({ a: z.string(), b: z.string() });
		await assert.rejects(
			() => parseJsonBody(jsonRequest(JSON.stringify({})), Multi),
			(err: any) => {
				assert.equal(err.status, 400);
				assert.ok(err.body.message.includes(';'));
				return true;
			}
		);
	});

	it('treats a JSON null body as a validation failure, not a crash', async () => {
		await assert.rejects(
			() => parseJsonBody(jsonRequest('null'), Schema),
			(err: any) => {
				assert.equal(err.status, 400);
				return true;
			}
		);
	});
});
