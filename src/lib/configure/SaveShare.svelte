<script>
	import { scenes as uploadedScenes } from '$lib/create/uploadStore.js';

	/**
	 * "Save & share" panel.
	 *
	 * On click it:
	 *   1. uploads each scene's WebP blob to GitHub via POST /api/upload,
	 *   2. asks POST /api/publish to commit the final tour config,
	 *   3. shows a shareable {origin}/t/{id} link with copy-to-clipboard.
	 *
	 * The GitHub token never reaches the browser — both calls go to our server
	 * endpoints. All in-progress / error / retry states are surfaced here.
	 *
	 * `buildPublishConfig(imageUrls)` is supplied by the configurator and returns
	 * the final tour config with the committed image URLs filled in.
	 */
	export let buildPublishConfig;

	let status = 'idle'; // idle | uploading | publishing | done | error
	let progress = { done: 0, total: 0 };
	let shareUrl = '';
	let errorMessage = '';
	let copied = false;

	// A unique tour id: timestamp + short random suffix (sortable, collision-safe).
	function makeTourId() {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result;
				resolve(String(result).split(',')[1]); // strip the data: prefix
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	}

	async function uploadImage(tourId, index, scene) {
		const base64 = await blobToBase64(scene.blob);
		const response = await fetch('/api/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tourId, index, contentBase64: base64 })
		});
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || `Upload failed (${response.status})`);
		}
		return data.url;
	}

	async function publishConfig(tourId, config) {
		const response = await fetch('/api/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tourId, config })
		});
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || `Publish failed (${response.status})`);
		}
		return data;
	}

	async function saveAndShare() {
		const list = $uploadedScenes;
		if (list.length === 0) {
			status = 'error';
			errorMessage = 'There are no scenes to publish.';
			return;
		}

		errorMessage = '';
		copied = false;
		const tourId = makeTourId();
		status = 'uploading';
		progress = { done: 0, total: list.length };

		try {
			const imageUrls = [];
			for (let index = 0; index < list.length; index++) {
				const url = await uploadImage(tourId, index, list[index]);
				imageUrls.push(url);
				progress = { done: index + 1, total: list.length };
			}

			status = 'publishing';
			const config = buildPublishConfig(imageUrls);
			const result = await publishConfig(tourId, config);

			shareUrl = `${window.location.origin}/t/${result.id ?? tourId}`;
			status = 'done';
		} catch (error) {
			status = 'error';
			errorMessage = error.message;
		}
	}

	async function copyLink() {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="save-share">
	{#if status === 'idle' || status === 'error'}
		<button class="primary" data-testid="save-share" on:click={saveAndShare}>
			<span class="lbl">{status === 'error' ? 'Retry save & share' : 'Save & share'}</span>
			<span class="sub">free for now</span>
		</button>
	{/if}

	{#if status === 'uploading'}
		<div class="progress" data-testid="upload-progress">
			Uploading panoramas… {progress.done}/{progress.total}
		</div>
	{/if}

	{#if status === 'publishing'}
		<div class="progress">Publishing tour config…</div>
	{/if}

	{#if status === 'error'}
		<div class="error" data-testid="save-error">{errorMessage}</div>
	{/if}

	{#if status === 'done'}
		<div class="done">
			<p class="done-label">Your tour is live</p>
			<div class="link-row">
				<input class="share-input" data-testid="share-url" readonly value={shareUrl} />
				<button class="copy" on:click={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
			</div>
			<a class="open-link" href={shareUrl} target="_blank" rel="noreferrer">Open tour ↗</a>
		</div>
	{/if}
</div>

<style>
	/* No card chrome — just a floating button; feedback gets its own small panel below. */
	.save-share {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.primary {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 7px 9px;
		border: none;
		border-radius: 8px;
		background: #2563eb;
		color: #fff;
		cursor: pointer;
		box-shadow: 0 1px 5px rgba(37, 99, 235, 0.35);
	}
	.primary:hover {
		background: #1d4ed8;
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
		color: #fcd34d; /* amber on blue → "temporary" */
	}
	.progress {
		font-size: 12px;
		color: #374151;
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
	}
	.done {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 10px;
	}
	.done-label {
		font-weight: 600;
		color: #047857;
		margin: 0 0 6px;
		font-size: 13px;
	}
	.link-row {
		display: flex;
		gap: 6px;
	}
	.share-input {
		flex: 1;
		min-width: 0;
		padding: 6px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 11px;
	}
	.copy {
		padding: 6px 10px;
		border: 1px solid #2563eb;
		background: #2563eb;
		color: #fff;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
	}
	.open-link {
		display: inline-block;
		margin-top: 8px;
		color: #2563eb;
		font-size: 12px;
		text-decoration: none;
	}
	.open-link:hover {
		text-decoration: underline;
	}
</style>
