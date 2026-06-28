import { json } from '@sveltejs/kit';
import { commitFile, GithubConfigError, GithubUploadError } from '$lib/server/github.js';

/**
 * POST /api/upload
 * Body: { tourId, index, contentBase64 }
 *
 * Commits one WebP image to static/uploads/{tourId}/{index}.webp and returns
 * its public raw URL. The GitHub token stays on the server.
 */
export async function POST({ request }) {
	const { tourId, index, contentBase64 } = await request.json();

	if (!tourId || typeof index !== 'number' || !contentBase64) {
		return json({ error: 'tourId, numeric index and contentBase64 are required.' }, { status: 400 });
	}

	const path = `static/uploads/${tourId}/${index}.webp`;

	try {
		const result = await commitFile(path, contentBase64, `Upload ${path}`);
		return json({ url: result.url, path: result.path });
	} catch (error) {
		if (error instanceof GithubConfigError || error instanceof GithubUploadError) {
			return json({ error: error.message }, { status: error.status });
		}
		throw error;
	}
}
