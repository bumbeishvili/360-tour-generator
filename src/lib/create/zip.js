/**
 * Minimal ZIP writer (STORE method — no compression).
 *
 * WebP images and JSON are already compact, so DEFLATE would buy almost nothing while
 * pulling in a dependency. We just frame each file with the standard ZIP headers, which
 * every unzip tool (Finder, Explorer, `unzip`) reads. Folder paths use "/" in the name.
 *
 * 32-bit sizes only (no ZIP64) — a tour of WebP panoramas is comfortably under 4 GB.
 */

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes) {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/**
 * Build a ZIP archive from `[{ name, blob }]` entries.
 * @returns {Promise<Blob>} application/zip
 */
export async function zipStore(entries) {
	const chunks = []; // file records, in archive order
	const central = []; // central-directory records
	let offset = 0; // running offset of the next local header

	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.name);
		const data = new Uint8Array(await entry.blob.arrayBuffer());
		const crc = crc32(data);
		const size = data.length;

		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true); // local file header signature
		local.setUint16(4, 20, true); // version needed to extract
		local.setUint16(6, 0x0800, true); // general purpose flag: UTF-8 filename
		local.setUint16(8, 0, true); // compression method: store
		local.setUint16(10, 0, true); // mod time
		local.setUint16(12, 0x21, true); // mod date (1980-01-01)
		local.setUint32(14, crc, true);
		local.setUint32(18, size, true); // compressed size
		local.setUint32(22, size, true); // uncompressed size
		local.setUint16(26, nameBytes.length, true);
		local.setUint16(28, 0, true); // extra field length
		const localHeader = new Uint8Array(local.buffer);

		chunks.push(localHeader, nameBytes, data);

		const cd = new DataView(new ArrayBuffer(46));
		cd.setUint32(0, 0x02014b50, true); // central dir header signature
		cd.setUint16(4, 20, true); // version made by
		cd.setUint16(6, 20, true); // version needed
		cd.setUint16(8, 0x0800, true); // flag: UTF-8
		cd.setUint16(10, 0, true); // method: store
		cd.setUint16(12, 0, true); // mod time
		cd.setUint16(14, 0x21, true); // mod date
		cd.setUint32(16, crc, true);
		cd.setUint32(20, size, true);
		cd.setUint32(24, size, true);
		cd.setUint16(28, nameBytes.length, true);
		cd.setUint16(30, 0, true); // extra length
		cd.setUint16(32, 0, true); // comment length
		cd.setUint16(34, 0, true); // disk number start
		cd.setUint16(36, 0, true); // internal attributes
		cd.setUint32(38, 0, true); // external attributes
		cd.setUint32(42, offset, true); // offset of local header
		central.push(new Uint8Array(cd.buffer), nameBytes);

		offset += localHeader.length + nameBytes.length + size;
	}

	const cdStart = offset;
	const cdSize = central.reduce((sum, part) => sum + part.length, 0);

	const eocd = new DataView(new ArrayBuffer(22));
	eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
	eocd.setUint16(4, 0, true); // disk number
	eocd.setUint16(6, 0, true); // disk with central dir
	eocd.setUint16(8, entries.length, true); // entries on this disk
	eocd.setUint16(10, entries.length, true); // total entries
	eocd.setUint32(12, cdSize, true);
	eocd.setUint32(16, cdStart, true);
	eocd.setUint16(20, 0, true); // comment length

	return new Blob([...chunks, ...central, new Uint8Array(eocd.buffer)], { type: 'application/zip' });
}
