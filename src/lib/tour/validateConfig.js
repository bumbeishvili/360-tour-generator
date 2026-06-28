/**
 * Validate a tour config of the shape:
 *   { start?: number, scenes: [ { name?, image, links: [ {to, yaw, pitch, lookYaw, lookPitch} ] } ] }
 *
 * Angles are in degrees (PSV convention: yaw 0 = image centre, +right; pitch + = up).
 * Returns an array of human-readable errors (empty = OK).
 */
export function validateTourConfig(config) {
	const errors = [];
	if (!config || typeof config !== 'object') return ['config is not an object'];

	const { scenes } = config;
	if (!Array.isArray(scenes) || scenes.length === 0) {
		errors.push('`scenes` must be a non-empty array');
		return errors;
	}

	const last = scenes.length - 1;
	scenes.forEach((s, i) => {
		if (!s || typeof s !== 'object') {
			errors.push(`scenes[${i}] is not an object`);
			return;
		}
		if (typeof s.image !== 'string' || !s.image) errors.push(`scenes[${i}].image must be a non-empty string`);
		if (s.links != null && !Array.isArray(s.links)) {
			errors.push(`scenes[${i}].links must be an array`);
			return;
		}
		(s.links || []).forEach((l, j) => {
			const at = `scenes[${i}].links[${j}]`;
			if (!l || typeof l !== 'object') {
				errors.push(`${at} is not an object`);
				return;
			}
			if (!inRange(l.to, 0, last)) errors.push(`${at}.to=${l.to} is not a scene index (0..${last})`);
			if (l.to === i) errors.push(`${at}: scene ${i} links to itself`);
			for (const k of ['yaw', 'pitch', 'lookYaw', 'lookPitch']) {
				if (typeof l[k] !== 'number' || !Number.isFinite(l[k])) errors.push(`${at}.${k} must be a number`);
			}
			if (l.rotation != null && (typeof l.rotation !== 'number' || !Number.isFinite(l.rotation))) {
				errors.push(`${at}.rotation must be a number`);
			}
		});
	});

	if ('start' in config && !inRange(config.start, 0, last)) {
		errors.push(`start=${config.start} is not a scene index (0..${last})`);
	}
	if (config.order != null) {
		if (!Array.isArray(config.order)) errors.push('`order` must be an array of scene indices');
		else config.order.forEach((idx, k) => {
			if (!inRange(idx, 0, last)) errors.push(`order[${k}]=${idx} is not a scene index (0..${last})`);
		});
	}
	return errors;
}

function inRange(n, lo, hi) {
	return Number.isInteger(n) && n >= lo && n <= hi;
}
