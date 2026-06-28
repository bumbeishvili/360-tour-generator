/**
 * Grid ⇄ angle mapping for the 360 tour.
 *
 * Every panorama is treated as an 8 (columns) × 4 (rows) grid of cells, numbered
 * left→right, top→bottom. Authors place arrows by cell number; the player turns a
 * cell into the spherical angle Photo Sphere Viewer needs.
 *
 * Verified PSV v5 conventions (from the installed source):
 *   - yaw  = 0° looks at the HORIZONTAL CENTRE of the image and increases to the
 *            RIGHT, wrapping at ±180°.
 *   - pitch = +90° is straight up (ceiling), 0° the horizon, −90° straight down
 *            (floor). So the bottom grid row is the floor — where nav arrows live.
 *
 * The only value you normally tune is YAW_ORIGIN_DEG (see CALIBRATION below).
 */

export const GRID = { COLS: 8, ROWS: 4 };

/** Cells are authored 1-based (1..32) to match how the tour was sketched. Set to 0 for 0..31. */
export const CELL_BASE = 1;

/**
 * CALIBRATION — added to every column's yaw so authored "column 1" lands on the
 * azimuth the grid was cut from. 0° puts the grid's left edge at the image centre.
 * Click a known feature in the player, read the logged yaw, and nudge this in 45°
 * steps until columns line up. This is a per-project constant, not per-image.
 */
export const YAW_ORIGIN_DEG = 0;

/** Set true only if your source grid numbers columns right→left (PSV yaw goes right). */
export const FLIP_COLUMNS = false;

/** Wrap any degree value into the (−180, 180] range PSV uses. */
export function normalizeYaw(deg) {
	const wrapped = (((deg + 180) % 360) + 360) % 360 - 180;
	return wrapped === -180 ? 180 : wrapped;
}

/**
 * Convert a grid cell to a viewing angle.
 * @param {number} cell - cell number (1..COLS*ROWS by default)
 * @param {{COLS:number,ROWS:number}} [grid]
 * @returns {{ yaw: number, pitch: number }} degrees
 */
export function cellToAngle(cell, grid = GRID) {
	const total = grid.COLS * grid.ROWS;
	const idx = cell - CELL_BASE;
	if (!Number.isInteger(idx) || idx < 0 || idx >= total) {
		const lo = CELL_BASE;
		const hi = total - 1 + CELL_BASE;
		throw new Error(`cellToAngle: cell ${cell} is out of range (expected ${lo}..${hi})`);
	}

	let col = idx % grid.COLS;
	const row = Math.floor(idx / grid.COLS);
	if (FLIP_COLUMNS) col = grid.COLS - 1 - col;

	const colSpan = 360 / grid.COLS; // 45° per column
	const rowSpan = 180 / grid.ROWS; // 45° per row band

	const yaw = normalizeYaw(YAW_ORIGIN_DEG + (col + 0.5) * colSpan);
	const pitch = 90 - (row + 0.5) * rowSpan; // top row → +pitch, bottom row → −pitch (floor)
	return { yaw, pitch };
}
