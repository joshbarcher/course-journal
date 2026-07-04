// Ported from src/tests/server.test.js — minimal-churn port (node:test -> vitest).
// getHealth's original req/res-handler shape is gone (Express-specific); its
// two behavioral assertions are kept against the new getHealthPayload().
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { formatUptime, getHealthPayload } from './health';

test('formatUptime: minutes only', () => {
	assert.equal(formatUptime(90), '1m');
});

test('formatUptime: zero seconds', () => {
	assert.equal(formatUptime(0), '0m');
});

test('formatUptime: exactly one hour', () => {
	assert.equal(formatUptime(3600), '1h');
});

test('formatUptime: hours and minutes', () => {
	assert.equal(formatUptime(3661), '1h 1m');
});

test('formatUptime: exactly one day', () => {
	assert.equal(formatUptime(86400), '1d');
});

test('formatUptime: days and hours', () => {
	assert.equal(formatUptime(90000), '1d 1h');
});

test('formatUptime: days only when no leftover hours', () => {
	assert.equal(formatUptime(172800), '2d');
});

test('getHealthPayload: returns status ok', () => {
	const result = getHealthPayload();
	assert.equal(result.status, 'ok');
});

test('getHealthPayload: returns uptime as non-empty string', () => {
	const result = getHealthPayload();
	assert.equal(typeof result.uptime, 'string');
	assert.ok(result.uptime.length > 0);
});
