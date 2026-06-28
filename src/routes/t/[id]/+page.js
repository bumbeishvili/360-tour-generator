/**
 * Universal passthrough. The authoritative loader is `+page.server.js`
 * (it reads the configured GitHub repo/branch). This simply forwards the
 * server-loaded data to the page component.
 */
export function load({ data }) {
	return data;
}
