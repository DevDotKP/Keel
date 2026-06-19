// Voice capture via browser Web Speech API.
// Strong on Android/Chrome. Graceful fallback to typing on iOS Safari.

export interface CaptureResult {
	transcript: string;
	confidence: number; // 0–1
}

/** True when Web Speech API is available (Android/Chrome; false on iOS Safari). */
export function isSpeechSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Start a single-utterance voice capture session.
 * Resolves with a lowercased, trimmed transcript on success.
 * Rejects with an Error on recognition error or if Speech API is unavailable.
 */
export function captureOnce(): Promise<CaptureResult> {
	if (!isSpeechSupported()) {
		return Promise.reject(new Error('Speech API not available on this device'));
	}

	return new Promise((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
		const rec = new SR();

		// Hindi-first so Chrome handles Hinglish well; English works too.
		rec.lang = 'hi-IN';
		rec.interimResults = false;
		rec.maxAlternatives = 1;
		rec.continuous = false;

		let settled = false;

		function done(fn: () => void) {
			if (settled) return;
			settled = true;
			fn();
		}

		rec.onresult = (event: SpeechRecognitionEvent) => {
			done(() => {
				const alt = event.results[0][0];
				resolve({
					transcript: alt.transcript.toLowerCase().trim(),
					confidence: alt.confidence ?? 1
				});
			});
		};

		rec.onerror = (event: SpeechRecognitionErrorEvent) => {
			done(() => {
				rec.abort();
				reject(new Error(event.error === 'no-speech' ? 'No speech detected' : event.error));
			});
		};

		rec.onnomatch = () => {
			done(() => reject(new Error('No speech detected')));
		};

		rec.onend = () => {
			// Fires after onresult too; only matters if we never settled.
			done(() => reject(new Error('No speech detected')));
		};

		try {
			rec.start();
		} catch (e) {
			done(() => reject(e instanceof Error ? e : new Error(String(e))));
		}
	});
}
