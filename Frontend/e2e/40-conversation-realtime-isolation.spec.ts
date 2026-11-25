import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/lib/api": "export const apiOrigin=()=>location.origin;",
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/lib/conversation-mapper": "export const mapRealtimeMessageDto=x=>x;",
    "@/services/conversations-mock": "export const subscribeMockMessages=()=>()=>{};",
    "@/lib/realtime-logger": "export const realtimeLogger={log(){}};",
    "@microsoft/signalr": `
      export const HubConnectionState={Connected:'Connected',Disconnected:'Disconnected',Connecting:'Connecting',Reconnecting:'Reconnecting'};
      export class HubConnectionBuilder {
        withUrl(url,options){this.options=options;return this}
        withAutomaticReconnect(){return this} configureLogging(){return this}
        build(){const handlers=new Map(),retired=new Map();const hub={state:'Disconnected',stopCalls:0,calls:[],options:this.options,
          on(name,callback){handlers.set(name,callback);retired.set(name,callback)},off(name){handlers.delete(name)},
          onreconnected(callback){this.reconnected=callback},onclose(callback){this.closed=callback},
          start(){this.state='Connecting';return new Promise((resolve,reject)=>{this.finishStart=()=>{this.state='Connected';resolve()};this.failStart=()=>{this.state='Disconnected';reject(new Error('start failed'))}})},
          stop(){this.stopCalls++;this.state='Disconnected';return Promise.resolve()},
          invoke(method,...args){this.calls.push([method,...args]);return Promise.resolve()},
          emit(name,value){handlers.get(name)?.(value)},emitQueued(name,value){retired.get(name)?.(value)},
          reconnect(){this.state='Connected';this.reconnected?.()},close(){this.state='Disconnected';this.closed?.()}
        };window.hubs.push(hub);return hub}
      }`,
  };
  const output = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import * as realtime from './src/services/conversation-realtime';
      import React from 'react';import{createRoot}from'react-dom/client';
      import{useConversationRealtime}from'./src/hooks/useConversationRealtime';
      import {setAccessToken} from './src/lib/auth-token';
      import {setStoredAuth,clearAuthSession} from './src/lib/auth-storage';
      window.hubs=[];window.received=[];window.disposers={};
      let root;function Probe(){useConversationRealtime('thread','A',value=>window.received.push({label:'hook',value}));return null}
      window.actions={
        mountHook(){root=createRoot(document.getElementById('root'));root.render(React.createElement(Probe))},
        unmountHook(){root.unmount()},
        login(id,token=id+'-token'){setAccessToken(token);setStoredAuth({token,user:{id,role:'Photographer'}})},
        logout:clearAuthSession,
        setToken:setAccessToken,
        subscribe(label,kind='inbox',id='thread'){
          const callback=value=>window.received.push({label,value});
          window.disposers[label]=kind==='thread'?realtime.subscribeConversationMessages(id,callback):
            kind==='unread'?realtime.subscribeUnreadCounts(callback):realtime.subscribeIncomingMessages(callback);
        },
        unsubscribe(label){window.disposers[label]?.();delete window.disposers[label]},
        open:realtime.setConversationOpen,read:realtime.markConversationReadOnHub
      };` },
    bundle: true, write: false, platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "signalr-double", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd() }));
    } }],
  });
  bundle = output.outputFiles[0].text;
});

async function mount(page: Page) {
  await page.route("**/*", route => {
    if (new URL(route.request().url()).pathname !== "/realtime-isolation") throw new Error("Unexpected network request");
    return route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' });
  });
  await page.goto("http://localhost:3000/realtime-isolation");
  await page.addScriptTag({ content: bundle });
  await page.evaluate("actions.login('A');actions.subscribe('A')");
}
async function flush(page: Page, source: string) {
  await page.evaluate(`(async()=>{${source};await new Promise(resolve=>setTimeout(resolve,0))})()`);
}

test("delayed events from A never reach B, even while the old consumer is mounted", async ({ page }) => {
  await mount(page);
  await flush(page, "hubs[0].finishStart()");
  await flush(page, "hubs[0].emit('MessageReceived',{conversationId:'own-A'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["A"]);
  await flush(page, "actions.login('B');actions.subscribe('B');hubs[0].emitQueued('MessageReceived',{conversationId:'private-A'})");
  expect(await page.evaluate("received.map(x=>x.value.conversationId)")).toEqual(["own-A"]);
  await flush(page, "hubs[1].finishStart();hubs[1].emit('MessageReceived',{conversationId:'own-B'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["A", "B"]);
});

test("late A startup cannot restore an obsolete connection or block B startup", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.login('B');actions.subscribe('B')");
  expect(await page.evaluate("hubs.length")).toBe(2);
  await flush(page, "hubs[1].finishStart();hubs[0].finishStart();hubs[0].emitQueued('MessageReceived',{conversationId:'private-A'})");
  expect(await page.evaluate("received")).toEqual([]);
  expect(await page.evaluate("hubs[0].state")).toBe("Disconnected");
  expect(await page.evaluate("hubs[1].state")).toBe("Connected");
});

test("logout stops transport, rejects queued unread events and removes its token", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.subscribe('count','unread');hubs[0].finishStart();actions.logout();hubs[0].emitQueued('UnreadCountsUpdated',{totalUnreadCount:9})");
  expect(await page.evaluate("received")).toEqual([]);
  expect(await page.evaluate("hubs[0].stopCalls")).toBeGreaterThan(0);
  expect(await page.evaluate("hubs[0].options.accessTokenFactory()")).toBe("");
});

test("rapid A to B to A uses separate login generations even with the same token", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.login('B');actions.subscribe('B');actions.login('A');actions.subscribe('A-new')");
  expect(await page.evaluate("hubs.length")).toBe(3);
  await flush(page, "hubs[2].finishStart();hubs[1].finishStart();hubs[0].finishStart();hubs[0].emitQueued('MessageReceived',{conversationId:'old'});hubs[2].emit('MessageReceived',{conversationId:'new'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["A-new"]);
  expect(await page.evaluate("hubs.map(x=>x.options.accessTokenFactory())")).toEqual(["", "", "A-token"]);
});

test("subscribers share one connection and thread group; reconnect restores current groups and presence", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.subscribe('thread-1','thread');actions.subscribe('thread-2','thread');actions.subscribe('count','unread');actions.open('thread');hubs[0].finishStart()");
  expect(await page.evaluate("hubs.length")).toBe(1);
  expect(await page.evaluate("hubs[0].calls.filter(x=>x[0]==='JoinConversation').length")).toBe(1);
  await flush(page, "hubs[0].calls=[];hubs[0].reconnect()");
  expect(await page.evaluate("hubs[0].calls")).toEqual([["JoinConversation", "thread"], ["SetConversationOpen", "thread", true]]);
  await flush(page, "hubs[0].emit('MessageReceived',{conversationId:'thread'});hubs[0].emit('UnreadCountsUpdated',{totalUnreadCount:3})");
  expect(await page.evaluate("received.map(x=>x.label).sort()")).toEqual(["A", "count", "thread-1", "thread-2"]);
});

test("unmounting the last subscriber stops the hub and stale cleanup cannot affect a new login", async ({ page }) => {
  await mount(page);
  await flush(page, "hubs[0].finishStart();actions.unsubscribe('A')");
  expect(await page.evaluate("hubs[0].stopCalls")).toBeGreaterThan(0);
  await flush(page, "actions.subscribe('again');hubs[1].finishStart();actions.login('B');actions.subscribe('B');actions.unsubscribe('again');hubs[2].finishStart();hubs[2].emit('MessageReceived',{conversationId:'B'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["B"]);
  expect(await page.evaluate("hubs[2].state")).toBe("Connected");
});

test("failed startup can retry without duplicating handlers; closed reconnect can restart", async ({ page }) => {
  await mount(page);
  await flush(page, "hubs[0].failStart()");
  await flush(page, "actions.subscribe('second')");
  expect(await page.evaluate("hubs.length")).toBe(1);
  await flush(page, "hubs[0].finishStart();hubs[0].emit('MessageReceived',{conversationId:'first'});hubs[0].close();actions.read('thread')");
  await flush(page, "hubs[0].finishStart();hubs[0].emit('MessageReceived',{conversationId:'second'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["A", "second", "A", "second"]);
});

test("obsolete queued join and presence actions cannot invoke a new account's connection", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.subscribe('thread-A','thread','private-A');actions.open('private-A');actions.read('private-A');actions.login('B');actions.subscribe('B');hubs[1].finishStart();hubs[0].finishStart()");
  expect(await page.evaluate("hubs[1].calls")).toEqual([]);
  expect(await page.evaluate("hubs[0].calls")).toEqual([]);
});

test("mounted thread resubscribes when the same user's login generation changes", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.mountHook();hubs[0].finishStart()");
  await flush(page, "actions.login('A','A-new-token')");
  await expect.poll(() => page.evaluate("hubs.length")).toBe(2);
  await flush(page, "hubs[1].finishStart();hubs[0].emitQueued('MessageReceived',{conversationId:'thread'});hubs[1].emit('MessageReceived',{conversationId:'thread'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["hook"]);
  await flush(page, "actions.unmountHook()");
  expect(await page.evaluate("hubs[1].state")).toBe("Disconnected");
});

test("logout during startup stops a transport even if start resolves after shutdown", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.logout();hubs[0].finishStart();hubs[0].emitQueued('MessageReceived',{conversationId:'private-A'})");
  expect(await page.evaluate("hubs[0].state")).toBe("Disconnected");
  expect(await page.evaluate("received")).toEqual([]);
});

test("missing or partially updated identity cannot create an authenticated connection", async ({ page }) => {
  await mount(page);
  await flush(page, "actions.logout();actions.subscribe('guest');actions.setToken('B-token');actions.subscribe('partial')");
  expect(await page.evaluate("hubs.length")).toBe(1);
  await flush(page, "actions.login('B');actions.subscribe('B');hubs[1].finishStart();hubs[1].emit('MessageReceived',{conversationId:'B'})");
  expect(await page.evaluate("received.map(x=>x.label)")).toEqual(["B"]);
});
