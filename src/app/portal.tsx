"use client";
import Image from "next/image";
import {useState,useEffect,useRef,type FormEvent,type ReactNode} from "react";
import {QueryClient,QueryClientProvider,useQuery,useQueryClient} from "@tanstack/react-query";

const root="/api/v1";
const statuses=["Open","In Progress","Resolved","Closed"];
const categories=["Royalty & Payments","ISBN & Metadata Issues","Printing & Quality","Distribution & Availability","Book Status & Production Updates","General Inquiry"];
const priorities=["Critical","High","Medium","Low"];
const policyNames:Record<string,string>={royalty:"Royalty policy",isbn:"ISBN policy",print:"Printing policy",distribution:"Distribution policy",production:"Production stages",general:"General guidance"};
type Identity={name:string;role:"author"|"admin"};
type Book={book_id:string;title:string;isbn:string;genre:string;publication_date:string|null;status:string;mrp:number|null;total_copies_sold:number;total_royalty_earned:number;royalty_paid:number;royalty_pending:number;last_royalty_payout_date:string|null};
type BookRow={id:string;details:Book};
type Entry={id:string;body:string;senderName:string;createdAt:string};
type Ticket={id:string;bookId:string|null;subject:string;description:string;status:string;createdAt:string;authorId?:string;priority?:string;category?:string;aiCategory?:string|null;assignee?:string|null;version?:number};
type Activity={id:string;actorName:string;field:string;before:string|null;after:string|null;createdAt:string};
type Detail=Ticket&{activity?:Activity[];messages:Entry[];notes?:Entry[];book:Book|null;authorName?:string;policies?:Record<string,string>};
type Draft={version:number;reply:string;sources:string[];missing:string[]};
const money=(value:number|null)=>value===null?"Not available yet":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2,minimumFractionDigits:0}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(new Date(value));
const reason=(error:unknown)=>error instanceof Error?error.message:"Something went wrong.";
class ApiError extends Error {
  constructor(message:string, readonly code?:string){super(message);}
}
async function api<T>(path:string,method="GET",body?:unknown):Promise<T>{
  const res=await fetch((path.startsWith("/api/")?"":root)+path,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  if(res.status===401 && !path.startsWith("/api/") && path!=="/me") window.dispatchEvent(new Event("bookleaf:session-ended"));
  const json=await res.json();
  if(!res.ok)throw new ApiError(res.status===401&&path==="/me"?"Sign in to continue.":json.error?.message??json.message??"Request failed.",json.error?.code);
  return json.data??json;
}
export default function Portal(){
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));
  return <QueryClientProvider client={client}><Workspace/></QueryClientProvider>;
}
function Workspace(){
  const client=useQueryClient();
  const identity=useQuery({queryKey:["identity"],queryFn:()=>api<Identity>("/me")});
  useEffect(()=>{
    const endSession=()=>{
      client.setQueryData(["identity"],null);
      client.removeQueries({predicate:query=>query.queryKey[0]!=="identity"});
    };
    window.addEventListener("bookleaf:session-ended",endSession);
    return()=>window.removeEventListener("bookleaf:session-ended",endSession);
  },[client]);
  const [location,setLocation]=useState("");
  const [signError,setSignError]=useState("");
  const [pending,setPending]=useState(false);
  useEffect(()=>{
    const update=()=>setLocation(window.location.search);
    update();window.addEventListener("popstate",update);
    return()=>window.removeEventListener("popstate",update);
  },[]);
  const params=new URLSearchParams(location);
  function go(values:Record<string,string>={}){
    const query=new URLSearchParams(values).toString();
    window.history.pushState(null,"",query?"?"+query:"/");
    setLocation(query?"?"+query:"");
  }
  async function signIn(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setPending(true);setSignError("");
    const form=new FormData(e.currentTarget);
    try{await api("/api/auth/sign-in/email","POST",{email:form.get("email"),password:form.get("password")});await client.invalidateQueries({queryKey:["identity"]});}
    catch(error){setSignError(reason(error));}finally{setPending(false);}
  }
  async function signOut(){
    setPending(true);setSignError("");
    try{await api("/api/auth/sign-out","POST",{});client.clear();go();await identity.refetch();}
    catch(error){setSignError(reason(error));}finally{setPending(false);}
  }
  const person=identity.error?.message==="Sign in to continue."?null:identity.data;
  if(identity.isPending)return <main><p role="status">Loading BookLeaf…</p></main>;
  if(!person && identity.isError && identity.error?.message!=="Sign in to continue.")return <main><h1>BookLeaf support</h1><Problem error={identity.error}/><button onClick={()=>void identity.refetch()}>Try again</button></main>;
  if(!person)return <main className="login"><span className="wordmark"><BrandLogo/></span><h1>Sign in to support</h1><p>View your books, royalties and support conversations.</p><form onSubmit={signIn}><label>Email<input type="email" name="email" autoComplete="username" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" required/></label><button disabled={pending}>{pending?"Signing in…":"Sign in"}</button><Problem error={signError}/></form></main>;
  const admin=person.role==="admin";
  const ticket=params.get("ticket");
  const view=params.get("view")??(admin?"queue":"books");
  return <><header><div className="top"><a className="wordmark" href="/" onClick={e=>{e.preventDefault();go();}}><BrandLogo/></a><nav aria-label="Portal">
    {admin?<button className="nav" aria-current="page" onClick={()=>go({view:"queue"})}>Ticket queue</button>:<><button className="nav" aria-current={view==="books"&&!ticket?"page":undefined} onClick={()=>go()}>My books</button><button className="nav" aria-current={view==="tickets"||ticket?"page":undefined} onClick={()=>go({view:"tickets"})}>My tickets</button></>}
    </nav><div className="identity"><span>{person.name}</span><button className="secondary" disabled={pending} onClick={()=>void signOut()}>Sign out</button></div></div></header>
    <main><Problem error={signError}/>{ticket?<TicketView key={ticket} id={ticket} admin={admin} back={()=>go({view:admin?"queue":"tickets"})}/>:!admin&&view==="new"?<NewTicket initial={params.get("book")??""} complete={id=>go({ticket:id})} cancel={()=>go({view:"tickets"})}/>:!admin&&view==="books"?<Books open={book=>go({view:"new",...(book?{book}:{})})}/>:<Queue admin={admin} params={params} go={go}/>}</main></>;
}
function BrandLogo(){
  return <Image src="/bookleaf-logo.jpg" alt="BookLeaf Publishing" width={705} height={324} unoptimized/>;
}
function Problem({error}:{error:unknown}){return error?<p className="problem" role="alert">{typeof error==="string"?error:reason(error)}</p>:null;}
function Loading({children}:{children:ReactNode}){return <p className="empty" role="status">{children}</p>;}
function Badge({children}:{children:ReactNode}){return <span className="badge">{children}</span>;}
function BookFacts({book}:{book:Book}){
  return <dl>{[
    ["ISBN",book.isbn],["Genre",book.genre],["Publication date",book.publication_date?date(book.publication_date):"Not available yet"],
    ["Price",money(book.mrp)],["Copies sold",book.total_copies_sold],["Royalty earned",money(book.total_royalty_earned)],
    ["Royalty paid",money(book.royalty_paid)],["Royalty pending",money(book.royalty_pending)],
    ["Last payout",book.last_royalty_payout_date?date(book.last_royalty_payout_date):"No payout date recorded"],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
function Books({open}:{open:(id?:string)=>void}){
  const query=useQuery({queryKey:["books"],queryFn:()=>api<BookRow[]>("/books")});
  return <><div className="pagehead"><div><h1>My books</h1><p>Check publication status and royalties for your books.</p></div><button onClick={()=>open()}>New support ticket</button></div>
  {query.isPending?<Loading>Loading your books…</Loading>:query.error?<Problem error={query.error}/>:query.data?.length?<section aria-label="Your books" className="ledger">
    <div className="bookrow labels"><span>Book</span><span>Status</span><span>Royalty</span><span>Support</span></div>
    {query.data.map(({id,details:b})=><article className="bookrow" key={id}>
      <div><h2>{b.title}</h2><p>{b.genre}</p><details><summary>Book details</summary><BookFacts book={b}/></details></div>
      <div><Badge>{b.status}</Badge></div><div><strong className="amount">{money(b.royalty_pending)}</strong><p>Pending royalty</p></div>
      <div><button className="secondary" onClick={()=>open(id)}>Ask about this book</button></div>
    </article>)}</section>:<Loading>Your books will appear here when they are added to your account.</Loading>}</>;
}
function NewTicket({initial,complete,cancel}:{initial:string;complete:(id:string)=>void;cancel:()=>void}){
  const query=useQuery({queryKey:["books"],queryFn:()=>api<BookRow[]>("/books")});
  const [error,setError]=useState("");
  const [pending,setPending]=useState(false);
  const operation=useRef("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setPending(true);setError("");
    const f=new FormData(e.currentTarget);
    operation.current ||= crypto.randomUUID();
    try{const t=await api<Ticket>("/tickets","POST",{bookId:f.get("bookId")||null,subject:f.get("subject"),description:f.get("description"),operationId:operation.current});complete(t.id);}
    catch(error){setError(reason(error));}finally{setPending(false);}
  }
  return <div className="narrow"><button className="quiet" onClick={cancel}>Back to tickets</button><h1>New support ticket</h1><p>Tell us what happened and what you need help with.</p>
  <form onSubmit={submit}><label>Book<select name="bookId" key={query.isSuccess?"ready":"loading"} defaultValue={initial}><option value="">General / Account Level</option>{query.data?.map(b=><option key={b.id} value={b.id}>{b.details.title}</option>)}</select></label><Problem error={query.error}/>
  <label>Subject<input name="subject" required maxLength={150}/></label><label>Description<textarea name="description" required maxLength={4000} rows={7}/></label>
  <label>Attachment <input type="file" aria-describedby="attachment-help"/></label><p id="attachment-help">File selection preview only. Files are not uploaded.</p>
  <Problem error={error}/><button disabled={pending}>{pending?"Submitting ticket…":"Submit ticket"}</button></form></div>;
}
function Queue({admin,params,go}:{admin:boolean;params:URLSearchParams;go:(values:Record<string,string>)=>void}){
  const keys=["status","category","priority","from","to","page"];
  const filters=Object.fromEntries(keys.flatMap(key=>params.get(key)?[[key,params.get(key)!]]:[]));
  const query=useQuery({queryKey:["tickets",admin,filters],queryFn:()=>api<{items:Ticket[];hasMore:boolean}>("/tickets?"+new URLSearchParams(filters)),refetchInterval:5000});
  const page=Number(filters.page??1);
  return <><div className="pagehead"><div><h1>{admin?"Ticket queue":"My tickets"}</h1><p>{admin?"Review incoming queries and follow up with authors.":"Read replies and track your support requests."}</p></div>{!admin&&<button onClick={()=>go({view:"new"})}>New support ticket</button>}</div>
  {admin&&<form className="filters" key={params.toString()} onSubmit={e=>{e.preventDefault();const entries=Array.from(new FormData(e.currentTarget)).filter(([,v])=>v);go({view:"queue",...Object.fromEntries(entries)});}}>
    {([["status","Status",statuses],["category","Category",categories],["priority","Priority",priorities]] as const).map(([key,label,options])=><label key={key}>{label}<select name={key} defaultValue={filters[key]??""}><option value="">{key==="status"?"Unresolved":"Any"}</option>{options.map(option=><option key={option}>{option}</option>)}</select></label>)}
    <label>From<input name="from" type="date" defaultValue={filters.from}/></label><label>To<input name="to" type="date" defaultValue={filters.to}/></label><button>Apply filters</button><button type="button" className="quiet" onClick={()=>go({view:"queue"})}>Clear</button>
  </form>}
  <Problem error={query.error}/>
  {query.isPending?<Loading>Loading tickets…</Loading>:query.data?.items.length?<div className="tablewrap"><table><thead><tr><th>Subject</th><th>Status</th>{admin&&<><th>Priority</th><th>Category</th><th>Assignment</th></>}<th>Opened</th></tr></thead><tbody>{query.data.items.map(t=><tr key={t.id}><td><button className="textbutton" onClick={()=>go({ticket:t.id})}>{t.subject}</button>{admin&&<small>{t.authorId}{!t.aiCategory?" / Needs triage":""}</small>}</td><td><Badge>{t.status}</Badge></td>{admin&&<><td>{t.priority}</td><td>{t.category}</td><td>{t.assignee?"Assigned":"Unassigned"}</td></>}<td>{date(t.createdAt)}</td></tr>)}</tbody></table></div>:!query.error&&<Loading>{admin?"No tickets match these filters.":"You haven’t opened a support ticket yet."}</Loading>}
  {(page>1||query.data?.hasMore)&&<div className="actions"><button className="secondary" disabled={page<=1} onClick={()=>go({view:admin?"queue":"tickets",...filters,page:String(page-1)})}>Previous</button><span>Page {page}</span><button className="secondary" disabled={!query.data?.hasMore} onClick={()=>go({view:admin?"queue":"tickets",...filters,page:String(page+1)})}>Next</button></div>}</>;
}
function TicketView({id,admin,back}:{id:string;admin:boolean;back:()=>void}){
  const client=useQueryClient();
  const query=useQuery({queryKey:["ticket",id],queryFn:()=>api<Detail>("/tickets/"+id),refetchInterval:5000});
  const [mode,setMode]=useState<"reply"|"note">("reply");
  const [replyText,setReplyText]=useState("");
  const [noteText,setNoteText]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [draftVersion,setDraftVersion]=useState<number>();
  const [rejectedDraft,setRejectedDraft]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiError,setAiError]=useState("");
  const operation=useRef("");
  const started=useRef(false);
  const ticket=query.data;
  async function generate(regenerate:boolean){
    setAiBusy(true);setAiError("");
    try{const result=await api<Draft>("/tickets/"+id+"/ai-draft","POST",{regenerate});setDraft(result);}
    catch(error){setAiError(reason(error));}finally{setAiBusy(false);}
  }
  useEffect(()=>{if(admin&&ticket&&ticket.status!=="Closed"&&!started.current){started.current=true;void generate(false);}},[admin,ticket]);
  async function update(body:Record<string,unknown>){if(!ticket)return;setError("");setBusy(true);
    try{await api("/tickets/"+id,"PATCH",{...body,version:ticket.version});}
    catch(error){setError(reason(error));}finally{await query.refetch();setBusy(false);}
  }
  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    await sendMessage(false);
  }
  async function sendMessage(manual:boolean){
    setBusy(true);setError("");
    operation.current ||= crypto.randomUUID();
    try {
      await api("/tickets/"+id+(mode==="note"?"/notes":"/messages"),"POST",{
        body:mode==="note"?noteText:replyText,operationId:operation.current,
        draftVersion:mode==="reply"&&!manual?draftVersion:undefined,
      });
      operation.current="";
      if(mode==="note") setNoteText("");
      else {setReplyText("");setDraftVersion(undefined);setRejectedDraft(false);}
      await client.invalidateQueries({queryKey:["ticket",id]});
    } catch(error){
      setError(reason(error));
      if(mode==="reply" && draftVersion!==undefined && !manual){
        setRejectedDraft(error instanceof ApiError && error.code==="stale_draft");
        await query.refetch();
      }
    } finally {setBusy(false);}
  }
  if(!ticket)return <><button className="quiet" onClick={back}>Back to tickets</button>{query.error?<Problem error={query.error}/>:<Loading>Loading conversation…</Loading>}</>;
  const stale=draft&&draft.version!==ticket.version;
  const staleComposer=mode==="reply"&&draftVersion!==undefined&&(rejectedDraft||draftVersion!==ticket.version);
  return <><button className="quiet" onClick={back}>Back to {admin?"ticket queue":"my tickets"}</button><h1>{ticket.subject}</h1>
    <div className="actions"><Badge>{ticket.status}</Badge><span>{date(ticket.createdAt)}</span>{ticket.book&&<span>{ticket.book.title}</span>}</div><Problem error={query.error}/>
    <div className="workspace"><section aria-label="Conversation">
    <article className="entry"><strong>{ticket.authorName??"Original query"}</strong><p>{ticket.description}</p></article>
    {ticket.messages.map(m=><article className="entry" key={m.id}><div className="actions"><strong>{m.senderName}</strong><time dateTime={m.createdAt}>{date(m.createdAt)}</time></div><p>{m.body}</p></article>)}
    {ticket.status!=="Closed"&&<form className="composer" onSubmit={send}>
    {admin&&<div className="actions"><button type="button" className="nav" aria-pressed={mode==="reply"} onClick={()=>{setMode("reply");operation.current="";}}>Reply to author</button><button type="button" className="nav" aria-pressed={mode==="note"} onClick={()=>{setMode("note");operation.current="";}}>Internal note</button></div>}
    <label>{mode==="note"?"Private note":"Message"}<textarea rows={6} maxLength={4000} required value={mode==="note"?noteText:replyText} onChange={e=>mode==="note"?setNoteText(e.target.value):setReplyText(e.target.value)}/></label>
    {staleComposer?<><p role="status">The ticket changed. Your edited reply is still here.</p><button type="button" className="secondary" disabled={busy||!replyText.trim()} onClick={()=>void sendMessage(true)}>Send edited text as manual reply</button></>:<button disabled={busy}>{busy?"Saving…":mode==="note"?"Add internal note":"Send reply"}</button>}</form>}
    {admin&&!!ticket.notes?.length&&<section className="block"><h2>Internal notes</h2>{ticket.notes.map(n=><article className="entry" key={n.id}><strong>{n.senderName}</strong><p>{n.body}</p></article>)}</section>}<Problem error={error}/>
    </section><aside aria-label="Ticket context">
    {admin&&<section className="block"><h2>Ticket controls</h2><div className="settings">
      {([["status","Status",statuses],["priority","Priority",priorities],["category","Category",categories]] as const).map(([key,label,options])=><label key={key}>{label}<select value={ticket[key]} disabled={busy} onChange={e=>void update({[key]:e.target.value})}>{options.map(v=><option key={v}>{v}</option>)}</select></label>)}
      <button className="secondary" disabled={busy} onClick={()=>void update({assignToMe:true})}>Assign to me</button>{!ticket.aiCategory&&<button className="quiet" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await api("/tickets/"+id+"/ai-classification","POST",{});}catch(error){setError(reason(error));}finally{await query.refetch();setBusy(false);}}}>Retry AI classification</button>}{ticket.assignee&&<small>Assigned</small>}
    </div></section>}
    {ticket.book&&<section className="block"><h2>Book details</h2><p>{ticket.book.title}</p><BookFacts book={ticket.book}/></section>}
    {admin&&ticket.status!=="Closed"&&<section className="block"><h2>AI draft</h2>{aiBusy&&<p role="status">Preparing a reply…</p>}<Problem error={aiError}/>
      {draft&&<><p>{draft.reply}</p>{stale&&<p className="problem">Ticket changed. Regenerate before using this draft.</p>}<h3>Draft sources</h3><ul>{draft.sources.map((s,i)=><li key={i}>{policyNames[s]}</li>)}</ul>{!!draft.missing.length&&<><h3>Verify before sending</h3><ul>{draft.missing.map((m,i)=><li key={i}>{m}</li>)}</ul></>}
      <button className="secondary" disabled={!!stale|| (!!replyText&&!staleComposer)} onClick={()=>{setMode("reply");setReplyText(draft.reply);setDraftVersion(draft.version);setRejectedDraft(false);operation.current="";}}>{replyText&&staleComposer?"Replace edited text with refreshed draft":"Use draft"}</button></>}
      <button className="quiet" disabled={aiBusy} onClick={()=>void generate(true)}>{draft?"Regenerate draft":"Generate draft"}</button></section>}
    {admin&&<details className="block"><summary>Activity</summary>{ticket.activity?.length?<ul>{ticket.activity.map(event=><li key={event.id}><strong>{event.actorName}</strong> changed {event.field==="assignee"?"assignment":event.field} from {event.before??"Unassigned"} to {event.after??"Unassigned"} <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}</time></li>)}</ul>:<p>No changes recorded yet.</p>}</details>}
    {admin&&ticket.policies&&<section className="block"><h2>Policy reference</h2>{Object.entries(ticket.policies).map(([id,policy])=><details key={id}><summary>{policyNames[id]}</summary><p>{policy}</p></details>)}</section>}
    </aside></div></>;
}
