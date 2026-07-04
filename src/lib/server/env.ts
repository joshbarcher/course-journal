// Validates and centralizes the app's runtime env vars, read via
// $env/dynamic/private (NOT $env/static/private) so DATA_DIR/READ_ONLY can
// be swapped without a rebuild — required for the side-by-side verification
// protocol (real share, read-only vs. local snapshot, read-write) in the
// migration plan. $env/dynamic/private is also what actually works under
// `vite dev`: unlike the production adapter-node build (started via
// `node --env-file .env build/index.js`), Vite's dev server does not itself
// populate process.env from .env — SvelteKit's dynamic-env module is what
// bridges Vite's loaded .env into both contexts consistently.
// Throws early, same as the old getCourseService() does today when
// DATA_DIR is unset.
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const EnvSchema = z.object({
	DATA_DIR: z.string().min(1, 'DATA_DIR is not set'),
	READ_ONLY: z.string().optional()
});

export interface AppEnv {
	dataDir: string;
	readOnly: boolean;
}

let _env: AppEnv | null = null;

export function getEnv(): AppEnv {
	if (_env) return _env;
	const parsed = EnvSchema.parse({
		DATA_DIR: env.DATA_DIR,
		READ_ONLY: env.READ_ONLY
	});
	_env = {
		dataDir: parsed.DATA_DIR,
		readOnly: parsed.READ_ONLY === '1' || parsed.READ_ONLY === 'true'
	};
	return _env;
}
