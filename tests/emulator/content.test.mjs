import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

const projectId=process.env.GCLOUD_PROJECT||"shinext-local";
const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST||"127.0.0.1:8080";
const [host,portText]=emulatorHost.split(":");
let env;

before(async()=>{
  env=await initializeTestEnvironment({
    projectId,
    firestore:{host,port:Number(portText||8080),rules:readFileSync("firestore.rules","utf8")}
  });
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await setDoc(doc(db,"blogPosts","public-post"),{public:true,status:"published",title:"Publicado"});
    await setDoc(doc(db,"blogPosts","draft-post"),{public:true,status:"draft",title:"Borrador"});
    await setDoc(doc(db,"mediaEmbeds","media-public"),{public:true,active:true,provider:"youtube"});
    await setDoc(doc(db,"mediaEmbeds","media-private"),{public:false,active:true,provider:"youtube"});
    await setDoc(doc(db,"bannerCampaigns","banner-public"),{public:true,active:true,title:"Promo"});
    await setDoc(doc(db,"bannerCampaigns","banner-off"),{public:true,active:false,title:"Off"});
  });
});

after(async()=>{await env?.cleanup();});

test("public may read only published blog content",async()=>{
  const db=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db,"blogPosts","public-post")));
  await assertFails(getDoc(doc(db,"blogPosts","draft-post")));
});

test("public may read only active public media and banners",async()=>{
  const db=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db,"mediaEmbeds","media-public")));
  await assertFails(getDoc(doc(db,"mediaEmbeds","media-private")));
  await assertSucceeds(getDoc(doc(db,"bannerCampaigns","banner-public")));
  await assertFails(getDoc(doc(db,"bannerCampaigns","banner-off")));
});

test("director may create managed content",async()=>{
  const db=env.authenticatedContext("director-1",{role:"director"}).firestore();
  await assertSucceeds(setDoc(doc(db,"bannerCampaigns","director-banner"),{
    public:true,active:true,title:"Nueva campaña"
  }));
});
