<script>
	import TourPlayer from '$lib/TourPlayer.svelte';

	/** @type {{ id: string, config: object }} */
	export let data;
</script>

<svelte:head>
	<title>360° tour</title>
	<meta name="description" content="An interactive 360° virtual tour" />
</svelte:head>

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
