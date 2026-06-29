import { redirect } from '@sveltejs/kit';

// No landing splash: opening the app drops the user straight into the create flow. Redirect at
// request time (not prerendered) so the create page renders with the real origin for canonical
// and Open Graph URLs.
export const prerender = false;

export function load() {
	redirect(307, '/create');
}
