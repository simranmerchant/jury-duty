"use client";

import { useState } from "react";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf_PLACEHOLDER/viewform?embedded=true";

export default function PlayPage() {
  const [entered, setEntered] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", category: "", screenshot: "", caption: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        "entry.name": form.name,
        "entry.username": form.username,
        "entry.category": form.category,
        "entry.screenshot": form.screenshot,
        "entry.caption": form.caption,
      });
      await fetch(`/api/play-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .play-root {
          min-height: 100vh;
          background: #0d0b10;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #ede8e0;
          position: relative;
          overflow: hidden;
        }

        /* Holographic gradient background */
        .play-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255, 143, 163, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(167, 139, 250, 0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 50% 80%, rgba(100, 180, 210, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 10% 70%, rgba(180, 210, 130, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 40% 50% at 90% 70%, rgba(255, 200, 120, 0.10) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* Film grain overlay */
        .play-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 256px 256px;
          pointer-events: none;
          z-index: 1;
          opacity: 0.5;
        }

        .play-content {
          position: relative;
          z-index: 2;
        }

        /* Gate screen */
        .gate {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
          gap: 32px;
        }

        .gate-badge {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 143, 163, 0.7);
          letter-spacing: 0.01em;
        }

        .gate-heading {
          font-size: clamp(36px, 8vw, 72px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #000;
        }

        .gate-sub {
          font-size: 16px;
          color: rgba(237, 232, 224, 0.55);
          max-width: 380px;
          line-height: 1.6;
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 143, 163, 0.5); opacity: 1; }
          50% { box-shadow: 0 0 18px 6px rgba(255, 143, 163, 0.25); opacity: 0.75; }
        }

        .gate-btn {
          background: rgba(255, 143, 163, 0.12);
          border: 1px solid rgba(255, 143, 163, 0.35);
          color: #ff8fa3;
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          padding: 14px 36px;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
          backdrop-filter: blur(8px);
          animation: pulse-glow 1.8s ease-in-out infinite;
        }
        .gate-btn:hover {
          background: rgba(255, 143, 163, 0.2);
          border-color: rgba(255, 143, 163, 0.55);
          transform: translateY(-1px);
          animation: none;
        }

        /* Main page */
        .page {
          max-width: 720px;
          margin: 0 auto;
          padding: 64px 24px 120px;
          display: flex;
          flex-direction: column;
          gap: 80px;
        }

        /* Header */
        .header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .header-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 143, 163, 0.7);
        }

        .header-title {
          font-size: clamp(28px, 6vw, 52px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #000;
        }

        .header-sub {
          font-size: 15px;
          color: rgba(237, 232, 224, 0.5);
          max-width: 480px;
          line-height: 1.65;
        }

        /* Section */
        .section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(167, 139, 250, 0.7);
          margin-bottom: 20px;
        }

        /* Story section */
        .story {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 36px 32px;
          backdrop-filter: blur(12px);
        }

        .story p {
          font-size: 15px;
          color: rgba(237, 232, 224, 0.72);
          line-height: 1.75;
          margin-bottom: 16px;
        }
        .story p:last-child { margin-bottom: 0; }

        /* Prizes */
        .prizes {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .prize-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px 28px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          backdrop-filter: blur(8px);
          transition: border-color 0.2s;
        }
        .prize-card:hover {
          border-color: rgba(255,143,163,0.2);
        }

        .prize-icon {
          font-size: 28px;
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,143,163,0.08);
          border-radius: 12px;
        }

        .prize-body { flex: 1; }

        .prize-title {
          font-size: 16px;
          font-weight: 700;
          color: #ede8e0;
          margin-bottom: 4px;
        }

        .prize-desc {
          font-size: 13px;
          color: rgba(237, 232, 224, 0.5);
          line-height: 1.55;
        }

        .prize-amount {
          font-size: 18px;
          font-weight: 800;
          color: #ff8fa3;
          flex-shrink: 0;
          align-self: center;
        }

        /* Download links */
        .download-links {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dl-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 12px 20px;
          color: rgba(237, 232, 224, 0.8);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
          cursor: pointer;
        }
        .dl-btn:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.18);
          color: #ede8e0;
        }

        /* Deadline */
        .deadline-banner {
          background: rgba(255, 143, 163, 0.06);
          border: 1px solid rgba(255, 143, 163, 0.18);
          border-radius: 14px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .deadline-icon { font-size: 22px; }

        .deadline-text {
          font-size: 14px;
          color: rgba(237, 232, 224, 0.65);
        }
        .deadline-text strong {
          color: #ff8fa3;
          font-weight: 700;
        }

        /* Form */
        .form-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 36px 32px;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(237, 232, 224, 0.45);
        }

        input, select, textarea {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 16px;
          color: #ede8e0;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          -webkit-appearance: none;
        }
        input:focus, select:focus, textarea:focus {
          border-color: rgba(255, 143, 163, 0.4);
        }
        input::placeholder, textarea::placeholder {
          color: rgba(237, 232, 224, 0.25);
        }
        select option {
          background: #1a1520;
          color: #ede8e0;
        }
        textarea { resize: vertical; min-height: 90px; }

        .submit-btn {
          background: rgba(255, 143, 163, 0.15);
          border: 1px solid rgba(255, 143, 163, 0.4);
          color: #ff8fa3;
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          padding: 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
          margin-top: 4px;
        }
        .submit-btn:hover:not(:disabled) {
          background: rgba(255, 143, 163, 0.25);
          border-color: rgba(255, 143, 163, 0.6);
        }
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-note {
          font-size: 12px;
          color: rgba(237, 232, 224, 0.3);
          text-align: center;
          line-height: 1.5;
        }

        /* Success */
        .success {
          text-align: center;
          padding: 48px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .success-icon { font-size: 48px; }
        .success h3 { font-size: 22px; font-weight: 800; color: #ede8e0; }
        .success p { font-size: 14px; color: rgba(237,232,224,0.5); line-height: 1.6; max-width: 360px; }

        /* Footer */
        .footer {
          text-align: center;
          font-size: 12px;
          color: rgba(237, 232, 224, 0.25);
          padding-top: 16px;
        }
        .footer a {
          color: rgba(255, 143, 163, 0.5);
          text-decoration: none;
        }
        .footer a:hover { color: rgba(255,143,163,0.8); }

        @media (max-width: 480px) {
          .story { padding: 24px 20px; }
          .form-card { padding: 24px 20px; }
          .prize-card { flex-direction: column; gap: 12px; }
          .prize-amount { align-self: flex-start; }
        }
      `}</style>

      <div className="play-root">
        <div className="play-content">
          {!entered ? (
            <div className="gate">
              <span className="gate-badge">jury duty</span>
              <h1 className="gate-heading">
                you&apos;ve been<br />summoned.
              </h1>
              <p className="gate-sub">
                a competition for the most unhinged, hilarious, and legendary bets on the app.
              </p>
              <button className="gate-btn" onClick={() => setEntered(true)}>
                enter &rarr;
              </button>
            </div>
          ) : (
            <div className="page">
              {/* Header */}
              <div className="header">
                <span className="header-eyebrow">jury duty — open competition</span>
                <h1 className="header-title">the jury awards</h1>
                <p className="header-sub">
                  $300 in prizes for the best bets on the app. submit your most interacted,
                  funniest, or memorable moment before November 1st.
                </p>
              </div>

              {/* Story */}
              <div>
                <p className="section-label">the story</p>
                <div className="story">
                  <p>
                    Jury Duty started when someone in the group chat said they were finally
                    deleting their ex&apos;s number. Nobody believed them. Someone made a bet.
                    Everyone had opinions. It spiraled.
                  </p>
                  <p>
                    Now it&apos;s an app where you and your friends bet points on real life — weddings,
                    job offers, situationships, side projects, Sunday plans. No fake money, no crypto.
                    Just bragging rights and the satisfaction of being right.
                  </p>
                  <p>
                    We&apos;re running this competition because some of you have created genuinely
                    unhinged content on this app and it deserves to be recognized.
                  </p>
                </div>
              </div>

              {/* Prizes */}
              <div>
                <p className="section-label">the prizes — $300 total</p>
                <div className="prizes">
                  <div className="prize-card">
                    <div className="prize-icon">🔥</div>
                    <div className="prize-body">
                      <p className="prize-title">most interacted bet</p>
                      <p className="prize-desc">
                        the bet that got the most stakers. peak discourse.
                      </p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                  <div className="prize-card">
                    <div className="prize-icon">💀</div>
                    <div className="prize-body">
                      <p className="prize-title">funniest bet</p>
                      <p className="prize-desc">
                        the bet that made us actually laugh out loud. bonus points if it hit close to home.
                      </p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                  <div className="prize-card">
                    <div className="prize-icon">🎲</div>
                    <div className="prize-body">
                      <p className="prize-title">wild card</p>
                      <p className="prize-desc">
                        one random feed post (photo + caption) wins. just show up.
                      </p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                </div>
              </div>

              {/* Get the app */}
              <div>
                <p className="section-label">get the app</p>
                <p style={{ fontSize: 14, color: "rgba(237,232,224,0.5)", marginBottom: 20, lineHeight: 1.6 }}>
                  you need to be on jury duty to enter. download the app and make some bets first.
                </p>
                <div className="download-links">
                  <a
                    href="https://apps.apple.com/us/app/jury-duty/id6770705837"
                    className="dl-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>🍎</span> app store
                  </a>
                  <a href="https://juryduty.xyz" className="dl-btn" target="_blank" rel="noopener noreferrer">
                    <span>🌐</span> web app
                  </a>
                </div>
              </div>

              {/* Deadline */}
              <div className="deadline-banner">
                <span className="deadline-icon">⏰</span>
                <p className="deadline-text">
                  submissions close <strong>November 1, 2026</strong> at midnight ET.
                  winners announced on the jury duty instagram within one week.
                </p>
              </div>

              {/* Submit */}
              <div>
                <p className="section-label">submit your entry</p>
                {submitted ? (
                  <div className="success">
                    <span className="success-icon">⚖️</span>
                    <h3>submitted.</h3>
                    <p>
                      we&apos;ve got your entry. check the jury duty instagram after november 1st
                      for winner announcements.
                    </p>
                  </div>
                ) : (
                  <form className="form-card" onSubmit={handleSubmit}>
                    <div className="field">
                      <label htmlFor="name">your name</label>
                      <input
                        id="name"
                        type="text"
                        placeholder="first + last"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="username">jury duty username</label>
                      <input
                        id="username"
                        type="text"
                        placeholder="@username"
                        required
                        value={form.username}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="category">category</label>
                      <select
                        id="category"
                        required
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        <option value="">pick one</option>
                        <option value="most_interacted">most interacted bet</option>
                        <option value="funniest">funniest bet</option>
                        <option value="wildcard">wild card</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="screenshot">screenshot or link</label>
                      <input
                        id="screenshot"
                        type="text"
                        placeholder="paste a link to your bet, or describe it"
                        required
                        value={form.screenshot}
                        onChange={(e) => setForm((f) => ({ ...f, screenshot: e.target.value }))}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="caption">caption (optional)</label>
                      <textarea
                        id="caption"
                        placeholder="why should this win? set the scene."
                        value={form.caption}
                        onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                      />
                    </div>

                    <button className="submit-btn" type="submit" disabled={submitting}>
                      {submitting ? "submitting..." : "submit entry"}
                    </button>

                    <p className="form-note">
                      by submitting you agree to let us share your bet publicly if you win.
                      we can remove names on request. no spam, ever.
                    </p>
                  </form>
                )}
              </div>

              <div className="footer">
                <a href="https://juryduty.xyz">juryduty.xyz</a>
                {" · "}
                <a href="https://juryduty.xyz/terms">terms</a>
                {" · "}
                <a href="https://juryduty.xyz/privacy">privacy</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
