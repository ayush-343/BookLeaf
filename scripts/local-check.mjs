import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.LOCAL_DEMO_PORT ?? 3300);
const pgPort = 55432 + port - 3300;
const origin = "http://127.0.0.1:"+port;
const dir = await mkdtemp(join(tmpdir(),"bookleaf-pg-"));
const pg = new EmbeddedPostgres({databaseDir:dir,user:"postgres",password:"local-check-password",port:pgPort,persistent:false,autoRehydrateSymlinks:true,onLog:()=>{}});
const env = {...process.env,DATABASE_URL:"postgres://postgres:local-check-password@127.0.0.1:"+pgPort+"/postgres",BETTER_AUTH_SECRET:"disposable-local-check-secret-only",BETTER_AUTH_URL:origin,SMOKE_ORIGIN:origin,DEMO_PASSWORD:"local-demo-check-password",OPENROUTER_API_KEY:"",BOOKLEAF_SEED_FILE:"",BOOKLEAF_ALLOW_IMPORTED_AI:""};
const liveCheck = process.argv.includes("--live-ai");
if (liveCheck || (process.argv.includes("--serve") && process.env.BOOKLEAF_DEMO_AI === "1")) {
  if (process.env.OPENROUTER_API_KEY) env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  else delete env.OPENROUTER_API_KEY;
}
if (liveCheck) env.BOOKLEAF_LIVE_CHECK = "1";
const run = (command,args) => new Promise((resolve,reject)=>{
  const child = spawn(command,args,{env,stdio:"inherit"});
  child.on("error",reject);
  child.on("exit",code=>code===0?resolve():reject(new Error(command+" exited with "+code)));
});
let next;
try {
  await pg.initialise();
  await pg.start();
  await run("npm",["run","db:migrate"]);
  await run("npm",["run","db:seed"]);
  next = spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{env,stdio:"inherit"});
  for(let attempt=0;attempt<50;attempt++){
    try { if((await fetch(env.SMOKE_ORIGIN)).ok) break; } catch {}
    if(attempt===49) throw new Error("Portal did not start");
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  if (process.argv.includes("--serve")) {
    console.log("Demo:",env.SMOKE_ORIGIN);
    console.log("Author: author1@bookleaf.example | Staff: admin1@bookleaf.example");
    console.log("Demo password:",env.DEMO_PASSWORD);
    await new Promise(resolve=>{
      process.once("SIGINT",resolve);
      process.once("SIGTERM",resolve);
      next.once("exit",resolve);
    });
  } else if (!liveCheck) {
    await run(process.execPath,["scripts/smoke.mjs"]);
  }
  if(process.argv.includes("--visual") || liveCheck){
    if (!liveCheck) await new Promise(resolve=>setTimeout(resolve,10500));
    await run(process.execPath,["scripts/visual-check.mjs"]);
    if (process.env.HALLMARK_SCRIPT) await run(process.execPath,[process.env.HALLMARK_SCRIPT,"src/app","--scope","app","--genre","editorial","--render","--url",env.SMOKE_ORIGIN]);
  }
} finally {
  if(next) next.kill();
  await pg.stop().catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}
