import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { ConversationSummary } from "../src/types/messages";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": "export const t=k=>k;",
    "next/navigation": "export const usePathname=()=>'/owner/halls/shared-hall';",
    "@/components/messages/MessagesInboxProvider": "export const useOptionalMessagesInbox=()=>null;",
    "@/hooks/useAccountAccess": `import{getStoredAuth}from'@/lib/auth-storage';
      export const useAccountAccess=()=>({isHallOwner:getStoredAuth()?.user?.role==='HallOwner'});`,
    "@/hooks/useHallOwnerHalls": "export const useHallOwnerHalls=()=>({halls:[{id:'shared-hall',paymentStatus:'Paid'}]});",
    // Deliberately ignore cancellation: correctness must not depend on transport cooperation.
    "@/services/conversations": `import{getStoredAuth}from'@/lib/auth-storage';
      function pending(kind){return new Promise((resolve,reject)=>window.pendingInbox.push({kind,user:getStoredAuth()?.user?.id,
        resolve(value){this.settled=true;resolve(value)},reject(message){this.settled=true;reject(new Error(message))}}))}
      export const fetchInboxConversations=()=>pending('list');
      export const fetchProfessionalConversationPage=()=>pending('list').then(items=>({items,pageNumber:1,pageSize:100,
        totalCount:items.length,totalPages:items.length?1:0,hasPreviousPage:false,hasNextPage:false}));
      export const fetchMyAdminAccountConversation=()=>pending('admin');
      export const fetchConversationThread=()=>pending('thread');
      export const conversationErrorMessage=e=>e.message;`,
  };
  const output = await build({
    stdin: { contents: `import React,{useState,useSyncExternalStore,StrictMode}from'react';import{createRoot}from'react-dom/client';
      import{useInboxConversations}from'./src/hooks/useInboxConversations';
      import{useContactAdmin}from'./src/hooks/useContactAdmin';
      import{useHallRejectionReason}from'./src/hooks/useHallRejectionReason';
      import{getStoredAuth,setStoredAuth,clearAuthSession,AUTH_CHANGE_EVENT}from'./src/lib/auth-storage';
      import{setAccessToken}from'./src/lib/auth-token';
      const subscribe=f=>{window.addEventListener(AUTH_CHANGE_EVENT,f);return()=>window.removeEventListener(AUTH_CHANGE_EVENT,f)};
      window.pendingInbox=[];window.actions={login(id,role='RegisteredUser',suffix=''){const token='inbox-'+id+suffix;
        setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession};
      actions.login('A',new URLSearchParams(location.search).get('role')||'RegisteredUser');
      function Probe({ownerKey,active,includeAdmin}){const inbox=useInboxConversations(ownerKey,active,includeAdmin);window.inbox=inbox;
        return <><output data-testid="inbox-state">{JSON.stringify({ownerKey,status:inbox.status,error:inbox.error,items:inbox.conversations})}</output>
          <button onClick={inbox.refresh}>Refresh inbox</button><button onClick={inbox.retry}>Retry inbox</button></>}
      function Harness(){const[shown,setShown]=useState(true),[active,setActive]=useState(!location.search.includes('closed'));
        const[includeAdmin,setIncludeAdmin]=useState(location.search.includes('admin'));
        const raw=useSyncExternalStore(subscribe,()=>JSON.stringify(getStoredAuth()));const auth=JSON.parse(raw);
        return <><button id="mount" onClick={()=>setShown(v=>!v)}>Mount</button>
          <button id="active" onClick={()=>setActive(v=>!v)}>Active</button>
          <button id="admin" onClick={()=>setIncludeAdmin(v=>!v)}>Admin mode</button>
          {shown&&<><Probe ownerKey={auth?.user?.id||null} active={active} includeAdmin={includeAdmin}/>
            {location.search.includes('helpers')&&<OwnerHelpers/>}</>}</>}
      function OwnerHelpers(){const contact=useContactAdmin(),reason=useHallRejectionReason('shared-hall',true);
        return <output data-testid="owner-helper-state">{JSON.stringify({contact,reason})}</output>}
      createRoot(document.getElementById('root')).render(location.search.includes('strict')?<StrictMode><Harness/></StrictMode>:<Harness/>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), define: { "process.env.NODE_ENV": '"development"',
      "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "deferred-inbox", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = output.outputFiles[0].text;
});

const row = (id: string, unreadMessageCount = 0, at = "2030-01-01T00:00:00Z"): ConversationSummary => ({
  conversationId: id, kind: "HallBooking", hallId: "hall-" + id, hallName: id,
  otherParticipantId: "peer-" + id, otherParticipantName: id, lastMessagePreview: id,
  lastMessageAt: at, createdAt: at, messageCount: 1, unreadMessageCount, isUnread: unreadMessageCount > 0,
});
async function mount(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).pathname !== "/inbox-isolation-test") throw new Error("Unexpected network");
    return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
  });
  await page.goto(`http://localhost:3000/inbox-isolation-test${query}`);
  await page.evaluate(() => { Object.assign(window, { process: { env: {} } }); });
  await page.addScriptTag({ content: bundle });
  const state = page.getByTestId("inbox-state");
  await expect.poll(async () => { expect(errors).toEqual([]); return state.textContent(); }).toContain('"ownerKey":"A"');
  return { state, errors };
}
async function pending(page: Page, count: number) {
  await expect.poll(() => page.evaluate("pendingInbox.length")).toBe(count);
}
async function resolve(page: Page, index: number, rows: ConversationSummary[] | ConversationSummary | null) {
  await page.evaluate(`pendingInbox[${index}].resolve(${JSON.stringify(rows)})`);
}
async function reject(page: Page, index: number, message = "old account failure") {
  await page.evaluate(`pendingInbox[${index}].reject(${JSON.stringify(message)})`);
}
async function login(page: Page, id: string, role = "RegisteredUser", suffix = "") {
  await page.evaluate(`actions.login(${JSON.stringify(id)},${JSON.stringify(role)},${JSON.stringify(suffix)})`);
  await expect(page.getByTestId("inbox-state")).toContainText(`"ownerKey":"${id}"`);
}

test("a delayed refresh cannot replace the next account's inbox", async ({ page }) => {
  const { state, errors } = await mount(page); await pending(page, 1);
  await resolve(page, 0, [row("A-initial")]);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await login(page, "B"); await pending(page, 3);
  await resolve(page, 2, [row("B-private")]);
  await resolve(page, 1, [row("A-private-delayed")]);
  await expect(state).toContainText("B-private");
  await expect(state).not.toContainText("A-private-delayed");
  expect(errors).toEqual([]);
});

test("normal loading and manual refresh preserve server ordering and unread updates", async ({ page }) => {
  const { state, errors } = await mount(page); await pending(page, 1);
  await resolve(page, 0, [row("new", 2, "2030-02-01T00:00:00Z"), row("old", 1)]);
  await expect(state).toContainText('"status":"ready"');
  expect(await page.evaluate("inbox.conversations.map(i=>i.conversationId)")).toEqual(["new", "old"]);
  await page.evaluate("inbox.markLocalRead('new');inbox.applyUnreadCount('old',4);inbox.applyPreview('old','latest','2030-03-01T00:00:00Z')");
  await expect.poll(() => page.evaluate("inbox.conversations.map(i=>[i.conversationId,i.unreadMessageCount])")).toEqual([["old", 5], ["new", 0]]);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await expect(state).toContainText("latest");
  await resolve(page, 1, [row("fresh", 3)]);
  await expect(state).toContainText("fresh"); await expect(state).not.toContainText("latest");
  expect(errors).toEqual([]);
});

for (const role of ["RegisteredUser", "HallOwner", "EventCoordinator", "Photographer", "Admin"]) {
  test(`${role}: a delayed initial load is isolated between accounts of the same role`, async ({ page }) => {
    const { state, errors } = await mount(page, `?role=${role}`); await pending(page, 1);
    await login(page, "B", role); await pending(page, 2);
    await expect(state).toContainText('"items":[]'); await expect(state).toContainText('"status":"loading"');
    await resolve(page, 0, [row("Private A")]);
    await expect(state).toContainText('"items":[]');
    await resolve(page, 1, [row("Private B")]);
    await expect(state).toContainText("Private B"); await expect(state).not.toContainText("Private A");
    expect(errors).toEqual([]);
  });
}

for (const mode of ["initial", "refresh"] as const) {
  test(`logout invalidates a pending ${mode} and clears visible data`, async ({ page }) => {
    const { state } = await mount(page); await pending(page, 1);
    let index = 0;
    if (mode === "refresh") {
      await resolve(page, 0, [row("A-before-logout")]);
      await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
      index = 1;
    }
    await page.evaluate("actions.logout()");
    await expect(state).toContainText('"status":"idle"'); await expect(state).toContainText('"items":[]');
    await resolve(page, index, [row("A-after-logout")]);
    await expect(state).toContainText('"status":"idle"'); await expect(state).not.toContainText("A-after-logout");
  });
}

test("unmount/remount rejects pending work from the previous hook instance", async ({ page }) => {
  const { state, errors } = await mount(page); await pending(page, 1);
  await page.locator("#mount").click(); await page.locator("#mount").click(); await pending(page, 2);
  await resolve(page, 1, [row("current instance")]); await resolve(page, 0, [row("abandoned instance")]);
  await expect(state).toContainText("current instance"); await expect(state).not.toContainText("abandoned instance");
  expect(errors).toEqual([]);
});

test("A to B to A does not revive either abandoned initial load", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1);
  await login(page, "B"); await pending(page, 2); await login(page, "A"); await pending(page, 3);
  await resolve(page, 0, [row("first A login")]); await resolve(page, 1, [row("old B login")]);
  await expect(state).toContainText('"items":[]');
  await resolve(page, 2, [row("current A login")]);
  await expect(state).toContainText("current A login"); await expect(state).not.toContainText("first A login");
});

