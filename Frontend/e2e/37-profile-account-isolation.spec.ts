import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

// Real AuthProvider, profile store, identity storage and request scopes. Only I/O is mocked.
let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "next/navigation": "export const useRouter=()=>({push(){},replace(){}});",
    "@/services/auth": "export const logoutAccount=async()=>{};",
    "@/services/session": `import{readLocalSession}from'./src/lib/local-session';
      export const fetchSession=async()=>readLocalSession()??{isAuthenticated:false,role:null,userName:null};`,
    "@/services/profile": `export const fetchProfile=()=>window.enqueue('load');
      export const updateProfile=input=>window.enqueue('save',input);`,
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState}from'react';import{createRoot}from'react-dom/client';
      import{AuthProvider,useAuth}from'./src/components/auth/AuthProvider';
      import{UserProfileProvider,useUserProfileStore}from'./src/components/profile/UserProfileProvider';
      import{setAccessToken}from'./src/lib/auth-token';
      import{setStoredAuth,getStoredAuth}from'./src/lib/auth-storage';
      import{ProfileError}from'./src/lib/profile-errors';
      window.requests=[];window.historySnapshots=[];window.results=[];
      window.enqueue=(kind,input)=>new Promise((resolve,reject)=>requests.push({kind,input,owner:getStoredAuth()?.user.id,resolve,reject}));
      window.login=(id,role='Photographer')=>{const token='test.'+btoa(JSON.stringify({sub:id,role,exp:Date.now()/1000+3600}))+'.test';
        setAccessToken(token);setStoredAuth({token,user:{id,name:id,role}})};
      window.settle=(index,data,error)=>{const req=requests[index];req.done=true;
        if(error)req.reject(new ProfileError('errors.profile.'+error,409,{code:error,fields:{email:'errors.profile.emailTaken'}}));else req.resolve(data)};
      function Probe(){const store=useUserProfileStore(),auth=useAuth();window.store=store;window.auth=auth;
        const snapshot={owner:getStoredAuth()?.user.id??null,profile:store.profile?.id??null,status:store.status,
          stamp:store.profile?.concurrencyStamp??null,saving:store.saving,loadError:store.loadError,
          formError:store.formError,fields:store.fieldErrors,name:store.displayName};
        historySnapshots.push(snapshot);return <><output data-testid="state">{JSON.stringify(snapshot)}</output>
          <button id="save" onClick={()=>void store.save({fullName:'Edited',email:'edited@example.test',phoneNumber:'0599000000'}).then(v=>results.push(v))}>Save</button>
          <button id="refresh" onClick={()=>void store.refetch()}>Refresh</button>
          <button id="logout" onClick={()=>void auth.logout({redirect:false})}>Logout</button>
          <input aria-label="Unsaved draft" defaultValue="draft"/></>}
      function Harness(){const[shown,setShown]=useState(true);return <><button id="unmount" onClick={()=>setShown(false)}>Unmount</button>
        <button id="remount" onClick={()=>setShown(true)}>Remount</button>
        {shown&&<UserProfileProvider><Probe/></UserProfileProvider>}</>}
      window.login('A',window.initialRole);createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><Harness/></AuthProvider></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "profile-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

type Request = { kind: string; owner: string; done?: boolean; input?: { concurrencyStamp: string } };
type HarnessWindow = Window & {
  requests: Request[];
  login: (id: string, role?: string) => void;
  settle: (index: number, data: unknown, error?: string) => void;
  historySnapshots: Array<{ owner: string | null; profile: string | null }>;
  results: boolean[];
};
const profile = (id: string, stamp = `${id}-stamp`) => ({ id, fullName: `Owner ${id}`, email: `${id}@example.test`,
  phoneNumber: "0599000000", concurrencyStamp: stamp, isSetupComplete: true, approvalStatus: "Approved", isLocked: false });
