<script>
	import { page } from '$app/stores';

	// Per-page SEO. Render <Meta ... /> once at the top of each route (it injects into <head>).
	export let title = '360° Tour Generator';
	export let description =
		'Upload your 360° photos, link the rooms together, and share a virtual tour anyone can walk through in their browser.';
	/** Social card image: an absolute URL, or a site-root path like /cover.jpg. Left out when empty. */
	export let image = '';
	export let type = 'website'; // 'website' for the app, 'article' for a published tour
	export let noindex = false;
	export let author = 'David Bumbeishvili';

	const siteName = '360° Tour Generator';

	// Canonical / og:url point each page at itself, using the real request origin (SSR).
	$: canonical = $page.url.origin + $page.url.pathname;
	$: cardImage = !image ? '' : /^https?:\/\//.test(image) ? image : $page.url.origin + image;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="author" content={author} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'} />

	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={canonical} />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:locale" content="en_US" />
	{#if cardImage}
		<meta property="og:image" content={cardImage} />
	{/if}

	<meta name="twitter:card" content={cardImage ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if cardImage}
		<meta name="twitter:image" content={cardImage} />
	{/if}
</svelte:head>
