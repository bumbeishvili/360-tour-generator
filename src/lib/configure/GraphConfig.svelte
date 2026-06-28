<script>
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
	import LinkEditor from './LinkEditor.svelte';
	import SaveShare from './SaveShare.svelte';
	import DownloadHost from './DownloadHost.svelte';
	import TourPlayer from '$lib/TourPlayer.svelte';
	import { scenes as uploadedScenes, loadPersisted, saveEditState, loadEditState } from '$lib/create/uploadStore.js';

	let config = null;
	let nodes = [];
	let edges = []; // { a, b } unordered, a<b
	let sim;

	let wrap;
	let W = 1000, H = 700;
	let view = { k: 1, tx: 0, ty: 0 };

	let hoverNode = null;
	let hoverPan = 0.5; // 0..1 horizontal scrub of the hovered node's thumbnail
	let hoverPanY = 0.5; // 0..1 vertical scrub (look toward ceiling / floor)
	let selectedNode = null; // node id last opened
	let tourOpen = false;
	let tourStart = 0;
	let tourCurrentScene = 0; // scene the open tour is currently showing
	let lastToured = null; // node enlarged after the tour is closed
	let selectedEdge = null; // {a,b}
	let editorPair = null; // {a,b} open editor
	let linking = null; // { from, x, y } while dragging a new link
	let saveTimer;
	let status = 'Drag between rooms to link · drop a room in the START circle to set the start · then Save & share.';

	const R = 66; // node radius (graph units)
	// node thumbnail: the uploaded scene's small preview (NOT its full-resolution panorama,
	// which is far too heavy to paint as N tiny circles at once — that made the graph crawl).
	const thumbFor = (i) => config.scenes[i]?.thumb ?? config.scenes[i]?.image;
	// Replace each scene's (blob) image with its committed GitHub URL, ready to publish.
	const buildPublishConfig = (imageUrls) => ({
		start: config.start ?? 0,
		scenes: config.scenes.map((s, i) => ({ name: s.name, image: imageUrls[i], links: s.links ?? [] }))
	});

	// Scene image blobs for the downloadable export (already in memory from /create).
	async function sceneBlobs() {
		return get(uploadedScenes).map((s) => s.blob);
	}
	const touch = () => (config = config);
	const screenToGraph = (sx, sy) => ({ x: (sx - view.tx) / view.k, y: (sy - view.ty) / view.k });

	// Fixed "start slot" on the left — drop a room into it to make it the starting scene.
	let slot = { x: 130, y: 360 };
	let slotActive = false; // true while a dragged node is hovering the slot

	function assignStart(id) {
		if (config.start != null && config.start !== id && nodes[config.start]) {
			nodes[config.start].fx = null; // release the previous start back into the layout
			nodes[config.start].fy = null;
		}
		nodes[id].fx = slot.x;
		nodes[id].fy = slot.y;
		config.start = id;
		touch();
		scheduleSave();
	}

	function rebuildEdges() {
		const seen = new Set();
		const es = [];
		config.scenes.forEach((s, a) =>
			(s.links || []).forEach((l) => {
				const b = l.to;
				const lo = Math.min(a, b), hi = Math.max(a, b);
				const key = `${lo}-${hi}`;
				if (seen.has(key)) return;
				seen.add(key);
				es.push({ a: lo, b: hi, source: lo, target: hi });
			})
		);
		edges = es;
		if (sim) {
			sim.force('link').links(edges);
			sim.alpha(0.5).restart();
		}
	}

	function linkObjs(a, b) {
		return {
			ab: config.scenes[a].links?.find((l) => l.to === b) ?? null,
			ba: config.scenes[b].links?.find((l) => l.to === a) ?? null
		};
	}

	function createEdge(a, b) {
		if (a === b) return;
		const { ab, ba } = linkObjs(a, b);
		if (ab && ba) return; // already connected — leave it (click the edge to edit arrows)
		const def = (yawSeed) => ({ yaw: yawSeed, pitch: -35, rotation: 0, lookYaw: 0, lookPitch: -5 });
		if (!ab) config.scenes[a].links.push({ ...def(0), to: b });
		if (!ba) config.scenes[b].links.push({ ...def(180), to: a });
		touch();
		rebuildEdges();
		scheduleSave();
	}

	function deleteEdge(e) {
		config.scenes[e.a].links = (config.scenes[e.a].links || []).filter((l) => l.to !== e.b);
		config.scenes[e.b].links = (config.scenes[e.b].links || []).filter((l) => l.to !== e.a);
		selectedEdge = null;
		touch();
		rebuildEdges();
		scheduleSave();
	}

	const edgeComplete = (e) => {
		const { ab, ba } = linkObjs(e.a, e.b);
		return ab && ba;
	};
	const edgeConfigured = (e) => {
		const { ab, ba } = linkObjs(e.a, e.b);
		return ab && ba && ab.configured && ba.configured;
	};
	const hasLinks = (i) => !!(config && config.scenes[i].links && config.scenes[i].links.length);
	// a node is "done" (green) when it has links and every edge touching it is configured
	function nodeDone(i) {
		if (!hasLinks(i)) return false;
		const touching = edges.filter((e) => e.a === i || e.b === i);
		return touching.length > 0 && touching.every((e) => edgeConfigured(e));
	}

	// edges drawn as a gentle arc so overlapping / nearby links are easy to tell apart.
	// edges always store a < b, so the bow direction is consistent. Takes the node objects
	// (not indices) so the template references `nodes` directly — otherwise Svelte can't see
	// the dependency and the edges freeze at their drawn position instead of tracking nodes.
	function edgeArc(p, q) {
		const dx = q.x - p.x, dy = q.y - p.y;
		const k = 0.14; // curvature: perpendicular bow as a fraction of the span
		const cx = (p.x + q.x) / 2 - dy * k;
		const cy = (p.y + q.y) / 2 + dx * k;
		return `M${p.x} ${p.y} Q${cx} ${cy} ${q.x} ${q.y}`;
	}

	// Hovering a room highlights its directly-connected ("related") neighbours so you can
	// see what it links to at a glance. A reactive set (not a helper) so the markup tracks it.
	$: neighbors = hoverNode == null
		? new Set()
		: new Set(edges.filter((e) => e.a === hoverNode || e.b === hoverNode).map((e) => (e.a === hoverNode ? e.b : e.a)));

	function openTour(id) {
		tourStart = id;
		tourCurrentScene = id;
		tourOpen = true;
	}
	function closeTour() {
		lastToured = tourCurrentScene; // enlarge the room you ended on
		tourOpen = false;
	}

	function openEditor(a, b) {
		selectedNode = null;
		selectedEdge = { a: Math.min(a, b), b: Math.max(a, b) };
		editorPair = selectedEdge;
	}

	// --- auto-save --------------------------------------------------------------
	// Graph edits (links, start, names) are persisted to localStorage keyed by scene id
	// (image-free, survives a refresh) and only published to GitHub via the Save & share panel.
	let uploadedIds = []; // scene ids in graph order, to map link `to` between indices and ids
	const idAt = (i) => uploadedIds[i];

	function saveEdits() {
		if (!config) return;
		saveEditState({
			start: idAt(config.start ?? 0) ?? null,
			scenes: config.scenes.map((s, i) => ({
				id: idAt(i),
				name: s.name,
				links: (s.links ?? []).map((l) => ({ ...l, to: idAt(l.to) }))
			}))
		});
	}

	// Re-apply persisted edits onto the freshly-built scenes, matching by scene id so it
	// survives reordering; link targets and start are remapped id → current index.
	function applyEdits() {
		const edits = loadEditState();
		if (!edits) return;
		const indexOfId = new Map(uploadedIds.map((id, i) => [id, i]));
		(edits.scenes ?? []).forEach((se) => {
			const i = indexOfId.get(se.id);
			if (i == null) return;
			if (typeof se.name === 'string') config.scenes[i].name = se.name;
			config.scenes[i].links = (se.links ?? [])
				.map((l) => ({ ...l, to: indexOfId.get(l.to) }))
				.filter((l) => l.to != null);
		});
		if (edits.start != null && indexOfId.has(edits.start)) config.start = indexOfId.get(edits.start);
	}

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveEdits, 400);
	}

	function onEditorClose() {
		editorPair = null;
		selectedEdge = null;
		touch();
		rebuildEdges();
		scheduleSave();
	}
	function onEditorDelete() {
		const p = editorPair;
		editorPair = null;
		deleteEdge(p);
	}

	// --- pointer interactions ---------------------------------------------------
	let drag = null;

	// Scrub the equirectangular thumbnail as you move across a node, to preview what's inside.
	function onNodeHover(e) {
		if (drag || linking) return;
		const r = e.currentTarget.getBoundingClientRect();
		hoverPan = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
		hoverPanY = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
	}

	function onNodePointerDown(e, node) {
		e.stopPropagation();
		if (linking) return;
		drag = { type: 'node', id: node.id, sx: e.clientX, sy: e.clientY, moved: false };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onHandlePointerDown(e, node) {
		e.stopPropagation();
		const g = localGraph(e);
		linking = { from: node.id, x: g.x, y: g.y };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onBackgroundPointerDown(e) {
		if (e.button !== 0) return;
		lastToured = null; // clicking the background deactivates the enlarged (last-toured) node
		selectedNode = null;
		drag = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function localGraph(e) {
		const r = wrap.getBoundingClientRect();
		return screenToGraph(e.clientX - r.left, e.clientY - r.top);
	}

	function onMove(e) {
		if (linking) {
			const g = localGraph(e);
			linking = { ...linking, x: g.x, y: g.y };
		} else if (drag?.type === 'node') {
			if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
				drag.moved = true;
				sim.alphaTarget(0.25).restart();
			}
			const g = localGraph(e);
			const n = nodes[drag.id];
			n.fx = g.x;
			n.fy = g.y;
			slotActive = Math.hypot(g.x - slot.x, g.y - slot.y) < R + 24;
		} else if (drag?.type === 'pan') {
			view = { ...view, tx: drag.tx + (e.clientX - drag.sx), ty: drag.ty + (e.clientY - drag.sy) };
		}
	}

	function onUp(e) {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		if (linking) {
			const target = nodeUnder(e.clientX, e.clientY);
			if (target != null && target !== linking.from) createEdge(linking.from, target);
			linking = null;
		} else if (drag?.type === 'node') {
			sim.alphaTarget(0);
			if (drag.moved) {
				const n = nodes[drag.id];
				if (Math.hypot(n.x - slot.x, n.y - slot.y) < R + 24) {
					assignStart(drag.id); // dropped into the start slot
				} else {
					n.fx = null; // release back into the live layout
					n.fy = null;
					if (config.start === drag.id) { config.start = null; touch(); }
					scheduleSave();
				}
			} else {
				openTour(drag.id); // a click (not a drag) → open the full tour
			}
		}
		slotActive = false;
		drag = null;
	}

	function nodeUnder(cx, cy) {
		const el = document.elementFromPoint(cx, cy)?.closest('[data-node]');
		return el ? +el.dataset.node : null;
	}

	function onWheel(e) {
		e.preventDefault();
		const r = wrap.getBoundingClientRect();
		const mx = e.clientX - r.left, my = e.clientY - r.top;
		const f = Math.exp(-e.deltaY * 0.0006); // gentle, proportional to scroll amount
		const k = Math.max(0.3, Math.min(3, view.k * f));
		const ratio = k / view.k;
		view = { k, tx: mx - (mx - view.tx) * ratio, ty: my - (my - view.ty) * ratio };
	}

	// Keep the layout compact and on-screen: clamp every node inside the viewport.
	function tick() {
		const left = 2 * R + 130, right = W - R - 16, top = R + 54, bot = H - R - 16;
		for (const n of nodes) {
			if (n.fx != null) continue; // pinned (e.g. docked in the start slot) — leave it
			n.x = Math.max(left, Math.min(right, n.x));
			n.y = Math.max(top, Math.min(bot, n.y));
		}
		nodes = nodes;
	}

	onMount(async () => {
		// Build the tour from the panoramas dropped on /create, then re-apply any saved edits.
		await loadPersisted();
		const list = get(uploadedScenes);
		uploadedIds = list.map((s) => s.id);
		config = { start: 0, scenes: list.map((s) => ({ name: s.name, image: s.url, thumb: s.thumbUrl, links: [] })) };
		applyEdits();
		const r = wrap.getBoundingClientRect();
		W = r.width; H = r.height;
		nodes = config.scenes.map((_, i) => ({ id: i }));
		nodes.forEach((n, i) => {
			const a = (i / nodes.length) * Math.PI * 2;
			n.x = W / 2 + Math.cos(a) * Math.min(W, H) * 0.32;
			n.y = H / 2 + Math.sin(a) * Math.min(W, H) * 0.32;
		});
		slot = { x: 130, y: H / 2 };
		if (Number.isInteger(config.start) && config.start < nodes.length) {
			nodes[config.start].fx = slot.x; // dock the saved start in the slot
			nodes[config.start].fy = slot.y;
		}
		sim = forceSimulation(nodes)
			.force('link', forceLink([]).id((d) => d.id).distance(205).strength(0.45))
			.force('charge', forceManyBody().strength(-280))
			.force('x', forceX(W / 2).strength(0.05))
			.force('y', forceY(H / 2).strength(0.09))
			.force('collide', forceCollide(R + 18).strength(1))
			.alphaDecay(0.05)
			.on('tick', tick);
		rebuildEdges();
		if (import.meta.env.DEV) window.__graph = () => ({ nodes: nodes.length, edges: edges.length, lastToured, editorPair, config });
	});

	onDestroy(() => sim?.stop());

	function onKey(e) {
		if (e.key === 'Escape') { selectedNode = null; selectedEdge = null; editorPair = null; }
	}
</script>

<svelte:window on:keydown={onKey} />

<div class="graph" bind:this={wrap} on:pointerdown={onBackgroundPointerDown} on:wheel={onWheel}>
	<svg class="edges">
		<g transform="translate({view.tx},{view.ty}) scale({view.k})">
			{#each edges as e (e.a + '-' + e.b)}
				{#if nodes[e.a] && nodes[e.b]}
					<path
						class="edge"
						class:sel={selectedEdge && selectedEdge.a === e.a && selectedEdge.b === e.b}
						class:partial={!edgeComplete(e)}
						class:done={edgeConfigured(e)}
						class:related={hoverNode != null && (e.a === hoverNode || e.b === hoverNode)}
						d={edgeArc(nodes[e.a], nodes[e.b])}
						on:pointerdown|stopPropagation={() => openEditor(e.a, e.b)}
					/>
				{/if}
			{/each}
			{#if linking && nodes[linking.from]}
				<line class="edge temp" x1={nodes[linking.from].x} y1={nodes[linking.from].y} x2={linking.x} y2={linking.y} />
			{/if}
		</g>
	</svg>

	<div class="nodes" style="transform: translate({view.tx}px,{view.ty}px) scale({view.k})">
		<div class="slot" class:active={slotActive} style="left:{slot.x}px; top:{slot.y}px"></div>
		{#each nodes as n (n.id)}
			<div
				class="node"
				class:hover={hoverNode === n.id}
				class:related={neighbors.has(n.id)}
				class:toured={lastToured === n.id}
				class:active={hasLinks(n.id) && !nodeDone(n.id)}
				class:done={nodeDone(n.id)}
				data-node={n.id}
				style="left:{n.x}px; top:{n.y}px"
				on:pointerdown={(e) => onNodePointerDown(e, n)}
				on:pointermove={onNodeHover}
				on:pointerenter={() => { hoverNode = n.id; hoverPan = 0.5; hoverPanY = 0.5; }}
				on:pointerleave={() => { if (hoverNode === n.id) hoverNode = null; }}
				role="button"
				tabindex="-1"
			>
				<div class="thumb" style="background-image:url({thumbFor(n.id)}); background-position:{n.id === hoverNode ? hoverPan * 100 : 50}% {n.id === hoverNode ? hoverPanY * 100 : 50}%"></div>
				{#if config.start === n.id}<span class="star" title="start scene">★</span>{/if}
				<div class="handle" title="drag to another room to link" on:pointerdown={(e) => onHandlePointerDown(e, n)}></div>
			</div>
		{/each}
	</div>

	<div class="bar">
		<strong>Tour map</strong>
		<span class="muted">{config ? config.scenes.length : 0} rooms · {edges.length} links</span>
		<span class="status">{status}</span>
	</div>

	{#if config}
		<div class="share-panel">
			<SaveShare {buildPublishConfig} />
			<DownloadHost {buildPublishConfig} getBlobs={sceneBlobs} />
		</div>
	{/if}

</div>

{#if editorPair && config}
	<LinkEditor {config} pair={editorPair} on:change={scheduleSave} on:delete={onEditorDelete} on:close={onEditorClose} />
{/if}

{#if tourOpen && config}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="tourmodal" on:pointerdown|self={closeTour}>
		<div class="tourbox">
			<button class="closebtn" on:click={closeTour}>✕ Close</button>
			{#key tourStart}
				<TourPlayer {config} start={tourStart} on:navigate={(e) => (tourCurrentScene = e.detail)} />
			{/key}
		</div>
	</div>
{/if}

<style>
	.graph { position: fixed; inset: 0; z-index: 50; overflow: hidden; background: #f5f6fb; color: #383874; font: 13px/1.4 system-ui, sans-serif; touch-action: none; cursor: grab; user-select: none; }
	.edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.edge { stroke: #9a45d7; stroke-width: 3; opacity: 0.9; cursor: pointer; fill: none; stroke-linecap: round; }
	.edge:hover { stroke-width: 5; opacity: 1; }
	.edge.sel { stroke: #9a45d7; stroke-width: 5; opacity: 1; }
	.edge.partial { stroke: #d4d5e6; stroke-width: 2; opacity: 1; }
	.edge.done { stroke: #20b15f; stroke-width: 3.5; opacity: 1; }
	.edge.related { stroke-width: 5.5; opacity: 1; }
	.edge.temp { stroke: #9a45d7; stroke-dasharray: 5 7; pointer-events: none; opacity: 0.75; }

	.share-panel { position: absolute; top: 52px; right: 14px; width: 168px; z-index: 40; display: flex; flex-direction: column; gap: 8px; }
	.nodes { position: absolute; inset: 0; transform-origin: 0 0; pointer-events: none; }
	.slot { position: absolute; width: 142px; height: 142px; box-sizing: border-box; transform: translate(-50%, -50%); border-radius: 50%; border: 3px dashed #c4b0e6; pointer-events: none; }
	.slot::after { content: 'START'; position: absolute; left: 50%; bottom: -24px; transform: translateX(-50%); color: #9a45d7; font: 700 11px/1 system-ui, sans-serif; letter-spacing: 1.5px; white-space: nowrap; }
	.slot.active { border-style: solid; border-color: #9a45d7; background: rgba(154, 69, 215, 0.12); box-shadow: 0 0 0 7px rgba(154, 69, 215, 0.18); transform: translate(-50%, -50%) scale(1.12); transition: transform 0.08s; }
	.slot.active::after { content: 'DROP HERE'; }
	.node { position: absolute; width: 132px; height: 132px; transform: translate(-50%, -50%); cursor: grab; pointer-events: auto; }
	.thumb { width: 132px; height: 132px; box-sizing: border-box; border-radius: 50%; background-color: #fff; background-size: auto 255%; background-position: 50% 50%; background-repeat: no-repeat; border: 4px solid #dcdce0; box-shadow: 0 0 0 5px #fff, 0 10px 26px rgba(56, 56, 116, 0.16), 0 3px 8px rgba(56, 56, 116, 0.1); filter: brightness(1.16) saturate(1.14) contrast(1.03); transition: border-color 0.12s; }
	.node.active .thumb { border-color: #9a45d7; }
	.node.done .thumb { border-color: #20b15f; }
	.node.hover .thumb { box-shadow: 0 0 0 5px #fff, 0 0 0 9px rgba(122, 162, 255, 0.28), 0 10px 26px rgba(56, 56, 116, 0.16); }
	.node.related .thumb { box-shadow: 0 0 0 5px #fff, 0 0 0 9px rgba(122, 162, 255, 0.5), 0 10px 26px rgba(56, 56, 116, 0.16); }
	.node.toured { transform: translate(-50%, -50%) scale(1.4); z-index: 6; }
	.node.toured .thumb { box-shadow: 0 0 0 5px #fff, 0 0 0 11px rgba(56, 56, 116, 0.3), 0 16px 38px rgba(56, 56, 116, 0.34); }
	.node .star { position: absolute; top: 6px; left: 10px; background: #9a45d7; color: #fff; font-size: 12px; font-weight: 800; border-radius: 50%; width: 26px; height: 26px; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(154, 69, 215, 0.5); }
	.node .handle { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; border-radius: 50%; background: #9a45d7; border: 2px solid #fff; opacity: 0; cursor: crosshair; box-shadow: 0 2px 6px rgba(56, 56, 116, 0.35); }
	.node.hover .handle { opacity: 1; }

	.bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 12px; padding: 14px 18px; }
	.bar strong { font-size: 15px; color: #383874; }
	.bar .status { color: #5a5a89; }
	.muted { color: #9a9ab8; }

	.tourmodal { position: fixed; inset: 0; z-index: 60; background: #000; }
	.tourbox { position: absolute; inset: 0; overflow: hidden; background: #000; }
	.closebtn { position: absolute; top: 14px; right: 14px; z-index: 1000; background: rgba(255, 255, 255, 0.92); border: none; border-radius: 9px; padding: 10px 16px; cursor: pointer; font: 600 13px system-ui, sans-serif; color: #383874; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25); }
</style>