async function mount(page: Page, role = "Photographer") {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).pathname === "/profile-isolation"
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/profile-isolation");
  await page.evaluate(role => Object.assign(window, { initialRole: role }), role);
  await page.addScriptTag({ content: bundle });
  await request(page, "load", "A");
  return errors;
}
async function request(page: Page, kind: string, owner: string) {
  const find = () => page.evaluate(({ kind, owner }) => (window as HarnessWindow).requests.findIndex(
    req => req.kind === kind && req.owner === owner && !req.done), { kind, owner });
  await expect.poll(find).toBeGreaterThanOrEqual(0);
  return find();
}
async function reply(page: Page, index: number, data: unknown, error?: string) {
  await page.evaluate(({ index, data, error }) => (window as HarnessWindow).settle(index, data, error), { index, data, error });
}
async function login(page: Page, owner: string, role?: string) {
  await page.evaluate(({ owner, role }) => (window as HarnessWindow).login(owner, role), { owner, role });
}
async function ready(page: Page, owner: string) {
  await reply(page, await request(page, "load", owner), profile(owner));
  await expect(page.getByTestId("state")).toContainText(`"profile":"${owner}"`);
}
async function assertOwner(page: Page, owner: string) {
  await expect(page.getByTestId("state")).toContainText(`"profile":"${owner}"`);
  const stored = await page.evaluate(() => {
    const raw = sessionStorage.getItem("wesal_auth") ?? localStorage.getItem("wesal_auth");
    const auth = JSON.parse(raw!);
    return { id: auth.user.id, subject: JSON.parse(atob(auth.token.split(".")[1])).sub };
  });
  expect(stored).toEqual({ id: owner, subject: owner });
}

for (const role of ["Photographer", "EventCoordinator", "HallSeeker"]) {
  test(`same-role account switch resets the profile immediately: ${role}`, async ({ page }) => {
    const errors = await mount(page, role);
    await ready(page, "A");
    await login(page, "B", role);
    await expect(page.getByTestId("state")).toContainText('"profile":null');
    await ready(page, "B");
    await assertOwner(page, "B");
    expect(await page.evaluate(() => (window as HarnessWindow).historySnapshots.some(s => s.owner === "B" && s.profile === "A"))).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("late initial load cannot overwrite another account or its stored identity", async ({ page }) => {
  await mount(page);
  const old = await request(page, "load", "A");
  await login(page, "B"); await ready(page, "B");
  await reply(page, old, profile("A"));
  await assertOwner(page, "B");
});

test("late refresh error does not overwrite the new account's error state", async ({ page }) => {
  await mount(page); await ready(page, "A"); await page.click("#refresh");
  const old = await request(page, "load", "A");
  await login(page, "B"); await ready(page, "B"); await reply(page, old, null, "load");
  await assertOwner(page, "B");
  await expect(page.getByTestId("state")).toContainText('"loadError":null');
});

for (const failure of [false, true]) {
  test(`old save ${failure ? "failure" : "success"} cannot affect B after logout`, async ({ page }) => {
    await mount(page); await ready(page, "A"); await page.click("#save");
    const old = await request(page, "save", "A");
    await page.click("#logout");
    await expect(page.getByTestId("state")).toContainText('"profile":null');
    await login(page, "B"); await ready(page, "B"); await page.click("#save");
    const current = await request(page, "save", "B");
    await reply(page, old, profile("A"), failure ? "stale" : undefined);
    await expect.poll(() => page.evaluate(() => (window as HarnessWindow).results)).toEqual([false]);
    await assertOwner(page, "B");
    await expect(page.getByTestId("state")).toContainText('"saving":true');
    await expect(page.getByTestId("state")).toContainText('"formError":null');
    await reply(page, current, profile("B", "saved"));
    await expect(page.getByTestId("state")).toContainText('"stamp":"saved"');
  });
}

for (const failure of [false, true]) {
  test(`conflict recovery ${failure ? "failure" : "success"} stays in its original account`, async ({ page }) => {
    await mount(page); await ready(page, "A"); await page.click("#save");
    await reply(page, await request(page, "save", "A"), null, "stale");
    const recovery = await request(page, "load", "A");
    await login(page, "B"); await ready(page, "B");
    await reply(page, recovery, profile("A", "obsolete"), failure ? "load" : undefined);
    await assertOwner(page, "B");
    await expect(page.getByTestId("state")).toContainText('"stamp":"B-stamp"');
    await expect(page.getByTestId("state")).toContainText('"formError":null');
  });
}

test("unmount and remount invalidate pending loads even for the same account", async ({ page }) => {
  await mount(page); const old = await request(page, "load", "A");
  await page.click("#unmount"); await page.click("#remount");
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).requests.length)).toBe(2);
  await reply(page, 1, profile("A", "new")); await reply(page, old, profile("A", "old"));
  await expect(page.getByTestId("state")).toContainText('"stamp":"new"');
});

