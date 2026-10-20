---
name: fullstack-ai-agent-app
description: Build or extend a client-ready AI agent web app (FastAPI + LangChain backend, Next.js frontend) in the Draftly architecture: streamed steps, safety checks, human approval, plain-language UI.
---

# Full-stack AI agent app (Draftly architecture)

Use this when the user wants a complete, client-ready AI product (e.g. Draftly, the AI email
draft app) or a new feature on one: a FastAPI API in `api/` that wraps a LangChain agent, and a
Next.js web app in `web/`. The reference build is Draftly. Reuse its structure, event protocol,
UI rules and verification loop for any similar "AI does the work, a person approves it" product.

## Non-negotiable product rules

1. **Plain language in the UI.** The client never sees technical names: no LangChain, Ollama,
   model names, MCP, tool, agent, guardrail, PII, token, prompt, v1/v2. Use: "Draftly" (writer),
   "Date check", "Safety checks", "Personal details", "Blanks to fill", "You're in control",
   "Gmail connector", "Rewrite", "Version 2". Keep all UI copy in `features/<x>/constants.ts`.
   Error messages from the API are user-facing too ("We couldn't find that draft.").
2. **Human in the loop.** Nothing is sent or published automatically. Approval requires an
   explicit `reviewed: true` confirmation. Any edit or rewrite returns the item to review.
3. **Safety checks** run on input (block harmful ideas before streaming → 422) and on output
   (rule objects returning key/label/passed/message), and re-run live while the person edits.
4. **Animated, honest progress.** Steps are driven by real server events, not timers:
   Understand → Date check → Writing → Checking → Your review.
5. **Dark and light** themes from CSS tokens. Default dark. The logo is the mark plus the wordmark only.

## Backend: `api/app` (layered; each layer only calls the one below)

```
main.py            create_app(settings, writer) factory, lifespan builds services, CORS
core/              config (pydantic-settings, env prefix), logging, errors (DomainError → JSON {error:{code,message}})
domain/            StrEnums (type, tone, length, status, version source, step), time helpers (safe_zone, today_label)
models/ + db/      SQLAlchemy 2 async; Draft + DraftVersion (versions lazy="selectin"); expire_on_commit=False
repositories/      DraftRepository + UnitOfWork (short session per step, never one session across a stream)
agents/            contracts.py (WriteJob, ToolCalled/ToolReturned/TextDelta, DraftWriter Protocol),
                   langchain_writer.py, prompts.py, tools.py (tool bound to the user's time zone via closure)
services/          draft_service (prepare_* then run() async generator), safety, parsing, mappers
schemas/           Pydantic requests/responses + stream events (Literal `type` discriminator)
api/routes/        thin routes; streaming via sse.py → StreamingResponse text/event-stream
integrations/      MailProvider Protocol + registry ("coming_soon" connectors)
```

Key patterns:
- **Writer contract**: services never import LangChain. `LangChainDraftWriter` uses
  `create_agent(model=init_chat_model(settings.llm_model, ...), tools=[...], system_prompt=...)`
  and `agent.astream(inputs, stream_mode="messages")`. Unpack both tuple and `{type:"messages",data}` shapes;
  read `langgraph_node` (`model`/`tools`), `tool_call_chunks`, and text from `content` (str or blocks).
  Wrap in `asyncio.timeout`.
- **Prepare, then stream**: `prepare_new/prepare_rewrite` validate and persist (raising proper HTTP
  errors *before* the stream starts); `run()` yields events and always ends with `ready` or `error`.
- **Event protocol**: `started{draft_id}`, `step{step,state}`, `date{value}`, `token{text}`,
  `reset` (drop text emitted before a tool call), `ready{draft}`, `error{message}`.
  If the model skips the tool, emit the server date as a fallback.
- **Interrupted runs**: catch `CancelledError` → `asyncio.shield(_interrupt())` → re-raise; on other
  exceptions log, reset status (back to `needs_review` if versions exist, else `failed`), yield a friendly error.
- **Prompt**: fixed output format `SUBJECT: ...\n---\nbody`; user content wrapped in `<idea>` tags and
  declared data, not instructions; no invented facts → square-bracket placeholders; call the date tool first.
  Rewrites include the previous version and ask for a clearly different one.
