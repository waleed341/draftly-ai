"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, Label, labelClass } from "@/components/ui/Card";
import { PlusIcon, SparkIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { COPY, EXAMPLES, IDEA_MAX, KIND_OPTIONS, LENGTH_OPTIONS, TONE_OPTIONS } from "../constants";
import { useStudio } from "../DraftStudioProvider";

export function IdeaPanel() {
  const { state, setForm, generate, newDraft } = useStudio();
  const { form, phase, draft } = state;
  const writing = phase === "writing";
  const hasDraft = Boolean(draft);

  return (
    <Card className="w-full lg:w-[340px] lg:shrink-0" aria-labelledby="idea-title">
      <CardHeader
        id="idea-title"
        title={COPY.idea.title}
        hint={COPY.idea.hint}
        action={
          hasDraft && !writing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={newDraft}
              className="-mt-1 border-accent/50! bg-accent-soft! text-accent-text! hover:border-accent!"
            >
              <PlusIcon className="size-4" />
              {COPY.idea.newDraftShort}
            </Button>
          ) : null
        }
      />
      <form
        className="space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!writing) generate();
        }}
      >
        <div>
          <Label htmlFor="idea">{COPY.idea.label}</Label>
          <textarea
            id="idea"
            value={form.idea}
            onChange={(e) => setForm({ idea: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !writing) {
                e.preventDefault();
                generate();
              }
            }}
            maxLength={IDEA_MAX}
            rows={5}
            readOnly={writing}
            placeholder={COPY.idea.placeholder}
            className="block w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-ring/30 read-only:opacity-70"
          />
          <div className="mt-1.5 flex justify-end text-xs text-subtle" aria-live="off">
            {COPY.idea.counter(form.idea.length, IDEA_MAX)}
          </div>
          {!form.idea && !hasDraft && (
            <div className="mt-1">
              <span className={labelClass}>{COPY.idea.examples}</span>
              <ul className="flex flex-col gap-1.5">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => setForm({ idea: example })}
                      className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-fg"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <fieldset>
          <legend className={labelClass}>{COPY.idea.kind}</legend>
          <Segmented label={COPY.idea.kind} value={form.kind} options={KIND_OPTIONS} onChange={(kind) => setForm({ kind })} disabled={writing || hasDraft} />
        </fieldset>
        <fieldset>
          <legend className={labelClass}>{COPY.idea.tone}</legend>
          <Segmented variant="chips" label={COPY.idea.tone} value={form.tone} options={TONE_OPTIONS} onChange={(tone) => setForm({ tone })} disabled={writing} />
        </fieldset>
        <fieldset>
          <legend className={labelClass}>{COPY.idea.length}</legend>
          <Segmented label={COPY.idea.length} value={form.length} options={LENGTH_OPTIONS} onChange={(length) => setForm({ length })} disabled={writing} />
        </fieldset>

        {writing ? (
          // The only Stop button lives on the Draft card; here the main action just shows it's busy.
          <Button key="writing" size="lg" className="w-full" disabled loading>
            {COPY.idea.writing}
          </Button>
        ) : hasDraft ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">{COPY.idea.rewriteHint}</p>
            <Button key="new-draft" size="lg" className="w-full" onClick={newDraft}>
              <PlusIcon className="size-4" />
              {COPY.idea.newDraft}
            </Button>
          </div>
        ) : (
          <Button key="generate" type="submit" size="lg" className="w-full">
            <SparkIcon className="size-4" />
            {COPY.idea.generate}
          </Button>
        )}
      </form>
    </Card>
  );
}
