import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true });
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: time("created_at").defaultNow().notNull(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const session = pgTable("session", {
  id: text().primaryKey(),
  token: text().notNull().unique(),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  updatedAt: time("updated_at").notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  scope: text(),
  password: text(),
  accessTokenExpiresAt: time("access_token_expires_at"),
  refreshTokenExpiresAt: time("refresh_token_expires_at"),
  createdAt: time("created_at").defaultNow().notNull(),
  updatedAt: time("updated_at").notNull(),
});
export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const profiles = pgTable("profiles", {
  userId: text()
    .primaryKey()
    .references(() => user.id),
  role: text({ enum: ["author", "admin"] }).notNull(),
  authorId: text().unique(),
  details: jsonb().$type<Record<string, unknown>>(),
});
export const books = pgTable("books", {
  id: text().primaryKey(),
  authorId: text()
    .notNull()
    .references(() => profiles.authorId),
  details: jsonb()
    .$type<Record<string, string | number | string[] | null>>()
    .notNull(),
});
export const tickets = pgTable(
  "tickets",
  {
    id: text().primaryKey(),
    operationId: text().notNull(),
    authorId: text()
      .notNull()
      .references(() => profiles.authorId),
    bookId: text().references(() => books.id),
    subject: text().notNull(),
    description: text().notNull(),
    status: text().notNull().default("Open"),
    category: text(),
    priority: text(),
    aiCategory: text(),
    aiPriority: text(),
    assignee: text().references(() => user.id),
    version: integer().notNull().default(1),
    createdAt: time("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.authorId, t.operationId),
    index("tickets_author_created").on(t.authorId, t.createdAt),
    index("tickets_status_created").on(t.status, t.createdAt),
  ],
);
export const messages = pgTable("messages", {
  id: text().primaryKey(),
  ticketId: text()
    .notNull()
    .references(() => tickets.id),
  senderId: text()
    .notNull()
    .references(() => user.id),
  senderName: text().notNull(),
  body: text().notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});
export const notes = pgTable("notes", {
  id: text().primaryKey(),
  ticketId: text()
    .notNull()
    .references(() => tickets.id),
  senderId: text()
    .notNull()
    .references(() => user.id),
  senderName: text().notNull(),
  body: text().notNull(),
  createdAt: time("created_at").defaultNow().notNull(),
});
export const aiRuns = pgTable("ai_runs", {
  id: text().primaryKey(),
  ticketId: text()
    .notNull()
    .references(() => tickets.id),
  kind: text().notNull(),
  state: text({ enum: ["pending", "ready", "failed"] })
    .notNull()
    .default("pending"),
  fingerprint: text().notNull(),
  model: text().notNull(),
  actorId: text().references(() => user.id),
  output: jsonb(),
  usage: jsonb(),
  latencyMs: integer(),
  createdAt: time("created_at").defaultNow().notNull(),
});

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: text().primaryKey(),
    ticketId: text()
      .notNull()
      .references(() => tickets.id),
    actorId: text()
      .notNull()
      .references(() => user.id),
    actorName: text().notNull(),
    field: text({
      enum: ["status", "assignee", "category", "priority"],
    }).notNull(),
    before: text(),
    after: text(),
    createdAt: time("created_at").defaultNow().notNull(),
  },
  (t) => [index("ticket_events_ticket_created").on(t.ticketId, t.createdAt)],
);
