import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

let bundle: string;
let styles = "";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=", "base64");
test.beforeAll(async () => {
  const chunks = path.resolve(".next/static/chunks");
  if (fs.existsSync(chunks)) styles = fs.readdirSync(chunks).filter(f => f.endsWith(".css"))
    .map(f => fs.readFileSync(path.join(chunks, f), "utf8")).filter(css => css.includes(".container-wesal")).join("\n");
  const mocks: Record<string, string> = {
    "next/navigation": "export const usePathname=()=>'/profile/messages';",
    "@/hooks/useAccountAccess": "export const useAccountAccess=()=>({isHallOwner:false});",
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.lang;",
    "@/components/brand/MabroukFigure": "import React from'react';export default()=> <span/>;",
    "@/lib/api": `import{getStoredAuth}from'@/lib/auth-storage';import{ApiError,parseApiFieldErrors}from'@/lib/api-error';export const apiOrigin=()=>location.origin;
      export default{get(path){const owner=getStoredAuth()?.user?.id,id=path.split('/')[2];
        if(path.endsWith('/attachment')){const messageId=path.split('/').at(-2),file=window.files.get(messageId);return Promise.resolve({data:file||new Blob([window.png],{type:'image/png'})})}
        return Promise.resolve({data:{conversationId:id,hallId:'',hallName:'',messages:window.messages.get(owner+':'+id)||[]}})},
      post(path,body,config={}){if(path.endsWith('/read'))return Promise.resolve({data:null});
        const owner=getStoredAuth()?.user?.id,kind=window.kind,conversationId=path.split('/')[2],file=body.get('file');
        const call={path,owner,kind,conversationId,file,caption:body.get('content')||'',clientRequestId:body.get('clientRequestId')};window.calls.push(call);
        return new Promise((resolve,reject)=>{call.resolve=()=>{
          if(window.fail)return reject(new ApiError('Temporary server error',500));
          if(kind==='CustomerProvider'&&!window.cpEnabled){const problem={status:400,title:'Validation failed',code:'ValidationError',errors:{message:['Attachments are not supported in professional conversations.']}};
            return reject(new ApiError(problem.title,400,parseApiFieldErrors(problem),{code:problem.code,details:problem}))}
          const messageId=window.id(900+window.calls.findIndex(x=>x.clientRequestId===call.clientRequestId)),sentAt='2026-11-23T10:00:00Z';
          const data={messageId,clientRequestId:call.clientRequestId,senderUserId:owner,senderName:'Sender',content:call.caption,sentAt,hasAttachment:true,
            attachmentFileName:file.name,attachmentContentType:file.type,attachmentUrl:'/api/v1/conversations/'+conversationId+'/messages/'+messageId+'/attachment'};
          window.files.set(messageId,file);const key=owner+':'+conversationId,rows=window.messages.get(key)||[];window.messages.set(key,[...rows.filter(x=>x.id!==messageId),{...data,id:messageId}]);resolve({data})};
          config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)reject(new Error('aborted'))});
          if(!window.hold)call.resolve()})}};`,
  };
  bundle = (await build({ stdin: { loader: "tsx", resolveDir: process.cwd(), contents: `import React,{useState,useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';
    import{useConversationThread}from'./src/hooks/useConversationThread';import{useAdminChat}from'./src/hooks/useAdminChat';import Composer from'./src/components/messages/MessageComposer';import Item from'./src/components/messages/ThreadMessageItem';
    import{readAuthenticatedAccount,subscribeAuthenticatedAccount}from'./src/lib/authenticated-account';import{getStoredAuth,setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';import{useT}from'./src/i18n';
    window.calls=[];window.messages=new Map();window.files=new Map();window.id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
    window.png=Uint8Array.from(atob('${png.toString("base64")}'),x=>x.charCodeAt(0));window.lang=window.seedLang||'en';window.kind=window.seedKind||'CustomerProvider';document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    window.actions={login(id,role=window.seedRole||'Photographer'){const token='chat-'+id;setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession};actions.login('A');
    function Probe({conversationId,owner}){const t=useT(),[caption,setCaption]=useState('');const thread=useConversationThread(conversationId,owner);
      const summary={conversationId,kind,hallId:'',hallName:'',otherParticipantId:'peer',otherParticipantName:'Peer',lastMessagePreview:'',lastMessageAt:null,messageCount:0,unreadMessageCount:0,createdAt:'2026-11-23T10:00:00Z',isUnread:false};
      const draft=useAdminChat({conversations:[summary],selectedId:conversationId,inboxStatus:'ready',selectConversation:()=>{},sendMessage:async()=>true,
        sendAttachment:(file,text)=>thread.sendAttachment(file,text,owner,'Sender')});
      window.draft=draft;window.thread=thread;window.caption=caption;window.receive=()=>thread.applyIncoming({id:id(777),senderUserId:'peer',senderName:'Peer',content:'Received image',sentAt:'2026-11-23T10:00:00Z',delivery:'sent',hasAttachment:true,attachmentFileName:'received.png',attachmentUrl:'/api/v1/conversations/'+conversationId+'/messages/'+id(777)+'/attachment'},conversationId,true);
      return <><output data-testid="state">{JSON.stringify({owner,conversationId,status:thread.status,canAttach:draft.canAttach,messages:thread.thread?.messages||[]})}</output>
        {(thread.thread?.messages||[]).map(message=><Item key={message.id} message={message} own={message.senderUserId===owner} retrying={false} hallName="" conversationId={conversationId} onRetrySend={thread.retrySend}/>)}
        {draft.errorKey&&<p role="alert">{t(draft.errorKey)}</p>}
        <Composer id="caption" value={caption} disabled={thread.status==='loading'} onChange={setCaption} onSend={text=>draft.sendWithAttachment(text)}
          attachmentPreviewUrl={draft.attachmentPreviewUrl} attachmentName={draft.attachmentName} attachmentBusy={draft.attachmentBusy} onPickAttachment={draft.pickAttachment} onClearAttachment={draft.clearAttachment}/></>}
    function App(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount),[conversationId,select]=useState(id(1)),[shown,setShown]=useState(true);window.select=select;window.toggle=()=>setShown(v=>!v);
      return <div className="mx-auto max-w-2xl p-3">{shown&&<Probe key={account?.token||'guest'} conversationId={conversationId} owner={account?.userId||null}/>}</div>}
    createRoot(document.getElementById('root')).render(<App/>);` },
    bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "chat-contract", setup(b) {
      b.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  })).outputFiles[0].text;
});
async function mount(page: Page, options: { role?: string; kind?: string; lang?: string; enabled?: boolean; hold?: boolean; styled?: boolean } = {}) {
  page.on("pageerror", error => console.error(error.message));
  await page.route("**/*", route => route.request().resourceType() === "document"
    ? route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' }) : route.abort());
  await page.goto("http://localhost:3000/profile/messages");
  await page.evaluate(() => Object.assign(window, { process: { env: {} } }));
  await page.evaluate(opts => Object.assign(window, { seedRole: opts.role || "Photographer", seedKind: opts.kind || "CustomerProvider", seedLang: opts.lang || "en", cpEnabled: opts.enabled || false, hold: opts.hold || false }), options);
  if (options.styled) { expect(styles).toContain("container-wesal"); await page.addStyleTag({ content: styles }); }
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId("state")).toContainText('"status":"empty"');
}
async function selectImage(page: Page, file = { name: "photo.png", mimeType: "image/png", buffer: png }) {
  await page.locator('input[type="file"]').setInputFiles(file);
}
const send = (page: Page) => page.locator('button[type="submit"]');
const directions = [
  { label: "Customer → Photographer", role: "RegisteredUser" },
  { label: "Photographer → Customer", role: "Photographer" },
  { label: "Customer → Coordinator", role: "RegisteredUser" },
  { label: "Coordinator → Customer", role: "EventCoordinator" },
];

for (const direction of directions) {
  test(`${direction.label}: current backend rejects CustomerProvider images without removing the attach control`, async ({ page }) => {
    await mount(page, { role: direction.role });
    await expect(page.getByTestId("message-attach-receipt")).toBeVisible();
    await page.locator("#caption").fill("Image caption"); await selectImage(page);
    await expect(page.getByTestId("message-attachment-preview")).toBeVisible();
    await send(page).click();
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
    await expect(page.getByTestId("thread-send-failed")).toContainText("Image sharing is not enabled for this conversation");
    await expect(page.locator("#caption")).toHaveValue("Image caption");
    await expect(page.getByTestId("message-attachment-preview")).toBeVisible();
    expect(await page.evaluate("calls[0].kind")).toBe("CustomerProvider");
    expect(await page.evaluate("calls[0].path")).toMatch(/\/conversations\/[^/]+\/messages\/attachment$/);
  });
}

test("same-turn send calls start only one upload", async ({ page }) => {
  await mount(page, { kind: "AdminAccount", hold: true }); await selectImage(page);
  await expect(page.getByTestId("message-attachment-preview")).toBeVisible();
  await page.evaluate("void draft.sendWithAttachment('Caption');void draft.sendWithAttachment('Caption')");
  expect(await page.evaluate("calls.length")).toBe(1);
});

test("an empty image is rejected before preview or upload", async ({ page }) => {
  await mount(page); await selectImage(page, { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
  await expect(page.getByTestId("message-attachment-preview")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("empty");
  expect(await page.evaluate("calls.length")).toBe(0);
});

for (const role of ["Photographer", "Admin"]) {
  test(`${role}: AdminAccount upload still succeeds and renders the authenticated download`, async ({ page }) => {
    await mount(page, { role, kind: "AdminAccount" });
    await page.locator("#caption").fill("Admin image"); await selectImage(page); await send(page).click();
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
    await expect(page.getByTestId("message-attachment-preview")).toHaveCount(0);
    await expect(page.getByTestId("chat-image-thumb")).toBeVisible();
    await expect.poll(() => page.getByTestId("chat-image-thumb").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.getByTestId("chat-image-thumb").click();
    await expect(page.getByTestId("chat-image-lightbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("chat-image-lightbox")).toHaveCount(0);
    expect(await page.evaluate("calls.length")).toBe(1);
  });
}

for (const direction of directions) {
  test(`${direction.label}: frontend ready when backend support is explicitly simulated`, async ({ page }) => {
    await mount(page, { role: direction.role, enabled: true });
    await page.locator("#caption").fill("Customer image caption"); await selectImage(page); await send(page).click();
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
    expect(await page.evaluate("calls[0].caption")).toBe("Customer image caption");
    expect(await page.evaluate("calls[0].kind")).toBe("CustomerProvider");
    expect(await page.evaluate("calls[0].file.type")).toBe("image/png");
    await expect(page.getByTestId("chat-image-thumb")).toBeVisible();
  });
}

for (const [mime, extension] of [["image/jpeg", "jpeg"], ["image/png", "png"], ["image/webp", "webp"]]) {
  test(`${mime}: real image bytes produce a preview and use the existing upload contract`, async ({ page }) => {
    await mount(page, { kind: "AdminAccount" });
    const encoded = await page.evaluate(type => {
      const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 2;
      canvas.getContext("2d")?.fillRect(0, 0, 2, 2);
      return canvas.toDataURL(type).split(",")[1];
    }, mime);
    await selectImage(page, { name: `image.${extension}`, mimeType: mime, buffer: Buffer.from(encoded, "base64") });
    await expect.poll(() => page.getByTestId("message-attachment-preview").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2);
    await send(page).click();
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
    expect(await page.evaluate("calls[0].file.type")).toBe(mime);
  });
}

for (const [name, mime] of [["image.svg", "image/svg+xml"], ["image.gif", "image/gif"], ["document.pdf", "application/pdf"], ["image.exe", "image/png"]]) {
  test(`${name}: unsupported upload is rejected before a request`, async ({ page }) => {
    await mount(page); await selectImage(page, { name, mimeType: mime, buffer: png });
    await expect(page.getByRole("alert")).toContainText("JPG, PNG, or WEBP");
    await expect(page.getByTestId("message-attachment-preview")).toHaveCount(0);
    expect(await page.evaluate("calls.length")).toBe(0);
  });
}

test("images larger than 5 MiB are rejected without losing typed content", async ({ page }) => {
  await mount(page); await page.locator("#caption").fill("Keep my caption");
  await selectImage(page, { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert")).toContainText("exceeds 5 MB");
  await expect(page.locator("#caption")).toHaveValue("Keep my caption");
  expect(await page.evaluate("calls.length")).toBe(0);
});

test("the backend 5 MiB boundary remains accepted", async ({ page }) => {
  await mount(page);
  await selectImage(page, { name: "limit.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 - png.length)]) });
  await expect(page.getByTestId("message-attachment-preview")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("busy upload prevents duplicate UI submissions and shows a real loading state", async ({ page }) => {
  await mount(page, { kind: "AdminAccount", hold: true }); await selectImage(page); await send(page).click();
  await expect(page.locator("form").getByRole("status")).toHaveText("Uploading image…");
  await expect(send(page)).toBeDisabled();
  await expect(page.getByTestId("message-attach-receipt")).toBeDisabled();
  await expect(page.locator("#caption")).toBeDisabled();
  await page.evaluate("calls[0].resolve()");
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await expect(page.locator("form").getByRole("status")).toHaveCount(0);
});

test("failed attachment retries retain the file and caption until simulated backend activation", async ({ page }) => {
  await mount(page); await page.locator("#caption").fill("Original caption"); await selectImage(page); await send(page).click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => page.evaluate("calls.length")).toBe(2);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
  await page.evaluate("window.cpEnabled=true");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(await page.evaluate("new Set(calls.map(x=>x.clientRequestId)).size")).toBe(1);
  expect(await page.evaluate("calls.every(x=>x.caption==='Original caption'&&x.file.name==='photo.png'&&x.file.type==='image/png')")).toBe(true);
  const bytes = await page.evaluate("Promise.all(calls.map(async x=>Array.from(new Uint8Array(await x.file.arrayBuffer()))))");
  expect(bytes[1]).toEqual(bytes[0]); expect(bytes[2]).toEqual(bytes[0]);
  await expect(page.getByTestId("thread-message")).toHaveCount(1);
});

test("transient AdminAccount failures can retry without losing the original image", async ({ page }) => {
  await mount(page, { kind: "AdminAccount" }); await page.evaluate("window.fail=true");
  await selectImage(page); await send(page).click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
  await page.evaluate("window.fail=false"); await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
});

test("existing received attachment DTOs render independently of the current send restriction", async ({ page }) => {
  await mount(page); await page.evaluate("receive()");
  await expect(page.getByTestId("chat-image-thumb")).toBeVisible();
  await expect.poll(() => page.getByTestId("chat-image-thumb").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("thread-message")).toContainText("Received image");
});

for (const action of ["actions.login('B')", "actions.logout()", "select(id(2))"]) {
  test(`pending upload cannot display in the next account or conversation after ${action}`, async ({ page }) => {
    await mount(page, { kind: "AdminAccount", hold: true }); await selectImage(page); await send(page).click();
    await page.evaluate("window.ignoreAbort=true"); await page.evaluate(action);
    await page.evaluate("calls[0].resolve()");
    await expect(page.getByTestId("message-attachment-preview")).toHaveCount(0);
    await expect(page.getByTestId("thread-message")).toHaveCount(0);
    expect(await page.evaluate("calls.length")).toBe(1);
  });
}

for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) {
  test(`${lang} at ${width}px: CustomerProvider remains selectable and rejection is localized`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await mount(page, { lang, styled: true });
    await selectImage(page); await send(page).click();
    await expect(page.getByTestId("thread-send-failed")).toContainText(lang === "ar" ? "إرسال الصور غير مفعّل لهذه المحادثة" : "Image sharing is not enabled for this conversation");
    await expect(page.getByTestId("message-attachment-preview")).toBeVisible();
    expect(await page.locator("html").getAttribute("dir")).toBe(lang === "ar" ? "rtl" : "ltr");
  });
}
