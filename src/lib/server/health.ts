// Ported from src/controllers/healthController.js. formatUptime is untouched
// pure logic; getHealth's req/res-shaped Express handler becomes a plain
// payload builder, consumed by routes/health/+server.ts (added in M2).
export function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
	if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
	return `${m}m`;
}

export function getHealthPayload(): { status: 'ok'; uptime: string } {
	return { status: 'ok', uptime: formatUptime(process.uptime()) };
}
