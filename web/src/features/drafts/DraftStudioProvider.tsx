"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { browserTimeZone } from "@/lib/format";
import { friendlyMessage, isAbort } from "@/lib/http";
import { draftKeys, draftsApi } from "./api";
import { COPY, IDEA_MIN } from "./constants";
import { initialState, studioReducer, type EditBuffer, type IdeaForm, type RunMode, type StudioState } from "./state";
import type { Draft, StreamEvent } from "./types";

const CHECK_DELAY_MS = 350;
const INTERRUPTED = "The connection was interrupted before Draftly finished. Please try again.";

interface StudioActions {
  setForm: (patch: Partial<IdeaForm>) => void;
  generate: () => void;
  stop: () => void;
  rewrite: (instructions?: string) => void;
  startEdit: () => void;
  changeEdit: (patch: Partial<EditBuffer>) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  setReviewed: (value: boolean) => void;
  approve: (details: { to: string[]; gmail_connection_id: number }) => Promise<void>;
  discard: () => Promise<void>;
  openDraft: (id: number) => Promise<void>;
  newDraft: () => void;
  viewVersion: (number: number | null) => void;
  dismiss: () => void;
}

type StudioValue = { state: StudioState } & StudioActions;

const StudioContext = createContext<StudioValue | null>(null);

export function DraftStudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  const queryClient = useQueryClient();
  const runRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const refreshHistory = useCallback(
    () => queryClient.invalidateQueries({ queryKey: draftKeys.all }),
    [queryClient],
  );

  useEffect(() => () => runRef.current?.abort(), []);

  const runStream = useCallback(
    async (mode: RunMode, start: (onEvent: (e: StreamEvent) => void, signal: AbortSignal) => Promise<void>) => {
      runRef.current?.abort();
      const controller = new AbortController();
      runRef.current = controller;
      dispatch({ type: "run/start", mode });

      let draftId: number | null = null;
      let finished = false;
      let succeeded = false;
      const onEvent = (event: StreamEvent) => {
        if (event.type === "started") draftId = event.draft_id;
        if (event.type === "ready" || event.type === "error") finished = true;
        if (event.type === "ready") succeeded = true;
        dispatch({ type: "run/event", event });
      };

      try {
        await start(onEvent, controller.signal);
        if (!finished) dispatch({ type: "run/failed", message: INTERRUPTED });
      } catch (error) {
        if (isAbort(error)) dispatch({ type: "run/stopped" });
        else dispatch({ type: "run/failed", message: friendlyMessage(error) });
      } finally {
        if (runRef.current === controller) runRef.current = null;
        // A new draft that never finished has nothing worth keeping.
        if (mode === "new" && !succeeded && draftId !== null) {
          await draftsApi.discard(draftId).catch(() => undefined);
        }
        void refreshHistory();
      }
    },
    [refreshHistory],
  );

  const generate = useCallback(() => {
    const { form } = stateRef.current;
    const idea = form.idea.trim();
    if (idea.length < IDEA_MIN) {
      dispatch({ type: "error", message: COPY.idea.tooShort });
      return;
    }
    void runStream("new", (onEvent, signal) =>
      draftsApi.write({ ...form, idea, time_zone: browserTimeZone() }, onEvent, signal),
    );
  }, [runStream]);

  const rewrite = useCallback(
    (instructions?: string) => {
      const { draft, form } = stateRef.current;
      if (!draft) return;
      const note = instructions?.trim() || undefined;
      void runStream("rewrite", (onEvent, signal) =>
        draftsApi.rewrite(draft.id, { instructions: note, tone: form.tone, length: form.length }, onEvent, signal),
      );
    },
    [runStream],
  );

  /** Run a change on the current draft, show the result, and refresh the history. */
  const mutate = useCallback(
    async (action: (draft: Draft) => Promise<Draft>) => {
      const { draft } = stateRef.current;
      if (!draft) return;
      dispatch({ type: "busy", value: true });
      try {
        const updated = await action(draft);
        dispatch({ type: "draft/loaded", draft: updated });
        queryClient.setQueryData(draftKeys.detail(updated.id), updated);
      } catch (error) {
        dispatch({ type: "error", message: friendlyMessage(error) });
      } finally {
        void refreshHistory();
      }
    },
    [queryClient, refreshHistory],
  );

  const saveEdit = useCallback(async () => {
    const { editing } = stateRef.current;
    if (!editing) return;
    await mutate((d) => draftsApi.edit(d.id, editing.subject, editing.body));
  }, [mutate]);

  const approve = useCallback(async (details: { to: string[]; gmail_connection_id: number }) => {
    if (!stateRef.current.reviewed) return;
    await mutate((d) => draftsApi.approve(d.id, details));
  }, [mutate]);

  const discard = useCallback(async () => {
    const { draft } = stateRef.current;
    if (!draft) return;
    dispatch({ type: "busy", value: true });
    try {
      await draftsApi.discard(draft.id);
      queryClient.removeQueries({ queryKey: draftKeys.detail(draft.id) });
      dispatch({ type: "draft/cleared", notice: COPY.workspace.discarded });
    } catch (error) {
      dispatch({ type: "error", message: friendlyMessage(error) });
    } finally {
      void refreshHistory();
    }
  }, [queryClient, refreshHistory]);

  const openDraft = useCallback(
    async (id: number) => {
      if (stateRef.current.phase === "writing") return;
      dispatch({ type: "busy", value: true });
      try {
        const draft = await queryClient.fetchQuery({
          queryKey: draftKeys.detail(id),
          queryFn: () => draftsApi.get(id),
          staleTime: 0,
        });
        dispatch({ type: "draft/loaded", draft, form: true });
      } catch (error) {
        dispatch({ type: "error", message: friendlyMessage(error) });
        void refreshHistory();
      }
    },
    [queryClient, refreshHistory],
  );

  // Re-run the safety checks while the person edits.
  const editing = state.editing;
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    dispatch({ type: "checks/pending" });
    const timer = window.setTimeout(() => {
      draftsApi
        .check(editing.subject, editing.body, controller.signal)
        .then((result) => dispatch({ type: "checks/set", checks: result.checks, blanks: result.blanks }))
        .catch((error: unknown) => {
          if (!isAbort(error)) dispatch({ type: "checks/set", checks: stateRef.current.checks, blanks: stateRef.current.blanks });
        });
    }, CHECK_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editing]);

  const value = useMemo<StudioValue>(
    () => ({
      state,
      setForm: (patch) => dispatch({ type: "form/set", patch }),
      generate,
      stop: () => runRef.current?.abort(),
      rewrite,
      startEdit: () => dispatch({ type: "edit/start" }),
      changeEdit: (patch) => dispatch({ type: "edit/change", patch }),
      cancelEdit: () => dispatch({ type: "edit/cancel" }),
      saveEdit,
      setReviewed: (value) => dispatch({ type: "reviewed/set", value }),
      approve,
      discard,
      openDraft,
      newDraft: () => {
        dispatch({ type: "draft/cleared" });
        dispatch({ type: "form/set", patch: { idea: "" } });
      },
      viewVersion: (number) => dispatch({ type: "version/view", number }),
      dismiss: () => {
        dispatch({ type: "error", message: null });
        dispatch({ type: "notice", message: null });
      },
    }),
    [state, generate, rewrite, saveEdit, approve, discard, openDraft],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside DraftStudioProvider");
  return value;
}
