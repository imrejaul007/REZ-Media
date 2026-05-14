"use strict";(()=>{var e={};e.id=495,e.ids=[495],e.modules={517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},618:(e,r,s)=>{s.r(r),s.d(r,{headerHooks:()=>_,originalPathname:()=>g,patchFetch:()=>I,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>u,staticGenerationAsyncStorage:()=>c,staticGenerationBailout:()=>f});var t={};s.r(t),s.d(t,{GET:()=>p});var a=s(5419),i=s(9108),n=s(9678),o=s(8070),d=s(6517);async function p(e,{params:r}){try{let{code:e}=await r;if(!e)return o.Z.json({error:"redemption code is required"},{status:400});let s=(0,d.e)(),{data:t,error:a}=await s.from("sample_requests").select(`
        *,
        free_samples (
          id,
          name,
          description,
          image_url,
          terms,
          expiry_date
        ),
        campaigns (
          id,
          name,
          brand_id
        ),
        stores (
          id,
          name,
          address,
          location_lat,
          location_lng
        )
      `).eq("redemption_code",e).single();if(a||!t)return o.Z.json({error:"Redemption code not found"},{status:404});let i=!!t.free_samples?.expiry_date&&new Date(t.free_samples.expiry_date)<new Date;return o.Z.json({success:!0,redemption:{id:t.id,code:t.redemption_code,status:t.status,isExpired:i,sample:t.free_samples?{id:t.free_samples.id,name:t.free_samples.name,description:t.free_samples.description,imageUrl:t.free_samples.image_url,terms:t.free_samples.terms,expiryDate:t.free_samples.expiry_date}:null,campaign:t.campaigns?{id:t.campaigns.id,name:t.campaigns.name}:null,store:t.stores?{id:t.stores.id,name:t.stores.name,address:t.stores.address,location:t.stores.location_lat&&t.stores.location_lng?{lat:t.stores.location_lat,lng:t.stores.location_lng}:null}:null,preferredDate:t.preferred_date,createdAt:t.created_at}})}catch(e){return console.error("[samples/redemption] error:",e),o.Z.json({error:"Internal server error"},{status:500})}}let l=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/v1/samples/redemption/[code]/route",pathname:"/api/v1/samples/redemption/[code]",filename:"route",bundlePath:"app/api/v1/samples/redemption/[code]/route"},resolvedPagePath:"/Users/rejaulkarim/Documents/ReZ Full App/adsqr/rez-sampling/src/app/api/v1/samples/redemption/[code]/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:m,staticGenerationAsyncStorage:c,serverHooks:u,headerHooks:_,staticGenerationBailout:f}=l,g="/api/v1/samples/redemption/[code]/route";function I(){return(0,n.patchFetch)({serverHooks:u,staticGenerationAsyncStorage:c})}},6517:(e,r,s)=>{s.d(r,{e:()=>o});var t=s(9093);let a="https://ukdhstoqhcplbvqikhro.supabase.co",i="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZGhzdG9xaGNwbGJ2cWlraHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Mzk0MjAsImV4cCI6MjA5MzMxNTQyMH0.fkQeAdnfaroZnWNk6-NNhWBrF6Q9pjnnnZKOeIbMsIc";if(!a||!i)throw Error("Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");let n=(0,t.eI)(a,i);function o(){return n}}};var r=require("../../../../../../webpack-runtime.js");r.C(e);var s=e=>r(r.s=e),t=r.X(0,[1638,9093,6206],()=>s(618));module.exports=t})();