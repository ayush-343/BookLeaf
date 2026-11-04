import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error("Set DEMO_PASSWORD for a seeded test database.");

async function call(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(origin + path, {
    method, headers: { origin, "Content-Type": "application/json", ...(cookie ? {cookie} : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, data: json.data, error: json.error, cookie: response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ") };
}
async function login(email) {
  const result = await call("/api/auth/sign-in/email", {method:"POST",body:{email,password}});
  assert.equal(result.status,200,JSON.stringify(result));
  assert.ok(result.cookie);
  return result.cookie;
}
const v1 = "/api/v1";
assert.equal((await call(v1+"/books")).status,401);
const author = await login("author1@bookleaf.example");
const other = await login("author2@bookleaf.example");
const admin = await login("admin1@bookleaf.example");
assert.equal((await call(v1+"/books",{cookie:author})).data.length,2);
assert.equal((await call(v1+"/books",{cookie:admin})).data.length,18);
assert.equal((await call(v1+"/books/BK003",{cookie:author})).status,404);
const operationId = randomUUID();
const input = {bookId:"BK001",subject:"Smoke: royalty question",description:"Could you help verify my payout?",operationId};
assert.equal((await call(v1+"/tickets",{cookie:author,method:"POST",body:{...input,bookId:"BK003"}})).status,404);
const created = await call(v1+"/tickets",{cookie:author,method:"POST",body:input});
assert.equal(created.status,201,JSON.stringify(created));
const path = v1+"/tickets/"+created.data.id;
assert.equal((await call(v1+"/tickets",{cookie:author,method:"POST",body:input})).data.id,created.data.id);
assert.equal((await call(path,{cookie:other})).status,404);
assert.equal((await call(path+"/notes",{cookie:author,method:"POST",body:{}})).status,403);
assert.equal((await call(path+"/notes",{cookie:admin,method:"POST",body:{body:"Staff-only fixture",operationId:randomUUID()}})).status,201);
const message = {body:"We will verify your payout details.",operationId:randomUUID()};
assert.equal((await call(path+"/messages",{cookie:admin,method:"POST",body:message})).status,201);
assert.equal((await call(path+"/messages",{cookie:admin,method:"POST",body:message})).status,200);
const detail = (await call(path,{cookie:author})).data;
assert.equal(detail.messages.length,1);
assert.equal(detail.notes,undefined);
assert.equal(detail.aiCategory,undefined);
assert.equal(detail.policies,undefined);
const staff = (await call(path,{cookie:admin})).data;
assert.equal(staff.notes.length,1);
assert.equal(staff.authorName,"Demo Author 1");
assert.ok(staff.policies.royalty);
assert.equal((await call(path,{cookie:admin,method:"PATCH",body:{version:staff.version,status:"Resolved",assignToMe:true}})).status,200);
assert.equal((await call(path,{cookie:admin,method:"PATCH",body:{version:staff.version,status:"Closed"}})).status,409);
assert.equal((await call(path+"/messages",{cookie:author,method:"POST",body:{body:"Thank you. Any update?",operationId:randomUUID()}})).status,201);
assert.equal((await call(path,{cookie:author})).data.status,"Open");
assert.equal((await call(v1+"/tickets",{cookie:admin})).status,200);
console.log("Smoke passed: auth, seed, ownership, private notes, idempotency, replies, queue, and conflict handling.");
const reopened = (await call(path,{cookie:admin})).data;
assert.equal((await call(path,{cookie:author})).data.activity,undefined);
assert.equal(reopened.activity.length,3);
assert.ok(reopened.activity.some(event=>event.field==="assignee"&&event.after==="BookLeaf Support 1"));
assert.ok(reopened.activity.some(event=>event.field==="status"&&event.before==="Resolved"&&event.after==="Open"));
const noChange=await call(path,{cookie:admin,method:"PATCH",body:{version:reopened.version,status:"Open",assignToMe:true}});
assert.equal(noChange.data.version,reopened.version);
assert.equal((await call(path,{cookie:admin})).data.activity.length,3);
const edited={body:"Edited follow-up.",operationId:randomUUID()};
const stale=await call(path+"/messages",{cookie:admin,method:"POST",body:{...edited,draftVersion:staff.version}});
assert.equal(stale.status,409);
assert.equal(stale.error.code,"stale_draft");
assert.equal((await call(path+"/messages",{cookie:admin,method:"POST",body:edited})).status,201);
assert.equal((await call(path+"/ai-draft",{cookie:admin,method:"POST",body:{}})).status,503);
console.log("Activity, stale draft rejection, and manual reply fallback passed.");
