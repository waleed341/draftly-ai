export function parseEmail(text: string): { subject: string; body: string } {
  const cleaned = text.replace(/\*\*(Subject|Email subject):\*\*/gi, "$1:").replaceAll("**", "").trim();
  if (/^\s*SUBJECT\b/i.test(cleaned) && !/\n\s*---\s*\n/.test(cleaned)) {
    return { subject: cleaned.replace(/^\s*SUBJECT\s*:?\s*/i, ""), body: "" };
  }
  const match = cleaned.match(/(?:^|\n)\s*SUBJECT\s*:\s*([\s\S]*?)(?:\n\s*---\s*\n|\n\s*BODY\s*:\s*)/i);
  if (match) return { subject: match[1].trim(), body: cleaned.slice(match.index! + match[0].length).trim() };
  const lines = cleaned.split(/\r?\n/);
  if (/^subject\s*:/i.test(lines[0] ?? "")) {
    return { subject: lines.shift()!.replace(/^subject\s*:\s*/i, "").trim(), body: lines.join("\n").replace(/^\s*[-\n]*/, "").trim() };
  }
  return { subject: "", body: cleaned };
}
