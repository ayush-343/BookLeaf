# BookLeaf Author Support Portal

Authors can review their books and royalty balances, open support tickets, and follow replies. Staff can triage and assign tickets, add private notes, and review AI suggestions alongside the relevant book facts and policies.

## Run locally

1. Install Node.js 22 or later and create a PostgreSQL database.
2. Run `npm install` and copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL`, `BETTER_AUTH_URL`, a random `BETTER_AUTH_SECRET` of at least 32 characters, and a demo password of at least 12 characters. Set `OPENROUTER_API_KEY` to enable AI.
4. Load the environment and run:

   ```sh
   set -a
   source .env.local
   set +a
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

Sign in as the seeded author `author1@bookleaf.example` or staff member `admin1@bookleaf.example`, using the seeded demo password. Seed reruns preserve existing accounts and tickets. Use an isolated demo database.

## Architecture

Next.js serves the UI and REST API in one deployment. Better Auth manages credentials and sessions. The application resolves roles from a server-side profile, scopes queries by the authenticated author's ID, and stores private notes separately. Drizzle provides parameterized access to PostgreSQL. TanStack Query refreshes visible ticket views every five seconds.

The default seed provides ten synthetic authors and eighteen synthetic books. To use the supplied assessment fixture in a fresh database, set `BOOKLEAF_SEED_FILE` to its private path before running the seed command. Imported records preserve book metadata and royalty totals. Choose the fixture before first seeding because both sets use the same book and author IDs.

## API

Business endpoints use `/api/v1`. Login and logout use Better Auth's `/api/auth/sign-in/email` and `/api/auth/sign-out`. Requests use the session cookie. Mutations require the application origin. Successful business responses use `{data}`. Errors use `{error:{code,message,fields?,requestId}}`.

| Method and path | Access and body |
|---|---|
| GET /me | Signed-in profile name and role |
| GET /books, /books/:id | Owned book(s), or staff access with optional authorId filter |
| GET /tickets | Owned list or staff queue. Filters: status, category, priority, from, to, page |
| POST /tickets | Author. subject, description, nullable bookId, UUID operationId |
| GET /tickets/:id | Role-specific conversation and book context. Staff also receive activity history. |
| PATCH /tickets/:id | Staff. version plus status, category, priority, or assignToMe |
| POST /tickets/:id/messages | Ticket participant. body and UUID operationId. Staff can supply draftVersion. |
| POST /tickets/:id/notes | Staff. body and UUID operationId |
| POST /tickets/:id/ai-classification | Staff retry |
| POST /tickets/:id/ai-draft | Staff. Optional regenerate boolean. Returns reply, policy sources, missing facts, and ticket version. |

Private notes, staff activity, and draft content are excluded from author responses. Status, assignment, category, and priority changes are recorded in the same transaction as the update. Closed tickets accept no public messages. Author follow-ups reopen resolved tickets.

## AI

A server-only adapter calls OpenRouter with one configured model, a JSON Schema response format, parameter-compatible provider routing, and an abort deadline. Zod validates the result. Classification runs after the ticket is saved. Drafting sends only relevant linked book facts, up to three public replies, and selected policy sections. Recognizable email addresses, phone numbers, and banking identifiers are redacted from free text. Imported records require an explicit `BOOKLEAF_ALLOW_IMPORTED_AI=1` after sharing authorization is established. It reports the policy references and facts that need verification. Staff decide what to send.

Drafts are cached by ticket and context fingerprint. Staff can recover from a stale draft without losing their edited text. The default OpenRouter model, `openai/gpt-4.1-mini`, supports structured outputs and handles this bounded text task at low token cost. Database limits default to 100 calls per day across the demo and 20 per actor. Provider failures, refusals, and invalid results leave the manual support workflow available. The app stores usage and latency with each completed AI run.

## Deployment

Deploy to Vercel with a dedicated Neon database. Configure the environment from the template, point `BETTER_AUTH_URL` at the deployed origin, and migrate and seed before inviting reviewers. Use an isolated demo-only password and add the published URL and reviewer credentials when the deployment is available. The public source uses synthetic fixtures. Import the supplied dataset only after hosted exposure is approved. For a production rollout, use private account provisioning, durable AI jobs, and a retention policy for ticket data.

## Scope

The attachment field previews file selection locally. The portal does not upload files, send email, or contact publishing/payment systems. The support data cannot determine a confirmed payout or publication deadline.

## Verification

Run `npm run typecheck`, then `npm run build` and `npm test`. The integration test starts a disposable PostgreSQL database and checks authentication, author isolation, private notes, ticket creation and replies, retry safety, and concurrent edits without a paid model call. The machine-readable contract is in [openapi.json](openapi.json).

For a self-contained local preview, run `npm run build && npm run demo`. It creates a temporary database, prints demo credentials, and serves the portal at http://127.0.0.1:3300 until stopped. This preview uses manual reply mode by default. Set `BOOKLEAF_DEMO_AI=1` with a local server-side OpenRouter key to enable AI for the synthetic seed.

Run `npm run test:ai` for mocked adapter checks and `npm run eval:ai` for the six-category synthetic live evaluation. With Chrome installed, set `CHROME_PATH` and run `npm test -- --visual` to check polling and session recovery. Run `npm test -- --live-ai` to exercise a synthetic ticket from classification to an edited staff reply.

## Interface

The author dashboard computes royalty and sales totals from owned books, links recent support conversations, and offers topic-specific intake guidance. The staff inbox keeps the queue, conversation, AI-assisted composer, and evidence together. On smaller screens, evidence moves into a keyboard-accessible native dialog. Search, assignment, status, priority, category, date, selected ticket, and context-tab state live in the URL.

The staff ticket response includes the recorded AI triage rationale and manual override flags. Sources show the policy text used by the selected draft. Missing-information checkboxes are local review aids and do not change book facts.
