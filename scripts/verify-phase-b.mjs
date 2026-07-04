// Phase B: exercise every mutating path against the LOCAL SNAPSHOT ONLY.
// Never point this at the real share.
const BASE = 'http://localhost:5174';

async function req(method, path, body) {
	const res = await fetch(BASE + path, {
		method,
		headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	const data = res.status === 204 ? null : await res.json().catch(() => null);
	return { status: res.status, data };
}

function assert(cond, msg) {
	if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
	console.log('  ok:', msg);
}

async function main() {
	console.log('=== Course CRUD ===');
	let r = await req('POST', '/api/courses', { title: 'Phase B Test Course' });
	assert(r.status === 201, 'create course -> 201');
	const courseId = r.data.id;

	r = await req('PUT', `/api/courses/${courseId}`, { title: 'Phase B Test Course (renamed)' });
	assert(r.status === 200 && r.data.title === 'Phase B Test Course (renamed)', 'rename course');

	console.log('=== Page CRUD, one of each type ===');
	const pageIds = {};
	for (const [type, extra] of [
		['list', { ordered: true }],
		['progress', {}],
		['progress-bars', {}],
		['notes', {}],
		['page', {}]
	]) {
		r = await req('POST', `/api/courses/${courseId}/pages`, { type, title: `Test ${type}`, ...extra });
		assert(r.status === 201 && r.data.type === type, `create ${type} page`);
		pageIds[type] = r.data.id;
	}

	console.log('=== Update each page type with real content ===');
	r = await req('PUT', `/api/courses/${courseId}/pages/${pageIds.list}`, {
		items: [{ id: 'i1', title: 'Item 1', subtasks: ['sub a'], order: 0, done: false }]
	});
	assert(r.status === 200 && r.data.items.length === 1, 'update list page items');

	r = await req('PUT', `/api/courses/${courseId}/pages/${pageIds.progress}`, {
		tasks: [{ id: 't1', title: 'Task 1', subtitle: 'sub', state: 'done' }]
	});
	assert(r.status === 200 && r.data.tasks[0].subtitle === 'sub', 'update progress page tasks');

	r = await req('PUT', `/api/courses/${courseId}/pages/${pageIds['progress-bars']}`, {
		bars: [{ id: 'b1', title: 'Bar 1', steps: [{ id: 's1', title: 'Step 1', subtitle: '', state: 'working' }] }]
	});
	assert(r.status === 200 && r.data.bars[0].steps[0].state === 'working', 'update progress-bars page');

	r = await req('PUT', `/api/courses/${courseId}/pages/${pageIds.notes}`, {
		notes: [{ id: 'n1', text: 'Hello', createdAt: new Date().toISOString() }]
	});
	assert(r.status === 200 && r.data.notes.length === 1, 'update notes page');

	r = await req('PUT', `/api/courses/${courseId}/pages/${pageIds.page}`, { content: '<p>Hello <b>world</b></p>' });
	assert(r.status === 200 && r.data.content.includes('<b>world</b>'), 'update rich-text page');

	console.log('=== Reorder pages ===');
	const allIds = Object.values(pageIds);
	const reversedIds = [...allIds].reverse();
	r = await req('PUT', `/api/courses/${courseId}/pages/order`, { ids: reversedIds });
	assert(r.status === 200, 'reorder pages -> 200');
	r = await req('GET', `/api/courses/${courseId}/pages`);
	assert(
		JSON.stringify(r.data.map((p) => p.id)) === JSON.stringify(reversedIds),
		'page order persisted as reversed'
	);

	console.log('=== Copy course (deep copy + progress reset) ===');
	r = await req('POST', `/api/courses/${courseId}/copy`);
	assert(r.status === 201 && r.data.title.endsWith('(Copy)'), 'copy course -> 201, title suffixed');
	const copyId = r.data.id;
	r = await req('GET', `/api/courses/${copyId}/pages`);
	const copyProgress = r.data.find((p) => p.type === 'progress');
	assert(copyProgress.tasks[0].state === null, 'copied progress task state reset to null');
	const copyBars = r.data.find((p) => p.type === 'progress-bars');
	assert(copyBars.bars[0].steps[0].state === null, 'copied progress-bars step state reset to null');
	const copyNotes = r.data.find((p) => p.type === 'notes');
	assert(Array.isArray(copyNotes.notes) && copyNotes.notes.length === 0, 'copied notes reset to empty');
	const copyContent = r.data.find((p) => p.type === 'page');
	assert(copyContent.content.includes('<b>world</b>'), 'copied rich-text content preserved');

	console.log('=== Delete a page ===');
	r = await req('DELETE', `/api/courses/${courseId}/pages/${pageIds.notes}`);
	assert(r.status === 204, 'delete page -> 204');
	r = await req('GET', `/api/courses/${courseId}/pages/${pageIds.notes}`);
	assert(r.status === 404, 'deleted page now 404s');

	console.log('=== Delete courses (confirm journal file cleanup, new behavior) ===');
	const fs = await import('node:fs/promises');
	const journalPath = `c:/dev/course-journal/data/course-journal/courses/${courseId}.json`;
	const copyJournalPath = `c:/dev/course-journal/data/course-journal/courses/${copyId}.json`;
	await fetch(`${BASE}/api/health-noop`).catch(() => {}); // no-op, just ensure fetch warm
	// Force a flush by hitting an unrelated GET before checking disk (writes are scheduled, not synchronous)
	r = await req('DELETE', `/api/courses/${courseId}`);
	assert(r.status === 204, 'delete original test course -> 204');
	r = await req('DELETE', `/api/courses/${copyId}`);
	assert(r.status === 204, 'delete copied test course -> 204');

	await new Promise((res) => setTimeout(res, 500));
	const journalExists = await fs.stat(journalPath).then(() => true).catch(() => false);
	const copyJournalExists = await fs.stat(copyJournalPath).then(() => true).catch(() => false);
	assert(!journalExists, 'original course journal file deleted from disk');
	assert(!copyJournalExists, 'copied course journal file deleted from disk');

	r = await req('GET', '/api/courses');
	assert(!r.data.some((c) => c.id === courseId || c.id === copyId), 'both test courses gone from courses list');

	console.log('\nPHASE B: PASS');
}

main().catch((err) => {
	console.error('\nPHASE B: FAIL');
	console.error(err);
	process.exit(1);
});
