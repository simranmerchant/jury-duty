type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateCreateBet(input: {
  question: unknown;
  options: unknown;
  deadline: unknown;
}): ValidationResult {
  const { question, options, deadline } = input;

  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "question required (max 200 chars)" };
  }
  if (question.trim().length > 200) {
    return { ok: false, error: "question required (max 200 chars)" };
  }

  if (!Array.isArray(options) || options.length < 2) {
    return { ok: false, error: "at least 2 options required" };
  }
  if (options.length > 6) {
    return { ok: false, error: "max 6 options" };
  }

  const labels: string[] = options.map((o: unknown) =>
    typeof o === "string" ? o.trim() : typeof (o as any)?.label === "string" ? (o as any).label.trim() : ""
  );
  if (labels.some((l) => !l || l.length > 100)) {
    return { ok: false, error: "each option must be 1-100 chars" };
  }

  if (!deadline) {
    return { ok: false, error: "deadline required" };
  }
  const ts = new Date(deadline as string).getTime();
  if (isNaN(ts)) {
    return { ok: false, error: "invalid deadline" };
  }
  if (ts <= Date.now()) {
    return { ok: false, error: "deadline must be in the future" };
  }

  return { ok: true };
}
