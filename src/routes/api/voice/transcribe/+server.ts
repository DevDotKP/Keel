import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// iOS Safari's Web Speech API is unreliable, so on those devices the client
// records audio and posts it here. We transcribe with Whisper on Cloudflare
// Workers AI (the user's own account, free tier), then hand the text back to the
// same anchor engine the tap/Web-Speech path uses. Audio is never stored.
const MAX_BYTES = 5_000_000; // ~5 MB; the client also caps recording length.

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.userId) throw error(401, 'Sign in required');

	const ai = platform?.env?.AI;
	if (!ai) throw error(503, 'Transcription is not available right now.');

	const buf = await request.arrayBuffer();
	if (buf.byteLength === 0) throw error(400, 'No audio received');
	if (buf.byteLength > MAX_BYTES) throw error(413, 'Recording too long. Keep it short.');

	let text = '';
	try {
		// The base Whisper model takes raw bytes as an array of 0-255 ints.
		const result = (await ai.run('@cf/openai/whisper', {
			audio: [...new Uint8Array(buf)]
		})) as { text?: string };
		text = (result?.text ?? '').trim();
	} catch {
		throw error(502, 'Could not transcribe that. Try again or type it.');
	}

	return json({ text });
};
