/**
 * In-memory store of the WebP scenes the user dropped on the /create screen,
 * mirrored to IndexedDB so a refresh does not lose the work.
 *
 * Each scene is:
 *   { id, name, blob, url, width, height, scaled, fileName }
 *
 * `url` is a freshly-created object URL valid for the current page session.
 * Blobs are persisted; object URLs are recreated on load.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { makeThumbBlob } from './imageProcessing.js';

const DB_NAME = 'tour-create';
const STORE_NAME = 'scenes';
// Graph-level edits (links, start, names) are small and image-free, so they live in
// localStorage keyed by scene id — survives a refresh without re-persisting blobs.
const EDITS_KEY = 'tour-create-edits';

export const scenes = writable([]);

/** Persist the configurator's graph edits (keyed by scene id). */
export function saveEditState(state) {
	if (browser) localStorage.setItem(EDITS_KEY, JSON.stringify(state));
}

/** Read back persisted graph edits, or null if none / corrupted. */
export function loadEditState() {
	if (!browser) return null;
	const raw = localStorage.getItem(EDITS_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null; // ignore corrupted state rather than blocking the editor
	}
}

/** Forget persisted graph edits (e.g. after the scenes are cleared). */
export function clearEditState() {
	if (browser) localStorage.removeItem(EDITS_KEY);
}

/** Open (and lazily create) the IndexedDB database. */
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function tx(db, mode) {
	return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/** Persist a single scene record (blobs + metadata, no object URLs). */
async function persist(scene) {
	if (!browser) return;
	const db = await openDb();
	const { url, thumbUrl, ...persisted } = scene;
	tx(db, 'readwrite').put(persisted);
}

/** Generate a sortable, unique scene id. */
function makeId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Add a processed scene to the store + IndexedDB.
 * The `processed` value is the result of `processPanorama`.
 */
export async function addScene(processed) {
	const scene = {
		id: makeId(),
		name: sceneNameFrom(processed.fileName),
		blob: processed.blob,
		url: processed.url,
		thumbBlob: processed.thumbBlob,
		thumbUrl: processed.thumbUrl,
		width: processed.width,
		height: processed.height,
		scaled: processed.scaled,
		fileName: processed.fileName,
		order: get(scenes).length
	};
	scenes.update((list) => [...list, scene]);
	await persist(scene);
	return scene;
}

function sceneNameFrom(fileName) {
	const base = (fileName || 'Scene').split('/').pop();
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(0, dot) : base;
}

/** Remove a scene by id, revoking its object URL and deleting from IndexedDB. */
export async function removeScene(id) {
	scenes.update((list) => {
		const removed = list.find((s) => s.id === id);
		if (removed) {
			URL.revokeObjectURL(removed.url);
			if (removed.thumbUrl) URL.revokeObjectURL(removed.thumbUrl);
		}
		return list.filter((s) => s.id !== id).map((s, index) => ({ ...s, order: index }));
	});
	if (!browser) return;
	const db = await openDb();
	tx(db, 'readwrite').delete(id);
	await reindexPersisted();
}

/** Move a scene from one position to another (drag reorder). */
export async function reorderScene(fromIndex, toIndex) {
	scenes.update((list) => {
		const next = [...list];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		return next.map((s, index) => ({ ...s, order: index }));
	});
	await reindexPersisted();
}

/** Rename a scene. */
export async function renameScene(id, name) {
	scenes.update((list) => list.map((s) => (s.id === id ? { ...s, name } : s)));
	const updated = get(scenes).find((s) => s.id === id);
	if (updated) await persist(updated);
}

/** Re-write the persisted order field for every scene. */
async function reindexPersisted() {
	if (!browser) return;
	const list = get(scenes);
	const db = await openDb();
	const store = tx(db, 'readwrite');
	list.forEach((scene) => {
		const { url, thumbUrl, ...persisted } = scene;
		store.put(persisted);
	});
}

/** Load any previously-persisted scenes back into the store on page load. */
export async function loadPersisted() {
	if (!browser) return;
	const db = await openDb();
	const records = await new Promise((resolve, reject) => {
		const request = tx(db, 'readonly').getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	// Backfill a thumbnail for any scene persisted before thumbnails existed, so the graph
	// never has to decode a full-resolution panorama as a tiny node preview.
	for (const record of records) {
		if (!record.thumbBlob && record.blob) {
			record.thumbBlob = await makeThumbBlob(record.blob);
			tx(db, 'readwrite').put(record);
		}
	}
	const ordered = records
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((record) => ({
			...record,
			url: URL.createObjectURL(record.blob),
			thumbUrl: URL.createObjectURL(record.thumbBlob)
		}));
	scenes.set(ordered);
	return ordered;
}

/** Drop everything (after a successful publish, or a manual reset). */
export async function clearScenes() {
	get(scenes).forEach((s) => {
		URL.revokeObjectURL(s.url);
		if (s.thumbUrl) URL.revokeObjectURL(s.thumbUrl);
	});
	scenes.set([]);
	clearEditState();
	if (!browser) return;
	const db = await openDb();
	tx(db, 'readwrite').clear();
}
