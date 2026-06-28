/**
 * Package an uploaded tour into a self-contained folder the user can open locally or host:
 *   index.html   — a standalone Photo Sphere Viewer tour (config inlined, images relative)
 *   tour.json    — the tour configuration (also embedded in index.html)
 *   images/NN.webp — the panoramas
 *   README.txt   — how to view / host it
 *
 * The viewer mirrors src/lib/TourPlayer.svelte (ground cursor, chevron hotspots, click-to-
 * navigate) but as a framework-free module so the export needs no build step. The Photo
 * Sphere Viewer library loads from a CDN — that keeps the download small and is the only
 * combination that works both by double-clicking index.html (file://) and when hosted.
 */

import { zipStore } from './zip.js';

const pad = (i) => String(i).padStart(2, '0');

const CDN = 'https://cdn.jsdelivr.net/npm';
const THREE_URL = `${CDN}/three@0.185.0/build/three.module.js`;
const CORE_URL = `${CDN}/@photo-sphere-viewer/core@5.14.3/index.module.js`;
const CORE_CSS = `${CDN}/@photo-sphere-viewer/core@5.14.3/index.css`;
const MARKERS_URL = `${CDN}/@photo-sphere-viewer/markers-plugin@5.14.3/index.module.js`;
const MARKERS_CSS = `${CDN}/@photo-sphere-viewer/markers-plugin@5.14.3/index.css`;

