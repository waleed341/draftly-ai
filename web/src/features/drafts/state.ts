import { StepName } from "@/features/drafts/types";

export type Phase = "idle" | "writing" | "review" | "approved";
export type StudioState = { phase: Phase; streamText: string; steps: Partial<Record<StepName, "running" | "complete">> };
export type StudioAction =
  | { type: "start" }
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "step"; step: StepName; state: "running" | "complete" }
  | { type: "phase"; phase: Phase }
  | { type: "clear" };

export const initialStudioState: StudioState = { phase: "idle", streamText: "", steps: {} };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "start": return { phase: "writing", streamText: "", steps: {} };
    case "token": return { ...state, streamText: state.streamText + action.text };
    case "reset": return { ...state, streamText: "" };
    case "step": return { ...state, steps: { ...state.steps, [action.step]: action.state } };
    case "phase": return { ...state, phase: action.phase };
    case "clear": return initialStudioState;
  }
}
