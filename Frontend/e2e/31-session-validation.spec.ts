import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "next/navigation": "export const useRouter=()=>window.router;export const usePathname=()=>'/profile';",
    "@/i18n": "export const t=key=>key;export const useT=()=>t;",
    "@/components/profile/UserProfileProvider": "export const useOptionalUserProfileStore=()=>null;",
  };
  const result = await build({
    stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{AuthProvider,useAuth}from'./src/components/auth/AuthProvider';
      import Owner from'./src/components/owner-management/HallOwnerManagementGuard';import Admin from'./src/components/admin/AdminManagementGuard';
      import Regular from'./src/components/profile/RegularUserProfileGuard';import{useAccountAccess}from'./src/hooks/useAccountAccess';
      import{useInboxConversations}from'./src/hooks/useInboxConversations';import{useNotifications}from'./src/hooks/useNotifications';
      import{setStoredAuth,getStoredAuth,clearAuthSession,AUTH_CHANGE_EVENT}from'./src/lib/auth-storage';
      import{setAccessToken,getAccessToken,clearAccessToken}from'./src/lib/auth-token';import{readLocalSession}from'./src/lib/local-session';
      import{readAuthenticatedAccount}from'./src/lib/authenticated-account';import{fetchSession}from'./src/services/session';
      import{pushPlatformNotification}from'./src/lib/platform-notifications-store';
      window.routes=[];window.router={replace(path){routes.push(path)},push(path){routes.push(path)}};
      window.sessionTest={login(id='A',role='RegisteredUser',expiry=3600){const token='test.'+btoa(JSON.stringify({sub:id,name:id,role,exp:Math.floor(Date.now()/1000)+expiry}))+'.test';
        setAccessToken(token);setStoredAuth({token,user:{id,name:id,role}})},clear:clearAuthSession,clearToken:clearAccessToken,
        snapshot:()=>({token:!!getAccessToken(),stored:!!getStoredAuth(),local:readLocalSession(),account:readAuthenticatedAccount()?.userId??null}),
        validate:fetchSession,push(){pushPlatformNotification({type:'booking_accepted',audience:'seeker',title:'Private A',body:'Private A',toast:false})}};
      const config=window.sessionConfig;
      localStorage.setItem('unrelated-preference','keep');localStorage.setItem('wesal_remembered_email','remember@example.test');
      if(config.credential!=='missing'){sessionTest.login('A',config.role,config.credential==='expired'?-1:3600);
        if(config.credential==='stored-only')clearAccessToken();
        if(config.credential==='mismatch')setAccessToken('another-token');}
      function Isolation(){const access=useAccountAccess(),inbox=useInboxConversations(access.sessionKey,true),notifications=useNotifications();
        return <output data-testid="isolated-state">{JSON.stringify({account:notifications.account?.userId??null,items:notifications.items.map(i=>i.title),unread:notifications.unreadCount,
          conversations:inbox.conversations.map(c=>c.conversationId),inboxStatus:inbox.status})}</output>}
      function Probe(){const auth=useAuth();window.auth=auth;const[guard,setGuard]=useState(config.guard||'regular');const Gate=guard==='owner'?Owner:guard==='admin'?Admin:Regular;
        return <><output data-testid="auth-state">{JSON.stringify({session:auth.session,status:auth.status,isLoggingOut:auth.isLoggingOut})}</output>
          <button id="refresh" onClick={auth.refreshSession}>Refresh</button><button id="local" onClick={()=>auth.applyLocalSession({isAuthenticated:true,role:'Admin',userName:'Stale'})}>Apply local</button>
          <button id="owner" onClick={()=>setGuard('owner')}>Owner</button><button id="admin" onClick={()=>setGuard('admin')}>Admin</button>
          <Gate><span data-testid="protected-content">Protected</span></Gate>{config.integration&&<Isolation/>}</>}
      function Root(){const[shown,setShown]=useState(true);return <><button id="mount" onClick={()=>setShown(v=>!v)}>Mount</button>
        {shown&&<AuthProvider><Probe/></AuthProvider>}</>}
      createRoot(document.getElementById('root')).render(config.strict?<React.StrictMode><Root/></React.StrictMode>:<Root/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "session-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

type Mode = "valid" | "401" | "false" | "False" | "network" | "timeout" | "500" | "403" | "malformed";
type SessionCall = { token: string; reply: (mode?: Mode) => Promise<void> };
type Options = { mode?: Mode; hold?: boolean; role?: string; credential?: "missing" | "expired" | "stored-only" | "mismatch";
  guard?: "owner" | "admin"; integration?: boolean; strict?: boolean };
async function mount(page: Page, options: Options = {}) {
  const calls: SessionCall[] = [], errors: string[] = [];
  let mode: Mode = options.mode ?? "valid", hold = options.hold ?? false;
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === "/session-validation-test") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    if (!pathname.startsWith("/api/v1/")) throw new Error(`Unexpected network ${pathname}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => undefined);
    const token = request.headers().authorization ?? "";
    const claims = token ? JSON.parse(Buffer.from(token.split(".")[1] ?? "e30=", "base64").toString()) : {};
    if (pathname === "/api/v1/session") {
      const reply = async (response: Mode = mode) => {
        if (response === "network") return route.abort("failed").catch(() => undefined);
        if (response === "timeout") return;
        if (["401", "500", "403"].includes(response)) return json({ title: response }, Number(response));
        if (response === "false") return json({ isAuthenticated: false, role: "Admin" });
        if (response === "False") return json({ IsAuthenticated: false, Role: "Admin" });
        if (response === "malformed") return json({});
        return json(token ? { isAuthenticated: true, role: claims.role, userName: "Remote " + claims.sub } : { isAuthenticated: false });
      };
      calls.push({ token, reply });
      if (hold) return;
      return reply();
    }
    if (pathname.endsWith("/unread-count")) return json({ unreadCount: 0 });
    if (pathname === "/api/v1/notifications") return json({ items: [], pageNumber: 1, pageSize: 40,
      totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
    if (pathname === "/api/v1/conversations") return json([{ conversationId: "conversation-" + claims.sub, createdAt: "2030-01-01", unreadMessageCount: 1 }]);
    if (pathname === "/api/v1/auth/logout") return json({});
    throw new Error(`Unexpected API ${pathname}`);
  });
  await page.goto("http://localhost:3000/session-validation-test");
  await page.evaluate(config => Object.assign(window, { sessionConfig: { role: "RegisteredUser", ...config }, process: { env: {} } }), options);
  await page.addScriptTag({ content: bundle });
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  return { calls, errors, setMode(next: Mode, pending = false) { mode = next; hold = pending; }, state: page.getByTestId("auth-state") };
}
async function guest(page: Page) {
  await expect(page.getByTestId("auth-state")).toContainText('"isAuthenticated":false');
  await expect(page.getByTestId("protected-content")).toHaveCount(0);
  expect(await page.evaluate("sessionTest.snapshot() ")).toMatchObject({ token: false, stored: false, local: null, account: null });
}

for (const mode of ["401", "false", "False"] as const) test(`explicit ${mode} rejection is authoritative over cached login`, async ({ page }) => {
  const { calls, errors } = await mount(page, { mode }); await guest(page);
  await page.locator("#local").click(); await guest(page);
  expect(await page.evaluate("localStorage.getItem('unrelated-preference')")).toBe("keep");
  expect(await page.evaluate("localStorage.getItem('wesal_remembered_email')")).toBe("remember@example.test");
  await page.locator("#mount").click(); await page.locator("#mount").click(); await guest(page);
  expect(calls.length).toBeLessThanOrEqual(2); expect(errors).toEqual([]);
});

test("a valid session uses the server identity and preserves local credentials", async ({ page }) => {
  const { state, errors } = await mount(page);
  await expect(state).toContainText('"userName":"Remote A"');
  await expect(page.getByTestId("protected-content")).toBeVisible();
  expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true, stored: true, account: "A" });
  expect(errors).toEqual([]);
});

for (const mode of ["network", "timeout", "500", "403", "malformed"] as const)
  test(`${mode} preserves a usable cached session without treating permission denial as expiry`, async ({ page }) => {
    const { calls, errors } = await mount(page, { mode });
    // Wait for the actual timeout/error path, not just the optimistic cached render.
    await page.evaluate("auth.refreshSession()");
    await expect(page.getByTestId("protected-content")).toBeVisible();
    expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true, stored: true, account: "A" });
    expect(calls.length).toBeLessThanOrEqual(2); expect(errors).toEqual([]);
  });

for (const credential of ["missing", "expired", "stored-only", "mismatch"] as const)
  test(`${credential} credentials cannot restore authentication during a temporary failure`, async ({ page }) => {
    await mount(page, { mode: "500", credential }); await guest(page);
  });

for (const response of ["valid", "401", "false", "500"] as const)
  test(`logout rejects a pending ${response} validation response`, async ({ page }) => {
    const { calls, state, errors } = await mount(page, { hold: true });
    await page.evaluate("auth.logout({redirect:false})"); await guest(page);
    await calls[0].reply(response); await expect(state).toContainText('"isAuthenticated":false');
    expect(calls).toHaveLength(1); expect(errors).toEqual([]);
  });

for (const response of ["valid", "401", "false", "500"] as const)
  test(`a late A ${response} response cannot overwrite or clear B`, async ({ page }) => {
    const { calls, state, errors } = await mount(page, { hold: true });
    await page.evaluate("sessionTest.login('B','HallOwner')"); await expect.poll(() => calls.length).toBe(2);
    await calls[1].reply(); await expect(state).toContainText('"userName":"Remote B"');
    await calls[0].reply(response); await expect(state).toContainText('"userName":"Remote B"');
    expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true, stored: true, account: "B" });
    expect(errors).toEqual([]);
  });

test("logout and login with the identical ID and token cannot revive the previous validation", async ({ page }) => {
  const { calls, state } = await mount(page, { hold: true });
  await page.evaluate("sessionTest.clear();sessionTest.login('A')"); await expect.poll(() => calls.length).toBe(2);
  await calls[1].reply(); await calls[0].reply("401");
  await expect(state).toContainText('"userName":"Remote A"');
  expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true, account: "A" });
});

test("a newer refresh wins over an older rejection within the same login", async ({ page }) => {
  const { calls, state } = await mount(page, { hold: true });
  await page.locator("#refresh").click(); await expect.poll(() => calls.length).toBe(2);
  await calls[1].reply(); await calls[0].reply("401");
  await expect(state).toContainText('"userName":"Remote A"');
  expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true });
});

test("unmount invalidates validation; a remount owns an independent request", async ({ page }) => {
  const { calls, state } = await mount(page, { hold: true });
  await page.locator("#mount").click(); await page.locator("#mount").click(); await expect.poll(() => calls.length).toBe(2);
  await calls[1].reply(); await calls[0].reply("401"); await expect(state).toContainText('"userName":"Remote A"');
});

test("StrictMode cleanup cannot make an obsolete validation authoritative", async ({ page }) => {
  const { calls, state } = await mount(page, { hold: true, strict: true });
  await calls[calls.length - 1].reply(); await expect(state).toContainText('"userName":"Remote A"');
  for (const call of calls.slice(0, -1)) await call.reply("401");
  expect(await page.evaluate("sessionTest.snapshot()")).toMatchObject({ token: true });
});

for (const role of ["RegisteredUser", "HallOwner", "Admin", "EventCoordinator", "Photographer"])
  test(`${role} retains its existing role guards and loses protected content after invalidation`, async ({ page }) => {
    const guard = role === "Admin" ? "admin" : role === "HallOwner" ? "owner" : undefined;
    const { setMode, state } = await mount(page, { role, guard });
    await expect(state).toContainText('"userName":"Remote A"'); await expect(page.getByTestId("protected-content")).toBeVisible();
    if (!guard) { await page.locator("#admin").click(); await expect(page.getByTestId("protected-content")).toHaveCount(0); }
    setMode("401"); await page.locator("#refresh").click(); await guest(page);
  });

test("confirmed invalidation resets F01 notifications and F02 inbox before a different login", async ({ page }) => {
  const { setMode } = await mount(page, { integration: true });
  await expect(page.getByTestId("isolated-state")).toContainText("conversation-A");
  await page.evaluate("sessionTest.push()"); await expect(page.getByTestId("isolated-state")).toContainText("Private A");
  setMode("false"); await page.locator("#refresh").click(); await guest(page);
  await expect(page.getByTestId("isolated-state")).toContainText('"account":null');
  await expect(page.getByTestId("isolated-state")).not.toContainText("Private A");
  await expect(page.getByTestId("isolated-state")).not.toContainText("conversation-A");
  setMode("valid"); await page.evaluate("sessionTest.login('B')");
  await expect(page.getByTestId("isolated-state")).toContainText("conversation-B");
  await expect(page.getByTestId("isolated-state")).not.toContainText("Private A");
});

test("a cached token that expires during validation is not restored after a server error", async ({ page }) => {
  const { calls } = await mount(page, { hold: true });
  await page.evaluate("const originalNow=Date.now;Date.now=()=>originalNow()+7200000");
  await calls[0].reply("500"); await guest(page);
});

test("unrelated cross-tab storage events do not repeatedly validate the session", async ({ page }) => {
  const { calls, state } = await mount(page); await expect(state).toContainText('"userName":"Remote A"');
  await page.evaluate(() => {
    for (const key of ["wesal-platform-notifications:v2:A", "theme", "booking-draft"]) {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: "changed" }));
    }
    return new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(calls).toHaveLength(1);
});

test("cross-tab logout invalidates pending validation and protected UI", async ({ page }) => {
  const { calls } = await mount(page, { hold: true });
  await page.evaluate(() => {
    sessionStorage.removeItem("wesal-access-token"); sessionStorage.removeItem("wesal_auth");
    window.dispatchEvent(new StorageEvent("storage", { key: "wesal_auth", newValue: null }));
  });
  await guest(page); await calls[0].reply(); await guest(page);
});

test("same-turn refresh and account switching cannot dispatch A validation with B credentials", async ({ page }) => {
  const { calls, state, setMode } = await mount(page); await expect(state).toContainText('"userName":"Remote A"');
  setMode("valid", true);
  await page.evaluate("auth.refreshSession();sessionTest.login('B')");
  await expect.poll(() => calls.length).toBe(2); await calls[1].reply();
  await expect(state).toContainText('"userName":"Remote B"');
  expect(calls.filter(call => JSON.parse(Buffer.from(call.token.split('.')[1], 'base64').toString()).sub === "A")).toHaveLength(1);
});

test("the existing login sequence of storage, local identity and refresh remains functional", async ({ page }) => {
  const { state } = await mount(page); await expect(state).toContainText('"userName":"Remote A"');
  await page.evaluate("sessionTest.login('B','Photographer');auth.applyLocalSession({isAuthenticated:true,role:'Photographer',userName:'B'});auth.refreshSession()");
  await expect(state).toContainText('"userName":"Remote B"'); await expect(state).toContainText('"role":"Photographer"');
  await expect(page.getByTestId("protected-content")).toBeVisible();
});
