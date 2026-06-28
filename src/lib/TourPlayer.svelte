<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import '@photo-sphere-viewer/core/index.css';
	import '@photo-sphere-viewer/markers-plugin/index.css';
	import { normalizeYaw } from './tour/grid.js';
	import { validateTourConfig } from './tour/validateConfig.js';

	/** @type {{ start?: number, scenes: { name?: string, image: string, links: { to:number, yaw:number, pitch:number, lookYaw:number, lookPitch:number, configured?:boolean }[] }[] }} */
	export let config;
	export let start = null;

	const dispatch = createEventDispatcher();

	// Hotspot arrows and the hover cursor are independent markers. They share the flat-ground
	// billboard look but stay visually distinct: the hotspot is a bare chevron, the cursor adds
	// a ring around it (see puckUrl), so they never read as the same thing when they overlap.
	const HOTSPOT = '/markers/chevron.svg'; // crisp DOM chevron, ground-flattened (was a blurry imageLayer)
	const XMARK = '/markers/x.svg'; // non-navigable cursor (the navigable puck is generated in puckUrl)
	// The hover cursor is a billboard (always faces the camera) so it can never become a
	// teardrop/cut sliver. Its shape depends only on how far the aim is from the median line
	// (|pitch|), SYMMETRICALLY above and below it: near the horizon it's a WIDE, very flat ground
	// ellipse; looking straight down/up it narrows but STAYS a flat ellipse — its height:width is
	// capped below 1 so it never closes into a full circle, always reading as lying on the floor.
	// Crossing the median line is continuous. The hotspot arrows stay truly ground-projected.
	const CURSOR_W_FLAT = 184; // widest near the median line (broad, flat ground ellipse)
	const CURSOR_W_NARROW = 120; // narrower as you look straight down/up
	const CURSOR_FLAT_MIN = 0.28; // flattest height:width, near the median line
	const CURSOR_FLAT_MAX = 0.42; // LEAST flat (steep up/down) — still an ellipse, never a full circle

	const SNAP_MAX_DEG = 90;
	const FLOOR_PITCH_MAX = -2; // above this pitch counts as "above the median line"

	// The puck is generated on the fly so the chevron can point toward the nearest exit (matching
	// the floor hotspot arrow). preserveAspectRatio="none" lets the 100×100 SVG stretch to the flat
	// marker box, so a chevron rotated in this space comes out correctly foreshortened on the ground.
	function puckUrl(rotDeg) {
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
			`<circle cx="50" cy="50" r="45" fill="#ffffff" fill-opacity="0.42" stroke="#ffffff" stroke-opacity="0.95" stroke-width="3"/>` +
			`<g transform="rotate(${rotDeg} 50 50)"><path d="M50 28 L74 54 L62.5 54 L50 41 L37.5 54 L26 54 Z" fill="#3a3a3a"/></g></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(svg)}`;
	}

	let container;
	let viewer;
	let markers;
	let current = 0;
	let navigating = false;
	let cursorOn = false;
	let cursorKey = null; // `${image}:${px}` — re-create on image/size change, else updateMarker (no flicker)

	const scenes = config.scenes;
	const linksFrom = (i) => (scenes[i].links ?? []).filter((l) => l.configured);

	function nearestExit(yawDeg) {
		const exits = linksFrom(current).map((l) => ({
			to: l.to,
			yaw: l.yaw,
			pitch: l.pitch,
			lookYaw: l.lookYaw,
			lookPitch: l.lookPitch,
			d: Math.abs(normalizeYaw(l.yaw - yawDeg))
		}));
		if (!exits.length) return null;
		exits.sort((a, b) => a.d - b.d);
		return exits[0];
	}

	// Shared flat-ground billboard box: wide & flat near the horizon, narrower looking steeply
	// up/down, height capped below the width so it always reads as lying on the floor. Used by both
	// the hover cursor and the hotspot chevrons so they share one consistent shape.
	function flatBox(pitchDeg, scale = 1) {
		const a = Math.min(90, Math.abs(pitchDeg));
		const s = Math.sin((a * Math.PI) / 180);
		const w = Math.round((CURSOR_W_NARROW + (CURSOR_W_FLAT - CURSOR_W_NARROW) * (1 - s)) * scale);
		const h = Math.round(w * Math.min(CURSOR_FLAT_MAX, Math.max(CURSOR_FLAT_MIN, s)));
		return { w, h };
	}

	// Hotspot arrows: crisp DOM chevron billboards (was a blurry ground-projected imageLayer),
	// flattened to lie on the floor and pointing "up" = away toward the destination.
	function buildArrows(index) {
		return linksFrom(index).map((l, j) => {
			const { w, h } = flatBox(l.pitch, 0.9);
			return {
				id: `link-${index}-${j}`,
				image: HOTSPOT,
				position: { yaw: `${l.yaw}deg`, pitch: `${l.pitch}deg` },
				size: { width: w, height: h },
				anchor: 'center',
				data: { to: l.to, lookYaw: l.lookYaw, lookPitch: l.lookPitch }
			};
		});
	}

	function refreshArrows() {
		markers.setMarkers(buildArrows(current));
		cursorOn = false;
	}

	async function goTo(to, lookYaw, lookPitch) {
		if (navigating) return;
		navigating = true;
		removeCursor();
		markers.clearMarkers(); // clear before the fade so old arrows don't flash through the transition
		await viewer.setPanorama(scenes[to].image, {
			transition: { rotation: false, effect: 'fade', speed: 700 },
			position: { yaw: `${lookYaw}deg`, pitch: `${lookPitch}deg` }
		});
		current = to;
		refreshArrows();
		dispatch('navigate', current);
		navigating = false;
		if (import.meta.env.DEV) window.__tourCurrent = current;
	}

	function clickAngle(e) {
		return { yaw: normalizeYaw((e.data.yaw * 180) / Math.PI), pitch: (e.data.pitch * 180) / Math.PI };
	}

	// --- Street-View ground cursor (independent from the arrows) ----------------
	let rafPending = false;
	let lastMove = null;

	function onPointerMove(e) {
		lastMove = e;
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			updateCursor(lastMove);
		});
	}

	function removeCursor() {
		if (cursorOn) {
			markers.removeMarker('__cursor');
			cursorOn = false;
			cursorKey = null;
		}
	}

	function updateCursor(e) {
		if (!viewer || navigating) return;
		const rect = container.getBoundingClientRect();
		const p = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
		if (!p) {
			removeCursor();
			return;
		}
		const pitchDeg = (p.pitch * 180) / Math.PI;
		const yawDeg = normalizeYaw((p.yaw * 180) / Math.PI);
		const near = nearestExit(yawDeg);
		const active = near && near.d <= SNAP_MAX_DEG;
		// Flat-ground billboard shape (shared with the hotspots): wide & flat near the horizon,
		// narrower looking steeply up/down, never closing into a full circle.
		const { w, h } = flatBox(pitchDeg);
		// Lean the chevron toward the nearest exit's HEADING (its yaw offset from the cursor), the
		// way that floor hotspot arrow points. The offset is capped at SNAP_MAX_DEG, so the turn
		// stays within ±90° — it never spins past 180° to point backward/down at the viewer.
		const rotDeg = active ? Math.round(normalizeYaw(near.yaw - yawDeg) / 3) * 3 : 0; // quantize to 3°
		const image = active ? puckUrl(rotDeg) : XMARK;
		const key = active ? 'puck' : 'x';
		const cfg = {
			id: '__cursor',
			image,
			position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
			size: { width: w, height: h },
			anchor: 'center',
			data: active ? { to: near.to, lookYaw: near.lookYaw, lookPitch: near.lookPitch } : { dead: true }
		};
		// updateMarker repositions, resizes AND swaps the (rotated) image smoothly; only re-create
		// when switching between the puck and the X so there's no flicker.
		if (cursorOn && key === cursorKey) {
			markers.updateMarker(cfg);
		} else {
			if (cursorOn) markers.removeMarker('__cursor');
			markers.addMarker(cfg);
			cursorOn = true;
			cursorKey = key;
		}
	}

	onMount(async () => {
		const errors = validateTourConfig(config);
		if (errors.length) throw new Error('Invalid tour config:\n' + errors.join('\n'));

		current = Number.isInteger(start) ? start : Number.isInteger(config.start) ? config.start : 0;

		const { Viewer } = await import('@photo-sphere-viewer/core');
		const { MarkersPlugin } = await import('@photo-sphere-viewer/markers-plugin');

		viewer = new Viewer({
			container,
			panorama: scenes[current].image,
			navbar: false,
			defaultZoomLvl: 30,
			plugins: [[MarkersPlugin, {}]]
		});
		markers = viewer.getPlugin(MarkersPlugin);

		viewer.addEventListener(
			'ready',
			() => {
				refreshArrows();
				dispatch('navigate', current);
				if (import.meta.env.DEV) window.__tourReady = true;
			},
			{ once: true }
		);

		markers.addEventListener('select-marker', ({ marker }) => {
			const d = marker.data;
			if (d && d.to != null) goTo(d.to, d.lookYaw, d.lookPitch);
		});

		viewer.addEventListener('click', (e) => {
			const { yaw, pitch } = clickAngle(e);
			if (pitch > FLOOR_PITCH_MAX) return;
			const near = nearestExit(yaw);
			if (near && near.d <= SNAP_MAX_DEG) goTo(near.to, near.lookYaw, near.lookPitch);
		});

		if (import.meta.env.DEV) {
			window.__tourViewer = viewer;
			window.__tourMarkers = markers;
			window.__tourCurrent = current;
			window.__tourGoto = (to, lookYaw = 0, lookPitch = -10) => goTo(to, lookYaw, lookPitch);
		}
	});

	onDestroy(() => viewer?.destroy());
