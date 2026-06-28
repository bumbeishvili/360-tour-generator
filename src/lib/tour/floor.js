/**
 * Four corner directions of a small rectangle lying FLAT on the floor, for a PSV
 * `imageLayer` marker. The rectangle is centred at the floor point hit by the ray
 * (centreYawDeg, centrePitchDeg) when the eye sits at height `h` above the floor,
 * and is oriented so an up-pointing image points along `faceYawDeg`.
 *
 * Returns corners in PSV imageLayer order [top-left, top-right, bottom-right,
 * bottom-left] where "top" is the FAR edge — so an up-pointing chevron points away
 * from the viewer (toward the destination). Returns null if the ray doesn't hit the
 * floor (must look downward).
 *
 * `lenM`/`widM` are an angular size factor (~radians): the rectangle is scaled by
 * its distance from the eye, so it keeps a CONSTANT on-screen size no matter how
 * far on the floor it is placed (not "bigger when closer").
 *
 * `square` (default true): the FORWARD (toward/away) extent of a flat floor patch
 * foreshortens hard at grazing angles — a square patch can project to a 5:1 wide,
 * squashed sliver, which slices the front off an arrow. We pre-stretch the forward
 * extent by the foreshortening factor (slant distance / eye height, capped by
 * `maxAspect`) so the patch projects roughly SQUARE on screen and the image keeps
 * its proportions.
 */
export function floorQuad(viewer, centreYawDeg, centrePitchDeg, faceYawDeg = centreYawDeg, opts = {}) {
	const dh = viewer.dataHelper;
	const DEG = Math.PI / 180;
	const { h = 2, lenM = 0.12, widM = 0.12, square = true, maxAspect = 6 } = opts;
	const unit = (yawDeg, pitchDeg) => dh.sphericalCoordsToVector3({ yaw: yawDeg * DEG, pitch: pitchDeg * DEG }).normalize();

	const dir = unit(centreYawDeg, centrePitchDeg);
	if (dir.y >= -1e-4) return null; // ray doesn't reach the floor plane y = -h

	const centre = dir.clone().multiplyScalar(-h / dir.y); // floor hit point, y = -h
	const dist = centre.length(); // scale with distance → constant on-screen size
	const fwd = unit(faceYawDeg, 0); // horizontal forward (unit, y = 0)
	const lat = fwd.clone().set(fwd.z, 0, -fwd.x); // up × fwd → points image-left (unit)
	// dist / h = 1 / sin(depression): the factor by which the forward floor extent is
	// foreshortened on screen. Pre-multiply length so forward span ≈ lateral span.
	const fore = square ? Math.min(maxAspect, dist / h) : 1;
	const hl = (lenM * fore * dist) / 2;
	const hw = (widM * dist) / 2;

	const corner = (fSign, lSign) => {
		const p = centre
			.clone()
			.add(fwd.clone().multiplyScalar(fSign * hl))
			.add(lat.clone().multiplyScalar(lSign * hw));
		const s = dh.vector3ToSphericalCoords(p);
		return { yaw: `${s.yaw / DEG}deg`, pitch: `${s.pitch / DEG}deg` };
	};

	return [
		corner(+1, +1), // top-left  (far, left)
		corner(+1, -1), // top-right (far, right)
		corner(-1, -1), // bottom-right (near, right)
		corner(-1, +1) // bottom-left (near, left)
	];
}

/**
 * A ground/billboard hybrid marker. Below the horizon it lies FLAT on the floor
 * (ground-projected, de-squished so it keeps its shape); above the horizon (e.g. up
 * a staircase) it falls back to a normal billboard so it can be placed anywhere.
 * Constant on-screen size in both cases. Used for both the hotspot arrows and the
 * Street-View hover cursor.
 */
export function groundMarker(viewer, { id, image, yawDeg, pitchDeg, data = {}, floor = { lenM: 0.09, widM: 0.09 }, px = 40 }) {
	if (pitchDeg < -2) {
		const position = floorQuad(viewer, yawDeg, pitchDeg, yawDeg, floor);
		if (position) return { id, imageLayer: image, position, data };
	}
	return {
		id,
		image,
		position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
		size: { width: px, height: px },
		anchor: 'center',
		data
	};
}

/**
 * A hotspot navigation arrow marker — INDEPENDENT of the hover cursor.
 */
export function arrowMarker(viewer, id, image, yawDeg, pitchDeg, data = {}, opts = {}) {
	const { floor = { lenM: 0.12, widM: 0.12 }, px = 52 } = opts;
	return groundMarker(viewer, { id, image, yawDeg, pitchDeg, data, floor, px });
}
