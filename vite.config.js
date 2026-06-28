import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	resolve: {
		// Photo Sphere Viewer and its markers plugin must share ONE copy of three,
		// otherwise the panorama renders wrong or throws. Force a single instance.
		dedupe: ['three']
	},
	server: {
		port: 3002
	}
};

export default defineConfig(config);