</script>

<div class="tour-root">
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="tour-viewer" bind:this={container} on:pointermove={onPointerMove} on:pointerleave={removeCursor}></div>
</div>

<style>
	.tour-root {
		position: relative;
		width: 100%;
		height: 100%;
		/* contain PSV's marker z-indexes so they can never paint over the Close button */
		isolation: isolate;
	}
	.tour-viewer {
		width: 100%;
		height: 100%;
		/* hide the native mouse pointer — our on-ground puck IS the cursor */
		cursor: none;
	}
	/* PSV sets cursor:move/grab on its inner container and on every marker, which overrides the
	   rule above — force every descendant to "none" so only our puck shows, never a system cursor. */
	.tour-viewer :global(*) {
		cursor: none !important;
	}
	/* PSV renders image markers with background-size:contain, which keeps a square SVG a CIRCLE
	   regardless of the box aspect — so flattening the box did nothing on screen. Stretch the cursor
	   AND the hotspot chevrons to fill so the box width/height actually flatten them into ground
	   ellipses (the SVGs use preserveAspectRatio="none" so their content stretches with the box). */
	.tour-viewer :global(#psv-marker-__cursor),
	.tour-viewer :global([id^='psv-marker-link-']) {
		background-size: 100% 100% !important;
	}
	/* Snap the cursor chevron to its new heading instantly — never animate the long way round
	   (>180°) when it re-points at the nearest exit. */
	.tour-viewer :global(#psv-marker-__cursor) {
		transition: none !important;
	}
	:global(.psv-navbar) {
		display: none !important;
	}
</style>
