<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import LinkPane from './LinkPane.svelte';
	import { normalizeYaw } from '$lib/tour/grid.js';
	import { sceneName } from './util.js';

	export let config;
	export let pair; // { a, b }

	const dispatch = createEventDispatcher();
	const name = (i) => sceneName(config, i);
	const r1 = (n) => Math.round(n * 10) / 10;

	$: a = pair.a;
	$: b = pair.b;
	$: ab = config.scenes[a].links.find((l) => l.to === b);
	$: ba = config.scenes[b].links.find((l) => l.to === a);

	// Arrival view: face into the room (opposite the door leading back).
	function deriveArrival() {
		if (ab && ba) {
			ab.lookYaw = r1(normalizeYaw(ba.yaw + 180));
			ab.lookPitch = -5;
			ba.lookYaw = r1(normalizeYaw(ab.yaw + 180));
			ba.lookPitch = -5;
		}
	}
	function onChange() {
		deriveArrival();
		config = config;
		dispatch('change');
	}
	function close() {
		dispatch('close');
	}

	onMount(deriveArrival);
</script>

<div class="overlay" on:pointerdown|self={close} role="presentation">
	<div class="editor">
		<header>
			<strong>{name(a)} ⇄ {name(b)}</strong>
			<span class="muted">click the floor in each room to place its arrow · drag to look · drag the arrow to fine-tune</span>
			<div class="spacer"></div>
			<button class="danger" on:click={() => dispatch('delete')}>Delete link</button>
			<button class="primary" on:click={close}>Done</button>
		</header>
		<div class="panes">
			<section>
				<h4><span class="dir">▸</span> {name(a)} → {name(b)}</h4>
				<div class="v">{#if ab}<LinkPane image={config.scenes[a].image} arrow={ab} on:change={onChange} />{/if}</div>
			</section>
			<section>
				<h4><span class="dir">◂</span> {name(b)} → {name(a)}</h4>
				<div class="v">{#if ba}<LinkPane image={config.scenes[b].image} arrow={ba} on:change={onChange} />{/if}</div>
			</section>
		</div>
	</div>
</div>

<style>
	.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(56, 56, 116, 0.4); display: grid; place-items: center; }
	.editor { width: 94vw; height: 88vh; display: flex; flex-direction: column; background: #fff; border: 1px solid #e3e3ee; border-radius: 16px; overflow: hidden; color: #383874; font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 24px 70px rgba(56, 56, 116, 0.35); }
	header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #ededf4; background: #f5f6fb; }
	.muted { color: #9a9ab8; }
	.spacer { flex: 1; }
	.panes { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e3e3ee; min-height: 0; }
	section { display: flex; flex-direction: column; background: #0c0c0e; min-height: 0; }
	h4 { margin: 0; padding: 9px 14px; font-size: 13px; background: #f5f6fb; color: #383874; border-bottom: 1px solid #ededf4; }
	.dir { color: #9a45d7; }
	.v { flex: 1; min-height: 0; }
	button.primary { background: #9a45d7; border: 1px solid #9a45d7; color: #fff; padding: 7px 16px; border-radius: 9px; cursor: pointer; font: inherit; font-weight: 600; }
	button.danger { background: #fff; border: 1px solid #e3b5b5; color: #c0392b; padding: 7px 14px; border-radius: 9px; cursor: pointer; font: inherit; }
</style>