- **Parsing** tolerates markdown (`**Subject:** x`, `**bold**`). Mirror the parser in `web/.../parse.ts`
  for the live preview.
- Settings: `DRAFTLY_LLM_MODEL=ollama:gemma4:31b-cloud` style `provider:model`, optional base URL,
  `step_pacing_seconds` (0 in tests).

## Frontend: `web/src` (Next.js App Router, TypeScript strict, Tailwind v4)

```
app/                       layout (fonts via the `geist` package, providers), page, globals.css tokens, icon.svg
components/ui              Button, Card/Label, Pill, Segmented, Spinner, icons (inline stroke SVG)
components/layout          AppHeader (progress bar while writing), ThemeToggle (next-themes, class strategy)
components/providers       AppProviders: ThemeProvider + React Query
features/<feature>/        types.ts (mirror API), constants.ts (all copy), api.ts, parse.ts,
                           state.ts (one reducer: phase idle|writing|review|approved, steps, streamText...),
                           <Feature>StudioProvider.tsx (actions, AbortController, edit buffer,
                           debounced live safety checks, history invalidation), components/
lib/                       http.ts (ApiError with friendly messages), sse.ts (POST stream reader), format.ts
```

- Theme: CSS variables on `:root` and `.dark`, mapped with `@theme inline` to utilities
  (`bg-surface`, `text-muted`, `bg-accent-soft`...). `@custom-variant dark (&:where(.dark, .dark *))`.
  Animations as theme tokens (`animate-fade-up`, `animate-caret`, `animate-progress`, `animate-pulse-soft`)
  plus a reduced-motion override.
- Layout: 3 columns with flex-wrap (idea panel | draft workspace | safety + history + coming soon);
  at phone width the nav hides, stats become a 3-column grid, and the side gutter is 16px.
- History uses React Query (`draftKeys`), invalidated after every run or mutation; clicking an item opens it.
- Accessibility: real buttons and labels, `aria-pressed` on chips, `aria-live` on progress and checks,
  and text contrast that passes in both themes.

## Build order

1. Read what exists (if extending). Confirm the agent code and model string the user has.
2. Backend: config → domain → models/db → repositories → agents → services → schemas → routes → main.
3. Tests with a **FakeWriter** (chatter → ToolCalled → ToolReturned → chunked TextDelta) using
   `httpx.ASGITransport` inside `app.router.lifespan_context(app)`; cover stream events, blocked input,
   edit → rewrite → approve flow, discard/404/409, safety endpoint.
4. Frontend: tokens → ui primitives → types/constants/api/state → provider → components → page.
5. Docker (api + standalone Next), docker-compose, README (run steps, API table, architecture).

## Verify before handing over

- `pytest -q` and `ruff check app tests` (line-length 110) in `api/`.
- In `web/`: `npx tsc --noEmit` then `npx next build`.
- End to end: start the API with a slowed FakeWriter on :8000 and `next start` on :3000, then drive it with
  Playwright (fill the idea → Generate → wait for "You're in control" → Edit → Save → check the box → Approve →
  toggle theme → 390px mobile). Screenshot each step and look at them. Require zero console errors.
- Smoke-test the real writer: instantiating it and streaming without a model should fail only with a
  connection error (that proves the wiring).

## Pitfalls seen

- `next/font/google` fails offline or in sandboxes: use the `geist` npm package (`GeistSans.variable`).
- Kill the old `next-server` before rebuilding, or the page loads stale chunks ("This page couldn't load").
  Use `pgrep -f "[n]ext-server"` so the kill doesn't match its own shell.
- Tailwind: `hidden` on a component whose base class has `inline-flex` loses. Wrap it in a `hidden sm:block` span.
- `@dataclass(slots=True)` has no `__dict__`: use `dataclasses.asdict`.
- Starlette's `HTTP_422_UNPROCESSABLE_ENTITY` is deprecated: use `422`.
- Pin `typescript` 5.x with Next 16. Next rewrites `tsconfig` (`jsx: react-jsx`) on the first build; that is expected.
- Model text before a tool call leaks into the email unless you emit `reset` and clear the buffer.

## Deliver

Zip the project, excluding `node_modules`, `.next`, `.venv`, caches and `*.db`, and send it with a one-line
summary of what was verified. Mention anything not verified (for example, the real model was not reachable).