test("batched logout/login with the same ID and token invalidates old actions and responses", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1);
  await page.evaluate("window.previousInbox=inbox;actions.logout();actions.login('A')"); await pending(page, 2);
  await resolve(page, 1, [row("new A session")]); await resolve(page, 0, [row("old A session")]);
  await page.evaluate(`previousInbox.refresh();previousInbox.retry();previousInbox.ensureConversation(${JSON.stringify(row("old action"))})`);
  await expect(state).toContainText("new A session"); await expect(state).not.toContainText("old A session");
  await pending(page, 2);
});

test("a newer refresh wins over an older refresh in the same account", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1); await resolve(page, 0, [row("initial")]);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 3);
  await resolve(page, 2, [row("newest refresh")]); await resolve(page, 1, [row("older refresh")]);
  await expect(state).toContainText("newest refresh"); await expect(state).not.toContainText("older refresh");
});

test("refresh and retry share one request generation", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1); await resolve(page, 0, [row("initial")]);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await page.getByRole("button", { name: "Retry inbox", exact: true }).click(); await pending(page, 3);
  await expect(state).toContainText('"status":"loading"');
  await resolve(page, 1, [row("obsolete refresh")]); await expect(state).toContainText('"items":[]');
  await resolve(page, 2, [row("retry result")]); await expect(state).toContainText("retry result");
});

