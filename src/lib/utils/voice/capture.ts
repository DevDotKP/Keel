// Voice capture via browser Web Speech API.
// Strong on Android/Chrome. Graceful fallback to typing on iOS Safari.

export interface CaptureResult {
	transcript: string;
	confidence: number; // 0–1
}

// How long to keep listening after the user stops talking, and a hard ceiling.
// Short so capture ends promptly once speech stops; the user can also stop manually.
const SILENCE_MS = 2_500;
const MAX_MS = 30_000;

/** True when Web Speech API is available (Android/Chrome; false on iOS Safari). */
export function isSpeechSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/** iOS Safari mishandles continuous recognition; capture a single utterance there. */
function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	return (
		/iP(hone|ad|od)/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

/**
 * Start a voice capture session.
 * Recognises Indian English (en-IN), which also copes with Hinglish, and returns
 * a lowercased, trimmed transcript. Listens until the user pauses for SILENCE_MS
 * (or MAX_MS total), so a normal sentence with mid-thought pauses is not cut off.
 * Rejects on recognition error or if the Speech API is unavailable.
 */
export function captureOnce(options: { signal?: AbortSignal } = {}): Promise<CaptureResult> {
	if (!isSpeechSupported()) {
		return Promise.reject(new Error('Speech API not available on this device'));
	}

	return new Promise((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
		const rec = new SR();

		// English output (the user speaks English; en-IN also handles Hinglish).
		rec.lang = 'en-IN';
		// iOS Safari behaves erratically in continuous mode (the stop control
		// gets out of sync), so there we capture a single utterance and let
		// recognition end itself. Android/Chrome keep continuous capture.
		const ios = isIOS();
		rec.continuous = !ios;
		rec.interimResults = true;
		rec.maxAlternatives = 1;

		let finalTranscript = '';
		let bestConfidence = 0;
		let settled = false;
		let silenceTimer: ReturnType<typeof setTimeout> | undefined;
		let hardCap: ReturnType<typeof setTimeout> | undefined;
		let stopping = false; // true once we asked it to stop, so onerror ignores 'aborted'

		// Manual stop: the user tapped the stop control. Finalize with whatever we
		// have so far (onend resolves it).
		function onAbort() {
			stopping = true;
			try {
				rec.stop();
			} catch {
				/* ignore */
			}
		}
		if (options.signal) {
			if (options.signal.aborted) onAbort();
			else options.signal.addEventListener('abort', onAbort, { once: true });
		}

		function clearTimers() {
			if (silenceTimer) clearTimeout(silenceTimer);
			if (hardCap) clearTimeout(hardCap);
			options.signal?.removeEventListener('abort', onAbort);
		}

		// Stop after a pause; onend then resolves with what we have.
		function armSilence() {
			if (silenceTimer) clearTimeout(silenceTimer);
			silenceTimer = setTimeout(() => {
				stopping = true;
				try {
					rec.stop();
				} catch {
					/* ignore */
				}
			}, SILENCE_MS);
		}

		function finish(fn: () => void) {
			if (settled) return;
			settled = true;
			clearTimers();
			fn();
		}

		rec.onresult = (event: SpeechRecognitionEvent) => {
			// Recompute the full final transcript from all results on each event.
			// Chrome can redeliver the same final segment across multiple onresult
			// events; accumulating with += duplicated it (the "logged thrice" bug).
			let assembled = '';
			let conf = 0;
			for (let i = 0; i < event.results.length; i++) {
				const res = event.results[i];
				if (res.isFinal) {
					assembled += res[0].transcript;
					conf = Math.max(conf, res[0].confidence ?? 0);
				}
			}
			finalTranscript = assembled;
			bestConfidence = conf;
			armSilence(); // reset the pause countdown while speech keeps arriving
		};

		rec.onerror = (event: SpeechRecognitionErrorEvent) => {
			// We asked it to stop after silence: that's a normal finish, not an error.
			if (stopping && (event.error === 'aborted' || event.error === 'no-speech')) return;
			finish(() => {
				try {
					rec.abort();
				} catch {
					/* ignore */
				}
				reject(new Error(event.error === 'no-speech' ? 'No speech detected' : event.error));
			});
		};

		rec.onend = () => {
			const text = finalTranscript.trim();
			finish(() => {
				if (text) resolve({ transcript: text.toLowerCase(), confidence: bestConfidence || 1 });
				// User-initiated stop with nothing captured: a silent cancel, not an error.
				else if (options.signal?.aborted) reject(new Error('cancelled'));
				else reject(new Error('No speech detected'));
			});
		};

		try {
			rec.start();
			armSilence();
			hardCap = setTimeout(() => {
				stopping = true;
				try {
					rec.stop();
				} catch {
					/* ignore */
				}
			}, MAX_MS);
		} catch (e) {
			finish(() => reject(e instanceof Error ? e : new Error(String(e))));
		}
	});
}
