import { error } from '@sveltejs/kit';
import { validateTourConfig } from '$lib/tour/validateConfig.js';
import { rawTourConfigUrl } from '$lib/server/github.js';

/**
 * Load a published tour config for the given id.
 *
 * Primary source is the public GitHub raw URL (static/tours/{id}.json) so the
 * tour works for anonymous visitors with no token and updates instantly without
 * a redeploy. As a fallback we also try the app's own static folder
 * (/tours/{id}.json) — useful in local dev or when the config was committed to
 * the deployed build. Runs on the server so it can read the configured repo.
 */
async function fetchConfig(fetch, id) {
	const remote = await fetch(rawTourConfigUrl(id));
	if (remote.ok) return remote.json();

	const local = await fetch(`/tours/${id}.json`);
	if (local.ok) return local.json();

	return null;
}

export async function load({ params, fetch }) {
	const config = await fetchConfig(fetch, params.id);
	if (!config) {
		throw error(404, `Tour "${params.id}" was not found`);
	}

	// validateTourConfig returns an array of human-readable errors (empty = OK).
	const errors = validateTourConfig(config);
	if (errors.length) {
		throw error(422, `Published tour "${params.id}" is invalid:\n${errors.join('\n')}`);
	}

	return { id: params.id, config };
}
