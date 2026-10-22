import re
from dataclasses import dataclass

from app.core.errors import BlockedError


@dataclass(frozen=True, slots=True)
class CheckResult:
    key: str
    label: str
    passed: bool
    message: str


@dataclass(frozen=True, slots=True)
class _Pattern:
    regex: re.Pattern[str]
    message: str


def _p(pattern: str, message: str) -> _Pattern:
    return _Pattern(re.compile(pattern, re.IGNORECASE), message)


_BLOCKED_IDEAS = [
    _p(
        r"\bphish|steal\w*\s+(?:\w+\s+){0,3}(?:password|credential|login|bank|card)"
        r"|(?:pretend|pose|posing)\s+(?:to\s+be|as)\s+(?:\w+\s+){0,3}(?:bank|irs|paypal|microsoft|apple|support)"
        r"|harvest\w*\s+(?:\w+\s+){0,2}(?:password|credential|login)",
        "Draftly can't help write emails that trick people into sharing passwords or personal details.",
    ),
    _p(
        r"\b(?:malware|ransomware|keylogger|trojan|virus\s+attachment)\b",
        "Draftly can't help write emails that spread harmful software.",
    ),
    _p(
        r"\b(?:threaten|blackmail|extort|intimidate)\w*|\b(?:kill|hurt|harm)\s+(?:you|him|her|them)\b",
        "Draftly can't help write threatening or intimidating emails.",
    ),
    _p(
        r"\b(?:harass|stalk|bully)\w*",
        "Draftly can't help write emails meant to harass or bully someone.",
    ),
    _p(
        r"\b(?:scam|ponzi|fake\s+invoice|gift\s+cards?\s+(?:urgently|now|asap)|lottery\s+winner)\b",
        "Draftly can't help write scam or fraud emails.",
    ),
]

_PLACEHOLDER = re.compile(r"\[[^\[\]\n]{1,60}\]")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE = re.compile(r"(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)")
_CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_SECRET = re.compile(r"\b(?:password|passcode|pin code|social security|ssn|cvv)\b", re.IGNORECASE)
_SHOUTING = re.compile(r"\b[A-Z]{4,}(?:\s+[A-Z]{4,}){2,}\b")
_HOSTILE = re.compile(
    r"\b(?:idiot|stupid|moron|useless|pathetic|shut up|or else|you'll regret)\b", re.IGNORECASE
)
_SUBJECT_MAX = 120


class SafetyService:
    """Input checks block a request; output checks describe what the person should look at."""

    def check_idea(self, text: str) -> None:
        for pattern in _BLOCKED_IDEAS:
            if pattern.regex.search(text):
                raise BlockedError(pattern.message, code="blocked_idea")

    def check_draft(self, subject: str, body: str) -> list[CheckResult]:
        return [
            self._subject(subject),
            self._blanks(subject, body),
            self._personal(subject + "\n" + body),
            self._respectful(subject + "\n" + body),
        ]

    @staticmethod
    def blanks(subject: str, body: str) -> list[str]:
        return list(dict.fromkeys(_PLACEHOLDER.findall(subject + "\n" + body)))

    def _subject(self, subject: str) -> CheckResult:
        label = "Subject line"
        if not subject.strip():
            return CheckResult("subject", label, False, "Add a subject so the email doesn't look like spam.")
        if len(subject) > _SUBJECT_MAX:
            return CheckResult("subject", label, False, "Long subject. Try to keep it under 120 characters.")
        return CheckResult("subject", label, True, "Clear and a good length.")

    def _blanks(self, subject: str, body: str) -> CheckResult:
        found = self.blanks(subject, body)
        if not found:
            return CheckResult("blanks", "Blanks to fill", True, "Nothing left to fill in.")
        shown = ", ".join(found[:4]) + ("…" if len(found) > 4 else "")
        noun = "blank" if len(found) == 1 else "blanks"
        return CheckResult("blanks", "Blanks to fill", False, f"{len(found)} {noun} to fill: {shown}")

    def _personal(self, text: str) -> CheckResult:
        found = []
        if _EMAIL.search(text):
            found.append("an email address")
        if _CARD.search(text):
            found.append("a card or account number")
        elif _PHONE.search(text):
            found.append("a phone number")
        if _SECRET.search(text):
            found.append("a mention of a password or ID number")
        if not found:
            return CheckResult("personal", "Personal details", True, "No personal details found.")
        listed = " and ".join(found) if len(found) < 3 else ", ".join(found[:-1]) + " and " + found[-1]
        return CheckResult(
            "personal", "Personal details", False, f"Includes {listed}. Make sure it's OK to share."
        )

    def _respectful(self, text: str) -> CheckResult:
        if _HOSTILE.search(text) or any(p.regex.search(text) for p in _BLOCKED_IDEAS[2:4]):
            return CheckResult(
                "respectful", "Respectful language", False, "Some wording may come across as hostile."
            )
        if _SHOUTING.search(text):
            return CheckResult(
                "respectful", "Respectful language", False, "Several words in capitals can read as shouting."
            )
        return CheckResult("respectful", "Respectful language", True, "Polite and respectful.")
