const root = "/api/v1";
export const statuses = ["Open", "In Progress", "Resolved", "Closed"];
export const categories = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
];
export const priorities = ["Critical", "High", "Medium", "Low"];
export const policyNames: Record<string, string> = {
  royalty: "Royalty policy",
  isbn: "ISBN policy",
  print: "Printing policy",
  distribution: "Distribution policy",
  production: "Production stages",
  general: "General guidance",
};
export type Identity = { name: string; role: "author" | "admin" };
export type Book = {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  available_on?: string[];
  print_partner?: string | null;
};
export type BookRow = { id: string; details: Book };
export type Entry = {
  role?: "author" | "admin";
  id: string;
  body: string;
  senderName: string;
  createdAt: string;
};
export type Ticket = {
  id: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  authorId?: string;
  priority?: string;
  category?: string;
  aiCategory?: string | null;
  assignee?: string | null;
  version?: number;
  authorName?: string;
  bookTitle?: string | null;
  latestMessage?: Entry | null;
};
export type Activity = {
  id: string;
  actorName: string;
  field: string;
  before: string | null;
  after: string | null;
  createdAt: string;
};
export type Detail = Ticket & {
  triage?: {
    state: string;
    category: string | null;
    priority: string | null;
    rationale: string | null;
    manualOverride: { category: boolean; priority: boolean };
  };
  activity?: Activity[];
  messages: Entry[];
  notes?: Entry[];
  book: Book | null;
  authorName?: string;
  policies?: Record<string, string>;
};
export type Draft = {
  policies?: Record<string, string>;
  version: number;
  reply: string;
  sources: string[];
  missing: string[];
};
export const money = (value: number | null) =>
  value === null
    ? "Not available yet"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export const reason = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch((path.startsWith("/api/") ? "" : root) + path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && !path.startsWith("/api/") && path !== "/me")
    window.dispatchEvent(new Event("bookleaf:session-ended"));
  const json = await res.json();
  if (!res.ok)
    throw new ApiError(
      res.status === 401 && path === "/me"
        ? "Sign in to continue."
        : (json.error?.message ?? json.message ?? "Request failed."),
      json.error?.code,
    );
  return json.data ?? json;
}
