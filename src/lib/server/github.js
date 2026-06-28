/**
 * Server-only GitHub Contents API helper.
 *
 * The token lives in the environment and is read via `$env/dynamic/private`
 * so it is never bundled into client code. Every upload writes to a NEW unique
 * path, so this is always a create (no existing-SHA lookup needed).
 */

import { env } from '$env/dynamic/private';

const DEFAULT_REPO = 'bumbeishvili/360-tour-generator';
const DEFAULT_BRANCH = 'main';

/** Resolve repo/branch/token from the environment. */
export function githubConfig() {
	const token = env.GITHUB_TOKEN;
	const repo = env.GITHUB_REPO || DEFAULT_REPO;
	const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;
	const [owner, name] = repo.split('/');
	return { token, repo, owner, name, branch };
}

/** Thrown when the server is not configured to talk to GitHub. */
export class GithubConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = 'GithubConfigError';
		this.status = 503;
	}
}

/** Thrown when GitHub rejects an upload. */
export class GithubUploadError extends Error {
	constructor(message, status) {
		super(message);
		this.name = 'GithubUploadError';
		this.status = status || 502;
	}
}

/**
 * The public raw URL for a committed file. Assets served from here are
 * available instantly (no redeploy of the SvelteKit app required).
 */
export function rawUrl(path) {
	const { owner, name, branch } = githubConfig();
	return `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${path}`;
}

/** Repo-relative path for a published tour config. */
export function tourConfigPath(id) {
	return `static/tours/${id}.json`;
}

/** Public raw URL of a published tour config, for anonymous viewers. */
export function rawTourConfigUrl(id) {
	return rawUrl(tourConfigPath(id));
}

/**
 * Commit a single file to the repo via the Contents API.
 *
 * @param {string} path        repo-relative path, e.g. "static/uploads/abc/0.webp"
 * @param {string} base64      base64-encoded file content
 * @param {string} message     commit message
 * @returns {Promise<{ path: string, url: string, commit: string }>}
 */
export async function commitFile(path, base64, message) {
	const { token, owner, name, branch } = githubConfig();
	if (!token) {
		throw new GithubConfigError(
			'GITHUB_TOKEN is not set on the server. Add it to your .env to enable publishing.'
		);
	}

	const endpoint = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
	const response = await fetch(endpoint, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ message, content: base64, branch })
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new GithubUploadError(
			`GitHub upload failed for "${path}" (${response.status}): ${detail.slice(0, 300)}`,
			response.status
		);
	}

	const result = await response.json();
	return {
		path,
		url: rawUrl(path),
		commit: result.commit?.sha ?? ''
	};
}

/** Encode a UTF-8 string (e.g. JSON) as base64 for the Contents API. */
export function jsonToBase64(value) {
	return Buffer.from(JSON.stringify(value, null, 2), 'utf-8').toString('base64');
}
