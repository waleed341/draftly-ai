export type StepName = "understand" | "date_check" | "writing" | "checking" | "your_review";
export type Check = { key: string; label: string; passed: boolean; message: string };
export type DraftVersion = { number: number; subject: string; body: string; source: string; created_at: string };
export type DraftEdit = { subject: string; body: string };
export type Draft = {
  id: string; idea: string; timezone: string; status: "writing" | "needs_review" | "approved" | "failed";
  subject: string; body: string; checks: Check[]; versions: DraftVersion[]; created_at: string; updated_at: string;
};
export type StreamEvent =
  | { type: "started"; draft_id: string }
  | { type: "step"; step: StepName; state: "running" | "complete" }
  | { type: "date"; value: string }
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "ready"; draft: Draft }
  | { type: "error"; message: string };
