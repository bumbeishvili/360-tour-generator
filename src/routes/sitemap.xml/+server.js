// Served at /sitemap.xml. Published tours are user-generated (hosted on GitHub) and not
// enumerable here, so the sitemap lists the one indexable entry point — the create page.
export const prerender = false;

export function GET({ url }) {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${url.origin}/create</loc>
		<changefreq>monthly</changefreq>
		<priority>1.0</priority>
	</url>
</urlset>
`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
