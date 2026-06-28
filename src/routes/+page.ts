import { redirect } from '@sveltejs/kit';

// No landing splash: opening the app drops the user straight into the create flow.
export const prerender = true;

export function load() {
	redirect(307, '/create');
}
