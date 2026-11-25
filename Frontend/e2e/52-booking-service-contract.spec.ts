import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

const hallId = "11111111-1111-4111-8111-111111111111";
let bundle: string;

test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/lib/api": `export default {
      get:async(path,options)=>{window.calls.push({method:'GET',path,options});
        if(path.endsWith('hourly-catalog'))return{data:{date:window.date,dayOpen:true,slots:[{startTime:'10:00:00',endTime:'11:00:00',isSelectable:true},{startTime:'11:00:00',endTime:'12:00:00',isSelectable:true}]}};
        if(path.endsWith('availability-calendar'))return{data:{fromDate:window.date,toDate:window.date,days:[{date:window.date,isOpen:true}]}};
        return{data:[{bookingId:'history-1',hallId:window.hallId,date:window.date,slotStarts:['10:00:00'],status:'Pending'}]};},
      post:async(path,body,options)=>{window.calls.push({method:'POST',path,body,options});
        if(window.defer)await new Promise(resolve=>window.release=resolve);
        if(window.failure){const{ApiError}=await import('./src/lib/api-error');throw new ApiError('Rejected',window.failure,{},window.failure===422?{code:'PENDING_LIMIT_REACHED'}:{});}
        return{data:{bookingId:'created-1',hallId:window.hallId,date:window.date,status:'Pending'}};}
    };`,
    "@/hooks/useUserIdentity": "export const useUserIdentity=()=>({displayName:'Customer',phoneNumber:'0599123456'});",
    "@/i18n": "export const t=key=>key;export const useT=()=>t;",
  };
  const result = await build({
    stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';
      import * as bookings from'./src/services/bookings';
      import{submitHourlyBooking}from'./src/services/hourly-bookings';
      import{useHourlyBooking}from'./src/hooks/useHourlyBooking';
      import{setStoredAuth}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
      window.calls=[];window.date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const token='test.'+btoa(JSON.stringify({sub:'seeker-A',role:'RegularUser',exp:Date.now()/1000+3600}))+'.test';
      setAccessToken(token);setStoredAuth({token,user:{id:'seeker-A',name:'Customer',role:'RegularUser'}});
      window.hasObsolete='submitBookingRequest'in bookings;window.loadHistory=bookings.fetchMyBookings;
      window.cancel=()=>bookings.cancelBookingRequest(window.hallId,'created-1');
      window.send=async(extra={})=>{try{return{result:await submitHourlyBooking({hallId:window.hallId,date:window.date,slotTime:'10:00',slotTimes:['10:00','11:00'],customerName:' Customer ',requesterName:' Requester ',...extra})}}catch(e){return{error:e.message,status:e.status}}};
      function Harness(){const value=useHourlyBooking({hallId:window.hallId,locale:'en',canSubmit:true});window.booking=value;
        return <><output id='state'>{JSON.stringify({loading:value.loading,slotsLoading:value.slotsLoading,selected:value.selectedRangeLabel,submitting:value.submitting,error:value.errorKey})}</output>
          <button id='date' onClick={()=>value.selectDate(window.date)}>Date</button>
          <button id='range' onClick={()=>{value.setRangeFrom('10:00');value.setRangeTo('12:00')}}>Range</button>
          <button id='confirm' onClick={()=>{value.setEventType('wedding');value.confirmRange()}}>Confirm</button>
          <button id='save' disabled={value.submitting} onClick={()=>void value.submit()}>Save</button></>}
      createRoot(document.getElementById('root')).render(<Harness/>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env": "{}" },
    plugins: [{ name: "booking-contract-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

type ContractWindow = Window & {
  hallId: string;
  hasObsolete: boolean;
  calls: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
  failure?: number;
  defer?: boolean;
  release: () => void;
  send: (extra?: Record<string, unknown>) => Promise<{ result?: { bookingId: string }; error?: string; status?: number }>;
  loadHistory: () => Promise<Array<{ bookingId: string }>>;
  cancel: () => Promise<{ bookingId: string }>;
};

async function mount(page: Page) {
  await page.route("**/*", route => route.request().url().endsWith("/booking-contract")
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/booking-contract");
  await page.evaluate(id => { (window as ContractWindow).hallId = id; }, hallId);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("#state")).toContainText('"loading":false');
}

test("booking service no longer exports the obsolete submission contract", async ({ page }) => {
  await mount(page);
  expect(await page.evaluate(() => (window as ContractWindow).hasObsolete)).toBe(false);
});

test("active hourly service retains the multi-slot request and result contract", async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(() => (window as ContractWindow).send());
  expect(result.result?.bookingId).toBe("created-1");
  const posts = await page.evaluate(() => (window as ContractWindow).calls.filter(call => call.method === "POST"));
  expect(posts).toHaveLength(1);
  expect(posts[0].path).toBe(`/halls/${hallId}/hourly-bookings`);
  expect(posts[0].body).toMatchObject({ hallId, slotStarts: ["10:00:00", "11:00:00"], nameOnBooking: "Customer", requesterName: "Requester" });
  expect(posts[0].body).not.toHaveProperty("periods");
});

for (const [status, key] of [[401, "errors.booking.unauthorized"], [403, "errors.booking.forbidden"], [409, "errors.hourly.slotBooked"], [422, "errors.booking.pendingLimit"], [500, "errors.hourly.generic"]] as const) {
  test(`hourly booking error feedback remains intact for HTTP ${status}`, async ({ page }) => {
    await mount(page);
    await page.evaluate(status => { (window as ContractWindow).failure = status; }, status);
    const result = await page.evaluate(() => (window as ContractWindow).send());
    expect(result.error).toBe(key);
    expect(result.status).toBe(status);
  });
}

test("GET booking history and the supported cancellation endpoint remain available", async ({ page }) => {
  await mount(page);
  expect(await page.evaluate(() => (window as ContractWindow).loadHistory())).toMatchObject([{ bookingId: "history-1" }]);
  expect(await page.evaluate(() => (window as ContractWindow).cancel())).toMatchObject({ bookingId: "created-1" });
  const calls = await page.evaluate(() => (window as ContractWindow).calls);
  expect(calls).toContainEqual(expect.objectContaining({ method: "GET", path: "/bookings" }));
  expect(calls).toContainEqual(expect.objectContaining({ method: "POST", path: `/halls/${hallId}/bookings/created-1/cancel` }));
  expect(calls.filter(call => call.method === "POST" && call.path === "/bookings")).toEqual([]);
});

test("existing hourly form prevents repeat submissions while the request is pending", async ({ page }) => {
  await mount(page);
  await page.locator("#date").click();
  await expect(page.locator("#state")).toContainText('"slotsLoading":false');
  await page.locator("#range").click();
  await page.locator("#confirm").click();
  await page.evaluate(() => { (window as ContractWindow).defer = true; });
  await page.locator("#save").click();
  await expect(page.locator("#save")).toBeDisabled();
  await page.locator("#save").dispatchEvent("click");
  expect(await page.evaluate(() => (window as ContractWindow).calls.filter(call => call.method === "POST").length)).toBe(1);
  await page.evaluate(() => { const w = window as ContractWindow; w.defer = false; w.release(); });
  await expect(page.locator("#save")).toBeEnabled();
  await expect(page.locator("#state")).toContainText('"error":null');
});
