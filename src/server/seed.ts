import { hashPassword } from "better-auth/crypto";
import { db } from "./db";
import { account, books, profiles, tickets, user } from "./schema";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const bookData = z.object({book_id:z.string()}).catchall(z.union([z.string(),z.number(),z.array(z.string()),z.null()]));
const authorData = z.object({author_id:z.string(),name:z.string(),email:z.email(),books:z.array(bookData)});
const fixture = z.object({authors:z.array(authorData)});
const titles = ["The Lantern Index","Margins of Summer","A Map of Quiet Places","The Paper Atlas","Field Notes at Dawn","Letters from the Jetty","The Last Typesetter","Salt and Starlight","Borrowed Rivers","The Folded Coast","Cloud Ledger","The Unwritten Mile","Studio Proofs","A Shelf for Tomorrow","Woodsmoke Pages","Echoes in Ink","The Night Library","Daybreak Edition"];

const synthetic = {authors:Array.from({length:10},(_,i)=>({
  author_id:"AUTH"+String(i+1).padStart(3,"0"),
  name:"Demo Author "+(i+1),
  email:"author"+(i+1)+"@bookleaf.example",
  books:titles.slice(i*2,i*2+2).map((title,j)=>{
    const number=i*2+j+1;
    const production=number===13;
    const earned=production?0:3570+number*200;
    return {
      book_id:"BK"+String(number).padStart(3,"0"),title,
      isbn:production?null:"DEMO-"+String(number).padStart(3,"0"),genre:"Fiction",
      status:production?"In Production - Cover Design":"Published & Live",publication_date:production?null:"2025-06-01",
      mrp:production?null:399,total_copies_sold:production?0:120+number,
      total_royalty_earned:earned,royalty_paid:j?earned:0,royalty_pending:j?0:earned,
      last_royalty_payout_date:j?"2025-08-14":null,available_on:production?[]:["BookLeaf Store"],print_partner:"In-house",
    };
  }),
}))};

async function seedUser(id:string,name:string,email:string,role:"admin"|"author",authorId?:string,details?:Record<string,unknown>) {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set DEMO_PASSWORD (at least 12 characters)");
  const hash = await hashPassword(password);
  await db.transaction(async tx=>{
    await tx.insert(user).values({id,name,email}).onConflictDoNothing();
    await tx.insert(account).values({id:"credential-"+id,accountId:id,providerId:"credential",userId:id,password:hash,updatedAt:new Date()}).onConflictDoNothing();
    await tx.insert(profiles).values({userId:id,role,authorId,details}).onConflictDoNothing();
  });
}
async function main(){
  const path=process.env.BOOKLEAF_SEED_FILE;
  const seed=fixture.parse(path?JSON.parse(await readFile(path,"utf8")):synthetic);
  for (const {books: titles, ...author} of seed.authors) {
    await seedUser("user-"+author.author_id,author.name,author.email,"author",author.author_id,{synthetic:!path});
    if (titles.length) await db.insert(books).values(titles.map(book=>({id:book.book_id,authorId:author.author_id,details:book}))).onConflictDoNothing();
  }
  for (const n of [1,2]) await seedUser("admin-"+n,"BookLeaf Support "+n,"admin"+n+"@bookleaf.example","admin");
  if (!path) await db.insert(tickets).values([
    {id:"demo-royalty",operationId:"seed-royalty",authorId:"AUTH001",bookId:"BK001",subject:"Question about my royalty payout",description:"My book shows ₹3,770 pending. Could you help me understand when it may be paid?",aiCategory:"Royalty & Payments",aiPriority:"Medium"},
    {id:"demo-isbn",operationId:"seed-isbn",authorId:"AUTH002",bookId:"BK003",subject:"ISBN differs on the listing",description:"The ISBN on the listing differs from the one printed in my book. Can you check?",aiCategory:"ISBN & Metadata Issues",aiPriority:"High"},
    {id:"demo-production",operationId:"seed-production",authorId:"AUTH007",bookId:"BK013",subject:"Cover design progress",description:"Could you share which production step my book is currently at?",aiCategory:"Book Status & Production Updates",aiPriority:"Low"},
  ]).onConflictDoNothing();
  console.log("Seeded",seed.authors.length,"authors and",seed.authors.reduce((n,a)=>n+a.books.length,0),"books.");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
