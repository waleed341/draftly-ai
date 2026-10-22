// Mirrors api/app/services/parsing.py so the live preview matches what gets saved.

const SUBJECT = /^[\s#>*_]*subject[\s*_]*:[\s*_]*(.*?)[\s*_]*$/i;
const SEPARATOR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const BODY_LABEL = /^[\s*_]*body[\s*_]*:[\s*_]*/i;
const BOLD = /\*\*(.+?)\*\*|__(.+?)__/g;
const FENCE = /^\s*```[a-z]*\s*$/i;

const unbold = (text: string) => text.replace(BOLD, (_m, a?: string, b?: string) => a ?? b ?? "");

export function parseDraft(text: string): { subject: string; body: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => !FENCE.test(line));
  let subject = "";
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = SUBJECT.exec(lines[i]);
    if (match) {
      subject = match[1];
      start = i + 1;
      break;
    }
    if (lines[i].trim()) break;
  }
  let rest = lines.slice(start);
  while (rest.length && !rest[0].trim()) rest = rest.slice(1);
  if (rest.length && SEPARATOR.test(rest[0])) rest = rest.slice(1);
  const body = rest.join("\n").trim().replace(BODY_LABEL, "");
  return { subject: unbold(subject).trim(), body: unbold(body).trim() };
}

/** While streaming, hide a half-written "SUBJ…" label or a lone "--" so the preview never flickers. */
export function parsePartial(text: string): { subject: string; body: string } {
  const trimmed = text.trimStart().replace(/^[#*_\s]+/, "");
  if (!trimmed.includes("\n") && "subject:".startsWith(trimmed.toLowerCase().slice(0, 8)) && !trimmed.includes(":")) {
    return { subject: "", body: "" };
  }
  const parsed = parseDraft(text.replace(/\n\s*-{1,2}\s*$/, "\n"));
  if (!text.includes("\n") && SUBJECT.test(text)) return { subject: parsed.subject, body: "" };
  return parsed;
}

const BLANK = /\[[^[\]\n]{1,60}\]/g;

export function findBlanks(subject: string, body: string): string[] {
  return [...new Set(`${subject}\n${body}`.match(BLANK) ?? [])];
}
