// Mirrors the old src/server.js pattern of calling getCourseService().load()
// once before the server starts accepting requests. Module-level `ready` is
// created exactly once (ES modules are singleton-evaluated); every request
// awaits it before hitting a route handler, so callers never race the
// initial courses.json + per-course journal load.
import type { Handle } from '@sveltejs/kit';
import { getCourseService } from '$lib/server/persistence/course-service';

const ready = getCourseService().load();

export const handle: Handle = async ({ event, resolve }) => {
	await ready;
	return resolve(event);
};

// Mirrors the old server.js's shutdown() — flush pending ManagedFile writes
// before the process exits. adapter-node's built server has its own
// SIGTERM/SIGINT handling for draining in-flight HTTP requests, but it has
// no knowledge of our data layer; this exits the process itself once the
// flush completes rather than racing adapter-node's own shutdown timer,
// prioritizing "never lose an edit" over a perfectly graceful HTTP drain —
// a reasonable tradeoff for a single-user app with no real concurrent load.
let shuttingDown = false;
async function shutdown(reason: string, exitCode = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	try {
		await ready;
		await getCourseService().close();
	} catch (err) {
		console.error(`Flush failed during shutdown (${reason})`, err);
	}
	process.exit(exitCode);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
process.on('uncaughtException', (err) => {
	console.error('Uncaught exception', err);
	shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
	console.error('Unhandled rejection', reason);
	shutdown('unhandledRejection', 1);
});
