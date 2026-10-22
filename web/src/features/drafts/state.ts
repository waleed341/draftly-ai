import { COPY, STEPS } from "./constants";
import type { Check, Draft, DraftType, Length, Step, StreamEvent, Tone } from "./types";

export type Phase = "idle" | "writing" | "review" | "approved";
export type StepStatus = "pending" | "active" | "done";
export type RunMode = "new" | "rewrite";

export interface IdeaForm {
  idea: string;
  kind: DraftType;
  tone: Tone;
  length: Length;
}

export interface EditBuffer {
  subject: string;
  body: string;
}

export interface StudioState {
  phase: Phase;
  form: IdeaForm;
  runMode: RunMode;
  steps: Record<Step, StepStatus>;
  date: string | null;
  streamText: string;
  draft: Draft | null;
  /** Version shown in the workspace; null means the latest. */
  viewing: number | null;
  editing: EditBuffer | null;
  checks: Check[];
  blanks: string[];
  checking: boolean;
  reviewed: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
}

export type StudioAction =
  | { type: "form/set"; patch: Partial<IdeaForm> }
  | { type: "run/start"; mode: RunMode }
  | { type: "run/event"; event: StreamEvent }
  | { type: "run/failed"; message: string }
  | { type: "run/stopped" }
  | { type: "draft/loaded"; draft: Draft; form?: boolean }
  | { type: "draft/cleared"; notice?: string }
  | { type: "edit/start" }
  | { type: "edit/change"; patch: Partial<EditBuffer> }
  | { type: "edit/cancel" }
  | { type: "checks/pending" }
  | { type: "checks/set"; checks: Check[]; blanks: string[] }
  | { type: "reviewed/set"; value: boolean }
  | { type: "version/view"; number: number | null }
  | { type: "busy"; value: boolean }
  | { type: "error"; message: string | null }
  | { type: "notice"; message: string | null };

const pendingSteps = (): Record<Step, StepStatus> =>
  Object.fromEntries(STEPS.map((s) => [s.key, "pending"])) as Record<Step, StepStatus>;

const doneSteps = (): Record<Step, StepStatus> =>
  Object.fromEntries(STEPS.map((s) => [s.key, "done"])) as Record<Step, StepStatus>;

export const initialState: StudioState = {
  phase: "idle",
  form: { idea: "", kind: "new", tone: "professional", length: "medium" },
  runMode: "new",
  steps: pendingSteps(),
  date: null,
  streamText: "",
  draft: null,
  viewing: null,
  editing: null,
  checks: [],
  blanks: [],
  checking: false,
  reviewed: false,
  busy: false,
  error: null,
  notice: null,
};

function phaseOf(draft: Draft): Phase {
  return draft.status === "approved" ? "approved" : "review";
}

function withDraft(state: StudioState, draft: Draft): StudioState {
  return {
    ...state,
    draft,
    phase: phaseOf(draft),
    steps: doneSteps(),
    streamText: "",
    viewing: null,
    editing: null,
    checks: draft.checks,
    blanks: draft.blanks,
    checking: false,
    reviewed: false,
    busy: false,
  };
}

function onEvent(state: StudioState, event: StreamEvent): StudioState {
  switch (event.type) {
    case "started":
      return state;
    case "step":
      return { ...state, steps: { ...state.steps, [event.step]: event.state } };
    case "date":
      return { ...state, date: event.value };
    case "token":
      return { ...state, streamText: state.streamText + event.text };
    case "reset":
      return { ...state, streamText: "" };
    case "ready":
      return { ...withDraft(state, event.draft), steps: { ...doneSteps(), review: "active" } };
    case "error":
      return onFailed(state, event.message);
  }
}

function onFailed(state: StudioState, message: string): StudioState {
  // A failed rewrite keeps the previous draft on screen.
  const fallback = state.draft ? phaseOf(state.draft) : "idle";
  return { ...state, phase: fallback, steps: state.draft ? doneSteps() : pendingSteps(), streamText: "", error: message };
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "form/set":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "run/start":
      return {
        ...state,
        phase: "writing",
        runMode: action.mode,
        steps: pendingSteps(),
        date: null,
        streamText: "",
        editing: null,
        viewing: null,
        reviewed: false,
        error: null,
        notice: null,
        draft: action.mode === "new" ? null : state.draft,
        checks: action.mode === "new" ? [] : state.checks,
        blanks: action.mode === "new" ? [] : state.blanks,
      };
    case "run/event":
      return onEvent(state, action.event);
    case "run/failed":
      return onFailed(state, action.message);
    case "run/stopped": {
      const next = onFailed(state, "");
      return { ...next, error: null, notice: COPY.workspace.stopped };
    }
    case "draft/loaded": {
      const next = withDraft(state, action.draft);
      if (!action.form) return next;
      const { idea, kind, tone, length } = action.draft;
      return { ...next, form: { idea, kind, tone, length }, error: null, notice: null };
    }
    case "draft/cleared":
      return { ...initialState, form: state.form, notice: action.notice ?? null };
    case "edit/start": {
      const latest = state.draft?.versions.at(-1);
      if (!latest) return state;
      return { ...state, editing: { subject: latest.subject, body: latest.body }, viewing: null, reviewed: false };
    }
    case "edit/change":
      return state.editing ? { ...state, editing: { ...state.editing, ...action.patch } } : state;
    case "edit/cancel":
      return state.draft ? { ...state, editing: null, checks: state.draft.checks, blanks: state.draft.blanks } : state;
    case "checks/pending":
      return { ...state, checking: true };
    case "checks/set":
      return { ...state, checks: action.checks, blanks: action.blanks, checking: false };
    case "reviewed/set":
      return { ...state, reviewed: action.value };
    case "version/view":
      return { ...state, viewing: action.number };
    case "busy":
      return { ...state, busy: action.value };
    case "error":
      return { ...state, error: action.message, busy: false };
    case "notice":
      return { ...state, notice: action.message };
  }
}
