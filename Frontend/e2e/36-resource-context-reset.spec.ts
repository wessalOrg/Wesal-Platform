import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": "export const t=key=>key;export const useT=()=>t;",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>'en';",
    "next/link": "export default function Link({href,children,...rest}){return <a href={href} {...rest}>{children}</a>}",
    "next/image": "export default function Image({src,alt,className}){return <img src={src} alt={alt} className={className}/>}",
    "@/services/admin-moderation": "export const fetchAdminModerationImageBlob=id=>window.resourceRequest('image',id);",
    "@/services/posts": "export const fetchPost=id=>window.resourceRequest('post',id);",
    "@/services/public-profile": "export const fetchPublicProfessionalProfile=id=>window.resourceRequest('profile',id);",
    "@/components/posts/ContentImageGallery": "export default function Gallery({children}){return <div>{children}</div>}",
    "@/components/offers/PublicProfileOffersSection": "export default function Offers({userId}){return <div data-testid='offers-owner'>{userId}</div>}",
  };
  for (const name of ["PostActionsMenu", "PostCommentSection", "PostFavoriteButton", "PostInquiryButton", "PostShareButton"])
    mocks[`@/components/posts/${name}`] = "export default function Child(){return null}";
  mocks["@/components/ui/SuccessToast"] = "export default function Toast(){return null}";
  const result = await build({
    stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import AdminModerationThumb from'./src/components/admin/moderation/AdminModerationThumb';
      import PostDetailsView from'./src/components/posts/PostDetailsView';
      import PublicProfessionalProfileView from'./src/components/posts/PublicProfessionalProfileView';
      const requests=[];window.resources=requests;window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revoked.push(url);revoke(url)};
      window.resourceRequest=(kind,id)=>new Promise((resolve,reject)=>requests.push({kind,id,resolve,reject}));
      window.completeResource=(index,fail=false)=>{const request=requests[index];if(fail){request.reject(Error('Request failed'));return}
        if(request.kind==='image'){request.url=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="pink"/></svg>'],{type:'image/svg+xml'}));request.resolve(request.url)}
        else if(request.kind==='post')request.resolve({id:request.id,ownerUserId:'owner-'+request.id,ownerName:'Author '+request.id,ownerAvatarUrl:'https://example.test/avatar.png',ownerRole:'Photographer',content:'Content '+request.id,createdAt:'2026-01-01T00:00:00Z',images:[],price:null,commentCount:0,saveCount:0});
        else request.resolve({userId:request.id,displayName:'Profile '+request.id,posts:[],offers:[]});};
      function Harness(){const[id,setId]=useState('A'),[shown,setShown]=useState(true);return <><button id='A' onClick={()=>setId('A')}>A</button><button id='B' onClick={()=>setId('B')}>B</button><button id='unmount' onClick={()=>setShown(false)}>Unmount</button><section id='resource'>{shown&&(window.resourceMode==='image'?<AdminModerationThumb imagePath={id} alt={id}/>:window.resourceMode==='post'?<PostDetailsView postId={id}/>:<PublicProfessionalProfileView userId={id}/>)}</section></>}
      createRoot(document.getElementById('root')).render(<Harness/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "resource-context-mocks", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

async function mount(page: Page, mode: string) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/resource-context", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.route("https://example.test/**", route => route.abort());
  await page.goto("http://localhost:3000/resource-context");
  await page.evaluate(value => Object.assign(window, { resourceMode: value }), mode);
  await page.addScriptTag({ content: bundle });
  await expect.poll(() => page.evaluate("window.resources?.length ?? 0"), errors.join("\n")).toBe(1);
  return errors;
}

test("moderation images never redisplay a revoked URL when returning to an earlier path", async ({ page }) => {
  const errors = await mount(page, "image");
  const image = page.locator("#resource img");
  await page.evaluate("completeResource(0)"); await expect(image).toHaveAttribute("alt", "A");
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(8);
  const original = await image.getAttribute("src");
  await page.locator("#B").click(); await expect(image).toHaveCount(0);
  await page.evaluate("completeResource(1)"); await expect(image).toHaveAttribute("alt", "B");
  await page.locator("#A").click(); await expect(image).toHaveCount(0);
  await page.evaluate("completeResource(2)"); await expect(image).toHaveAttribute("alt", "A");
  expect(await image.getAttribute("src")).not.toBe(original);
  await page.locator("#unmount").click();
  expect(await page.evaluate("revoked.length")).toBe(3);
  expect(errors).toEqual([]);
});

test("late moderation image responses are released without replacing the current preview", async ({ page }) => {
  const errors = await mount(page, "image");
  await page.locator("#B").click(); await page.evaluate("completeResource(1)");
  await expect(page.locator("#resource img")).toHaveAttribute("alt", "B");
  const current = await page.locator("#resource img").getAttribute("src");
  await page.evaluate("completeResource(0)");
  await expect.poll(() => page.evaluate("revoked.length")).toBe(1);
  await expect(page.locator("#resource img")).toHaveAttribute("src", current!);
  await page.locator("#unmount").click();
  expect(await page.evaluate("revoked.length")).toBe(2);
  expect(errors).toEqual([]);
});

for (const mode of ["post", "profile"]) for (const fail of [false, true])
  test(`${mode}: late ${fail ? "errors" : "results"} cannot replace a newly selected resource`, async ({ page }) => {
    const errors = await mount(page, mode);
    await page.locator("#B").click();
    await expect.poll(() => page.evaluate("resources.length")).toBe(2);
    await page.evaluate("completeResource(1)");
    await expect(page.locator("#resource")).toContainText(mode === "post" ? "Content B" : "Profile B");
    await page.evaluate(value => (window as unknown as { completeResource: (index: number, fail: boolean) => void }).completeResource(0, value), fail);
    await expect(page.locator("#resource")).not.toContainText(mode === "post" ? "Content A" : "Profile A");
    await expect(page.locator("#resource")).toContainText(mode === "post" ? "Content B" : "Profile B");
    await page.locator("#A").click();
    await expect(page.locator("#resource")).not.toContainText(mode === "post" ? "Content B" : "Profile B");
    await page.evaluate("completeResource(2)");
    await expect(page.locator("#resource")).toContainText(mode === "post" ? "Content A" : "Profile A");
    expect(errors).toEqual([]);
  });
