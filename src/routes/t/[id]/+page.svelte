<script>
	import TourPlayer from '$lib/TourPlayer.svelte';
	import Meta from '$lib/Meta.svelte';

	/** @type {{ id: string, config: object }} */
	export let data;

	$: rooms = data.config.scenes.length;
	$: plural = rooms === 1 ? 'room' : 'rooms';
	// The start panorama doubles as the social card image so shared links show the actual place.
	$: cover = data.config.scenes[data.config.start ?? 0]?.image ?? '';
</script>

<Meta
	title={`360° virtual tour · ${rooms} ${plural}`}
	description={`Look around in 360° and move between ${rooms} ${plural}, right in your browser.`}
	image={cover}
	type="article"
/>

<div class="viewer-page">
	<TourPlayer config={data.config} />
</div>

<style>
	.viewer-page {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
	}
	.viewer-page :global(.tour-viewer) {
		height: 100%;
	}
</style>
