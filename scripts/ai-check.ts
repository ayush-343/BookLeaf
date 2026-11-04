import assert from "node:assert/strict";
import { draftInput, generate, ticketText } from "../src/server/ai";

process.env.OPENROUTER_API_KEY = "test-only";
let output: unknown = {category:"Royalty & Payments",priority:"High",rationale:"Prolonged delay"};
const context = draftInput("Royalty check","Reach me at sample@example.invalid or +1 (415) 555-0100. IFSC: DEMO0123456",[
  {body:"Discard this earlier reply"},{body:"Bank account number: 123456789"},
  {body:"Received."},{body:"Follow up soon."},
],{title:"Synthetic book",total_royalty_earned:3770,author_id:"private-id",print_partner:"irrelevant"},"Royalty & Payments");
assert.equal(context.publicMessages.length,3);
assert.deepEqual(context.book,{title:"Synthetic book",total_royalty_earned:3770});
for(const excluded of ["sample@example.invalid","555-0100","DEMO0123456","123456789","private-id","earlier reply"]){
  assert.ok(!JSON.stringify(context).includes(excluded));
}
assert.equal(ticketText("Account", "IBAN: GB82 WEST 1234 5698 7654 32").description,"IBAN [identifier removed]");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(String(options?.body));
  assert.equal(body.provider.require_parameters,true);
  assert.equal(body.response_format.type,"json_schema");
  return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(output)}}],usage:{total_tokens:123}});
};
try {
  const classification = await generate("classify",{description:"No royalty for six months."});
  assert.deepEqual(classification.output,output);
  output = {reply:"I can help check this. We’ll verify the payout record.",sources:["royalty"],missing:["Bank status"]};
  assert.deepEqual((await generate("draft",{description:"When is my royalty due?"},"Royalty & Payments")).output,output);
  output = {reply:"Invalid citation",sources:["isbn"],missing:[]};
  await assert.rejects(generate("draft",{description:"Royalty due?"},"Royalty & Payments"),/Invalid source/);
  output = {category:"invented",priority:"Urgent",rationale:""};
  await assert.rejects(generate("classify",{description:"invalid fixture"}));
  console.log("AI adapter passed: OpenRouter contract, schema validation, and policy source validation.");
} finally {
  globalThis.fetch = originalFetch;
}
