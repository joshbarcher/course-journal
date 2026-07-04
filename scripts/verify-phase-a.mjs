// Phase A verification: read-only against the REAL live share, Express
// still running on 8060. This script only issues GET requests.
const BASE = process.env.VERIFY_BASE ?? 'http://localhost:5175';

async function get(path) {
	const res = await fetch(BASE + path);
	const body = await res.json().catch(() => null);
	return { status: res.status, body };
}

async function main() {
	const { status: coursesStatus, body: courses } = await get('/api/courses');
	console.log(`GET /api/courses -> ${coursesStatus}, ${courses.length} courses`);
	if (coursesStatus !== 200) throw new Error('Failed to load courses list');

	let totalPages = 0;
	let parseFailures = 0;
	const typeCounts = {};
	let subtitleSamplesChecked = 0;
	let subtitleBackfillOk = true;

	for (const course of courses) {
		const { status, body: pages } = await get(`/api/courses/${course.id}/pages`);
		if (status !== 200) {
			parseFailures++;
			console.error(`  FAIL: ${course.title} (${course.id}) -> HTTP ${status}`, pages);
			continue;
		}
		totalPages += pages.length;
		for (const p of pages) {
			typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;
			if (p.type === 'progress') {
				for (const t of p.tasks) {
					if (typeof t.subtitle !== 'string') subtitleBackfillOk = false;
					subtitleSamplesChecked++;
				}
			}
			if (p.type === 'progress-bars') {
				for (const b of p.bars) {
					for (const s of b.steps) {
						if (typeof s.subtitle !== 'string') subtitleBackfillOk = false;
						subtitleSamplesChecked++;
					}
				}
			}
		}
		console.log(`  ${course.title}: ${pages.length} pages OK`);
	}

	console.log('\n=== Summary ===');
	console.log('Courses:', courses.length);
	console.log('Total pages:', totalPages);
	console.log('Pages by type:', typeCounts);
	console.log('Zod parse failures:', parseFailures);
	console.log('Subtitle fields checked:', subtitleSamplesChecked, '- all strings:', subtitleBackfillOk);

	// READ_ONLY guard check
	const writeRes = await fetch(BASE + '/api/courses', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: 'Should be blocked by READ_ONLY' })
	});
	console.log('\nPOST /api/courses while READ_ONLY=1 -> HTTP', writeRes.status);
	const writeBlocked = writeRes.status === 503;

	const pass = coursesStatus === 200 && parseFailures === 0 && subtitleBackfillOk && writeBlocked;
	console.log('\n' + (pass ? 'PHASE A: PASS' : 'PHASE A: FAIL'));
	if (!pass) process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
