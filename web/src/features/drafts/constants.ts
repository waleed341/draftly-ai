import type { DraftStatus, DraftType, Length, Step, Tone, VersionSource } from "./types";

export const STEPS: readonly { key: Step; label: string; detail: string }[] = [
  { key: "understand", label: "Understand", detail: "Reading your idea" },
  { key: "date_check", label: "Date check", detail: "Confirming today's date" },
  { key: "writing", label: "Writing", detail: "Drafting your email" },
  { key: "checking", label: "Checking", detail: "Running safety checks" },
  { key: "review", label: "Your review", detail: "Waiting for you" },
];

export const KIND_OPTIONS: readonly { value: DraftType; label: string }[] = [
  { value: "new", label: "New email" },
  { value: "reply", label: "Reply" },
  { value: "follow_up", label: "Follow-up" },
];

export const TONE_OPTIONS: readonly { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "direct", label: "Direct" },
  { value: "warm", label: "Warm" },
];

export const LENGTH_OPTIONS: readonly { value: Length; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export const STATUS_LABEL: Record<DraftStatus, string> = {
  writing: "Writing",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Not finished",
};

export const SOURCE_LABEL: Record<VersionSource, string> = {
  written: "Written by Draftly",
  rewrite: "Rewrite by Draftly",
  edited: "Your edit",
};

export const EXAMPLES = [
  "Ask Sara to move our Thursday sync to tomorrow afternoon",
  "Thank the team for shipping the launch on time",
  "Follow up with a client about the unpaid invoice from last month",
];

export const COPY = {
  page: {
    titleLead: "Turn rough ideas into",
    titleHighlight: "emails worth sending",
    subtitle:
      "Describe what you need and Draftly writes a clear, polished draft in seconds. Every draft is checked " +
      "for dates, personal details and missing information, and nothing is sent without your approval.",
    badges: [
      { key: "date", label: "Date-aware drafts" },
      { key: "safety", label: "Built-in safety checks" },
      { key: "control", label: "Nothing sent without you" },
    ],
    aside: "Checks and history",
    copyright: (year: number) => `© ${year} Draftly`,
    howTitle: "How Draftly works",
    howIntro: "From a rough idea to a polished, ready-to-send email in seconds, with you in charge of every word.",
    how: [
      {
        key: "write",
        title: "Write from a single idea",
        body: "Describe what you need in a sentence. Draftly turns it into a clear, well-structured email in the tone and length you choose.",
      },
      {
        key: "date",
        title: "Always the right date",
        body: "Every draft is anchored to today's date in your time zone, so “tomorrow” and “next Friday” always point to the right day.",
      },
      {
        key: "safety",
        title: "Safety checks built in",
        body: "Each draft is reviewed for personal details, blanks to fill and respectful language, and checked again as you edit.",
      },
      {
        key: "control",
        title: "You're in control",
        body: "Nothing is ever sent on your behalf. You read, refine and approve every draft before it leaves your hands.",
      },
    ],
  },
  header: {
    home: "Draftly home",
    navLabel: "Main",
    nav: ["Studio", "History", "Help"],
    stats: {
      title: "Your workspace",
      total: "Drafts",
      needsReview: "To review",
      approved: "Approved",
      rate: "Approval rate",
      rateEmpty: "Approve a draft to see your rate",
    },
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
  },
  idea: {
    title: "What's the email about?",
    hint: "A rough idea is enough. Draftly fills in the rest.",
    label: "Your idea",
    placeholder: "e.g. Ask Sara to move our Thursday sync to tomorrow afternoon",
    kind: "Type",
    tone: "Tone",
    length: "Length",
    examples: "Try an example",
    generate: "Write my draft",
    stop: "Stop writing",
    writing: "Writing your draft…",
    counter: (n: number, max: number) => `${n.toLocaleString()} / ${max.toLocaleString()}`,
    tooShort: "Add a few more words so Draftly knows what to write.",
    newDraft: "Start a new draft",
    newDraftShort: "New draft",
    rewriteHint: "Want a different feel? Pick a new tone or length, then choose Rewrite.",
  },
  workspace: {
    title: "Draft",
    progressLabel: "Progress",
    dateLabel: "Date check",
    emptyTitle: "Your draft will appear here",
    emptyBody: "Describe the email on the left and Draftly will write it while you watch. Nothing is sent without your approval.",
    writingTitle: "Writing your draft…",
    rewritingTitle: "Writing a new version…",
    subject: "Subject",
    message: "Message",
    noSubject: "(no subject)",
    version: (n: number) => `Version ${n}`,
    versions: "Versions",
    latest: "Latest",
    edit: "Edit",
    save: "Save changes",
    cancel: "Cancel",
    rewrite: "Rewrite",
    rewriteTitle: "What should change?",
    rewritePlaceholder: "Optional, e.g. shorter, mention the deadline, less formal",
    rewriteGo: "Write a new version",
    discard: "Discard",
    discardConfirm: "Discard this draft? This can't be undone.",
    copy: "Copy",
    copied: "Copied",
    stopped: "Stopped. Nothing was changed.",
    discarded: "Draft discarded.",
    olderVersion: "You're looking at an older version. Editing or approving uses the latest one.",
    showLatest: "Show latest",
  },
  control: {
    title: "You're in control",
    hint: "Draftly never sends anything. Read the draft, then approve it.",
    confirm: "I've read this draft and it's ready to send",
    approve: "Approve draft",
    blanks: (n: number) => `Fill in ${n === 1 ? "the blank" : `the ${n} blanks`} before approving.`,
    approvedTitle: "Approved",
    approvedBody: "Nothing has been sent. Copy it into your email app when you're ready.",
    reopen: "Any edit or rewrite sends it back for review.",
  },
  safety: {
    title: "Safety checks",
    hint: "Re-checked as you edit.",
    empty: "Checks run as soon as there's a draft.",
    checking: "Checking…",
    allClear: "All clear",
    toLookAt: (n: number) => `${n} to look at`,
  },
  history: {
    title: "History",
    hint: "Your recent drafts",
    empty: "No drafts yet. Your first one will show up here.",
    error: "We couldn't load your history.",
    retry: "Try again",
    versions: (n: number) => (n === 1 ? "1 version" : `${n} versions`),
    open: (subject: string) => `Open draft: ${subject}`,
  },
  soon: {
    title: "Coming soon",
    badge: "Soon",
  },
  errors: {
    title: "That didn't work",
    dismiss: "Dismiss",
  },
} as const;

export const IDEA_MIN = 3;
export const IDEA_MAX = 2000;
