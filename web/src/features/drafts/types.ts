// Mirrors api/app/schemas. Keep in sync.

export type DraftType = "new" | "reply" | "follow_up";
export type Tone = "professional" | "friendly" | "direct" | "warm";
export type Length = "short" | "medium" | "long";
export type DraftStatus = "writing" | "needs_review" | "approved" | "failed";
export type VersionSource = "written" | "rewrite" | "edited";
export type Step = "understand" | "date_check" | "writing" | "checking" | "review";
export type StepState = "active" | "done";

export interface Check {
  key: string;
  label: string;
  passed: boolean;
  message: string;
}

export interface DraftVersion {
  number: number;
  subject: string;
  body: string;
  source: VersionSource;
  note: string | null;
  created_at: string;
}

export interface Draft {
  id: number;
  idea: string;
  kind: DraftType;
  tone: Tone;
  length: Length;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  versions: DraftVersion[];
  checks: Check[];
  blanks: string[];
  approval_id: number | null;
}

export interface DraftSummary {
  id: number;
  idea: string;
  subject: string | null;
  status: DraftStatus;
  kind: DraftType;
  version_count: number;
  updated_at: string;
}

export interface DraftStats {
  total: number;
  needs_review: number;
  approved: number;
}

export interface Connector {
  key: string;
  name: string;
  description: string;
  status: "available" | "coming_soon";
}

export interface CreateDraftInput {
  idea: string;
  kind: DraftType;
  tone: Tone;
  length: Length;
  time_zone: string;
}

export interface RewriteInput {
  instructions?: string;
  tone?: Tone;
  length?: Length;
}

export interface CheckResult {
  checks: Check[];
  blanks: string[];
}

export type StreamEvent =
  | { type: "started"; draft_id: number }
  | { type: "step"; step: Step; state: StepState }
  | { type: "date"; value: string }
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "ready"; draft: Draft }
  | { type: "error"; message: string };
