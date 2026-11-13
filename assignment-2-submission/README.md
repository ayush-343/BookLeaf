# BookLeaf Assignment 2

Bubble provides native login, author and admin pages, ownership-based data access, royalty records, and the notification log. n8n validates summary requests, calls OpenRouter, renders verified financial facts and returns the final result. Email content is logged; no email is sent.

## Review access

Development preview: https://ayushsrivastavamail.bubbleapps.io/version-test/

Review profiles: admin@bookleaf.test, author1@bookleaf.test, author2@bookleaf.test. Passwords must be supplied privately to the evaluator. Password setup is being corrected: a dashboard return did not prove that the password changed, and AUTH002 ordinary login failed. Setup retry and ordinary password-login verification remain pending. This is a development preview, not a production deployment.

## Free-plan workaround

The separate n8n-to-Bubble callback returned a subscription-upgrade rejection, including at the development endpoint. The implementation instead waits for n8n's final synchronous response through Bubble's private, server-side API Connector. Bubble then updates its existing Pending notification after checking both identifiers. The callback deviation requires evaluator acceptance; that acceptance has not been confirmed.

Success means a summary was generated, validated and logged. Delivery mode is Logged. The optional email-delivery bonus is not implemented.

## Features

- Author dashboard with linked books, publication facts, platform availability, cumulative royalties and last payout dates.
- Administrative author search, city and book royalty-status filters, book counts, earned totals and pending balances.
- Single-author summary generation, persisted input snapshots, notification content, errors, retry and interrupted-attempt display.
- Sequential bulk generation for authors with positive pending royalties and unfinished summaries. Keep the admin page open. Stop/resume preserves completed records.
- Integer-paise financial storage and deterministic statement figures. AI supplies only the introduction and closing.
- Quarterly payout policy and 45-day window, without inventing a payment date for balances whose quarter is unknown. The original Knowledge Base confirms the minimum payout rollover rule.
- Linked-author reads, administrative reads, default-deny privacy rules and no auto-binding of ownership or role fields.

The sample contains ten authors and eighteen books. Missing source values are retained. The dataset provides cumulative paid balances and last payout dates, not transaction-level payout history; the application explains this limitation.

## Import the n8n workflow

Import royalty-summary-sync.json. Select two separate Header Auth credentials: inbound X-BookLeaf-Key and provider Authorization with a Bearer OpenRouter key. Enter keys directly into n8n. Credential references in the export contain no key values. Configure Bubble's matching header as Private and keep browser-side invocation disabled.

Publish the workflow and use POST /webhook/bookleaf-royalty-summary-sync. The configurable model defaults to openai/gpt-4.1-mini. The AI request timeout is twenty seconds and the complete workflow timeout is thirty seconds.

## Verification status

Thirteen local checks pass for money, statuses, dates, data minimization, prose validation and rendering. An isolated real n8n instance verified authentication rejection, malformed input, synchronous success, provider failure, malformed output and bounded provider timeout. Bubble's normal admin flow generated and stored successful summaries; bulk processing, retry counters, interruption/resume and an empty queue were exercised. Two author views were independently checked through Bubble's Run as control, including denial of an author's admin-page access.

Remaining release checks: ordinary password login, remaining administrative mutation checks, Bubble's controlled transport-delay test, mobile and keyboard inspection, and the three-to-five-minute recording. These files are implementation deliverables; they are not a claim that submission verification is complete.

The n8n Cloud workspace currently uses a time-limited trial. Continued hosting after expiry needs a separate hosting decision; Bubble remains on Free.

Source records, contact information, passwords, API keys, reset tokens and private screenshots are excluded from these shared deliverables.
