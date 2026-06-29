// Served at /robots.txt. Dynamic so the Sitemap line carries the real origin.
export const prerender = false;

export function GET({ url }) {
	const body = `User-agent: *
Allow: /
Disallow: /configure

Sitemap: ${url.origin}/sitemap.xml
`;
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
