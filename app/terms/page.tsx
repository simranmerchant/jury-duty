import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — jury duty",
};

export default function TermsPage() {
  const updated = "May 9, 2026";
  const email = "hello@juryduty.app";

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-[var(--text)]">
      <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
      <p className="text-[var(--muted)] text-sm mb-12">Last updated: {updated}</p>

      <section className="space-y-10 text-[15px] leading-7 text-[var(--muted)]">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">The basics</h2>
          <p>By using jury duty you agree to these terms. jury duty is a social entertainment app. All predictions use virtual points — no real money, no gambling.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Your account</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least 13 years old to use jury duty.</li>
            <li>You are responsible for activity that happens under your account.</li>
            <li>Don&apos;t share your login credentials.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Virtual points</h2>
          <p>Points in jury duty have no real-world monetary value and cannot be exchanged for cash, goods, or services. They exist solely to make bets between friends more interesting. We may adjust point values, earning rules, or balances at any time.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">What you can&apos;t do</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the app for anything illegal.</li>
            <li>Harass, threaten, or abuse other users.</li>
            <li>Post content that is hateful, obscene, or violates others&apos; privacy.</li>
            <li>Attempt to exploit, hack, or reverse-engineer the app.</li>
            <li>Create fake accounts or manipulate bets through coordinated abuse.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">User-generated content</h2>
          <p>jury duty allows users to create predictions, post comments, and interact with other users&apos; content. We have zero tolerance for objectionable content or abusive behavior. By using the app you agree that you will not post content that is harmful, harassing, obscene, hateful, or otherwise objectionable.</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>You can <strong className="text-[var(--text)]">report</strong> any prediction or user by tapping the report button on the content. We will review all reports within 24 hours and remove violating content and accounts.</li>
            <li>You can <strong className="text-[var(--text)]">block</strong> any user from their profile page. Blocking removes their content from your view immediately and notifies us of potential abuse.</li>
            <li>Accounts found to be posting objectionable content will be permanently removed.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Your content</h2>
          <p>You own the content you post. By posting it, you give us a license to display it within the app. We don&apos;t claim ownership of your content and don&apos;t sell it.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Termination</h2>
          <p>We can suspend or terminate your account if you violate these terms. You can delete your account anytime from the Profile tab.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Disclaimer</h2>
          <p>jury duty is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the app. Bet outcomes are final once resolved by the event host or participants.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Changes</h2>
          <p>We may update these terms. Continued use of the app after changes means you accept the new terms.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Contact</h2>
          <p>Questions? Email us at <a href={`mailto:${email}`} className="text-[var(--accent)] underline">{email}</a>.</p>
        </div>
      </section>
    </main>
  );
}
