# Assessment approach

I prioritized a complete author-to-staff conversation and grounded AI assistance. Authors can see the facts they need without contacting support. Staff can resolve a ticket with the conversation, book data, and relevant policy in one workspace.

A single Next.js application keeps deployment and authentication simple while retaining a documented REST interface. PostgreSQL makes ownership and ticket relationships explicit. Polling makes updates visible without operating a separate connection service.

AI is advisory. Tickets are persisted before classification, the draft uses a bounded policy context, and staff review every reply before sending. The sample data provides cumulative royalties. The model cannot verify bank status or infer that a particular payment is overdue.

In production, I would move model calls to a durable queue with idempotent jobs, use stronger per-actor abuse controls, and connect verified publishing and payment facts. I would evaluate policy adherence on anonymized queries and track latency, cost, and staff edits before expanding AI use.
