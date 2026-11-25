import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import ar from "../../src/i18n/messages/ar";
import en from "../../src/i18n/messages/en";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "next/navigation": "export const usePathname=()=>'/messages';",
    "@/hooks/useAccountAccess": "export const useAccountAccess=()=>({isHallOwner:false});",
    "@/i18n": `const catalogs=${JSON.stringify({ ar, en })};export const t=key=>catalogs[window.chatLang||'en'][key]??key;export const useT=()=>t;export const useTranslateLang=()=>window.chatLang||'en';`,
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.chatLang||'en';",
    "@/components/brand/MabroukFigure": "import React from'react';export default function Figure(){return <span/>}",
  };
  const output = await build({
    stdin: { contents: `import React,{useState,useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';
      import{useConversationThread}from'./src/hooks/useConversationThread';import{useAdminChat}from'./src/hooks/useAdminChat';import Item from'./src/components/messages/ThreadMessageItem';
      import{getStoredAuth,setStoredAuth,clearAuthSession,AUTH_CHANGE_EVENT}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
      window.chatLang=new URLSearchParams(location.search).get('lang')||'en';
      const subscribe=f=>{window.addEventListener(AUTH_CHANGE_EVENT,f);return()=>window.removeEventListener(AUTH_CHANGE_EVENT,f)};
      window.chatAuth={login(id){const token='chat-'+id;setAccessToken(token);setStoredAuth({token,user:{id,role:'RegisteredUser'}})},logout:clearAuthSession};chatAuth.login('A');
      function Composer({conversationId,thread,ownerKey}){const draft=useAdminChat({conversations:[],selectedId:conversationId,inboxStatus:'empty',selectConversation:()=>{},sendMessage:text=>thread.send(text,ownerKey,ownerKey),sendAttachment:(file,text)=>thread.sendAttachment(file,text,ownerKey,ownerKey)});
        return <><input data-testid="draft-file" type="file" onChange={e=>e.target.files?.[0]&&draft.pickAttachment(e.target.files[0])}/>
          {draft.attachmentPreviewUrl&&<img data-testid="draft-preview" src={draft.attachmentPreviewUrl}/>}
          <button id="clear-draft" onClick={draft.clearAttachment}>Clear</button><button id="send-draft" onClick={()=>draft.sendWithAttachment('Draft caption')}>Send draft</button></>}
      function Probe({conversationId,ownerKey}){const thread=useConversationThread(conversationId,ownerKey);window.chat=thread;
        const[file,setFile]=useState(null),[caption,setCaption]=useState('');return <>
          {window.chatComposer&&<Composer conversationId={conversationId} thread={thread} ownerKey={ownerKey}/>}<input data-testid="attachment-file" type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/>
          <textarea data-testid="attachment-caption" value={caption} onChange={e=>setCaption(e.target.value)}/>
          <button id="send-file" onClick={()=>file&&thread.sendAttachment(file,caption,ownerKey,ownerKey)}>Send file</button>
          <button id="send-text" onClick={()=>thread.send(caption,ownerKey,ownerKey)}>Send text</button>
          <button id="refresh-thread" onClick={thread.retry}>Refresh thread</button>
          <output data-testid="thread-state">{JSON.stringify({ownerKey,conversationId,status:thread.status,error:thread.error,messages:thread.thread?.messages??[]})}</output>
          {(thread.thread?.messages??[]).map(message=><Item key={message.id} message={message} own={true} retrying={false}
            hallName="" conversationId={conversationId} onRetrySend={id=>thread.retrySend(id)}/>)}</>}
      function Root(){const[shown,setShown]=useState(true),[id,setId]=useState('thread-A');const auth=JSON.parse(useSyncExternalStore(subscribe,()=>JSON.stringify(getStoredAuth())));
        return <><button id="mount" onClick={()=>setShown(v=>!v)}>Mount</button><button id="thread-A" onClick={()=>setId('thread-A')}>A</button>
          <button id="thread-B" onClick={()=>setId('thread-B')}>B</button>{shown&&<Probe conversationId={id} ownerKey={auth?.user?.id||null}/>}</>}
      createRoot(document.getElementById('root')).render(window.chatStrict?<React.StrictMode><Root/></React.StrictMode>:<Root/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "chat-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = output.outputFiles[0].text;
});

export const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=", "base64");
type Call = { path: string; token: string; kind: "file" | "text"; caption: string; clientRequestId: string;
  name?: string; mime?: string; bytes?: string };
type Held = { call: Call; reply: (status?: number) => Promise<void> };
export async function mount(page: Page, options: { failures?: number; holdRetry?: boolean; holdDownload?: boolean; lang?: "ar" | "en"; trackUrls?: boolean; strict?: boolean; composer?: boolean } = {}) {
  const calls: Call[] = [], held: Held[] = [], errors: string[] = [];
  const downloads: Array<() => Promise<void>> = [];
  const history = new Map<string, Array<Record<string, unknown>>>();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === "/chat-retry-test") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    if (request.url() === "https://images.example/remote.png") return route.fulfill({ contentType: "image/png", body: image });
    if (!pathname.startsWith("/api/v1/")) throw new Error(`Unexpected network ${pathname}`);
    const requestPath = pathname.slice(7);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "GET") {
      if (requestPath.endsWith("/attachment")) {
        const reply = () => route.fulfill({ contentType: "image/png", body: image }).catch(() => undefined);
        if (options.holdDownload) { downloads.push(reply); return; }
        return reply();
      }
      const conversationId = requestPath.split("/")[2];
      return json({ conversationId, hallId: "", hallName: "", messages: history.get(`${request.headers().authorization}:${conversationId}`) ?? [] });
    }
    if (requestPath.endsWith("/read")) return json({});
    const kind = requestPath.endsWith("/attachment") ? "file" : "text";
    let caption: string, clientRequestId: string, name: string | undefined, mime: string | undefined, bytes: string | undefined;
    if (kind === "file") {
      const body = request.postDataBuffer()!.toString("latin1"), fileAt = body.indexOf('name="file"');
      const start = body.indexOf("\r\n\r\n", fileAt) + 4, end = body.indexOf("\r\n--", start);
      bytes = Buffer.from(body.slice(start, end), "latin1").toString("base64");
      name = /filename="([^"]+)"/.exec(body)?.[1]; mime = /Content-Type: ([^\r]+)/i.exec(body)?.[1];
      caption = Buffer.from(/name="content"\r\n\r\n([^]*?)\r\n--/.exec(body)?.[1] ?? "", "latin1").toString("utf8");
      clientRequestId = /name="clientRequestId"\r\n\r\n([^\r]+)/.exec(body)?.[1] ?? "";
    } else {
      const body = request.postDataJSON(); caption = body.content; clientRequestId = body.clientRequestId;
    }
    const call: Call = { path: requestPath, token: request.headers().authorization ?? "", kind, caption, clientRequestId, name, mime, bytes };
    calls.push(call);
    const saved = {
      messageId: "saved-" + clientRequestId, content: caption, senderUserId: call.token.replace("Bearer chat-", ""), senderName: "Sender", sentAt: "2030-01-01T10:00:00Z",
      hasAttachment: kind === "file", attachmentFileName: name, attachmentUrl: kind === "file" ? "/attachment.png" : null,
    };
    const reply = (status = 200) => {
      if (status < 400) {
        const key = `${call.token}:${requestPath.split("/")[2]}`, rows = history.get(key) ?? [];
        history.set(key, [...rows.filter((row) => row.messageId !== saved.messageId), { ...saved, id: saved.messageId }]);
      }
      return json(status >= 400 ? { title: "Upload failed" } : saved, status).catch(() => undefined);
    };
    if (calls.length <= (options.failures ?? 1)) return reply(500);
    if (options.holdRetry) { held.push({ call, reply }); return; }
    return reply();
  });
  await page.goto(`http://localhost:3000/chat-retry-test?lang=${options.lang ?? "en"}`);
  await page.evaluate(() => Object.assign(window, { process: { env: {} } }));
  if (options.trackUrls) await page.evaluate(() => {
    const created: string[] = [], revoked: string[] = [], premature: string[] = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); created.push(url); return url; };
    URL.revokeObjectURL = (url) => {
      if ([...document.querySelectorAll("img,a")].some(node => node.getAttribute("src") === url || node.getAttribute("href") === url)) premature.push(url);
      revoked.push(url); revoke(url);
    };
    Object.assign(window, { urlAudit: { created, revoked, premature } });
  });
  await page.evaluate(({ strict, composer }) => Object.assign(window, { chatStrict: strict, chatComposer: composer }), options);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId("thread-state")).toContainText('"status":"empty"');
  return { calls, held, downloads, errors, state: page.getByTestId("thread-state") };
}
export async function selectAndFail(page: Page, caption: string, file = { name: "photo.png", mimeType: "image/png", buffer: image }) {
  await page.getByTestId("attachment-file").setInputFiles(file);
  await page.getByTestId("attachment-caption").fill(caption);
  await page.locator("#send-file").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
}

