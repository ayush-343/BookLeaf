"use client";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  SlidersHorizontal,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, type Ticket, categories, priorities } from "./contracts";
import { Badge, Loading, Problem } from "./ui";
import { TicketView } from "./conversation";

type Navigate = (values: Record<string, string>) => void;
function age(value: string) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 3600000),
  );
  return hours < 1
    ? "Less than an hour"
    : hours < 24
      ? hours + "h ago"
      : Math.floor(hours / 24) + "d ago";
}
export function Inbox({
  params,
  go,
}: {
  params: URLSearchParams;
  go: Navigate;
}) {
  const keys = [
    "status",
    "category",
    "priority",
    "from",
    "to",
    "page",
    "search",
    "assignment",
  ];
  const filters = Object.fromEntries(
    keys.flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])),
  );
  const query = useQuery({
    queryKey: ["staff-tickets", filters],
    queryFn: () =>
      api<{ items: Ticket[]; hasMore: boolean }>(
        "/tickets?" + new URLSearchParams(filters),
      ),
    refetchInterval: 5000,
  });
  const ticket = params.get("ticket");
  const page = Number(filters.page ?? 1);
  function navigate(values: Record<string, string>) {
    go({ view: "queue", ...filters, ...values });
  }
  return (
    <div className={"inbox" + (ticket ? " has-selection" : "")}>
      <div className="inbox-toolbar">
        <form
          className="search-form"
          key={filters.search ?? ""}
          onSubmit={(e) => {
            e.preventDefault();
            navigate({
              search: String(new FormData(e.currentTarget).get("search") ?? ""),
              page: "1",
            });
          }}
        >
          <Search size={18} />
          <label className="sr-only" htmlFor="ticket-search">
            Search subject or query
          </label>
          <input
            id="ticket-search"
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Search subject or query"
          />
          <button className="secondary">Search</button>
        </form>
        <div className="status-tabs" aria-label="Ticket status">
          {["", "Open", "In Progress", "Resolved", "Closed"].map((status) => (
            <button
              key={status}
              className="nav"
              aria-pressed={(filters.status ?? "") === status}
              onClick={() => navigate({ status, page: "1" })}
            >
              {status || "Unresolved"}
            </button>
          ))}
        </div>
        <details className="filter-disclosure">
          <summary>
            <SlidersHorizontal size={17} />
            Filters
          </summary>
          <form
            className="filter-panel"
            key={new URLSearchParams(filters).toString()}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              navigate({
                priority: String(form.get("priority")),
                category: String(form.get("category")),
                assignment: String(form.get("assignment")),
                from: String(form.get("from")),
                to: String(form.get("to")),
                page: "1",
              });
            }}
          >
            <label>
              Priority
              <select name="priority" defaultValue={filters.priority ?? ""}>
                <option value="">Any priority</option>
                {priorities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue={filters.category ?? ""}>
                <option value="">Any category</option>
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Assignment
              <select name="assignment" defaultValue={filters.assignment ?? ""}>
                <option value="">Anyone</option>
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
            <label>
              From
              <input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label>
              To
              <input type="date" name="to" defaultValue={filters.to} />
            </label>
            <div className="actions">
              <button>Apply filters</button>
              <button
                type="button"
                className="quiet"
                onClick={() => go({ view: "queue" })}
              >
                Clear
              </button>
            </div>
          </form>
        </details>
      </div>
      <div className="inbox-body">
        <section className="ticket-rail" aria-label="Ticket queue">
          <div className="rail-heading">
            <h1>Ticket queue</h1>
            <small>Priority, then oldest first</small>
          </div>
          <Problem error={query.error} />
          {query.isPending ? (
            <Loading>Loading tickets…</Loading>
          ) : query.data?.items.length ? (
            query.data.items.map((item) => (
              <button
                key={item.id}
                className="queue-item"
                aria-current={item.id === ticket ? "true" : undefined}
                onClick={() => navigate({ ticket: item.id })}
              >
                <span className="queue-meta">
                  <strong>{item.authorName ?? "Author"}</strong>
                  <time dateTime={item.createdAt}>{age(item.createdAt)}</time>
                </span>
                <span className="queue-subject">{item.subject}</span>
                <span className="queue-book">
                  <BookOpen size={14} />
                  {item.bookTitle ?? "General / Account Level"}
                </span>
                <span className="queue-preview">
                  {item.latestMessage?.body ?? item.description}
                </span>
                <span className="queue-tags">
                  <Badge>{item.priority}</Badge>
                  <Badge>{item.status}</Badge>
                  <small>{item.assignee ? "Assigned" : "Unassigned"}</small>
                </span>
              </button>
            ))
          ) : (
            !query.error && <Loading>No tickets match these filters.</Loading>
          )}
          {(page > 1 || query.data?.hasMore) && (
            <div className="pagination">
              <button
                aria-label="Previous page"
                className="secondary"
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
              >
                <ChevronLeft size={17} />
              </button>
              <span>Page {page}</span>
              <button
                aria-label="Next page"
                className="secondary"
                disabled={!query.data?.hasMore}
                onClick={() => navigate({ page: String(page + 1) })}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </section>
        <div className="conversation-area">
          {ticket ? (
            <TicketView
              key={ticket}
              id={ticket}
              admin
              params={params}
              go={(values) =>
                go({ view: "queue", ...filters, ticket, ...values })
              }
              back={() => navigate({ ticket: "" })}
            />
          ) : (
            <div className="select-ticket">
              <MessageSquare size={32} />
              <h2>Select a conversation</h2>
              <p>
                Review the author’s query, prepare a reply, and check the
                supporting facts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
