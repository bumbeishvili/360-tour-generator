/**
 * Client-side panorama processing.
 *
 * Equirectangular panoramas are 2:1. Before anything is uploaded we:
 *   1. decode the dropped file,
 *   2. downscale so the longest side is <= MAX_EDGE (8k) — only if larger,
 *   3. re-encode as WebP via canvas.toBlob(..., 'image/webp', quality).
 *
 * We also emit a small THUMB_EDGE-wide WebP thumbnail. The graph configurator shows
 * every scene as a tiny circle; painting N full-resolution (up to 8192×4096) panoramas
 * at once is what made `configure?source=uploaded` crawl, so the graph uses the thumbnail
 * and the full-resolution blob is kept only for the tour viewer and the GitHub publish.
 *
 * The result is a WebP Blob plus an object URL the rest of the app can render.
 */

export const MAX_EDGE = 8192;
export const WEBP_QUALITY = 0.9;
// The graph nodes are small circles (~132px, ~185px when a toured room is enlarged), so a
// 512-wide preview is plenty there and decodes in a tiny fraction of the time a full panorama
// would. This thumbnail is ONLY for the node previews — the tour viewer and publish keep the
// full-resolution panorama (scene.image / scene.blob).
export const THUMB_EDGE = 512;
export const THUMB_QUALITY = 0.8;

/** Load a File/Blob into an <img> that is ready to draw. */
function loadImage(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve({ img, url });
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`Could not decode image "${file.name || 'unnamed'}"`));
		};
		img.src = url;
	});
}

/** canvas.toBlob promisified. */
function canvasToBlob(canvas, type, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('canvas.toBlob returned null'));
			},
			type,
			quality
		);
	});
}

/**
 * Compute the output size: scale down so the longest side is <= maxEdge,
 * never scale up. Returns integer dimensions.
 */
export function fitWithinMaxEdge(width, height, maxEdge = MAX_EDGE) {
	const longest = Math.max(width, height);
	if (longest <= maxEdge) {
		return { width, height, scaled: false };
	}
	const scale = maxEdge / longest;
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
		scaled: true
	};
}

/** Draw an already-decoded image to a WebP blob, downscaled to fit maxEdge. */
async function renderWebp(img, maxEdge, quality) {
	const { width, height, scaled } = fitWithinMaxEdge(img.naturalWidth, img.naturalHeight, maxEdge);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(img, 0, 0, width, height);
	return { blob: await canvasToBlob(canvas, 'image/webp', quality), width, height, scaled };
}

/**
 * Process a single dropped File into a WebP scene asset (full panorama + preview thumbnail).
 *
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number }} [options]
 * @returns {Promise<{
 *   blob: Blob,
 *   url: string,
 *   thumbBlob: Blob,
 *   thumbUrl: string,
 *   width: number,
 *   height: number,
 *   originalWidth: number,
 *   originalHeight: number,
 *   scaled: boolean,
 *   fileName: string
 * }>}
 */
export async function processPanorama(file, options = {}) {
	const maxEdge = options.maxEdge ?? MAX_EDGE;
	const quality = options.quality ?? WEBP_QUALITY;

	const { img, url } = await loadImage(file);
	const originalWidth = img.naturalWidth;
	const originalHeight = img.naturalHeight;

	const full = await renderWebp(img, maxEdge, quality);
	const thumb = await renderWebp(img, THUMB_EDGE, THUMB_QUALITY);

	// The source object URL is no longer needed once both sizes are drawn.
	URL.revokeObjectURL(url);

	return {
		blob: full.blob,
		url: URL.createObjectURL(full.blob),
		thumbBlob: thumb.blob,
		thumbUrl: URL.createObjectURL(thumb.blob),
		width: full.width,
		height: full.height,
		originalWidth,
		originalHeight,
		scaled: full.scaled,
		fileName: file.name || 'panorama'
	};
}

/** Build just the preview thumbnail blob from a full-size image blob (used to backfill
 *  scenes persisted before thumbnails existed). */
export async function makeThumbBlob(blob) {
	const { img, url } = await loadImage(blob);
	const { blob: thumbBlob } = await renderWebp(img, THUMB_EDGE, THUMB_QUALITY);
	URL.revokeObjectURL(url);
	return thumbBlob;
}
