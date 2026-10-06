"use client";

import { useState, useEffect } from "react";

const STEPS = 5; // 0=gate, 1=title, 2=story, 3=prizes, 4=app+deadline, 5=form

export default function PlayPage() {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", category: "", caption: "" });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState("");

  function advance() {
    setStep((s) => s + 1);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => s - 1);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setFileError("please upload a screenshot"); return; }
    setFileError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("username", form.username);
      fd.append("category", form.category);
      fd.append("caption", form.caption);
      fd.append("screenshot", file);
      await fetch("/api/play-submit", { method: "POST", body: fd });
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
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .play-root {
          min-height: 100vh;
          background: #0d0b10;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #ede8e0;
          position: relative;
          overflow-x: hidden;
        }

        .play-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,143,163,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(167,139,250,0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 50% 80%, rgba(100,180,210,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 10% 70%, rgba(180,210,130,0.12) 0%, transparent 50%),
            radial-gradient(ellipse 40% 50% at 90% 70%, rgba(255,200,120,0.10) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

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

        .play-content { position: relative; z-index: 2; }

        @keyframes fadeslide {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .portal {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px 80px;
          text-align: center;
          animation: fadeslide 0.5s ease both;
        }

        .portal-inner {
          max-width: 600px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        /* Step dots */
        .dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: all 0.3s;
        }
        .dot.active {
          background: rgba(255,143,163,0.7);
          width: 16px;
          border-radius: 3px;
        }

        /* Gate */
        .gate-badge {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,143,163,0.7);
        }

        .gate-heading {
          font-size: clamp(40px, 10vw, 80px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.0;
          color: #000;
        }

        .gate-sub {
          font-size: 15px;
          color: rgba(237,232,224,0.5);
          max-width: 340px;
          line-height: 1.65;
        }

        /* Buttons */
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,143,163,0.5); opacity: 1; }
          50% { box-shadow: 0 0 18px 6px rgba(255,143,163,0.2); opacity: 0.8; }
        }

        .court-btn {
          background: rgba(255,143,163,0.1);
          border: 1px solid rgba(255,143,163,0.3);
          color: #ff8fa3;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          padding: 13px 32px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .court-btn:hover {
          background: rgba(255,143,163,0.18);
          border-color: rgba(255,143,163,0.5);
          transform: translateY(-1px);
        }
        .court-btn.pulse { animation: pulse-glow 1.8s ease-in-out infinite; }
        .court-btn.pulse:hover { animation: none; }

        .court-btn.ghost {
          background: transparent;
          border-color: rgba(255,255,255,0.1);
          color: rgba(237,232,224,0.35);
          font-size: 12px;
          padding: 10px 20px;
        }
        .court-btn.ghost:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.18);
          color: rgba(237,232,224,0.6);
          transform: none;
        }

        .btn-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
        }

        /* Content cards */
        .card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px 28px;
          backdrop-filter: blur(12px);
          text-align: left;
          width: 100%;
        }

        .card p {
          font-size: 15px;
          color: rgba(237,232,224,0.7);
          line-height: 1.8;
          margin-bottom: 14px;
        }
        .card p:last-child { margin-bottom: 0; }

        /* Section heading inside portal */
        .portal-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(167,139,250,0.65);
        }

        .portal-title {
          font-size: clamp(28px, 6vw, 48px);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #000;
          line-height: 1.1;
        }

        .portal-sub {
          font-size: 15px;
          color: rgba(237,232,224,0.5);
          max-width: 440px;
          line-height: 1.65;
        }

        /* Prizes */
        .prizes { display: flex; flex-direction: column; gap: 12px; width: 100%; }

        .prize-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 20px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          text-align: left;
          transition: border-color 0.2s;
        }
        .prize-card:hover { border-color: rgba(255,143,163,0.2); }

        .prize-icon {
          font-size: 22px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,143,163,0.08);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .prize-body { flex: 1; }
        .prize-title { font-size: 15px; font-weight: 700; color: #ede8e0; margin-bottom: 2px; }
        .prize-desc { font-size: 12px; color: rgba(237,232,224,0.45); line-height: 1.5; }
        .prize-amount { font-size: 17px; font-weight: 800; color: #ff8fa3; flex-shrink: 0; }

        /* App links */
        .dl-links { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .dl-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 11px 18px;
          color: rgba(237,232,224,0.75);
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }
        .dl-btn:hover { background: rgba(255,255,255,0.07); color: #ede8e0; }

        /* Deadline */
        .deadline {
          background: rgba(255,143,163,0.06);
          border: 1px solid rgba(255,143,163,0.16);
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 13px;
          color: rgba(237,232,224,0.6);
          line-height: 1.6;
          width: 100%;
          text-align: center;
        }
        .deadline strong { color: #ff8fa3; font-weight: 700; }

        /* Form */
        .form-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px 28px;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          text-align: left;
        }

        .field { display: flex; flex-direction: column; gap: 7px; }

        label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(237,232,224,0.4);
        }

        input, select, textarea {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 9px;
          padding: 11px 14px;
          color: #ede8e0;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          -webkit-appearance: none;
        }
        input:focus, select:focus, textarea:focus { border-color: rgba(255,143,163,0.4); }
        input::placeholder, textarea::placeholder { color: rgba(237,232,224,0.22); }
        select option { background: #1a1520; color: #ede8e0; }
        textarea { resize: vertical; min-height: 80px; }

        .submit-btn {
          background: rgba(255,143,163,0.12);
          border: 1px solid rgba(255,143,163,0.35);
          color: #ff8fa3;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          padding: 13px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .submit-btn:hover:not(:disabled) {
          background: rgba(255,143,163,0.22);
          border-color: rgba(255,143,163,0.55);
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .form-note {
          font-size: 11px;
          color: rgba(237,232,224,0.28);
          text-align: center;
          line-height: 1.5;
        }

        /* Success */
        .success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 40px 0;
        }
        .success-icon { font-size: 44px; }
        .success h3 { font-size: 20px; font-weight: 800; color: #ede8e0; }
        .success p { font-size: 13px; color: rgba(237,232,224,0.45); line-height: 1.6; max-width: 320px; text-align: center; }

        /* Footer */
        .footer {
          font-size: 11px;
          color: rgba(237,232,224,0.2);
        }
        .footer a { color: rgba(255,143,163,0.4); text-decoration: none; }
        .footer a:hover { color: rgba(255,143,163,0.7); }

        @media (max-width: 480px) {
          .prize-card { flex-wrap: wrap; }
          .form-card, .card { padding: 24px 18px; }
        }
      `}</style>

      <div className="play-root">
        <div className="play-content">

          {/* STEP 0: Gate */}
          {step === 0 && (
            <div className="portal" key={`step-${animKey}`}>
              <div className="portal-inner">
                <span className="gate-badge">jury·<em>duty</em></span>
                <h1 className="gate-heading">you&apos;ve been<br />summoned.</h1>
                <p className="gate-sub">
                  a competition for the most unhinged, hilarious, and legendary bets on the app.
                </p>
                <button className="court-btn pulse" onClick={advance}>
                  enter the courtroom →
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: The announcement */}
          {step === 1 && (
            <div className="portal" key={`step-${animKey}`}>
              <div className="portal-inner">
                <div className="dots">
                  {[1,2,3,4,5].map(i => <div key={i} className={`dot${i===1?" active":""}`} />)}
                </div>
                <span className="portal-eyebrow">case open</span>
                <h1 className="portal-title">the jury awards</h1>
                <p className="portal-sub">
                  $300 in prizes for the best bets on the app. submit your most interacted,
                  funniest, or memorable moment before November 1st.
                </p>
                <div className="btn-row">
                  <button className="court-btn ghost" onClick={back}>← recess</button>
                  <button className="court-btn" onClick={advance}>hear the case →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: The story */}
          {step === 2 && (
            <div className="portal" key={`step-${animKey}`}>
              <div className="portal-inner">
                <div className="dots">
                  {[1,2,3,4,5].map(i => <div key={i} className={`dot${i===2?" active":""}`} />)}
                </div>
                <span className="portal-eyebrow">background</span>
                <h2 style={{ fontSize: "clamp(22px,5vw,36px)", fontWeight: 800, letterSpacing: "-0.02em", color: "#ede8e0" }}>
                  the story
                </h2>
                <div className="card">
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
                <div className="btn-row">
                  <button className="court-btn ghost" onClick={back}>← recess</button>
                  <button className="court-btn" onClick={advance}>see the charges →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Prizes */}
          {step === 3 && (
            <div className="portal" key={`step-${animKey}`}>
              <div className="portal-inner">
                <div className="dots">
                  {[1,2,3,4,5].map(i => <div key={i} className={`dot${i===3?" active":""}`} />)}
                </div>
                <span className="portal-eyebrow">the charges — $300 total</span>
                <h2 style={{ fontSize: "clamp(22px,5vw,36px)", fontWeight: 800, letterSpacing: "-0.02em", color: "#ede8e0" }}>
                  three verdicts
                </h2>
                <div className="prizes">
                  <div className="prize-card">
                    <div className="prize-icon">🔥</div>
                    <div className="prize-body">
                      <p className="prize-title">most interacted bet</p>
                      <p className="prize-desc">the bet that got the most stakers. peak discourse.</p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                  <div className="prize-card">
                    <div className="prize-icon">💀</div>
                    <div className="prize-body">
                      <p className="prize-title">funniest bet</p>
                      <p className="prize-desc">the bet that made us actually laugh out loud.</p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                  <div className="prize-card">
                    <div className="prize-icon">🎲</div>
                    <div className="prize-body">
                      <p className="prize-title">wild card</p>
                      <p className="prize-desc">one random feed post (photo + caption) wins.</p>
                    </div>
                    <span className="prize-amount">$100</span>
                  </div>
                </div>
                <div className="btn-row">
                  <button className="court-btn ghost" onClick={back}>← recess</button>
                  <button className="court-btn" onClick={advance}>approach the bench →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Get the app + deadline */}
          {step === 4 && (
            <div className="portal" key={`step-${animKey}`}>
              <div className="portal-inner">
                <div className="dots">
                  {[1,2,3,4,5].map(i => <div key={i} className={`dot${i===4?" active":""}`} />)}
                </div>
                <span className="portal-eyebrow">before you testify</span>
                <h2 style={{ fontSize: "clamp(22px,5vw,36px)", fontWeight: 800, letterSpacing: "-0.02em", color: "#ede8e0" }}>
                  get the app first
                </h2>
                <p className="portal-sub">
                  you need to be on jury duty to enter. download the app and make some bets first.
                </p>
                <div className="dl-links">
                  <a href="https://apps.apple.com/us/app/jury-duty/id6770705837" className="dl-btn" target="_blank" rel="noopener noreferrer">
                    🍎 app store
                  </a>
                  <a href="https://juryduty.xyz" className="dl-btn" target="_blank" rel="noopener noreferrer">
                    🌐 web app
                  </a>
                </div>
                <div className="deadline">
                  submissions close <strong>November 1, 2026</strong> at midnight ET.
                  winners announced on the jury duty instagram within one week.
                </div>
                <div className="btn-row">
                  <button className="court-btn ghost" onClick={back}>← recess</button>
                  <button className="court-btn" onClick={advance}>take the stand →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Form */}
          {step === 5 && (
            <div className="portal" key={`step-${animKey}`} style={{ justifyContent: "flex-start", paddingTop: 60 }}>
              <div className="portal-inner">
                <div className="dots">
                  {[1,2,3,4,5].map(i => <div key={i} className={`dot${i===5?" active":""}`} />)}
                </div>
                <span className="portal-eyebrow">the stand</span>
                <h2 style={{ fontSize: "clamp(22px,5vw,36px)", fontWeight: 800, letterSpacing: "-0.02em", color: "#ede8e0" }}>
                  submit your evidence
                </h2>
                {submitted ? (
                  <div className="success">
                    <span className="success-icon">⚖️</span>
                    <h3>submitted to the jury.</h3>
                    <p>
                      we&apos;ve got your evidence. check the jury duty instagram after november 1st
                      for the verdicts.
                    </p>
                  </div>
                ) : (
                  <form className="form-card" onSubmit={handleSubmit}>
                    <div className="field">
                      <label htmlFor="name">your name</label>
                      <input id="name" type="text" placeholder="first + last" required
                        value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="username">jury duty username</label>
                      <input id="username" type="text" placeholder="@username" required
                        value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="category">charge</label>
                      <select id="category" required value={form.category}
                        onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="">select a charge</option>
                        <option value="most_interacted">most interacted bet</option>
                        <option value="funniest">funniest bet</option>
                        <option value="wildcard">wild card</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="screenshot">exhibit A — screenshot</label>
                      <input id="screenshot" type="file" accept="image/*"
                        style={{ padding: "10px 14px", cursor: "pointer" }}
                        onChange={(e) => { setFileError(""); setFile(e.target.files?.[0] ?? null); }} />
                      {file && <p style={{ fontSize: 11, color: "rgba(237,232,224,0.35)", marginTop: 3 }}>{file.name}</p>}
                      {fileError && <p style={{ fontSize: 11, color: "#ff8fa3", marginTop: 3 }}>{fileError}</p>}
                    </div>
                    <div className="field">
                      <label htmlFor="caption">closing argument (optional)</label>
                      <textarea id="caption" placeholder="why should this win? set the scene."
                        value={form.caption} onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))} />
                    </div>
                    <button className="submit-btn" type="submit" disabled={submitting}>
                      {submitting ? "filing..." : "submit to the jury"}
                    </button>
                    <p className="form-note">
                      by submitting you agree to let us share your bet publicly if you win.
                      we can remove names on request. no spam, ever.
                    </p>
                  </form>
                )}
                {!submitted && (
                  <button className="court-btn ghost" onClick={back}>← recess</button>
                )}
                <div className="footer">
                  <a href="https://juryduty.xyz">juryduty.xyz</a>
                  {" · "}
                  <a href="https://juryduty.xyz/terms">terms</a>
                  {" · "}
                  <a href="https://juryduty.xyz/privacy">privacy</a>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
