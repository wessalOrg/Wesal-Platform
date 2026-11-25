import { expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

export async function buildPwaLifecycleHarness(withLanguage = false) {
  const mocks: Record<string, string> = withLanguage
    ? { "@/components/auth/AuthProvider": "export const useAuth=()=>({session:{isAuthenticated:false},status:'ready'});" }
    : { "@/components/layout/LanguageProvider": "export const useUiLang=()=>'ar';" };
  const output = await build({
    stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import PwaRegister from'./src/components/pwa/PwaRegister';
      ${withLanguage ? "import {LanguageProvider,useLanguage} from './src/components/layout/LanguageProvider';" : ''}
      class Target extends EventTarget{counts=new Map();addEventListener(type,fn,...args){const set=this.counts.get(type)||new Set();set.add(fn);this.counts.set(type,set);super.addEventListener(type,fn,...args)}
        removeEventListener(type,fn,...args){this.counts.get(type)?.delete(fn);super.removeEventListener(type,fn,...args)}count(type){return this.counts.get(type)?.size||0}}
      class Worker extends Target{constructor(state){super();this.state=state}postMessage(message){window.recordWorkerMessage?.(message)}transition(state){this.state=state;this.dispatchEvent(new Event('statechange'))}}
      const options=window.pwaOptions||{},first=new Worker('activated'),sw=new Target(),reg=new Target();
      sw.controller=options.controlled?first:null;reg.active=options.controlled?first:null;reg.installing=null;reg.waiting=options.waiting?new Worker('installed'):null;
      reg.updateCalls=0;reg.update=()=>{reg.updateCalls++;return options.failUpdate?Promise.reject(Error('offline')):Promise.resolve(reg)};
      let resolveRegistration;const registrationPromise=new Promise(resolve=>resolveRegistration=resolve);if(!options.deferRegister)resolveRegistration(reg);
      reg.registerCalls=0;sw.register=()=>{reg.registerCalls++;return registrationPromise};sw.getRegistration=()=>options.failGet?Promise.reject(Error('blocked')):Promise.resolve(reg);
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});
      const visibility=new Set(),add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
      document.addEventListener=(type,fn,...args)=>{if(type==='visibilitychange')visibility.add(fn);return add(type,fn,...args)};
      document.removeEventListener=(type,fn,...args)=>{if(type==='visibilitychange')visibility.delete(fn);return remove(type,fn,...args)};
      window.pwaTest={sw,reg,first,visibility,resolveRegistration(){resolveRegistration(reg)},
        initialClaim(){sw.controller=first;reg.active=first;sw.dispatchEvent(new Event('controllerchange'))},
        installing(){const worker=new Worker('installing');reg.installing=worker;reg.dispatchEvent(new Event('updatefound'));return worker},
        replace(worker){sw.controller=worker;reg.active=worker;reg.installing=null;sw.dispatchEvent(new Event('controllerchange'))}};
      ${withLanguage ? "function LanguageControls(){const language=useLanguage();window.pwaLanguage=language;return <><button id='language-ar' onClick={()=>language.setLanguage('ar')}>Arabic</button><button id='language-en' onClick={()=>language.setLanguage('en')}>English</button></>}" : ''}
      function Harness(){const[shown,setShown]=useState(true);return <><button id="unmount" onClick={()=>setShown(false)}>Unmount</button>{shown&&(${withLanguage ? '<LanguageProvider><LanguageControls/><PwaRegister/></LanguageProvider>' : '<PwaRegister/>'})}</>}
      createRoot(document.getElementById('root')).render(<Harness/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "pwa-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  return output.outputFiles[0].text;
}

export async function mountPwaLifecycle(page: Page, bundle: string, options: Record<string, boolean> = {}, lang: "ar" | "en" = "ar") {
  const errors: string[] = [], messages: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("recordWorkerMessage", (message: string) => messages.push(message));
  await page.route("**/pwa-lifecycle-test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost:3000/pwa-lifecycle-test");
  await page.evaluate((value) => Object.assign(window, { pwaOptions: value }), options);
  await page.evaluate(language => localStorage.setItem("wesal_ui_lang", language), lang);
  await page.addScriptTag({ content: bundle });
  await expect.poll(() => page.evaluate("pwaTest.sw.count('controllerchange')")).toBe(1);
  return { banner: page.getByTestId("pwa-update-banner"), errors, messages };
}

