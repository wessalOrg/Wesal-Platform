import { build } from "esbuild";
import path from "node:path";
import ar from "../../src/i18n/messages/ar";
import en from "../../src/i18n/messages/en";

/** Keep the real profile store, permission hooks, forms, services and HTTP requests. */
export async function buildPublishingLockHarness() {
  const mocks: Record<string, string> = {
    "@/i18n": `const catalogs=${JSON.stringify({ ar, en })};export const useT=()=> (key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),catalogs[document.documentElement.lang][key]??key);`,
    "@/components/layout/LanguageProvider": `export const useUiLang=()=>document.documentElement.lang;`,
    "@/components/auth/AuthProvider": `const role=new URLSearchParams(location.search).get('role');const value={session:{isAuthenticated:true,role,userName:'Lock Owner'},status:'ready',applyIdentity(){}};export const useAuth=()=>value;`,
    "@/hooks/useAccountAccess": `const account={ready:true,authenticated:true,canOpenRegularProfile:true,userId:'lock-owner',sessionKey:'professional-session',role:new URLSearchParams(location.search).get('role'),displayName:'Lock Owner',isProfessional:true,isAdmin:false};export const useAccountAccess=()=>account;`,
    "@/hooks/useStartProfessionalConversation": `export const useStartProfessionalConversation=()=>({start:async()=>null,starting:false,error:null});`,
    "next/link": `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    "next/navigation": `export const useRouter=()=>({push(){},replace(){}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/';`,
    "@/components/posts/PostInquiryButton": `export default function PostInquiryButton(){return null}`,
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState} from 'react';import {createRoot} from 'react-dom/client';
      import {UserProfileProvider,useUserProfileStore} from './src/components/profile/UserProfileProvider';
      import {setAccessToken} from './src/lib/auth-token';
      import {setStoredAuth} from './src/lib/auth-storage';
      import {useAccountPublishingLock} from './src/hooks/useAccountPublishingLock';
      import {useProfessionalAccountAccess} from './src/hooks/useProfessionalAccountAccess';
      import Posts from './src/components/professionals/ProfessionalPostsManagePage';
      import Offers from './src/components/offers/ProfessionalOffersManagePage';
      import Profile from './src/components/professionals/ProfessionalPublicProfileView';
      function Probe(){const store=useUserProfileStore();const lock=useAccountPublishingLock();const access=useProfessionalAccountAccess();
        return <><output data-testid="snapshot">{JSON.stringify({rawLocked:store.profile?.isLocked,locked:lock.isLocked,ready:lock.ready,
          approval:access.phase,allowed:lock.ready&&!lock.isLocked&&access.canPublish})}</output>
          <button data-testid="refresh-profile" onClick={()=>void store.refetch()}>Refresh profile</button></>}
      function Workspace(){const mode=location.pathname.split('/').pop();return <><Probe/><Probe/>
        {mode==='posts'?<Posts/>:mode==='offers'?<Offers/>:mode==='public'?<Profile userId="lock-owner"/>:null}</>}
      function Harness(){const [shown,setShown]=useState(true);return <><button id="unmount" onClick={()=>setShown(false)}>Unmount</button>
        {shown&&<UserProfileProvider><Workspace/></UserProfileProvider>}</>}
      const token='test.'+btoa(JSON.stringify({sub:'lock-owner',exp:Date.now()/1000+3600}))+'.test';
      setAccessToken(token);setStoredAuth({token,user:{id:'lock-owner',name:'Lock Owner'}});
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "app-shell-stubs", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  return result.outputFiles[0].text;
}