test("old errors cannot replace B loading or ready states, and retry clears current errors", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1);
  await login(page, "B"); await pending(page, 2); await reject(page, 0);
  await expect(state).toContainText('"status":"loading"'); await expect(state).toContainText('"error":null');
  await reject(page, 1, "B current failure"); await expect(state).toContainText("B current failure");
  await page.getByRole("button", { name: "Retry inbox", exact: true }).click(); await pending(page, 3);
  await expect(state).toContainText('"error":null'); await resolve(page, 2, []);
  await expect(state).toContainText('"status":"empty"');
});

test("closing parks data, while switching accounts in a closed panel hides it immediately", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1); await resolve(page, 0, [row("A parked")]);
  await page.locator("#active").click(); await expect(state).toContainText("A parked");
  await login(page, "B"); await expect(state).toContainText('"items":[]'); await pending(page, 1);
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await resolve(page, 1, [row("B background refresh")]); await expect(state).toContainText("B background refresh");
});

test("late list data does not start an admin lookup under the next account", async ({ page }) => {
  const { state } = await mount(page, "?admin"); await pending(page, 1);
  await page.locator("#active").click(); await login(page, "B");
  await resolve(page, 0, [row("A customer")]); await pending(page, 1);
  await expect(state).toContainText('"items":[]');
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click(); await pending(page, 2);
  await resolve(page, 1, [row("B customer")]); await pending(page, 3);
  expect(await page.evaluate("pendingInbox[2].user")).toBe("B");
  await resolve(page, 2, { ...row("B admin"), kind: "AdminAccount", hallId: "", hallName: "" });
  await expect(state).toContainText("B admin"); await expect(state).not.toContainText("A customer");
});

