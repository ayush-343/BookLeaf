"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, reason, type Identity } from "./components/contracts";
import { BrandLogo, Problem } from "./components/ui";
import { Books, NewTicket, AuthorTickets } from "./components/author";
import { Inbox } from "./components/inbox";
import { TicketView } from "./components/conversation";
export default function Portal() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Workspace />
    </QueryClientProvider>
  );
}
function Workspace() {
  const client = useQueryClient();
  const identity = useQuery({
    queryKey: ["identity"],
    queryFn: () => api<Identity>("/me"),
  });
  useEffect(() => {
    const endSession = () => {
      client.setQueryData(["identity"], null);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "identity",
      });
    };
    window.addEventListener("bookleaf:session-ended", endSession);
    return () =>
      window.removeEventListener("bookleaf:session-ended", endSession);
  }, [client]);
  const [location, setLocation] = useState("");
  const [signError, setSignError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const update = () => setLocation(window.location.search);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const params = new URLSearchParams(location);
  function go(values: Record<string, string> = {}) {
    const query = new URLSearchParams(values).toString();
    window.history.pushState(null, "", query ? "?" + query : "/");
    setLocation(query ? "?" + query : "");
  }
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSignError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/auth/sign-in/email", "POST", {
        email: form.get("email"),
        password: form.get("password"),
      });
      await client.invalidateQueries({ queryKey: ["identity"] });
    } catch (error) {
      setSignError(reason(error));
    } finally {
      setPending(false);
    }
  }
  async function signOut() {
    setPending(true);
    setSignError("");
    try {
      await api("/api/auth/sign-out", "POST", {});
      client.clear();
      go();
      await identity.refetch();
    } catch (error) {
      setSignError(reason(error));
    } finally {
      setPending(false);
    }
  }
  const person =
    identity.error?.message === "Sign in to continue." ? null : identity.data;
  if (identity.isPending)
    return (
      <main>
        <p role="status">Loading BookLeaf…</p>
      </main>
    );
  if (
    !person &&
    identity.isError &&
    identity.error?.message !== "Sign in to continue."
  )
    return (
      <main>
        <h1>BookLeaf support</h1>
        <Problem error={identity.error} />
        <button onClick={() => void identity.refetch()}>Try again</button>
      </main>
    );
  if (!person)
    return (
      <main className="login">
        <span className="wordmark">
          <BrandLogo />
        </span>
        <h1>Sign in to support</h1>
        <p>View your books, royalties and support conversations.</p>
        <form onSubmit={signIn}>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <Problem error={signError} />
        </form>
      </main>
    );
  const admin = person.role === "admin";
  const ticket = params.get("ticket");
  const view = params.get("view") ?? (admin ? "queue" : "books");
  return (
    <>
      <header>
        <div className="top">
          <a
            className="wordmark"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <BrandLogo />
          </a>
          {admin ? (
            <span className="workspace-title">Support workspace</span>
          ) : (
            <nav aria-label="Portal">
                <button
                  className="nav"
                  aria-current={
                    view === "books" && !ticket ? "page" : undefined
                  }
                  onClick={() => go()}
                >
                  My books
                </button>
                <button
                  className="nav"
                  aria-current={
                    view === "tickets" || ticket ? "page" : undefined
                  }
                  onClick={() => go({ view: "tickets" })}
                >
                  My tickets
                </button>
            </nav>
          )}
          <div className="identity">
            <span>{person.name}</span>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={admin ? "staff-main" : "author-main"}>
        <Problem error={signError} />
        {admin ? (
          <Inbox params={params} go={go} />
        ) : ticket ? (
          <TicketView
            key={ticket}
            id={ticket}
            admin={false}
            params={params}
            go={go}
            back={() => go({ view: "tickets" })}
          />
        ) : !admin && view === "new" ? (
          <NewTicket
            initial={params.get("book") ?? ""}
            topic={params.get("topic") ?? ""}
            complete={(id) => go({ ticket: id })}
            cancel={() => go({ view: "tickets" })}
          />
        ) : !admin && view === "books" ? (
          <Books name={person.name} go={go} />
        ) : (
          <AuthorTickets params={params} go={go} />
        )}
      </main>
    </>
  );
}
