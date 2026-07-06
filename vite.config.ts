import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	// `vite dev`/`vite preview` don't read .env into process.env on their own
	// (see src/lib/server/env.ts's header comment) — loadEnv here is what
	// lets the dev/preview server bind to the same PORT that start.js reads
	// for production, instead of always falling back to Vite's default port.
	const env = loadEnv(mode, process.cwd(), '');
	const port = Number(env.PORT) || undefined;

	return {
		plugins: [
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				// This app runs as a long-lived Node process (see start.js), not serverless.
				// BUILD_OUT_DIR lets scripts/build.mjs build into a staging directory
				// and swap it into place atomically once complete - see that file.
				adapter: adapter({ out: process.env.BUILD_OUT_DIR || 'build' })
			})
		],
		server: { port, strictPort: Boolean(port) },
		preview: { port, strictPort: Boolean(port) },
		test: {
			environment: 'node'
		}
	};
});
