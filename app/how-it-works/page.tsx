"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// SVG icons — all inline, no dependency
function IconScale() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 9l9-6 9 6M5 21h14"/>
      <path d="M5 21V9M19 21V9"/>
    </svg>
  );
}
function IconVote() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

type Slide = {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  bullets: { text: string }[];
};

const SLIDES: Slide[] = [
  {
    icon: <IconScale />,
    label: "overview",
    title: "what is jury duty?",
    body: "bet on anything with your friends. stake points on outcomes only your group would care about.",
    bullets: [
      { text: "will she text back? who leaves first? does the trip make it out of the group chat?" },
      { text: "tied to real events — weddings, game nights, birthday dinners, concerts" },
      { text: "your friends are the market" },
    ],
  },
  {
    icon: <IconVote />,
    label: "bets",
    title: "how bets work",
    body: "create a bet, pick your options, stake points. when it resolves, winners split the pot.",
    bullets: [
      { text: "create a bet inside any event" },
      { text: "stake points on the option you think wins" },
      { text: "creator resolves it — winner takes the pot" },
      { text: "after 24 hrs, anyone in the event can resolve it" },
    ],
  },
  {
    icon: <IconStar />,
    label: "points",
    title: "earning points",
    body: "points are your betting power. you never buy them — you earn them.",
    bullets: [
      { text: "join jury duty  —  +500 pts" },
      { text: "win a bet  —  your stake + winnings" },
      { text: "create a bet  —  +25 pts" },
      { text: "create a group or event  —  +50 pts" },
    ],
  },
  {
    icon: <IconMessage />,
    label: "social",
    title: "reactions & comments",
    body: "bets aren't just bets — they're conversations.",
    bullets: [
      { text: "react or comment on any bet" },
      { text: "make a bet private — only invited people see it" },
      { text: "bet anonymously — your name stays hidden from the pot" },
    ],
  },
  {
    icon: <IconBell />,
    label: "notifications",
    title: "stay in the loop",
    body: "add jury duty to your home screen and enable notifications so you never miss a bet or result.",
    bullets: [
      { text: "tap the share icon (Safari) or three dots (Chrome) in your browser" },
      { text: 'select "Add to Home Screen" and tap Add' },
      { text: "open from your home screen, then tap the bell icon to enable notifications" },
    ],
  },
];

export default function HowItWorksPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && index < SLIDES.length - 1) setIndex(index + 1);
    if (diff < 0 && index > 0) setIndex(index - 1);
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-5">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
          aria-label="close"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--dimmer)" }}>
          {index + 1} of {SLIDES.length}
        </span>
        <div className="w-8" />
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-10">
        <div className="h-[1.5px] rounded-full w-full" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full"
            style={{
              background: "var(--accent)",
              width: `${((index + 1) / SLIDES.length) * 100}%`,
              transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
      </div>

      {/* Slide */}
      <div className="flex-1 px-5 flex flex-col">
        {/* Icon badge */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-7 shrink-0"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}
        >
          {slide.icon}
        </div>

        {/* Label */}
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
          {slide.label}
        </p>

        {/* Title */}
        <h1 className="text-[26px] font-black tracking-tight leading-[1.2] mb-3" style={{ fontFamily: "var(--font-nunito)" }}>
          {slide.title}
        </h1>

        {/* Body */}
        <p className="text-[15px] leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
          {slide.body}
        </p>

        {/* Bullets */}
        <div className="flex flex-col gap-2.5">
          {slide.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
                style={{ background: "var(--accent)" }}
              />
              <span className="text-[14px] leading-[1.55]" style={{ color: "var(--text)" }}>
                {b.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-12 pt-8 flex gap-3">
        {index > 0 && (
          <button
            onClick={() => setIndex(index - 1)}
            className="h-13 px-5 rounded-2xl font-semibold text-[15px]"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)", height: 52 }}
          >
            back
          </button>
        )}
        <button
          onClick={() => (isLast ? router.back() : setIndex(index + 1))}
          className="flex-1 rounded-2xl font-bold text-[15px] text-white"
          style={{ background: "var(--accent)", height: 52 }}
        >
          {isLast ? "got it" : "next"}
        </button>
      </div>
    </div>
  );
}
