import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — jury duty",
};

export default function PrivacyPage() {
  const updated = "May 9, 2026";
  const email = "support@juryduty.xyz";

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-[var(--text)]">
      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="text-[var(--muted)] text-sm mb-12">Last updated: {updated}</p>

      <section className="space-y-10 text-[15px] leading-7 text-[var(--muted)]">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">What is jury duty?</h2>
          <p>jury duty is a social bet-on-anything app for friends. You create events, place bets using virtual points, and settle debates with your group. No real money is ever involved.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">What we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text)]">Account info</strong> — your name, username, and phone number provided during sign-up via Privy.</li>
            <li><strong className="text-[var(--text)]">Profile photo</strong> — if you choose to upload one.</li>
            <li><strong className="text-[var(--text)]">Usage data</strong> — bets you create or join, events you participate in, and reactions or comments you post.</li>
            <li><strong className="text-[var(--text)]">Push notification token</strong> — if you grant permission, so we can notify you about bet outcomes and activity in your events.</li>
            <li><strong className="text-[var(--text)]">Device info</strong> — basic device identifiers used by our auth provider (Privy) for security.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">What we don&apos;t collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not collect real financial information. jury duty uses virtual points only.</li>
            <li>We do not sell your data to third parties.</li>
            <li>We do not run ads.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">How we use your data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To operate the app — display your profile, connect you with friends, and run bets.</li>
            <li>To send push notifications about activity that involves you (bet resolutions, reactions, comments, mentions).</li>
            <li>To improve the product.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Third-party services</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text)]">Privy</strong> — handles authentication. <a href="https://privy.io/privacy-policy" className="text-[var(--accent)] underline">Privy&apos;s Privacy Policy</a>.</li>
            <li><strong className="text-[var(--text)]">Supabase</strong> — stores your data in a secure PostgreSQL database.</li>
            <li><strong className="text-[var(--text)]">Expo / EAS</strong> — used to deliver the app and over-the-air updates.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Data retention & deletion</h2>
          <p>You can delete your account at any time from the Profile tab in the app. This permanently removes your account, profile, and associated data. Some data (such as bets you participated in) may remain in aggregate form tied to the event.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Children</h2>
          <p>jury duty is not intended for users under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us data, contact us and we will delete it.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-3">Contact</h2>
          <p>Questions? Email us at <a href={`mailto:${email}`} className="text-[var(--accent)] underline">{email}</a>.</p>
        </div>
      </section>
    </main>
  );
}
