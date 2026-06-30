<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { ChevronLeft } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let displayName = $state(untrack(() => data.user?.display_name ?? ''));
	let profileError = $state<string | null>(null);
	let avatarBusy = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleteConfirmText = $state('');
	let deleteBusy = $state(false);

	const CROP_VP = 240;
	let cropOpen = $state(false);
	let cropSrc = $state('');
	let imgW = $state(0);
	let imgH = $state(0);
	let zoom = $state(1);
	let offX = $state(0);
	let offY = $state(0);
	let cropBusy = $state(false);
	let dragging = false;
	let lastX = 0;
	let lastY = 0;

	let renderW = $derived(imgW ? imgW * (CROP_VP / Math.min(imgW, imgH)) * zoom : 0);
	let renderH = $derived(imgH ? imgH * (CROP_VP / Math.min(imgW, imgH)) * zoom : 0);

	// Smallest zoom that still fits the whole photo inside the circle (contain).
	// 1 for a square; below 1 for a non-square, so the user can zoom out to fit.
	let minZoom = $derived(imgW && imgH ? Math.min(imgW, imgH) / Math.max(imgW, imgH) : 1);

	function clampOffsets() {
		// Zoomed out past cover: centre the photo (padding shows). Otherwise keep it
		// covering the circle so no empty edge slips in.
		offX = renderW <= CROP_VP ? (CROP_VP - renderW) / 2 : Math.min(0, Math.max(CROP_VP - renderW, offX));
		offY = renderH <= CROP_VP ? (CROP_VP - renderH) / 2 : Math.min(0, Math.max(CROP_VP - renderH, offY));
	}

	function initials(name: string | null | undefined, email: string | null | undefined): string {
		const base = (name && name.trim()) || (email ? email.split('@')[0] : '');
		const parts = base.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}

	async function patchProfile(fields: Record<string, unknown>): Promise<boolean> {
		const res = await fetch('/api/profile', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		if (!res.ok) {
			profileError = 'Could not save. Try again.';
			return false;
		}
		await invalidateAll();
		return true;
	}

	async function saveDisplayName() {
		profileError = null;
		const name = displayName.trim();
		if (name === (data.user?.display_name ?? '')) return;
		await patchProfile({ display_name: name || null });
	}

	function onAvatarFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		profileError = null;
		if (!file.type.startsWith('image/')) { profileError = 'Choose an image file.'; return; }
		if (file.size > 8 * 1024 * 1024) { profileError = 'Image too large. Max 8 MB.'; return; }
		const reader = new FileReader();
		reader.onerror = () => (profileError = 'Could not read that image.');
		reader.onload = () => {
			const src = reader.result as string;
			const img = new Image();
			img.onload = () => {
				cropSrc = src;
				imgW = img.naturalWidth;
				imgH = img.naturalHeight;
				zoom = 1;
				const ds = CROP_VP / Math.min(imgW, imgH);
				offX = (CROP_VP - imgW * ds) / 2;
				offY = (CROP_VP - imgH * ds) / 2;
				cropOpen = true;
			};
			img.onerror = () => (profileError = 'Could not read that image. Try a JPEG or PNG.');
			img.src = src;
		};
		reader.readAsDataURL(file);
	}

	function cropPointerDown(e: PointerEvent) {
		dragging = true; lastX = e.clientX; lastY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function cropPointerMove(e: PointerEvent) {
		if (!dragging) return;
		offX += e.clientX - lastX; offY += e.clientY - lastY;
		lastX = e.clientX; lastY = e.clientY;
		clampOffsets();
	}
	function cropPointerUp() { dragging = false; }
	function onZoom(v: number) { zoom = v; clampOffsets(); }

	function renderCrop(out: number, quality: number): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const ds = (CROP_VP / Math.min(imgW, imgH)) * zoom;
				const sx = -offX / ds; const sy = -offY / ds; const s = CROP_VP / ds;
				const canvas = document.createElement('canvas');
				canvas.width = out; canvas.height = out;
				const ctx = canvas.getContext('2d');
				if (!ctx) return reject(new Error('no-canvas'));
				// Fill behind the photo so any padding (when zoomed out to fit) is white, not black.
				ctx.fillStyle = '#FFFFFF';
				ctx.fillRect(0, 0, out, out);
				ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.onerror = () => reject(new Error('decode'));
			img.src = cropSrc;
		});
	}

	function cancelCrop() { cropOpen = false; cropSrc = ''; }

	async function useCrop() {
		cropBusy = true; profileError = null;
		try {
			let dataUrl = await renderCrop(192, 0.82);
			if (dataUrl.length > 200_000) dataUrl = await renderCrop(144, 0.72);
			if (dataUrl.length > 200_000) {
				profileError = 'Could not compress that image. Try another.';
			} else {
				await patchProfile({ avatar: dataUrl });
				cropOpen = false; cropSrc = '';
			}
		} catch { profileError = 'Could not process the image.'; }
		cropBusy = false;
	}

	async function removeAvatar() {
		avatarBusy = true; profileError = null;
		await patchProfile({ avatar: null });
		avatarBusy = false;
	}

	async function handleSignOut() {
		await fetch('/api/auth/signout', { method: 'POST' });
		location.href = '/auth';
	}

	async function handleDeleteAccount() {
		deleteBusy = true;
		profileError = null;
		const res = await fetch('/api/auth/delete', { method: 'POST' });
		if (res.ok) {
			location.href = '/auth';
		} else {
			profileError = 'Could not delete account. Try again.';
			deleteBusy = false;
			deleteConfirmOpen = false;
		}
	}
