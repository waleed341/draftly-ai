import re

from fastapi import HTTPException

BLOCKED_PATTERNS = [
    re.compile(r"\b(write|draft|compose|send|create)\b.{0,50}\b(threat\w*|blackmail|extortion)\b", re.IGNORECASE),
    re.compile(r"\b(threaten|blackmail|extort)\b.{0,50}\b(email|message|letter|someone|them)\b", re.IGNORECASE),
]


def check_input(text: str) -> None:
    if any(pattern.search(text) for pattern in BLOCKED_PATTERNS):
        raise HTTPException(status_code=422, detail="We can’t help write threatening or coercive emails.")


def check_output(subject: str, body: str) -> list[dict[str, object]]:
    text = f"{subject}\n{body}"
    personal = bool(re.search(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b(?:\+?\d[\d .()-]{7,}\d)\b", text))
    placeholders = bool(re.search(r"\[[^\]]+\]", text))
    return [
        {"key": "personal_details", "label": "Personal details", "passed": not personal,
         "message": "Review names, email addresses, and phone numbers before using this draft." if personal else "No contact details detected."},
        {"key": "blanks", "label": "Blanks to fill", "passed": not placeholders,
         "message": "Fill in the bracketed details before you use this draft." if placeholders else "No blanks left to fill."},
        {"key": "review", "label": "Your review", "passed": True,
         "message": "Read through the draft and make sure it says what you mean."},
    ]
