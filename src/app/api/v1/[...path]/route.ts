import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../../../../server/auth";
import { db } from "../../../../server/db";
import { books, profiles, tickets, messages, notes, aiRuns, user, ticketEvents } from "../../../../server/schema";
import { categories, priorities, generate, selectPolicies, draftInput, ticketText, knowledgeVersion } from "../../../../server/ai";

const statuses = ["Open","In Progress","Resolved","Closed"] as const;
const reply = (data:unknown,status=200) => Response.json({data},{status,headers:{"Cache-Control":"private, no-store"}});
const fail = (status:number,code:string,message:string,fields?:unknown) => Response.json({error:{code,message,fields,requestId:randomUUID()}},{status,headers:{"Cache-Control":"private, no-store"}});
const missing = () => fail(404,"not_found","Resource not found.");
const forbidden = () => fail(403,"forbidden","You cannot perform this action.");
const text = (max:number) => z.string().trim().min(1).max(max);
const create = z.object({subject:text(150),description:text(4000),bookId:z.string().max(40).nullable(),operationId:z.uuid()}).strict();
const patch = z.object({version:z.number().int().positive(),status:z.enum(statuses).optional(),category:z.enum(categories).optional(),priority:z.enum(priorities).optional(),assignToMe:z.literal(true).optional()}).strict();
const message = z.object({body:text(4000),operationId:z.uuid(),draftVersion:z.number().int().positive().optional()}).strict();
type Context = {params:Promise<{path:string[]}>};
type Ticket = typeof tickets.$inferSelect;
const publicTicket = ({id,bookId,subject,description,status,createdAt}:Ticket) => ({id,bookId,subject,description,status,createdAt});
const adminTicket = (t:Ticket) => ({...t,category:t.category??t.aiCategory??"General Inquiry",priority:t.priority??t.aiPriority??"Medium"});

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = {id:string; name:string};
const tracked = ["status","assignee","category","priority"] as const;

async function recordChanges(tx:Transaction,before:Ticket,after:Ticket,actor:Actor) {
  const old = adminTicket(before);
  const current = adminTicket(after);
  const events = tracked.filter(field=>old[field]!==current[field]).map(field=>({
    id:randomUUID(),ticketId:before.id,actorId:actor.id,actorName:actor.name,
    field,before:old[field],after:current[field],
  }));
  if (events.length) await tx.insert(ticketEvents).values(events);
}

