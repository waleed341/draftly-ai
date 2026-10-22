import re

_SUBJECT = re.compile(r"^[\s#>*_]*subject[\s*_]*:[\s*_]*(?P<value>.*?)[\s*_]*$", re.IGNORECASE)
_SEPARATOR = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$")
_BODY_LABEL = re.compile(r"^[\s*_]*body[\s*_]*:[\s*_]*", re.IGNORECASE)
_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__")
_FENCE = re.compile(r"^\s*```[a-z]*\s*$", re.IGNORECASE)


def parse_draft(text: str) -> tuple[str, str]:
    """Split model output into (subject, body). Tolerates markdown like "**Subject:** x" and "**bold**"."""
    lines = [line for line in text.replace("\r\n", "\n").split("\n") if not _FENCE.match(line)]
    subject = ""
    start = 0
    for index, line in enumerate(lines):
        match = _SUBJECT.match(line)
        if match:
            subject = match.group("value")
            start = index + 1
            break
        if line.strip():
            break  # the first real line is not a subject: treat everything as the body
    rest = lines[start:]
    while rest and not rest[0].strip():
        rest = rest[1:]
    if rest and _SEPARATOR.match(rest[0]):
        rest = rest[1:]
    body = "\n".join(rest).strip()
    body = _BODY_LABEL.sub("", body, count=1)
    return _unbold(subject).strip(), _unbold(body).strip()


def _unbold(text: str) -> str:
    return _BOLD.sub(lambda m: m.group(1) or m.group(2), text)