</script>

<svelte:head>
	<title>Profile - Keel</title>
</svelte:head>

<div class="profile-page">
	<header class="profile-header">
		<a href="/settings" class="back-link">
			<ChevronLeft size={20} aria-hidden="true" />
			Settings
		</a>
	</header>

	<div class="avatar-block">
		<span class="avatar avatar--xl" aria-hidden="true">
			{#if data.user?.avatar}
				<img src={data.user.avatar} alt="" class="avatar-img" />
			{:else}
				{initials(data.user?.display_name, data.user?.email)}
			{/if}
		</span>
		<div class="avatar-actions">
			<label class="secondary-btn avatar-upload-btn">
				{avatarBusy ? 'Saving…' : data.user?.avatar ? 'Change photo' : 'Add photo'}
				<input type="file" accept="image/*" onchange={onAvatarFile} disabled={avatarBusy} hidden />
			</label>
			{#if data.user?.avatar}
				<button class="link-btn danger" onclick={removeAvatar} disabled={avatarBusy}>Remove</button>
			{/if}
		</div>
	</div>

	<div class="profile-fields">
		<div class="field">
			<label for="display-name">Display name</label>
			<input
				id="display-name"
				type="text"
				placeholder="Your name"
				bind:value={displayName}
				onblur={saveDisplayName}
				maxlength="60"
			/>
		</div>

		<div class="field">
			<p class="field-label">Email</p>
			<p class="email-display">{data.user?.email || ''}</p>
		</div>

		{#if profileError}
			<p class="error" role="alert">{profileError}</p>
		{/if}
	</div>

	<button class="sign-out-btn" onclick={handleSignOut}>Sign out</button>

	<div class="danger-zone">
		<p class="danger-label">Danger zone</p>
		<button
			class="delete-trigger"
			onclick={() => { deleteConfirmOpen = true; deleteConfirmText = ''; }}
		>
			Delete my account and all data
		</button>
	</div>
</div>

{#if deleteConfirmOpen}
	<div class="delete-backdrop" role="dialog" aria-modal="true" aria-label="Delete account">
		<div class="delete-card">
			<h2 class="delete-title">Delete your account?</h2>
			<p class="delete-body">
				All your entries, categories, and settings will be permanently deleted.
				We keep a small amount of anonymised data (no names, no amounts) for product analytics.
				This cannot be undone.
			</p>
			<p class="delete-confirm-label">Type <strong>DELETE</strong> to confirm</p>
			<input
				class="delete-input"
				type="text"
				placeholder="DELETE"
				bind:value={deleteConfirmText}
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
			/>
			<div class="delete-actions">
				<button class="secondary-btn" onclick={() => deleteConfirmOpen = false} disabled={deleteBusy}>
					Cancel
				</button>
				<button
					class="delete-confirm-btn"
					onclick={handleDeleteAccount}
					disabled={deleteBusy || deleteConfirmText !== 'DELETE'}
				>
					{deleteBusy ? 'Deleting…' : 'Delete account'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if cropOpen}
	<div class="crop-backdrop" role="dialog" aria-modal="true" aria-label="Position your photo">
		<div class="crop-card">
			<h2 class="crop-title">Position your photo</h2>
			<div
				class="crop-viewport"
				role="application"
				aria-label="Drag to reposition your photo"
				onpointerdown={cropPointerDown}
				onpointermove={cropPointerMove}
				onpointerup={cropPointerUp}
				onpointercancel={cropPointerUp}
			>
				<img
					class="crop-img"
					src={cropSrc}
					alt=""
					draggable="false"
					style="width:{renderW}px; height:{renderH}px; transform:translate({offX}px, {offY}px)"
				/>
			</div>
			<label class="crop-zoom">
				<span class="sr-only">Zoom</span>
				<input type="range" min={minZoom} max="3" step="0.01" value={zoom}
					oninput={(e) => onZoom(parseFloat(e.currentTarget.value))} />
			</label>
			<div class="crop-actions">
				<button class="secondary-btn" onclick={cancelCrop} disabled={cropBusy}>Cancel</button>
				<button class="crop-use" onclick={useCrop} disabled={cropBusy}>
					{cropBusy ? 'Saving…' : 'Use photo'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.profile-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		padding: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
		max-width: 480px;
		margin: 0 auto;
	}

	.profile-header {
		display: flex;
		align-items: center;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text-muted);
		text-decoration: none;
		min-height: var(--tap-target);
		margin-left: calc(var(--space-1) * -1);
	}

	.back-link:hover { color: var(--color-text); }

	.avatar-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4) 0;
	}

	.avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-muted);
		font-weight: 600;
		overflow: hidden;
		text-transform: uppercase;
	}

	.avatar--xl {
		width: 96px;
		height: 96px;
		font-size: 2rem;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.avatar-upload-btn { cursor: pointer; }

	.profile-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field label,
	.field-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		margin: 0;
	}

	.field input {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.field input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.email-display {
		height: 44px;
		display: flex;
		align-items: center;
		padding: 0 var(--space-3);
		font-size: 1rem;
		color: var(--color-text-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-subtle);
	}

	.error {
		font-size: 0.875rem;
		color: var(--color-clay);
	}

	.secondary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		padding: 0 var(--space-4);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		font-size: 0.9375rem;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.secondary-btn:hover { background: var(--color-surface-subtle); }
	.secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		font-family: inherit;
		color: var(--color-text-muted);
	}

	.link-btn.danger { color: var(--color-clay); }
	.link-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.sign-out-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		width: 100%;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
		font-family: inherit;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.sign-out-btn:hover { border-color: var(--color-text-subtle); }

	/* Crop dialog */
	.crop-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(12, 35, 64, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}

	.crop-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		width: min(320px, 100%);
		padding: var(--space-6);
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
	}

	.crop-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.crop-viewport {
		position: relative;
		width: 240px;
		height: 240px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--color-surface-subtle);
		touch-action: none;
		cursor: grab;
	}

	.crop-img {
		position: absolute;
		top: 0;
		left: 0;
		max-width: none;
		user-select: none;
		-webkit-user-drag: none;
	}

	.crop-zoom { width: 100%; }
	.crop-zoom input { width: 100%; accent-color: var(--color-gold); }

	.crop-actions { display: flex; gap: var(--space-3); width: 100%; }
	.crop-actions .secondary-btn { flex: 1; }

	.crop-use {
		flex: 1;
		height: 44px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
	}

	.crop-use:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Danger zone */
	.danger-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-6);
		border-top: 1px solid var(--color-border);
		margin-top: var(--space-4);
	}

	.danger-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-subtle);
	}

	.delete-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		width: 100%;
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--color-clay) 40%, transparent);
		border-radius: var(--radius-md);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-clay);
		cursor: pointer;
		font-family: inherit;
		transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
	}

	.delete-trigger:hover {
		background: color-mix(in srgb, var(--color-clay) 8%, transparent);
		border-color: var(--color-clay);
	}

	/* Delete confirmation modal */
	.delete-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: rgba(12, 35, 64, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}

	.delete-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: min(360px, 100%);
		padding: var(--space-6);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.delete-title {
		font-family: var(--font-display);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.delete-body {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.delete-confirm-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.delete-input {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
		letter-spacing: 0.1em;
	}

	.delete-input:focus { outline: none; border-color: var(--color-clay); }

	.delete-actions {
		display: flex;
		gap: var(--space-3);
	}

	.delete-actions .secondary-btn { flex: 1; }

	.delete-confirm-btn {
		flex: 1;
		height: 44px;
		background: var(--color-clay);
		color: #fff;
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.9375rem;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.delete-confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