test("admin rows remain canonical, ordered, and deduplicated with their unread count", async ({ page }) => {
  const { state } = await mount(page, "?admin"); await pending(page, 1);
  await resolve(page, 0, [row("customer", 2, "2031-01-01T00:00:00Z"),
    { ...row("legacy admin"), kind: "AdminAccount" }, { ...row("canonical admin", 7), kind: "AdminAccount" }]);
  await pending(page, 2);
  await resolve(page, 1, { ...row("canonical admin", 3), kind: "AdminAccount", hallId: "", hallName: "" });
  await expect(state).toContainText('"status":"ready"');
  expect(await page.evaluate("inbox.conversations.map(i=>[i.conversationId,i.unreadMessageCount])")).toEqual([["customer", 2], ["canonical admin", 3]]);
});

test("stale callbacks cannot mutate the next account even when conversation IDs coincide", async ({ page }) => {
  const { state } = await mount(page); await pending(page, 1); await resolve(page, 0, [row("same id", 1)]);
  await page.evaluate("window.previousInbox=inbox"); await login(page, "B"); await pending(page, 2);
  await resolve(page, 1, [row("same id", 4)]);
  await page.evaluate(`previousInbox.markLocalRead('same id');previousInbox.applyUnreadCount('same id',9);
    previousInbox.applyPreview('same id','A stale preview','2032-01-01T00:00:00Z');
    previousInbox.ensureConversation(${JSON.stringify(row("A injected"))});previousInbox.retry();previousInbox.refresh()`);
  await expect(state).toContainText('"unreadMessageCount":4');
  await expect(state).not.toContainText("A stale preview"); await expect(state).not.toContainText("A injected");
  await pending(page, 2);
});

test("StrictMode cleanup cannot reactivate the abandoned first request", async ({ page }) => {
  const { state, errors } = await mount(page, "?strict"); await pending(page, 2);
  await resolve(page, 1, [row("strict current")]); await resolve(page, 0, [row("strict stale")]);
  await expect(state).toContainText("strict current"); await expect(state).not.toContainText("strict stale");
  expect(errors).toEqual([]);
});

test("owner helper caches cannot reuse A's conversation or hall-rejection reason for B", async ({ page }) => {
  const { errors } = await mount(page, "?helpers&closed&role=HallOwner"); await pending(page, 2);
  const adminA = { ...row("A admin", 2), kind: "AdminAccount", hallId: "shared-hall" };
  await resolve(page, 0, [adminA]); await resolve(page, 1, [adminA]); await pending(page, 3);
  await page.evaluate(`pendingInbox[2].resolve({messages:[{content:'Your hall was rejected for the following reason: "A private reason"'}]})`);
  const state = page.getByTestId("owner-helper-state");
  await expect(state).toContainText("A private reason"); await expect(state).toContainText("A admin");
  await login(page, "B", "HallOwner");
  await expect(state).not.toContainText("A admin"); await expect(state).not.toContainText("A private reason");
  await pending(page, 5);
  const adminB = { ...adminA, conversationId: "B admin" };
  await resolve(page, 3, [adminB]); await resolve(page, 4, [adminB]); await pending(page, 6);
  await page.evaluate(`pendingInbox[5].resolve({messages:[{content:'Your hall was rejected for the following reason: "B private reason"'}]})`);
  await expect(state).toContainText("B private reason"); await expect(state).toContainText("B admin");
  expect(errors).toEqual([]);
});

test("late helper requests cannot overwrite B's shared cache or start an A thread with B credentials", async ({ page }) => {
  const { errors } = await mount(page, "?helpers&closed&role=HallOwner"); await pending(page, 2);
  await login(page, "B", "HallOwner"); await pending(page, 4);
  const adminB = { ...row("B admin"), kind: "AdminAccount", hallId: "shared-hall" };
  await resolve(page, 2, [adminB]); await resolve(page, 3, [adminB]); await pending(page, 5);
  const adminA = { ...adminB, conversationId: "A admin" };
  await resolve(page, 0, [adminA]); await resolve(page, 1, [adminA]); await pending(page, 5);
  await page.evaluate(`pendingInbox[4].resolve({messages:[{content:'Rejected for the following reason: "B reason"'}]})`);
  await expect(page.getByTestId("owner-helper-state")).toContainText("B reason");
  await page.locator("#mount").click(); await page.locator("#mount").click(); await pending(page, 6);
  expect(await page.evaluate("pendingInbox[5].kind")).toBe("thread");
  await page.evaluate("pendingInbox[5].resolve({messages:[]})");
  await expect(page.getByTestId("owner-helper-state")).toContainText("B admin");
  await expect(page.getByTestId("owner-helper-state")).not.toContainText("A admin");
  expect(errors).toEqual([]);
});
