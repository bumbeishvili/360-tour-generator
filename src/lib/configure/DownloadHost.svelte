<script>
	import { buildTourZip, exportImagePath } from '$lib/create/exportTour.js';

	/**
	 * "Download & host" panel.
	 *
	 * Packages the tour entirely in the browser — no server, no GitHub — into a ZIP holding
	 * the panoramas, the tour config, and a standalone index.html. The user unzips it to a
	 * folder and either opens index.html directly or hosts the folder anywhere.
	 *
	 * `buildPublishConfig(imageUrls)` (shared with Save & share) returns the tour config with
	 * the given relative image paths filled in. `getBlobs()` resolves to the scene image blobs
	 * in order — in-memory for an uploaded tour, fetched from the served URLs for a saved one.
	 */
	export let buildPublishConfig;
	export let getBlobs;

	let status = 'idle'; // idle | building | done | error
	let errorMessage = '';

	async function downloadTour() {
		status = 'building';
		errorMessage = '';
		try {
			const blobs = await getBlobs();
			if (blobs.length === 0) {
				status = 'error';
				errorMessage = 'There are no scenes to download.';
				return;
			}
			const config = buildPublishConfig(blobs.map((blob, i) => exportImagePath(i, blob.type)));
			const zip = await buildTourZip(blobs.map((blob) => ({ blob })), config);

			const url = URL.createObjectURL(zip);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'tour.zip';
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);

			status = 'done';
		} catch (error) {
			status = 'error';
			errorMessage = error.message;
		}
	}
</script>

<div class="download-host">
	<button class="secondary" data-testid="download-host" on:click={downloadTour} disabled={status === 'building'}>
		{#if status === 'building'}
			<span class="lbl">Packaging…</span>
		{:else}
			<span class="lbl">{status === 'done' ? 'Download again' : 'Download & host'}</span>
			<span class="sub">free forever ∞</span>
		{/if}
	</button>

	{#if status === 'done'}
		<p class="hint" data-testid="download-done">Saved <strong>tour.zip</strong> — unzip it, then open <code>index.html</code>.</p>
	{/if}
	{#if status === 'error'}
		<div class="error" data-testid="download-error">{errorMessage}</div>
	{/if}
</div>

<style>
	/* No card chrome — just a floating button; feedback gets its own small panel below. */
	.download-host {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	code {
		background: #eef0f4;
		border-radius: 4px;
		padding: 0 4px;
		font-size: 11px;
	}
	.secondary {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 7px 9px;
		border: 1px solid #2563eb;
		border-radius: 8px;
		background: #fff;
		color: #2563eb;
		cursor: pointer;
		box-shadow: 0 1px 5px rgba(56, 56, 116, 0.14);
	}
	.secondary:hover:not(:disabled) {
		background: #eff4ff;
	}
	.secondary:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.lbl {
		font-size: 13px;
		font-weight: 600;
	}
	/* the price is baked into the button so it clearly belongs to this action */
	.sub {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: #059669; /* solid green → "always free" */
	}
	.hint {
		font-size: 11.5px;
		color: #374151;
		margin: 0;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 8px 10px;
	}
	.error {
		background: #fde8e8;
		color: #9b1c1c;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 12px;
		margin: 0;
	}
</style>
