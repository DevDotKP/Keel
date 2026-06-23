import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb, getReadDb } from '$lib/server/db';
import { getAdminMetrics } from '$lib/server/queries/admin-metrics';
import { ADMIN_COOKIE, checkCredentials, makeToken, verifyToken } from '$lib/server/admin';

export const load: PageServerLoad = async ({ platform, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const envUser = platform?.env?.ADMIN_USER;
	const envPass = platform?.env?.ADMIN_PASS;
	const configured = !!envUser && !!envPass;

	const authed = await verifyToken(cookies.get(ADMIN_COOKIE), envPass);
	if (!authed) return { authed: false, configured };

	const metrics = await getAdminMetrics(getReadDb(platform));
	return { authed: true, configured, metrics };
};

export const actions: Actions = {
	login: async ({ platform, cookies, request }) => {
		const envUser = platform?.env?.ADMIN_USER;
		const envPass = platform?.env?.ADMIN_PASS;
		if (!envUser || !envPass) return fail(503, { message: 'Admin is not configured on this deployment.' });

		const form = await request.formData();
		const user = String(form.get('user') ?? '');
		const pass = String(form.get('pass') ?? '');
		if (!checkCredentials(user, pass, envUser, envPass)) {
			return fail(401, { message: 'Wrong username or password.' });
		}

		cookies.set(ADMIN_COOKIE, await makeToken(envPass), {
			path: '/admin',
			httpOnly: true,
			secure: !dev,
			sameSite: 'strict',
			maxAge: 60 * 60 * 12
		});
		return { ok: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(ADMIN_COOKIE, { path: '/admin' });
		return { ok: true };
	},

	addRelease: async ({ platform, cookies, request }) => {
		const envPass = platform?.env?.ADMIN_PASS;
		if (!(await verifyToken(cookies.get(ADMIN_COOKIE), envPass))) return fail(403, { message: 'Not signed in.' });
		const form = await request.formData();
		const note = String(form.get('note') ?? '').trim();
		if (!note) return fail(400, { message: 'Enter a note.' });
		await getDb(platform).prepare('INSERT INTO releases (note) VALUES (?)').bind(note.slice(0, 280)).run();
		return { ok: true };
	}
};
