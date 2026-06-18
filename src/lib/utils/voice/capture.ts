// Voice capture via browser Web Speech API.
// Strong on Android/Chrome. Graceful fallback to typing on iOS Safari.

export interface CaptureResult {
	transcript: string;
	confidence: number; // 0–1
}

/** True when Web Speech API is available (Android/Chrome; false on iOS Safari). */
export function isSpeechSupported(): boolean {
	return typeof window !== 'undefined' && 'SpeechRecognition' in window ||
		(typeof window !== 'undefined' && 'webkitSpeechRecognition' in window);
}

/**
 * Start a single-utterance voice capture session.
 * Resolves with the transcript on success.
 * Rejects with an Error on recognition error or if Speech API is unavailable.
 *
 * Callers should catch and fall back to manual input on rejection.
 */
export function captureOnce(): Promise<CaptureResult> {
	// TODO(sonnet): construct SpeechRecognition (or webkitSpeechRecognition),
	// set lang = 'hi-IN' with en-IN fallback, interimResults = false,
	// maxAlternatives = 1. Wire onresult → resolve, onerror → reject.
	// Call .start() and return the promise.
	return Promise.reject(new Error('Not implemented'));
}