async function runAI(kind:"classify"|"draft", ticket:Ticket, input:unknown, fingerprint:string, actor:Actor) {
  if (!process.env.OPENROUTER_API_KEY) return;
  const [owner] = await db.select({details:profiles.details}).from(profiles).where(eq(profiles.authorId,ticket.authorId));
  if (owner?.details?.synthetic!==true && process.env.BOOKLEAF_ALLOW_IMPORTED_AI!=="1") return;
  const run = await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(481093)`);
    const limit = Number(process.env.AI_DAILY_LIMIT ?? 100) || 100;
    const [usage] = await tx.select({count:sql<number>`count(*)::int`, actorCount:sql<number>`count(*) filter (where ${aiRuns.actorId} = ${actor.id})::int`}).from(aiRuns).where(sql`created_at >= date_trunc('day', now())`);
    if (usage.count >= limit || usage.actorCount >= 20) return;
    const [row] = await tx.insert(aiRuns).values({id:randomUUID(),ticketId:ticket.id,kind,fingerprint,actorId:actor.id,model:process.env.OPENROUTER_MODEL??"openai/gpt-4.1-mini"}).returning();
    return row;
  });
  if (!run) return;
  try {
    const result = await generate(kind,input,adminTicket(ticket).category);
    await db.update(aiRuns).set(result).where(eq(aiRuns.id,run.id));
    if ("category" in result.output) {
      const {category,priority} = result.output;
      await db.transaction(async tx=>{
        const [before] = await tx.select().from(tickets).where(eq(tickets.id,ticket.id)).for("update");
        const next = {...before,aiCategory:category,aiPriority:priority};
        const old = adminTicket(before), current = adminTicket(next);
        const changed = old.category!==current.category || old.priority!==current.priority;
        const [after] = await tx.update(tickets).set({aiCategory:category,aiPriority:priority,version:before.version+Number(changed)}).where(eq(tickets.id,ticket.id)).returning();
        await recordChanges(tx,before,after,{...actor,name:"AI triage"});
      });
    }
    return result.output;
  } catch { return; }
}
async function handle(req:Request, ctx:Context) {
  const session = await auth.api.getSession({headers:req.headers});
  if (!session) return fail(401,"unauthenticated","Sign in to continue.");
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId,session.user.id));
  if (!profile || (profile.role === "author" && !profile.authorId)) return forbidden();
  const admin = profile.role === "admin";
  const [resource,id,action,...rest] = (await ctx.params).path;
  if (rest.length) return missing();
  const get = req.method === "GET";
  const post = req.method === "POST";
  if (!get && req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL ?? req.url).origin) return forbidden();
  const url = new URL(req.url);
  async function body() {
    const raw = await req.text();
    if (raw.length > 16000) throw new RangeError();
    try { return JSON.parse(raw); } catch { throw new SyntaxError(); }
  }
  if (get && resource === "me" && !id) return reply({name:session.user.name,role:profile.role});
  if (get && resource === "books" && !action) {
    const author = admin ? url.searchParams.get("authorId") : profile.authorId;
    const rows = await db.select().from(books).where(and(id?eq(books.id,id):undefined,author?eq(books.authorId,author):undefined)).orderBy(books.id);
    return id ? rows.length ? reply(rows[0]) : missing() : reply(rows);
  }
  if (resource !== "tickets") return missing();
  if (!id && get) {
    const q = z.object({status:z.enum(statuses).optional(),category:z.enum(categories).optional(),priority:z.enum(priorities).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(1).max(1000).default(1)}).parse(Object.fromEntries(url.searchParams));
    const conditions = admin ? [
      q.status?eq(tickets.status,q.status):sql`status in ('Open','In Progress')`,
      q.category?sql`coalesce(${tickets.category},${tickets.aiCategory},'General Inquiry') = ${q.category}`:undefined,
      q.priority?sql`coalesce(${tickets.priority},${tickets.aiPriority},'Medium') = ${q.priority}`:undefined,
      q.from?sql`created_at >= ${q.from}::date`:undefined,
      q.to?sql`created_at < ${q.to}::date + interval '1 day'`:undefined,
    ] : [eq(tickets.authorId,profile.authorId!)];
    const rows = await db.select().from(tickets).where(and(...conditions)).orderBy(admin
      ? sql`case coalesce(${tickets.priority},${tickets.aiPriority},'Medium') when 'Critical' then 1 when 'High' then 2 when 'Medium' then 3 else 4 end, created_at, id`
      : desc(tickets.createdAt)).limit(26).offset((q.page-1)*25);
    return reply({items:rows.slice(0,25).map(t=>admin?adminTicket(t):publicTicket(t)),hasMore:rows.length>25});
  }
  if (!id && post && !admin && profile.authorId) {
    const data = create.parse(await body());
    if (data.bookId && !(await db.select().from(books).where(and(eq(books.id,data.bookId),eq(books.authorId,profile.authorId)))).length) return missing();
    const [ticket] = await db.insert(tickets).values({...data,id:randomUUID(),authorId:profile.authorId}).onConflictDoNothing().returning();
    if (!ticket) {
      const [existing] = await db.select().from(tickets).where(and(eq(tickets.authorId,profile.authorId),eq(tickets.operationId,data.operationId)));
      return reply(publicTicket(existing));
    }
    await runAI("classify",ticket,ticketText(data.subject,data.description),"triage-v2",session.user).catch(()=>undefined);
    return reply(publicTicket(ticket),201);
  }
  if (!id) return forbidden();
  const [ticket] = await db.select().from(tickets).where(and(eq(tickets.id,id),admin?undefined:eq(tickets.authorId,profile.authorId!)));
  if (!ticket) return missing();
  const [book] = ticket.bookId ? await db.select().from(books).where(and(eq(books.id,ticket.bookId),eq(books.authorId,ticket.authorId))) : [];
  if (get && !action) {
    const thread = await db.select({id:messages.id,body:messages.body,senderName:messages.senderName,createdAt:messages.createdAt}).from(messages).where(eq(messages.ticketId,id)).orderBy(messages.createdAt);
    const base = {...publicTicket(ticket),book:book?.details??null,messages:thread};
    if (!admin) return reply(base);
    const [author] = await db.select({name:user.name}).from(profiles).innerJoin(user,eq(profiles.userId,user.id)).where(eq(profiles.authorId,ticket.authorId));
    const privateNotes = await db.select().from(notes).where(eq(notes.ticketId,id)).orderBy(notes.createdAt);
    const activity = await db.select().from(ticketEvents).where(eq(ticketEvents.ticketId,id)).orderBy(desc(ticketEvents.createdAt),desc(ticketEvents.id));
    const assigneeIds = new Set(activity.filter(event=>event.field==="assignee").flatMap(event=>[event.before,event.after]));
    const names = new Map<string,string>();
    for (const assignee of assigneeIds) {
      if (!assignee) continue;
      const [person] = await db.select({name:user.name}).from(user).where(eq(user.id,assignee));
      if (person) names.set(assignee,person.name);
    }
    return reply({...base,...adminTicket(ticket),authorName:author?.name,notes:privateNotes,
      activity:activity.map(event=>event.field==="assignee"?{...event,before:event.before?names.get(event.before)??event.before:null,after:event.after?names.get(event.after)??event.after:null}:event),
      policies:selectPolicies({subject:ticket.subject,description:ticket.description},adminTicket(ticket).category)});
  }
  if (post && action==="messages") {
    const data = message.parse(await body());
    return db.transaction(async tx=>{
      const [current] = await tx.select().from(tickets).where(eq(tickets.id,id)).for("update");
      const [existing] = await tx.select().from(messages).where(eq(messages.id,data.operationId));
      if (existing) return existing.ticketId===id && existing.senderId===session.user.id ? reply({id:existing.id}) : fail(409,"conflict","Operation ID already used.");
      if (current.status==="Closed") return fail(409,"closed","This ticket is closed.");
      if (data.draftVersion!==undefined && !admin) return forbidden();
      if (data.draftVersion!==undefined && data.draftVersion!==current.version) return fail(409,"stale_draft","The ticket changed. Refresh the draft or send your edited text as a manual reply.");
      await tx.insert(messages).values({id:data.operationId,ticketId:id,body:data.body,senderId:session.user.id,senderName:session.user.name});
      const [after] = await tx.update(tickets).set({version:current.version+1,status:!admin&&current.status==="Resolved"?"Open":current.status}).where(eq(tickets.id,id)).returning();
      await recordChanges(tx,current,after,session.user);
      return reply({id:data.operationId},201);
    });
  }
  if (!admin) return forbidden();
  if (req.method==="PATCH" && !action) {
    const {version,assignToMe,...changes} = patch.parse(await body());
    return db.transaction(async tx=>{
      const [before] = await tx.select().from(tickets).where(eq(tickets.id,id)).for("update");
      if (before.version!==version) return fail(409,"stale_ticket","Ticket changed. Refresh and try again.");
      const update = {...changes,...(assignToMe?{assignee:session.user.id}:{})};
      if (!Object.entries(update).some(([key,value])=>before[key as keyof Ticket]!==value)) return reply(adminTicket(before));
      const [after] = await tx.update(tickets).set({...update,version:version+1}).where(eq(tickets.id,id)).returning();
      await recordChanges(tx,before,after,session.user);
      return reply(adminTicket(after));
    });
  }
  if (post && action==="notes") {
    const data = message.parse(await body());
    await db.insert(notes).values({id:data.operationId,ticketId:id,body:data.body,senderId:session.user.id,senderName:session.user.name}).onConflictDoNothing();
    return reply({id:data.operationId},201);
  }
  if (post && action==="ai-classification") {
    const result = await runAI("classify",ticket,ticketText(ticket.subject,ticket.description),"triage-v2",session.user);
    return result?reply(result):fail(503,"ai_unavailable","AI unavailable. Set category and priority manually.");
  }
  if (post && action==="ai-draft") {
    const {regenerate} = z.object({regenerate:z.boolean().optional()}).parse(await body());
    const recent = await db.select({body:messages.body}).from(messages).where(eq(messages.ticketId,id)).orderBy(desc(messages.createdAt)).limit(3);
    const input = draftInput(ticket.subject,ticket.description,recent.reverse(),book?.details,adminTicket(ticket).category);
    const key = createHash("sha256").update(JSON.stringify([input,ticket.version,adminTicket(ticket).category,process.env.OPENROUTER_MODEL,"draft-v2",knowledgeVersion])).digest("hex");
    if (!regenerate) {
      const [cached] = await db.select().from(aiRuns).where(and(eq(aiRuns.ticketId,id),eq(aiRuns.fingerprint,key),sql`output is not null`)).orderBy(desc(aiRuns.createdAt)).limit(1);
      if (cached) return reply({...cached.output as object,version:ticket.version});
    }
    const output = await runAI("draft",ticket,input,key,session.user);
    return output?reply({...output,version:ticket.version}):fail(503,"ai_unavailable","AI unavailable. Write a response manually.");
  }
  return missing();
}
async function route(req:Request,ctx:Context) {
  try { return await handle(req,ctx); }
  catch(error) {
    if (error instanceof z.ZodError) return fail(422,"validation","Check the provided fields.",error.flatten().fieldErrors);
    if (error instanceof RangeError) return fail(413,"too_large","Request is too large.");
    if (error instanceof SyntaxError) return fail(400,"invalid_json","Invalid JSON.");
    return fail(500,"server_error","Something went wrong. Try again.");
  }
}
export {route as GET,route as POST,route as PATCH};