// Standalone viewer module. Written with string concatenation (no template literals / ${})
// so it embeds cleanly in the HTML template below. `__CONFIG__` is replaced with the tour
// config. Logic is a faithful port of TourPlayer.svelte.
const VIEWER_JS = `
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

var CONFIG = __CONFIG__;
var scenes = CONFIG.scenes;

var CHEVRON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" preserveAspectRatio="none"><path d="M50 20 L84 62 L66 62 L50 42 L34 62 L16 62 Z" fill="#ffffff" stroke="#2a2a2a" stroke-width="5" stroke-linejoin="round"/></svg>';
var XMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512"><g stroke-linecap="round" fill="none"><line x1="33" y1="33" x2="67" y2="67" stroke="#000000" stroke-opacity="0.25" stroke-width="16"/><line x1="67" y1="33" x2="33" y2="67" stroke="#000000" stroke-opacity="0.25" stroke-width="16"/><line x1="33" y1="33" x2="67" y2="67" stroke="#ffffff" stroke-opacity="0.92" stroke-width="11"/><line x1="67" y1="33" x2="33" y2="67" stroke="#ffffff" stroke-opacity="0.92" stroke-width="11"/></g></svg>';

var HOTSPOT = 'data:image/svg+xml,' + encodeURIComponent(CHEVRON_SVG);
var XMARK = 'data:image/svg+xml,' + encodeURIComponent(XMARK_SVG);
var CURSOR_W_FLAT = 184, CURSOR_W_NARROW = 120, CURSOR_FLAT_MIN = 0.28, CURSOR_FLAT_MAX = 0.42;
var SNAP_MAX_DEG = 90, FLOOR_PITCH_MAX = -2;

function normalizeYaw(deg){ var w = (((deg + 180) % 360) + 360) % 360 - 180; return w === -180 ? 180 : w; }

function puckUrl(rotDeg){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">'
    + '<circle cx="50" cy="50" r="45" fill="#ffffff" fill-opacity="0.42" stroke="#ffffff" stroke-opacity="0.95" stroke-width="3"/>'
    + '<g transform="rotate(' + rotDeg + ' 50 50)"><path d="M50 28 L74 54 L62.5 54 L50 41 L37.5 54 L26 54 Z" fill="#3a3a3a"/></g></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function flatBox(pitchDeg, scale){
  if (scale === undefined) scale = 1;
  var a = Math.min(90, Math.abs(pitchDeg));
  var s = Math.sin(a * Math.PI / 180);
  var w = Math.round((CURSOR_W_NARROW + (CURSOR_W_FLAT - CURSOR_W_NARROW) * (1 - s)) * scale);
  var h = Math.round(w * Math.min(CURSOR_FLAT_MAX, Math.max(CURSOR_FLAT_MIN, s)));
  return { w: w, h: h };
}

function linksFrom(i){ return (scenes[i].links || []).filter(function(l){ return l.configured; }); }

var viewer, markers, container;
var current = Number.isInteger(CONFIG.start) ? CONFIG.start : 0;
var navigating = false, cursorOn = false, cursorKey = null;

function nearestExit(yawDeg){
  var exits = linksFrom(current).map(function(l){
    return { to: l.to, yaw: l.yaw, pitch: l.pitch, lookYaw: l.lookYaw, lookPitch: l.lookPitch, d: Math.abs(normalizeYaw(l.yaw - yawDeg)) };
  });
  if (!exits.length) return null;
  exits.sort(function(a, b){ return a.d - b.d; });
  return exits[0];
}

function buildArrows(index){
  return linksFrom(index).map(function(l, j){
    var box = flatBox(l.pitch, 0.9);
    return { id: 'link-' + index + '-' + j, image: HOTSPOT, position: { yaw: l.yaw + 'deg', pitch: l.pitch + 'deg' }, size: { width: box.w, height: box.h }, anchor: 'center', data: { to: l.to, lookYaw: l.lookYaw, lookPitch: l.lookPitch } };
  });
}

function refreshArrows(){ markers.setMarkers(buildArrows(current)); cursorOn = false; }
function removeCursor(){ if (cursorOn){ markers.removeMarker('__cursor'); cursorOn = false; cursorKey = null; } }

function goTo(to, lookYaw, lookPitch){
  if (navigating) return;
  navigating = true;
  removeCursor();
  markers.clearMarkers();
  viewer.setPanorama(scenes[to].image, { transition: { rotation: false, effect: 'fade', speed: 700 }, position: { yaw: lookYaw + 'deg', pitch: lookPitch + 'deg' } }).then(function(){
    current = to;
    refreshArrows();
    navigating = false;
  });
}

function updateCursor(e){
  if (!viewer || navigating) return;
  var rect = container.getBoundingClientRect();
  var p = viewer.dataHelper.viewerCoordsToSphericalCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  if (!p){ removeCursor(); return; }
  var pitchDeg = p.pitch * 180 / Math.PI;
  var yawDeg = normalizeYaw(p.yaw * 180 / Math.PI);
  var near = nearestExit(yawDeg);
  var active = near && near.d <= SNAP_MAX_DEG;
  var box = flatBox(pitchDeg);
  var rotDeg = active ? Math.round(normalizeYaw(near.yaw - yawDeg) / 3) * 3 : 0;
  var image = active ? puckUrl(rotDeg) : XMARK;
  var key = active ? 'puck' : 'x';
  var cfg = { id: '__cursor', image: image, position: { yaw: yawDeg + 'deg', pitch: pitchDeg + 'deg' }, size: { width: box.w, height: box.h }, anchor: 'center', data: active ? { to: near.to, lookYaw: near.lookYaw, lookPitch: near.lookPitch } : { dead: true } };
  if (cursorOn && key === cursorKey){ markers.updateMarker(cfg); }
  else { if (cursorOn) markers.removeMarker('__cursor'); markers.addMarker(cfg); cursorOn = true; cursorKey = key; }
}

var rafPending = false, lastMove = null;
function onPointerMove(e){ lastMove = e; if (rafPending) return; rafPending = true; requestAnimationFrame(function(){ rafPending = false; updateCursor(lastMove); }); }

container = document.getElementById('viewer');
viewer = new Viewer({ container: container, panorama: scenes[current].image, navbar: false, defaultZoomLvl: 30, plugins: [[MarkersPlugin, {}]] });
markers = viewer.getPlugin(MarkersPlugin);

viewer.addEventListener('ready', function(){ refreshArrows(); window.__tourLoaded = true; }, { once: true });
markers.addEventListener('select-marker', function(ev){ var d = ev.marker.data; if (d && d.to != null) goTo(d.to, d.lookYaw, d.lookPitch); });
viewer.addEventListener('click', function(e){
  var yaw = normalizeYaw(e.data.yaw * 180 / Math.PI);
  var pitch = e.data.pitch * 180 / Math.PI;
  if (pitch > FLOOR_PITCH_MAX) return;
  var near = nearestExit(yaw);
  if (near && near.d <= SNAP_MAX_DEG) goTo(near.to, near.lookYaw, near.lookPitch);
});
container.addEventListener('pointermove', onPointerMove);
container.addEventListener('pointerleave', removeCursor);
`;

