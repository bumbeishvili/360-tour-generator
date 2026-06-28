<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import '@photo-sphere-viewer/core/index.css';
	import '@photo-sphere-viewer/markers-plugin/index.css';
	import { normalizeYaw } from '$lib/tour/grid.js';
	import { arrowMarker } from '$lib/tour/floor.js';

	export let image;
	export let arrow; // directional link object: { yaw, pitch, ... } (mutated in place)

	const dispatch = createEventDispatcher();
	const ARROW = '/markers/arrow.svg';
	const PI = Math.PI;
	const r1 = (n) => Math.round(n * 10) / 10;

	let container;
	let viewer;
	let markers;
	let lastImage;
	let placed = false; // the arrow isn't shown until the user clicks a floor spot to place it

	function markerCfg() {
		return placed && viewer ? [arrowMarker(viewer, 'a', ARROW, arrow.yaw, arrow.pitch)] : [];
	}

	function refresh() {
		markers?.setMarkers(markerCfg());
	}

	// Click anywhere to place / re-place the arrow (floor → flat; above horizon → billboard, e.g. stairs).
	function onClick(e) {
		arrow.yaw = r1(normalizeYaw((e.data.yaw * 180) / PI));
		arrow.pitch = r1((e.data.pitch * 180) / PI);
		arrow.configured = true;
		placed = true;
		refresh();
		dispatch('change');
	}

	onMount(async () => {
		const core = await import('@photo-sphere-viewer/core');
		const mk = await import('@photo-sphere-viewer/markers-plugin');
		viewer = new core.Viewer({
			container,
			panorama: image,
			navbar: false,
			defaultZoomLvl: 15,
			plugins: [[mk.MarkersPlugin, {}]]
		});
		markers = viewer.getPlugin(mk.MarkersPlugin);
		lastImage = image;
		placed = !!arrow.configured; // show it if this direction was already set before
		viewer.addEventListener('ready', () => refresh(), { once: true });
		viewer.addEventListener('click', onClick);
	});

	$: if (viewer && image && image !== lastImage) {
		lastImage = image;
		viewer.setPanorama(image, { transition: false }).then(refresh);
	}

	onDestroy(() => viewer?.destroy());
</script>

<div class="pane" class:placed bind:this={container}></div>

<style>
	.pane {
		width: 100%;
		height: 100%;
	}
	.pane :global(.psv-navbar) {
		display: none !important;
	}
	/* plus cursor while placing; move cursor once the arrow is set */
	.pane :global(canvas) {
		cursor: url('/markers/plus.svg') 14 14, crosshair;
	}
	.pane.placed :global(canvas) {
		cursor: grab;
	}
</style>
