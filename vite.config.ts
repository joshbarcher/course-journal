import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
	test: {
		environment: 'node'
	}
});
