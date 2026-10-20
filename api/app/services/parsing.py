import re


def parse_email(text: str) -> tuple[str, str]:
    cleaned = re.sub(r"\*\*(Subject|Email subject):\*\*", r"\1:", text.strip(), flags=re.IGNORECASE).replace("**", "")
    match = re.search(r"(?:^|\n)\s*SUBJECT\s*:\s*(.*?)(?:\n\s*---\s*\n|\n\s*BODY\s*:\s*)", cleaned, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip(), cleaned[match.end():].strip()
    lines = cleaned.splitlines()
    if lines and re.match(r"(?:subject)\s*:", lines[0], re.IGNORECASE):
        subject = re.sub(r"^subject\s*:\s*", "", lines.pop(0), flags=re.IGNORECASE).strip()
        return subject, "\n".join(lines).lstrip("\n- ").strip()
    return "", cleaned.strip()
