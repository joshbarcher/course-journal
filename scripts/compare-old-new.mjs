// Runs an identical sequence of operations against the OLD app (port 8062,
// isolated scratch dir) and the NEW app (port 5176, isolated scratch dir),
// then structurally compares the resulting on-disk JSON (parsed, not
// byte-for-byte — key order/whitespace differences are immaterial).
const OLD_BASE = 'http://localhost:8062/api';
const NEW_BASE = 'http://localhost:5176/api';

async function req(base, method, path, body) {
	const res = await fetch(base + path, {
		method,
		headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	return res.status === 204 ? null : res.json();
}

async function runScenario(base) {
	const course = await req(base, 'POST', '/courses', { title: 'Compare Course' });
	const listPage = await req(base, 'POST', `/courses/${course.id}/pages`, { type: 'list', title: 'L', ordered: true });
	await req(base, 'PUT', `/courses/${course.id}/pages/${listPage.id}`, {
		items: [{ id: 'i1', title: 'Item', subtasks: ['a', 'b'], order: 0, done: true }]
	});
	const progressPage = await req(base, 'POST', `/courses/${course.id}/pages`, { type: 'progress', title: 'P' });
	await req(base, 'PUT', `/courses/${course.id}/pages/${progressPage.id}`, {
		tasks: [{ id: 't1', title: 'Task', subtitle: 'Sub', state: 'done' }],
		notes: 'some notes'
	});
	const barsPage = await req(base, 'POST', `/courses/${course.id}/pages`, { type: 'progress-bars', title: 'PB' });
	await req(base, 'PUT', `/courses/${course.id}/pages/${barsPage.id}`, {
		bars: [{ id: 'b1', title: 'Bar', optional: true, steps: [{ id: 's1', title: 'Step', subtitle: '', state: 'working' }] }]
	});
	const notesPage = await req(base, 'POST', `/courses/${course.id}/pages`, { type: 'notes', title: 'N' });
	await req(base, 'PUT', `/courses/${course.id}/pages/${notesPage.id}`, {
		notes: [{ id: 'n1', text: 'hi', createdAt: '2026-01-01T00:00:00.000Z' }]
	});
	const contentPage = await req(base, 'POST', `/courses/${course.id}/pages`, { type: 'page', title: 'C' });
	await req(base, 'PUT', `/courses/${course.id}/pages/${contentPage.id}`, { content: '<p>hi</p>' });

	await req(base, 'PUT', `/courses/${course.id}/pages/order`, {
		ids: [contentPage.id, notesPage.id, barsPage.id, progressPage.id, listPage.id]
	});

	const copy = await req(base, 'POST', `/courses/${course.id}/copy`);

	return { courseId: course.id, copyId: copy.id };
}

// Recursively strips fields that are expected to differ between runs
// (ids, timestamps) so the remaining structure can be deep-equal compared.
// JSON object key order is not semantically meaningful, and Zod's
// .parse() re-serializes objects in schema-declaration order rather than
// original insertion order (confirmed: the new app's GET responses come
// back with `title` before `type`, since PageBase declares title first,
// while the old app's hand-built objects have `type` before `title`).
// The migration plan explicitly calls this immaterial — so keys are
// sorted here before comparing, turning this into a true structural
// (order-independent) deep-equal rather than a byte-for-byte JSON compare.
function normalize(value) {
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === 'object') {
		const out = {};
		for (const k of Object.keys(value).sort()) {
			if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
			out[k] = normalize(value[k]);
		}
		return out;
	}
	return value;
}

async function main() {
	const oldResult = await runScenario(OLD_BASE);
	const newResult = await runScenario(NEW_BASE);

	// Read back via the API (in-memory state) rather than disk — ManagedFile
	// schedules flushes up to maxFlushIntervalMs (30s) later, and we're
	// comparing structural shape, not on-disk timing.
	const oldPages = await req(OLD_BASE, 'GET', `/courses/${oldResult.courseId}/pages`);
	const newPages = await req(NEW_BASE, 'GET', `/courses/${newResult.courseId}/pages`);
	const oldJournal = { pages: oldPages };
	const newJournal = { pages: newPages };

	const oldNormalized = normalize(oldJournal);
	const newNormalized = normalize(newJournal);

	const equal = JSON.stringify(oldNormalized) === JSON.stringify(newNormalized);
	console.log('Old journal (normalized):', JSON.stringify(oldNormalized, null, 2));
	console.log('\nNew journal (normalized):', JSON.stringify(newNormalized, null, 2));
	console.log('\nStructurally equal (ids/timestamps excluded):', equal);
	console.log(equal ? 'PASS' : 'FAIL');
	if (!equal) process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
