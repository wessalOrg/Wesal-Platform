import { build } from "esbuild";
import path from "node:path";
import en from "../../src/i18n/messages/en";

/** Production offer components and services, isolated from unrelated app-shell providers. */
export async function buildOfferLifecycleHarness() {
  const mocks: Record<string, string> = {
    "@/i18n": `const catalog=${JSON.stringify(en)};export const useT=()=> (key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),catalog[key]??key);`,
    "@/components/layout/LanguageProvider": `export const useUiLang=()=>"en";`,
    "@/components/auth/AuthProvider": `export const useAuth=()=>({session:{isAuthenticated:false}});`,
    "@/hooks/useAccountAccess": `export const useAccountAccess=()=>({ready:true,authenticated:false,userId:null,isAdmin:false});`,
    "@/hooks/useProfessionalAccountAccess": `export const useProfessionalAccountAccess=()=>({userId:'pro-a',canPublish:true,statusLoading:false});`,
    "@/hooks/useAccountPublishingLock": `export const useAccountPublishingLock=()=>({isLocked:false});`,
    "@/hooks/useFavoritePostIds": `const ids=new Set();export const useFavoritePostIds=()=>({ids,markSaved(){}});`,
    "@/hooks/useStartProfessionalConversation": `export const useStartProfessionalConversation=()=>({start:async()=>null,starting:false,error:null});`,
    "@/hooks/useHallOwnerHalls": `const halls=['hall-a','hall-b'].map(id=>({id,name:id,status:'Approved',paymentStatus:'Paid',adminLocked:false,systemLocked:false}));export const useHallOwnerHalls=()=>({halls,isLoading:false});`,
    "next/link": `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    "next/navigation": `const params=new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){}});export const useSearchParams=()=>params;export const usePathname=()=>'/';`,
    "@/components/posts/PostInquiryButton": `export default function PostInquiryButton(){return null}`,
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState} from 'react';import {createRoot} from 'react-dom/client';
      import Discover from './src/components/discover/DiscoverPageView';
      import Profile from './src/components/professionals/ProfessionalPublicProfileView';
      import Manager from './src/components/offers/ProfessionalOffersManagePage';
      import Halls from './src/components/offers/HallOwnerOffersPage';
      import HallSection from './src/components/owner-management/halls/HallOffersSection';
      import Banner from './src/components/offers/HallActiveOfferBanner';
      import DetailBanner from './src/components/halls/HallActiveOfferBanner';
      import ProfileSection from './src/components/offers/PublicProfileOffersSection';
      import {useOfferLifecycle} from './src/hooks/useOfferLifecycle';
      import {resolveOfferStatus} from './src/lib/offer-status';
      function Probe(){const offer={startsAt:'2030-01-01T00:00:10Z',endsAt:'2030-01-01T00:00:20Z'};
        const tick=useOfferLifecycle([offer],{discoverUnloaded:true,onRevalidate:async()=>{await fetch('/api/v1/probe')}});
        return <output id="probe">{resolveOfferStatus(offer.startsAt,offer.endsAt)}:{tick}</output>}
      function Harness(){const [id,setId]=useState('pro-a');const [shown,setShown]=useState(true);const mode=location.pathname.split('/').pop();
        return <><button id="switch" onClick={()=>setId(id==='pro-a'?'pro-b':'pro-a')}>Switch</button>
        <button id="unmount" onClick={()=>setShown(false)}>Unmount</button>{shown&&(
        mode==='discover'?<Discover/>:mode==='profile'?<Profile userId={id}/>:mode==='manager'?<Manager/>:
        mode==='halls'?<Halls/>:mode==='section'?<HallSection hallId="hall-a"/>:mode==='banner'?<Banner hallId="hall-a"/>:
        mode==='detail-banner'?<DetailBanner hallId="hall-a"/>:mode==='profile-section'?<ProfileSection userId={id}/>:<Probe/>)}</>}
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "app-shell-stubs", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  return result.outputFiles[0].text;
}
