export type QSegment =
  | { type: "text"; text: string; start: number; end: number }
  | { type: "mention"; userId: string; original: string; start: number; end: number };

const TOKEN_RE = /@\[([^\]|]+)\|([^\]]+)\]/g;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseQuestion(question: string): QSegment[] {
  const segments: QSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(question)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: question.slice(lastIndex, match.index), start: lastIndex, end: match.index });
    }
    segments.push({ type: "mention", userId: match[1], original: match[2], start: match.index, end: match.index + match[0].length });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < question.length) {
    segments.push({ type: "text", text: question.slice(lastIndex), start: lastIndex, end: question.length });
  }
  return segments;
}

export function extractTaggedUserIds(question: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(question)) !== null) ids.push(match[1]);
  return ids;
}

/** Replace the text at [start, end) with a mention token. */
export function insertMentionAt(question: string, start: number, end: number, userId: string): string {
  const original = question.slice(start, end);
  return question.slice(0, start) + `@[${userId}|${original}]` + question.slice(end);
}

/** Remove the first mention for userId, restoring original text. */
export function removeMention(question: string, userId: string): string {
  const re = new RegExp(`@\\[${escapeRegex(userId)}\\|([^\\]]+)\\]`);
  return question.replace(re, "$1");
}

/** Split text segments into word-level tokens for the word-picker UI. */
export function getWordTokens(segments: QSegment[]): Array<{ key: string; label: string; start: number; end: number; isMention: boolean; userId?: string }> {
  const tokens: Array<{ key: string; label: string; start: number; end: number; isMention: boolean; userId?: string }> = [];
  for (const seg of segments) {
    if (seg.type === "mention") {
      tokens.push({ key: `m-${seg.start}`, label: `@${seg.original}`, start: seg.start, end: seg.end, isMention: true, userId: seg.userId });
    } else {
      const wordRe = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = wordRe.exec(seg.text)) !== null) {
        const start = seg.start + m.index;
        const end = start + m[0].length;
        tokens.push({ key: `w-${start}`, label: m[0], start, end, isMention: false });
      }
    }
  }
  return tokens;
}
