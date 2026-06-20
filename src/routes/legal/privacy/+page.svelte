<svelte:head>
	<title>Privacy Notice - Keel</title>
</svelte:head>

<div class="legal-page">
	<h1>Privacy Notice</h1>
	<p class="last-updated">Last updated: June 2026. Operated by Annapurna Labs.</p>

	<h2>The short version</h2>
	<p>
		Keel does not read your SMS messages, email, UPI notifications, or any data from your
		bank or phone. We never have and never will. Entry is always manual or by your own voice.
		Your money data stays private.
	</p>

	<h2>What we collect</h2>
	<p>
		We collect two things and nothing else: your email address (used only to send your
		magic sign-in link) and the expense entries you choose to add. We do not collect your
		name, phone number, payment instrument details, or device identifiers.
	</p>

	<h2>Voice entry</h2>
	<p>
		If you use voice to add an entry, the audio is processed entirely on your device by
		your browser's built-in speech API. We receive only the text transcript you confirm.
		No audio is sent to our servers. With your permission, the transcript and your final
		confirmed entry may be stored to improve accuracy over time. No account balances or
		monetary amounts appear in these samples. You can opt out or delete all stored
		samples from Settings at any time.
	</p>

	<h2>Analytics</h2>
	<p>
		We use Microsoft Clarity (session analytics) in production to understand how people
		use the app. Clarity is configured with full text and input masking — no amounts,
		descriptions, or personal text is ever captured. You can exclude your browser from
		Clarity at <a href="/opt-out">/opt-out</a>.
	</p>

	<h2>How we use your data</h2>
	<p>
		Your email is used solely to authenticate you (one magic link per sign-in). Your
		expense data is used solely to power your own Keel experience. We do not sell, rent,
		or share your personal data with any third party for marketing or advertising.
	</p>

	<h2>Data storage and security</h2>
	<p>
		Your data is stored on Cloudflare's infrastructure (D1 database, servers in the
		APAC region). Connections are encrypted in transit (HTTPS). Sessions are protected
		by httpOnly, Secure, SameSite cookies. Magic-link tokens are single-use and expire
		within 15 minutes.
	</p>

	<h2>Retention and deletion</h2>
	<p>
		Your data is retained for as long as your account is active. You can export all your
		data (CSV or JSON) from Settings at any time. To delete your account and all
		associated data, <a href="/legal/contact">contact us</a>. We will complete the
		deletion within 7 business days and confirm by email.
	</p>

	<h2>Your rights</h2>
	<p>
		Under applicable Indian law (Information Technology Act and IT Rules), you have the
		right to access, correct, and delete the personal information we hold about you.
		To exercise any of these rights, <a href="/legal/contact">contact us</a>.
	</p>

	<h2>Third-party processors</h2>
	<p>
		We use Cloudflare (infrastructure and database) and Microsoft Clarity (masked
		analytics). When payments are activated, Razorpay will process payment transactions.
		Each processor's privacy policy governs their use of data. We do not share your
		financial entries with any processor.
	</p>

	<h2>Changes to this notice</h2>
	<p>
		We will post any material changes to this page and update the "Last updated" date.
		Continued use of Keel after a change constitutes acceptance.
	</p>

	<p>
		Questions? <a href="/legal/contact">Contact us.</a>
		&copy; 2026 Annapurna Labs. All rights reserved.
	</p>
</div>

<style>
	@import '../legal.css';
</style>