const README = `This folder is a self-contained 360° virtual tour.

Quick look (no setup)
  Open index.html in a web browser. The viewer library loads from a CDN, so the
  first open needs an internet connection.

Host it
  Upload the whole folder to any static host (GitHub Pages, Netlify, S3, nginx, or
  run "npx serve" in this folder) and open index.html. All paths are relative.

Contents
  index.html      the tour viewer (the configuration is embedded inside it)
  tour.json       the tour configuration: scenes, links and the start scene
  images/         the panorama images (WebP)
`;

/** Build the standalone index.html for a tour config (image paths must be relative). */
export function buildIndexHtml(config) {
	// JSON is safe inside a JS string, but a "</script>" inside a scene name would close the
	// inline module early — escape "<" so the browser keeps it as data, not markup.
	const configJson = JSON.stringify(config).replace(/</g, '\\u003c');
	// String replacement (not regex) and a function replacer so any "$" in names is literal.
	const body = VIEWER_JS.replace('__CONFIG__', () => configJson);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>360° tour</title>
<link rel="stylesheet" href="${CORE_CSS}" />
<link rel="stylesheet" href="${MARKERS_CSS}" />
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  #viewer { position: fixed; inset: 0; width: 100vw; height: 100vh; cursor: none; }
  #viewer * { cursor: none !important; }
  #psv-marker-__cursor, [id^="psv-marker-link-"] { background-size: 100% 100% !important; }
  #psv-marker-__cursor { transition: none !important; }
  .psv-navbar { display: none !important; }
  #fallback { position: fixed; inset: 0; display: none; place-items: center; background: #000;
    color: #fff; font: 15px/1.6 system-ui, sans-serif; text-align: center; padding: 24px; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "${THREE_URL}",
    "@photo-sphere-viewer/core": "${CORE_URL}",
    "@photo-sphere-viewer/markers-plugin": "${MARKERS_URL}"
  }
}
</script>
</head>
<body>
<div id="viewer"></div>
<div id="fallback">Could not load the 360° viewer library.<br />Opening this tour needs an internet connection (the viewer is fetched from a CDN).</div>
<script>
  // If the module never signals "loaded", the CDN was unreachable — show a clear message.
  setTimeout(function () { if (!window.__tourLoaded) document.getElementById('fallback').style.display = 'grid'; }, 8000);
</script>
<script type="module">
${body}
</script>
</body>
</html>
`;
}

/**
 * Build the downloadable ZIP for an uploaded tour.
 * @param {{ blob: Blob }[]} scenes  uploadStore scenes (full-resolution WebP blobs), in order
 * @param {{ start:number, scenes:{ image:string }[] }} config  config with RELATIVE image paths
 * @returns {Promise<Blob>}
 */
export async function buildTourZip(scenes, config) {
	// Use each scene's declared image path as its path in the zip, so tour.json and the files
	// can never drift apart. Leading "/" is stripped so paths stay relative inside the folder.
	const files = config.scenes.map((scene, i) => ({
		name: scene.image.replace(/^\//, ''),
		blob: scenes[i].blob
	}));
	files.push({ name: 'tour.json', blob: new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }) });
	files.push({ name: 'index.html', blob: new Blob([buildIndexHtml(config)], { type: 'text/html' }) });
	files.push({ name: 'README.txt', blob: new Blob([README], { type: 'text/plain' }) });
	return zipStore(files);
}

const EXT_BY_TYPE = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Relative in-zip image path for scene `i`, extension matched to the blob's mime type. */
export const exportImagePath = (i, type = 'image/webp') => `images/${pad(i)}.${EXT_BY_TYPE[type] || 'webp'}`;
