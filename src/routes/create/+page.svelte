<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Meta from '$lib/Meta.svelte';
	import { processPanorama } from '$lib/create/imageProcessing.js';
	import {
		scenes,
		addScene,
		removeScene,
		reorderScene,
		renameScene,
		loadPersisted,
		clearScenes
	} from '$lib/create/uploadStore.js';

	let dragOver = false;
	let fileInput;
	let processing = false;
	let processingError = '';
	let dragIndex = null; // index being reordered

	onMount(loadPersisted);

	// The create screen restores the panoramas from the last session, so a fresh tour needs an
	// explicit reset — the user decides when to discard the current one and start over.
	function startNewTour() {
		if (!confirm('Start a new tour? This removes the current panoramas and links.')) return;
		clearScenes();
	}

	async function handleFiles(fileList) {
		const files = [...fileList].filter((file) => file.type.startsWith('image/'));
		if (files.length === 0) return;
		processing = true;
		processingError = '';
		// Sequential so very large panoramas don't blow up memory all at once.
		for (const file of files) {
			try {
				const processed = await processPanorama(file);
				await addScene(processed);
			} catch (error) {
				processingError = error.message;
			}
		}
		processing = false;
	}

	function onDrop(event) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files);
	}

	function onDragOver(event) {
		event.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onSelect(event) {
		handleFiles(event.target.files);
		event.target.value = '';
	}

	// --- thumbnail reordering (HTML5 drag) ---
	function onThumbDragStart(index) {
		dragIndex = index;
	}

	function onThumbDragOver(event) {
		event.preventDefault();
	}

	function onThumbDrop(index) {
		if (dragIndex !== null && dragIndex !== index) {
			reorderScene(dragIndex, index);
		}
		dragIndex = null;
	}

	function startConfiguring() {
		goto('/configure?source=uploaded');
	}

	$: canProceed = $scenes.length > 0 && !processing;

	// Structured data so search engines understand this is a free, browser-based tool.
	$: ldJson =
		'<script type="application/ld+json">' +
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: '360° Tour Generator',
			url: $page.url.origin + '/create',
			description:
				'Make a 360° virtual tour from your own photos and share it with a link — no account or install.',
			applicationCategory: 'MultimediaApplication',
			operatingSystem: 'Web',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
		}) +
		'<\/script>';
</script>

<Meta
	title="360° Tour Generator — virtual tours from your own photos"
	description="Upload your 360° photos, link the rooms together on a simple map, and share a virtual tour anyone can walk through in their browser. No account, nothing to install."
/>
<svelte:head>
	{@html ldJson}
</svelte:head>

<section class="create">
	<header class="head">
		<h1>Create a 360° tour</h1>
		{#if $scenes.length > 0}
			<button class="new-tour" on:click={startNewTour} data-testid="new-tour">Start new tour</button>
		{/if}
	</header>

	<div
		class="dropzone"
		class:over={dragOver}
		on:drop={onDrop}
		on:dragover={onDragOver}
		on:dragleave={onDragLeave}
		role="button"
		tabindex="0"
		on:click={() => fileInput.click()}
		on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
		data-testid="dropzone"
	>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="file-input"
			on:change={onSelect}
			data-testid="file-input"
		/>
		<div class="dz-inner">
			<div class="dz-icon">⤓</div>
			<p class="dz-title">Drag &amp; drop panoramas here</p>
			<p class="dz-sub">or click to choose files</p>
		</div>
	</div>

	{#if processing}
		<div class="status">Processing images…</div>
	{/if}
	{#if processingError}
		<div class="status error">{processingError}</div>
	{/if}

	{#if $scenes.length > 0}
		<div class="grid-head">
			<h2>{$scenes.length} panorama{$scenes.length === 1 ? '' : 's'}</h2>
			<p class="reorder-hint">Drag thumbnails to reorder.</p>
		</div>
		<ul class="thumbs">
			{#each $scenes as scene, index (scene.id)}
				<li
					class="thumb-card"
					class:dragging={dragIndex === index}
					draggable="true"
					on:dragstart={() => onThumbDragStart(index)}
					on:dragover={onThumbDragOver}
					on:drop={() => onThumbDrop(index)}
					data-testid="thumb"
				>
					<img src={scene.thumbUrl ?? scene.url} alt={scene.name} />
					<div class="thumb-meta">
						<input
							class="name-input"
							value={scene.name}
							on:input={(e) => renameScene(scene.id, e.target.value)}
						/>
						<span class="dims">
							{scene.width}×{scene.height}{scene.scaled ? ' (resized)' : ''}
						</span>
					</div>
					<button class="remove" on:click|stopPropagation={() => removeScene(scene.id)} aria-label="Remove">×</button>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<button class="proceed" disabled={!canProceed} on:click={startConfiguring} data-testid="start-configuring">
				Start configuring →
			</button>
		</div>
	{/if}
</section>

<style>
	.create {
		max-width: 1000px;
		margin: 0 auto;
		padding: 40px 20px 80px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	.head h1 {
		font-size: 32px;
		font-weight: 700;
		margin: 0;
	}
	.new-tour {
		padding: 8px 14px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: #fff;
		color: #374151;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.new-tour:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}
	.dropzone {
		border: 2px dashed #c4c9d4;
		border-radius: 16px;
		padding: 56px 24px;
		text-align: center;
		cursor: pointer;
		background: #fafbff;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.dropzone.over {
		border-color: #2563eb;
		background: #eff4ff;
	}
	.file-input {
		display: none;
	}
	.dz-icon {
		font-size: 40px;
		color: #2563eb;
		margin-bottom: 8px;
	}
	.dz-title {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
	}
	.dz-sub {
		color: #6b7280;
		margin: 4px 0 0;
	}
	.status {
		margin-top: 16px;
		font-size: 14px;
		color: #374151;
	}
	.status.error {
		color: #9b1c1c;
	}
	.grid-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin: 32px 0 12px;
	}
	.grid-head h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
	}
	.reorder-hint {
		color: #6b7280;
		font-size: 13px;
		margin: 0;
	}
	.thumbs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 16px;
	}
	.thumb-card {
		position: relative;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		background: #fff;
		cursor: grab;
	}
	.thumb-card.dragging {
		opacity: 0.5;
	}
	.thumb-card img {
		width: 100%;
		height: 110px;
		object-fit: cover;
		display: block;
	}
	.thumb-meta {
		padding: 8px 10px 10px;
	}
	.name-input {
		width: 100%;
		border: none;
		border-bottom: 1px solid #e5e7eb;
		font-size: 14px;
		padding: 2px 0;
		margin-bottom: 4px;
	}
	.name-input:focus {
		outline: none;
		border-color: #2563eb;
	}
	.dims {
		font-size: 12px;
		color: #6b7280;
	}
	.remove {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}
	.actions {
		margin-top: 32px;
	}
	.proceed {
		padding: 14px 28px;
		border: none;
		border-radius: 10px;
		background: #2563eb;
		color: #fff;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
	}
	.proceed:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}
</style>
