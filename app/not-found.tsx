import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <p
        className="text-[64px] font-black leading-none"
        style={{ fontFamily: "var(--font-nunito)", color: "var(--accent)" }}
      >
        404
      </p>
      <p className="text-[16px]" style={{ color: "var(--muted)" }}>
        page not found
      </p>
      <Link
        href="/events"
        className="mt-2 text-[14px] font-bold"
        style={{ color: "var(--accent)" }}
      >
        go home →
      </Link>
    </div>
  );
}