test("logout and identical-account login create a new request context", async ({ page }) => {
  await mount(page); const old = await request(page, "load", "A");
  await page.click("#logout"); await login(page, "A");
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).requests.length)).toBe(2);
  await reply(page, 1, profile("A", "new")); await reply(page, old, profile("A", "old"));
  await expect(page.getByTestId("state")).toContainText('"stamp":"new"');
});

test("normal save uses the current stamp, prevents duplicate writes, and preserves mounted input", async ({ page }) => {
  await mount(page); await ready(page, "A");
  await page.getByLabel("Unsaved draft").fill("Keep this input");
  await page.locator("#save").dblclick();
  const save = await request(page, "save", "A");
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.kind === "save").length)).toBe(1);
  expect(await page.evaluate(index => (window as HarnessWindow).requests[index].input?.concurrencyStamp, save)).toBe("A-stamp");
  await reply(page, save, profile("A", "saved"));
  await expect(page.getByTestId("state")).toContainText('"stamp":"saved"');
  await expect(page.getByLabel("Unsaved draft")).toHaveValue("Keep this input");
});

test("same-account conflicts update only the concurrency stamp and allow retry", async ({ page }) => {
  await mount(page); await ready(page, "A"); await page.click("#save");
  await reply(page, await request(page, "save", "A"), null, "stale");
  await reply(page, await request(page, "load", "A"), profile("A", "latest"));
  await expect(page.getByTestId("state")).toContainText('"stamp":"latest"');
  await expect(page.getByTestId("state")).toContainText('"formError":"errors.profile.stale"');
  await page.click("#save"); const retry = await request(page, "save", "A");
  expect(await page.evaluate(index => (window as HarnessWindow).requests[index].input?.concurrencyStamp, retry)).toBe("latest");
  await reply(page, retry, profile("A", "saved"));
  await expect(page.getByTestId("state")).toContainText('"formError":null');
});

test("partial authentication data masks the profile and cannot restore it from a pending request", async ({ page }) => {
  await mount(page); await ready(page, "A"); await page.click("#refresh");
  const old = await request(page, "load", "A");
  await page.evaluate(() => {
    sessionStorage.removeItem("wesal-access-token"); localStorage.removeItem("wesal-access-token");
    window.dispatchEvent(new Event("wesal-auth-change"));
  });
  await expect(page.getByTestId("state")).toContainText('"profile":null');
  await reply(page, old, profile("A"));
  await expect(page.getByTestId("state")).toContainText('"profile":null');
});

test("callbacks retained by an old form cannot save or refetch under a new account", async ({ page }) => {
  await mount(page); await ready(page, "A");
  await page.evaluate("window.oldStore=window.store");
  await login(page, "B"); await ready(page, "B");
  await page.evaluate("void oldStore.save({fullName:'Old',email:'old@example.test',phoneNumber:'0599000000'}).then(v=>results.push(v));void oldStore.refetch();oldStore.clearFormFeedback()");
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).results)).toEqual([false]);
  expect(await page.evaluate(() => (window as HarnessWindow).requests.length)).toBe(2);
  await assertOwner(page, "B");
});

test("rapid A to B to A switches reject both obsolete requests", async ({ page }) => {
  await mount(page); await login(page, "B"); await request(page, "load", "B");
  await login(page, "A");
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).requests.length)).toBe(3);
  await reply(page, 2, profile("A", "current"));
  await reply(page, 0, profile("A", "old")); await reply(page, 1, profile("B"));
  await assertOwner(page, "A");
  await expect(page.getByTestId("state")).toContainText('"stamp":"current"');
});

test("a save completing after unmount cannot publish identity into a new provider", async ({ page }) => {
  await mount(page); await ready(page, "A"); await page.click("#save");
  const old = await request(page, "save", "A");
  await page.click("#unmount"); await login(page, "B"); await page.click("#remount");
  await ready(page, "B"); await reply(page, old, profile("A"));
  await assertOwner(page, "B");
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).results)).toEqual([false]);
});

test("losing regular-profile permission invalidates pending work", async ({ page }) => {
  await mount(page); const old = await request(page, "load", "A");
  await login(page, "admin", "Admin");
  await expect(page.getByTestId("state")).toContainText('"status":"forbidden"');
  await reply(page, old, profile("A"));
  await expect(page.getByTestId("state")).toContainText('"profile":null');
  expect(await page.evaluate(() => (window as HarnessWindow).requests.length)).toBe(1);
});
