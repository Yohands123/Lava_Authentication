import { test, expect } from "@playwright/test";
import { addAuthenticator, register, signOut, enter } from "../e2e/helpers";
const origin="http://localhost:8809",headers={Origin:origin,"X-Phase6":"synthetic-local-experiment"};
test("verification admission rejects excess concurrent work and recovers after reserved slots drain",async({request})=>{
  const responses=await Promise.all(Array.from({length:12},()=>request.post("/__phase6/stall-verification",{headers,data:{}})));
  const statuses=responses.map(r=>r.status());expect(statuses.filter(s=>s===403)).toHaveLength(4);expect(statuses.filter(s=>s===503)).toHaveLength(8);
  expect((await request.post("/__phase6/stall-verification",{headers,data:{}})).status()).toBe(403);
  expect((await request.get("/api/session")).status()).toBe(401);
});
test("the local adapter requires its fixed origin and never yields cookies or clearance",async({request})=>{
  expect((await request.post("/__phase6/score",{data:{mode:"shadow",input:"golden"}})).status()).toBe(403);
  for(const mode of ["off","shadow"]){const r=await request.post("/__phase6/score",{headers,data:{mode,input:"golden"}}),body=await r.json();
    expect(r.status()).toBe(200);expect(r.headers()["set-cookie"]).toBeUndefined();expect(body.policyInfluence).toBe(false);
    expect(body.result.riskScore===null).toBe(mode==="off");expect(body.result.action).toBe("observe");expect(body.clearance).toBeUndefined();
  }
  expect((await request.get("/api/session")).status()).toBe(401);
  expect((await request.post("/api/login/options",{headers:{Origin:origin},data:{digests:{}}})).status()).toBe(403);
});
test("model failures, revoked, withdrawn, OOD and unsupported inputs abstain without influencing normal clearance",async({request})=>{
  for(const method of ["prepared","parse-each-call"])for(const input of ["ood","unsupported","missing","revoked","withdrawn","unavailable","throw","stall"]){
    const r=await request.post("/__phase6/score",{headers,data:{mode:"shadow",input,method}});expect((await r.json()).result.riskScore).toBeNull();
  }
  const c=await(await request.post("/api/lavaguard/challenge",{headers:{Origin:origin},data:{kind:"accessible"}})).json();
  const d=await(await request.post("/api/lavaguard/evaluate",{headers:{Origin:origin},data:{id:c.id,nonce:c.nonce,summary:null}})).json();
  expect(d.verdict).toBe("CLEAR");expect(d.assessment).toBe("accessible");expect((await request.get("/api/session")).status()).toBe(401);
});
test("a real assertion with a corrupted signature fails and consumes its challenge",async({page})=>{
  await addAuthenticator(page);await register(page);await signOut(page);await enter(page);
  let captured: unknown;
  await page.route("**/api/login/verify",async route=>{
    const body=route.request().postDataJSON();const signature=Buffer.from(body.response.response.signature,"base64url");signature[signature.length-1]!^=1;
    body.response.response.signature=signature.toString("base64url");captured=body;await route.continue({postData:JSON.stringify(body)});
  });
  const verified=page.waitForResponse(r=>r.url().endsWith("/api/login/verify"));
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.getByRole("button",{name:"Use a passkey without stirring"}).press("Enter");
  expect((await verified).status()).toBe(401);expect((await page.request.get("/api/session")).status()).toBe(401);
  expect((await page.request.post("/api/login/verify",{headers:{Origin:origin},data:captured})).status()).toBe(409);
});
test("keyboard passkeys still work with no WebGL and positive automation flags",async({page})=>{
  await addAuthenticator(page);await register(page);await signOut(page);
  await page.addInitScript(()=>{
    Object.defineProperty(Navigator.prototype,"webdriver",{get:()=>true,configurable:true});
    const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof get>){if(String(args[0]).startsWith("webgl"))return null;return Reflect.apply(get,this,args);} as typeof get;
  });
  await page.reload();await enter(page);const evaluation=page.waitForRequest(r=>r.url().endsWith("/api/lavaguard/evaluate"));
  await page.getByRole("button",{name:"Sign in",exact:true}).press("Enter");
  expect((await evaluation).postDataJSON().summary).toBeNull();await expect(page.getByRole("heading",{name:"You're in"})).toBeVisible();
});
