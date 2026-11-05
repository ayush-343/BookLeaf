"use client";
import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Coins,
  MessageCircle,
  Package,
  Send,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import {
  api,
  money,
  timestamp,
  reason,
  type BookRow,
  type Ticket,
} from "./contracts";
import { Badge, BookFacts, Loading, Problem } from "./ui";

type Navigate = (values: Record<string, string>) => void;
const topics = [
  {
    label: "Royalties",
    icon: Coins,
    hint: "Tell us the balance or payout you’re asking about, and the period if you know it. Please keep bank details private.",
  },
  {
    label: "ISBN",
    icon: BookOpen,
    hint: "Include the ISBN shown and where you noticed the mismatch.",
  },
  {
    label: "Printing",
    icon: Package,
    hint: "Describe the defect, how many copies are affected, and when you received them. The team may ask for photographs.",
  },
  {
    label: "Distribution",
    icon: Send,
    hint: "Include the affected platform and listing URL, and what availability message you see.",
  },
  {
    label: "Production",
    icon: Clock3,
    hint: "Tell us the stage you’re asking about and the last update you received.",
  },
  {
    label: "General",
    icon: MessageCircle,
    hint: "Describe what you need and what a helpful next step would be.",
  },
];
export function Books({ name, go }: { name: string; go: Navigate }) {
  const query = useQuery({
    queryKey: ["books"],
    queryFn: () => api<BookRow[]>("/books"),
  });
  const books = query.data ?? [];
  const totals = books.reduce(
    (sum, { details: b }) => ({
      sold: sum.sold + b.total_copies_sold,
      earned: sum.earned + b.total_royalty_earned,
      paid: sum.paid + b.royalty_paid,
      pending: sum.pending + b.royalty_pending,
    }),
    { sold: 0, earned: 0, paid: 0, pending: 0 },
  );
  const stats = [
    {
      label: "Copies sold",
      value: totals.sold.toLocaleString("en-IN"),
      icon: BookOpen,
    },
    { label: "Royalty earned", value: money(totals.earned), icon: Coins },
    { label: "Paid", value: money(totals.paid), icon: CheckCircle2 },
    { label: "Pending", value: money(totals.pending), icon: Clock3 },
  ];
  return (
    <>
      <div className="pagehead">
        <div>
          <p className="welcome">Welcome, {name}</p>
          <h1>Your publishing overview</h1>
          <p>Your books, royalties and support in one place.</p>
        </div>
        <button onClick={() => go({ view: "new" })}>
          <MessageCircle size={18} />
          New support ticket
        </button>
      </div>
      {query.isPending ? (
        <Loading>Loading your publishing overview…</Loading>
      ) : query.error ? (
        <Problem error={query.error} />
      ) : (
        <>
          <section className="summary-strip" aria-label="Royalty overview">
            {stats.map(({ label, value, icon: Icon }) => (
              <div className="summary-item" key={label}>
                <Icon size={23} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </section>
          <div className="author-grid">
            <section aria-label="Your books">
              <div className="section-heading">
                <h2>My books</h2>
                <span>
                  {books.length} {books.length === 1 ? "title" : "titles"}
                </span>
              </div>
              {books.length ? (
                books.map(({ id, details: b }) => {
                  const production = b.status !== "Published & Live";
                  return (
                    <article className="book-panel" key={id}>
                      <div
                        className="book-placeholder"
                        aria-label="Title placeholder"
                      >
                        <BookOpen size={20} />
                        <span>{b.title}</span>
                        <small>{b.genre}</small>
                      </div>
                      <div className="book-content">
                        <h3>{b.title}</h3>
                        <p>{b.genre}</p>
                        <Badge>{b.status}</Badge>
                        {production ? (
                          <div className="production-summary">
                            <Clock3 size={17} />
                            <p>
                              {b.status.replace("In Production - ", "")} is the
                              recorded stage. Publication and royalty details
                              will appear when available.
                            </p>
                          </div>
                        ) : (
                          <div className="book-numbers">
                            <div>
                              <span>Copies sold</span>
                              <strong>
                                {b.total_copies_sold.toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div>
                              <span>Pending royalty</span>
                              <strong>{money(b.royalty_pending)}</strong>
                              {b.royalty_pending === 0 && (
                                <small>Paid in full</small>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="book-actions">
                          <details>
                            <summary>View details</summary>
                            <BookFacts book={b} />
                          </details>
                          <button
                            className="secondary"
                            onClick={() => go({ view: "new", book: id })}
                          >
                            <MessageCircle size={16} />
                            Ask about this book
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <Loading>
                  Your books will appear here when they’re added to your
                  account.
                </Loading>
              )}
            </section>
            <aside className="author-sidebar">
              <RecentTickets go={go} />
              <section className="help-panel">
                <h2>A question about your book?</h2>
                <p>
                  Start with a topic and we’ll help you include the right
                  details.
                </p>
                {[topics[0], topics[2], topics[3]].map(
                  ({ label, icon: Icon }) => (
                    <button
                      key={label}
                      className="topic-link"
                      onClick={() => go({ view: "new", topic: label })}
                    >
                      <Icon size={19} />
                      <span>{label}</span>
                      <ChevronRight size={16} />
                    </button>
                  ),
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
function RecentTickets({ go }: { go: Navigate }) {
  const query = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: () => api<{ items: Ticket[] }>("/tickets"),
    refetchInterval: 5000,
  });
  return (
    <section className="support-panel">
      <h2>Recent support</h2>
      {query.isPending ? (
        <Loading>Loading support…</Loading>
      ) : query.error ? (
        <Problem error={query.error} />
      ) : query.data?.items.length ? (
        query.data.items.slice(0, 3).map((ticket) => (
          <button
            className="recent-ticket"
            key={ticket.id}
            onClick={() => go({ ticket: ticket.id })}
          >
            <span className="recent-title">
              <span className="recent-subject">{ticket.subject}</span>
              <Badge>{ticket.status}</Badge>
            </span>
            <small>{ticket.bookTitle ?? "General / Account Level"}</small>
            <p>{ticket.latestMessage?.body ?? ticket.description}</p>
            <time
              dateTime={ticket.latestMessage?.createdAt ?? ticket.createdAt}
            >
              {ticket.latestMessage ? "Latest reply" : "Opened"}{" "}
              {timestamp(ticket.latestMessage?.createdAt ?? ticket.createdAt)}
            </time>
          </button>
        ))
      ) : (
        <p className="muted">Your support conversations will appear here.</p>
      )}
      <button className="quiet" onClick={() => go({ view: "tickets" })}>
        View all tickets
        <ArrowRight size={15} />
      </button>
    </section>
  );
}
export function NewTicket({
  initial,
  topic,
  complete,
  cancel,
}: {
  initial: string;
  topic: string;
  complete: (id: string) => void;
  cancel: () => void;
}) {
  const query = useQuery({
    queryKey: ["books"],
    queryFn: () => api<BookRow[]>("/books"),
  });
  const [selected, setSelected] = useState(
    topics.some((item) => item.label === topic) ? topic : "General",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const operation = useRef("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    operation.current ||= crypto.randomUUID();
    try {
      const ticket = await api<Ticket>("/tickets", "POST", {
        bookId: form.get("bookId") || null,
        subject: form.get("subject"),
        description: form.get("description"),
        operationId: operation.current,
      });
      complete(ticket.id);
    } catch (error) {
      setError(reason(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="intake-layout">
      <section className="intake-main">
        <button className="quiet" onClick={cancel}>
          Back to tickets
        </button>
        <h1>How can we help?</h1>
        <p>A few details will help our team get to the right answer.</p>
        <form onSubmit={submit}>
          <label>
            Book
            <select
              name="bookId"
              key={query.isSuccess ? "ready" : "loading"}
              defaultValue={initial}
            >
              <option value="">General / Account Level</option>
              {query.data?.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.details.title}
                </option>
              ))}
            </select>
          </label>
          <Problem error={query.error} />
          <label>
            What’s this about?
            <select
              name="topic"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {topics.map((topic) => (
                <option key={topic.label}>{topic.label}</option>
              ))}
            </select>
          </label>
          <p className="intake-hint" id="intake-help">
            {topics.find((topic) => topic.label === selected)?.hint}
          </p>
          <label>
            Subject
            <input name="subject" required maxLength={150} />
          </label>
          <label>
            Description
            <textarea
              name="description"
              required
              maxLength={4000}
              rows={7}
              aria-describedby="intake-help"
            />
          </label>
          <label>
            Attachment
            <input type="file" aria-describedby="attachment-help" />
          </label>
          <p id="attachment-help" className="muted">
            File selection preview only. Files are not uploaded.
          </p>
          <Problem error={error} />
          <button disabled={pending}>
            <Send size={17} />
            {pending ? "Submitting ticket…" : "Submit ticket"}
          </button>
        </form>
      </section>
      <aside className="help-panel">
        <MessageCircle size={25} />
        <h2>A conversation with our team</h2>
        <p>
          We’ll review your query alongside your book information. You can
          follow replies in My tickets.
        </p>
        <p>
          For your privacy, keep passwords and banking identifiers out of your
          message.
        </p>
      </aside>
    </div>
  );
}
export function AuthorTickets({
  params,
  go,
}: {
  params: URLSearchParams;
  go: Navigate;
}) {
  const page = Number(params.get("page") ?? 1);
  const query = useQuery({
    queryKey: ["author-tickets", page],
    queryFn: () =>
      api<{ items: Ticket[]; hasMore: boolean }>("/tickets?page=" + page),
    refetchInterval: 5000,
  });
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>My tickets</h1>
          <p>Your conversations with the BookLeaf team.</p>
        </div>
        <button onClick={() => go({ view: "new" })}>
          <MessageCircle size={18} />
          New support ticket
        </button>
      </div>
      <Problem error={query.error} />
      {query.isPending ? (
        <Loading>Loading your conversations…</Loading>
      ) : query.data?.items.length ? (
        <section className="author-ticket-list">
          {query.data.items.map((ticket) => (
            <button
              key={ticket.id}
              className="author-ticket"
              onClick={() => go({ ticket: ticket.id })}
            >
              <MessageCircle size={22} />
              <span>
                <strong>{ticket.subject}</strong>
                <small>{ticket.bookTitle ?? "General / Account Level"}</small>
                <p>{ticket.latestMessage?.body ?? ticket.description}</p>
                <time>
                  {ticket.latestMessage ? "Latest reply" : "Opened"}{" "}
                  {timestamp(
                    ticket.latestMessage?.createdAt ?? ticket.createdAt,
                  )}
                </time>
              </span>
              <Badge>{ticket.status}</Badge>
              <ChevronRight size={18} />
            </button>
          ))}
        </section>
      ) : (
        !query.error && (
          <Loading>You haven’t opened a support ticket yet.</Loading>
        )
      )}
      {(page > 1 || query.data?.hasMore) && (
        <div className="pagination">
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => go({ view: "tickets", page: String(page - 1) })}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="secondary"
            disabled={!query.data?.hasMore}
            onClick={() => go({ view: "tickets", page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
