import { json } from '@sveltejs/kit';
import { commitFile, jsonToBase64, GithubConfigError, GithubUploadError } from '$lib/server/github.js';
import { validateTourConfig } from '$lib/tour/validateConfig.js';

/**
 * POST /api/publish
 * Body: { tourId, config }
 *
 * Validates the tour config, commits it to static/tours/{tourId}.json and
 * returns the id plus its public raw URL. The committed config is reachable
 * instantly via the GitHub raw URL (no redeploy needed).
 */
export async function POST({ request }) {
	const { tourId, config } = await request.json();

	if (!tourId) {
		return json({ error: 'tourId is required.' }, { status: 400 });
	}

	// validateTourConfig returns an array of human-readable errors (empty = OK).
	const errors = validateTourConfig(config);
	if (errors.length) {
		return json({ error: `Invalid tour config:\n${errors.join('\n')}` }, { status: 400 });
	}

	const path = `static/tours/${tourId}.json`;

	try {
		const result = await commitFile(path, jsonToBase64(config), `Publish tour ${tourId}`);
		return json({ id: tourId, url: result.url, path: result.path });
	} catch (error) {
		if (error instanceof GithubConfigError || error instanceof GithubUploadError) {
			return json({ error: error.message }, { status: error.status });
		}
		throw error;
	}
}
