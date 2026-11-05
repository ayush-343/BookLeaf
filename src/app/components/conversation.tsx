"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Send,
  RefreshCw,
  Check,
  ShieldCheck,
  BookOpen,
  History,
  PanelRightOpen,
  X,
  Lock,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import {
  api,
  ApiError,
  reason,
  timestamp,
  statuses,
  priorities,
  categories,
  policyNames,
  type Detail,
  type Draft,
} from "./contracts";
import { Badge, BookFacts, Loading, Problem } from "./ui";
export function TicketView({
  id,
  admin,
  back,
  params,
  go,
}: {
  id: string;
  admin: boolean;
  back: () => void;
  params: URLSearchParams;
  go: (values: Record<string, string>) => void;
}) {
  const client = useQueryClient();
  const [contextOpen, setContextOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [verified, setVerified] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width:1279px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (narrow && contextOpen && !dialog.current?.open)
      dialog.current?.showModal();
    if (!contextOpen && dialog.current?.open) dialog.current.close();
  }, [narrow, contextOpen]);
  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api<Detail>("/tickets/" + id),
    refetchInterval: 5000,
  });
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftVersion, setDraftVersion] = useState<number>();
  const [rejectedDraft, setRejectedDraft] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const operation = useRef("");
  const started = useRef(false);
  const ticket = query.data;
  async function generate(regenerate: boolean) {
    setAiBusy(true);
    setAiError("");
    try {
      const result = await api<Draft>("/tickets/" + id + "/ai-draft", "POST", {
        regenerate,
      });
      setDraft(result);
    } catch (error) {
      setAiError(reason(error));
    } finally {
      setAiBusy(false);
    }
  }
  useEffect(() => {
    if (admin && ticket && ticket.status !== "Closed" && !started.current) {
      started.current = true;
      void generate(false);
    }
  }, [admin, ticket]);
  async function update(body: Record<string, unknown>) {
    if (!ticket) return;
    setError("");
    setBusy(true);
    try {
      await api("/tickets/" + id, "PATCH", {
        ...body,
        version: ticket.version,
      });
    } catch (error) {
      setError(reason(error));
    } finally {
      await query.refetch();
      setBusy(false);
    }
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    await sendMessage(false);
  }
  async function sendMessage(manual: boolean) {
    setBusy(true);
    setError("");
    operation.current ||= crypto.randomUUID();
    try {
      await api(
        "/tickets/" + id + (mode === "note" ? "/notes" : "/messages"),
        "POST",
        {
          body: mode === "note" ? noteText : replyText,
          operationId: operation.current,
          draftVersion: mode === "reply" && !manual ? draftVersion : undefined,
        },
      );
      operation.current = "";
      if (mode === "note") setNoteText("");
      else {
        setReplyText("");
        setDraftVersion(undefined);
        setRejectedDraft(false);
      }
      await client.invalidateQueries({ queryKey: ["ticket", id] });
    } catch (error) {
      setError(reason(error));
      if (mode === "reply" && draftVersion !== undefined && !manual) {
        setRejectedDraft(
          error instanceof ApiError && error.code === "stale_draft",
        );
        await query.refetch();
      }
    } finally {
      setBusy(false);
    }
  }
  if (!ticket)
    return (
      <>
        <button className="quiet" onClick={back}>
          Back to tickets
        </button>
        {query.error ? (
          <Problem error={query.error} />
        ) : (
          <Loading>Loading conversation…</Loading>
        )}
      </>
    );
  const stale = draft && draft.version !== ticket.version;
  const staleComposer =
    mode === "reply" &&
    draftVersion !== undefined &&
    (rejectedDraft || draftVersion !== ticket.version);
  const requestedPanel = params.get("panel");
  const panel = admin && ["evidence","book","activity"].includes(requestedPanel??"") ? requestedPanel! : admin ? "evidence" : "book";
  const context = (
    <>
      <div className="context-tabs" aria-label="Ticket context">
        {(admin ? ["evidence", "book", "activity"] : ["book"]).map((tab) => (
          <button
            className="nav"
            key={tab}
            aria-pressed={panel === tab}
            onClick={() => go({ ...Object.fromEntries(params), panel: tab })}
          >
            {tab === "evidence" ? (
              <ShieldCheck size={16} />
            ) : tab === "book" ? (
              <BookOpen size={16} />
            ) : (
              <History size={16} />
            )}
            {{ evidence: "Evidence", book: "Book", activity: "Activity" }[tab]}
          </button>
        ))}
      </div>
      <div className="context-content">
        {panel === "book" && (
          <>
            <h2>Book details</h2>
            {ticket.book ? (
              <>
                <p className="context-book-title">{ticket.book.title}</p>
                <BookFacts book={ticket.book} />
              </>
            ) : (
              <p>This is a general account query.</p>
            )}
          </>
        )}
        {admin && panel === "activity" && (
          <>
            <h2>Activity</h2>
            {ticket.activity?.length ? (
              <ol className="activity-list">
                {ticket.activity.map((event) => (
                  <li key={event.id}>
                    <strong>{event.actorName}</strong>
                    <p>
                      Changed{" "}
                      {event.field === "assignee" ? "assignment" : event.field}{" "}
                      from {event.before ?? "Unassigned"} to{" "}
                      {event.after ?? "Unassigned"}.
                    </p>
                    <time dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No changes recorded yet.</p>
            )}
          </>
        )}
        {admin && panel === "evidence" && (
          <>
            <section className="context-section">
              <h2>
                <Sparkles size={17} />
                Suggested triage
              </h2>
              {ticket.triage?.category ? (
                <>
                  <div className="actions">
                    <Badge>{ticket.triage.category}</Badge>
                    <Badge>{ticket.triage.priority}</Badge>
                  </div>
                  <p>
                    {ticket.triage.rationale ??
                      "No rationale was recorded for this seeded example."}
                  </p>
                </>
              ) : (
                <p>
                  {ticket.triage?.state === "pending"
                    ? "Classification is in progress."
                    : "AI triage is unavailable. Set the category and priority below."}
                </p>
              )}
              <div className="settings">
                {(
                  [
                    ["priority", "Priority", priorities],
                    ["category", "Category", categories],
                  ] as const
                ).map(([key, label, options]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={ticket[key]}
                      disabled={busy}
                      onChange={(e) => void update({ [key]: e.target.value })}
                    >
                      {options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    {ticket.triage?.manualOverride[key] && (
                      <small>Staff override</small>
                    )}
                  </label>
                ))}
              </div>
              {!ticket.aiCategory && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api(
                        "/tickets/" + id + "/ai-classification",
                        "POST",
                        {},
                      );
                    } catch (error) {
                      setError(reason(error));
                    } finally {
                      await query.refetch();
                      setBusy(false);
                    }
                  }}
                >
                  <RefreshCw size={15} />
                  Retry classification
                </button>
              )}
            </section>
            {draft && (
              <section className="verify-panel">
                <h2>
                  <AlertTriangle size={18} />
                  Verify before sending
                </h2>
                {draft.missing.length ? (
                  draft.missing.map((fact, index) => {
                    const key = draft.version + ":" + index + ":" + fact;
                    return (
                      <label key={key} className="check-label">
                        <input
                          type="checkbox"
                          checked={verified.includes(key)}
                          onChange={(e) =>
                            setVerified((current) =>
                              e.target.checked
                                ? [...current, key]
                                : current.filter((item) => item !== key),
                            )
                          }
                        />
                        {fact}
                      </label>
                    );
                  })
                ) : (
                  <p>
                    The draft did not flag missing information. Review the facts
                    before sending.
                  </p>
                )}
              </section>
            )}
            <section className="context-section">
              <h2>
                <ShieldCheck size={17} />
                {draft ? "Draft sources" : "Policy reference"}
              </h2>
              {(draft?.sources ?? Object.keys(ticket.policies ?? {})).map(
                (key) => (
                  <details className="policy-source" key={key}>
                    <summary>{policyNames[key] ?? key}</summary>
                    <p>
                      {draft?.policies?.[key] ??
                        ticket.policies?.[key] ??
                        "Refresh the ticket to view this policy."}
                    </p>
                  </details>
                ),
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
  const draftBlock = admin && ticket.status !== "Closed" && (
    <section className="draft-panel" aria-label="AI-assisted reply">
      <div className="draft-heading">
        <h2>
          <Sparkles size={18} />
          AI-assisted reply
        </h2>
        <span>
          {aiBusy
            ? "Preparing"
            : aiError
              ? "Unavailable"
              : stale
                ? "Needs refresh"
                : draft
                  ? "Ready to review"
                  : "Draft assistance"}
        </span>
      </div>
      {aiBusy && (
        <p className="draft-loading" role="status">
          Preparing a reply from the query, book facts and relevant policies…
        </p>
      )}
      <Problem error={aiError} />
      {draft && (
        <>
          <p className="draft-copy">{draft.reply}</p>
          {stale && (
            <p className="problem">
              This draft is based on an earlier ticket version. Refresh it
              before use.
            </p>
          )}
          <div className="actions">
            <button
              className="secondary"
              disabled={!!stale || (!!replyText && !staleComposer)}
              onClick={() => {
                setMode("reply");
                setReplyText(draft.reply);
                setDraftVersion(draft.version);
                setRejectedDraft(false);
                operation.current = "";
              }}
            >
              <Check size={16} />
              {replyText && staleComposer
                ? "Replace with refreshed draft"
                : "Use draft"}
            </button>
            <small>Review and edit before sending</small>
          </div>
        </>
      )}
      <button
        className="quiet"
        disabled={aiBusy}
        onClick={() => void generate(true)}
      >
        <RefreshCw size={15} />
        {draft ? "Regenerate" : "Generate draft"}
      </button>
    </section>
  );
  return (
    <div
      className={
        admin
          ? "ticket-workspace staff-ticket"
          : "ticket-workspace author-conversation"
      }
    >
      <section className="conversation-main" aria-label="Conversation">
        <div className="conversation-heading">
          <button className="quiet back-to-list" onClick={back}>
            Back to {admin ? "queue" : "my tickets"}
          </button>
          <h1>{ticket.subject}</h1>
          <div className="conversation-meta">
            <span>{ticket.authorName ?? "Your conversation"}</span>
            <span>{ticket.book?.title ?? "General / Account Level"}</span>
            <Badge>{ticket.status}</Badge>
          </div>
          <div className="ticket-tools">
            {admin && (
              <>
                <label className="sr-only" htmlFor="ticket-status">
                  Status
                </label>
                <select
                  id="ticket-status"
                  value={ticket.status}
                  disabled={busy}
                  onChange={(e) => void update({ status: e.target.value })}
                >
                  {statuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void update({ assignToMe: true })}
                >
                  {ticket.assignee ? "Assign to me again" : "Assign to me"}
                </button>
                <button
                  disabled={busy || ticket.status === "Resolved"}
                  onClick={() => void update({ status: "Resolved" })}
                >
                  <Check size={16} />
                  Resolve
                </button>
              </>
            )}
            <button
              className="secondary context-toggle"
              onClick={() => setContextOpen(true)}
            >
              <PanelRightOpen size={17} />
              {admin ? "Evidence & details" : "Book details"}
            </button>
          </div>
          <Problem error={query.error} />
        </div>
        <div className="conversation-scroll">
          <article className="message-entry">
            <div className="message-heading">
              <span className="avatar">
                {(ticket.authorName ?? "Author").slice(0, 1)}
              </span>
              <strong>{ticket.authorName ?? "Original query"}</strong>
              <span className="message-role">Author</span>
              <time dateTime={ticket.createdAt}>
                {timestamp(ticket.createdAt)}
              </time>
            </div>
            <p>{ticket.description}</p>
          </article>
          {ticket.messages.map((message) => (
            <article
              className={
                "message-entry " +
                (message.role === "admin" ? "staff-message" : "")
              }
              key={message.id}
            >
              <div className="message-heading">
                <span className="avatar">{message.senderName.slice(0, 1)}</span>
                <strong>{message.senderName}</strong>
                <span className="message-role">
                  {message.role === "admin" ? "BookLeaf team" : "Author"}
                </span>
                <time dateTime={message.createdAt}>
                  {timestamp(message.createdAt)}
                </time>
              </div>
              <p>{message.body}</p>
            </article>
          ))}
          {admin &&
            ticket.notes?.map((note) => (
              <article className="message-entry private-note" key={note.id}>
                <div className="message-heading">
                  <Lock size={15} />
                  <strong>{note.senderName}</strong>
                  <span>Internal note</span>
                  <time dateTime={note.createdAt}>
                    {timestamp(note.createdAt)}
                  </time>
                </div>
                <p>{note.body}</p>
              </article>
            ))}
          {draftBlock}
          {ticket.status !== "Closed" ? (
            <form
              className={"composer " + (mode === "note" ? "note-composer" : "")}
              onSubmit={send}
            >
              <div className="composer-tabs">
                {admin ? (
                  <>
                    <button
                      type="button"
                      className="nav"
                      aria-pressed={mode === "reply"}
                      onClick={() => {
                        setMode("reply");
                        operation.current = "";
                      }}
                    >
                      <MessageCircle size={16} />
                      Reply to author
                    </button>
                    <button
                      type="button"
                      className="nav"
                      aria-pressed={mode === "note"}
                      onClick={() => {
                        setMode("note");
                        operation.current = "";
                      }}
                    >
                      <Lock size={16} />
                      Internal note
                    </button>
                  </>
                ) : (
                  <h2>Your reply</h2>
                )}
              </div>
              <label className="composer-label">
                {mode === "note" ? "Private note" : "Message"}
                <textarea
                  placeholder={
                    mode === "note"
                      ? "Add context for the support team…"
                      : "Write your reply…"
                  }
                  rows={5}
                  maxLength={4000}
                  required
                  value={mode === "note" ? noteText : replyText}
                  onChange={(e) =>
                    mode === "note"
                      ? setNoteText(e.target.value)
                      : setReplyText(e.target.value)
                  }
                />
              </label>
              <div className="composer-footer">
                <small>
                  {mode === "note"
                    ? "Visible only to staff"
                    : "Your reply will appear in this conversation"}
                </small>
                {staleComposer ? (
                  <>
                    <p role="status">
                      The ticket changed. Your edited reply is still here.
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || !replyText.trim()}
                      onClick={() => void sendMessage(true)}
                    >
                      Send manual reply
                    </button>
                  </>
                ) : (
                  <button disabled={busy}>
                    <Send size={16} />
                    {busy
                      ? "Saving…"
                      : mode === "note"
                        ? "Add internal note"
                        : "Send reply"}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="closed-message">This conversation is closed.</p>
          )}
          <Problem error={error} />
        </div>
      </section>
      {!narrow && (
        <aside className="context-pane" aria-label="Ticket context">
          {context}
        </aside>
      )}
      {narrow && (
        <dialog
          className="context-dialog"
          ref={dialog}
          onCancel={() => setContextOpen(false)}
          onClose={() => setContextOpen(false)}
        >
          <div className="drawer-heading">
            <h2>Ticket context</h2>
            <button
              className="quiet"
              aria-label="Close context"
              onClick={() => setContextOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {context}
        </dialog>
      )}
    </div>
  );
}
