import test, { after } from "node:test";
import assert from "node:assert/strict";

import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

const projectId=process.env.GCLOUD_PROJECT||"shinext-local";
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||"127.0.0.1:9099";
const functionsHost=process.env.FUNCTIONS_EMULATOR_HOST||"127.0.0.1:5001";
const [functionsHostname,functionsPortText]=functionsHost.split(":");

const adminApp=initializeAdminApp({projectId},`e2e-admin-${Date.now()}`);
const adminAuth=getAdminAuth(adminApp);
const adminDb=getAdminFirestore(adminApp);
const clientApps=[];

async function makeClient(uid,email,password,role){
  try{await adminAuth.getUser(uid);}catch{await adminAuth.createUser({uid,email,password});}
  await adminAuth.setCustomUserClaims(uid,{role});
  const app=initializeApp({
    apiKey:"demo-key",
    authDomain:`${projectId}.firebaseapp.com`,
    projectId,
    appId:`1:123:web:${uid}`,
  },`e2e-${uid}-${Date.now()}`);
  clientApps.push(app);
  const auth=getAuth(app);
  connectAuthEmulator(auth,`http://${authHost}`,{disableWarnings:true});
  const functions=getFunctions(app,"us-central1");
  connectFunctionsEmulator(functions,functionsHostname,Number(functionsPortText||5001));
  await signInWithEmailAndPassword(auth,email,password);
  return {app,auth,functions};
}

after(async()=>{
  for(const app of clientApps){try{await deleteApp(app);}catch{}}
  try{await deleteAdminApp(adminApp);}catch{}
});

test("worker service lifecycle creates one assignment, notes, incident, earning and paid status",async()=>{
  const suffix=Date.now().toString(36);
  const worker1=`worker-e2e-a-${suffix}`;
  const worker2=`worker-e2e-b-${suffix}`;
  const operations=`ops-e2e-${suffix}`;
  const accounting=`accounting-e2e-${suffix}`;
  const requestId=`request-e2e-${suffix}`;
  const offer1=`${requestId}_${worker1}`;
  const offer2=`${requestId}_${worker2}`;
  const password="TestPassword123!";

  await Promise.all([
    adminDb.collection("workers").doc(worker1).set({active:true,fullName:"Trabajador Uno"}),
    adminDb.collection("workers").doc(worker2).set({active:true,fullName:"Trabajador Dos"}),
    adminDb.collection("collaborators").doc(operations).set({role:"operations",permissionGrants:[],permissionRevokes:[]}),
    adminDb.collection("collaborators").doc(accounting).set({role:"accounting",permissionGrants:[],permissionRevokes:[]}),
    adminDb.collection("serviceRequests").doc(requestId).set({
      status:"offered",
      serviceType:"Casa",
      zone:"Saltillo",
      scheduledAt:new Date(Date.now()+3600000),
      durationMinutes:180,
      materialsProvider:"Shinext",
      fullAddress:"Dirección de prueba",
      clientContactName:"Cliente Prueba",
      clientContactPhone:"8440000000",
      instructions:"Acceso por recepción",
    }),
    adminDb.collection("serviceOffers").doc(offer1).set({
      serviceRequestId:requestId,
      workerUid:worker1,
      status:"pending",
      workerView:{
        serviceType:"Casa",
        zone:"Saltillo",
        scheduledAt:new Date(Date.now()+3600000),
        durationMinutes:180,
        materialsProvider:"Shinext",
        workerEarning:500,
      }
    }),
    adminDb.collection("serviceOffers").doc(offer2).set({
      serviceRequestId:requestId,
      workerUid:worker2,
      status:"pending",
      workerView:{
        serviceType:"Casa",
        zone:"Saltillo",
        scheduledAt:new Date(Date.now()+3600000),
        durationMinutes:180,
        materialsProvider:"Shinext",
        workerEarning:500,
      }
    }),
  ]);

  const [c1,c2,ops,acct]=await Promise.all([
    makeClient(worker1,`${worker1}@example.com`,password,"worker"),
    makeClient(worker2,`${worker2}@example.com`,password,"worker"),
    makeClient(operations,`${operations}@example.com`,password,"operations"),
    makeClient(accounting,`${accounting}@example.com`,password,"accounting"),
  ]);

  const accept1=httpsCallable(c1.functions,"respondToOffer");
  const first=await accept1({offerId:offer1,decision:"accept"});
  assert.equal(first.data.accepted,true);

  const serviceAfterFirst=(await adminDb.collection("services").doc(requestId).get()).data();
  assert.equal(serviceAfterFirst?.assignedWorkerUid,worker1);

  const accept2=httpsCallable(c2.functions,"respondToOffer");
  await assert.rejects(
    ()=>accept2({offerId:offer2,decision:"accept"}),
  );

  const serviceAfterSecond=(await adminDb.collection("services").doc(requestId).get()).data();
  assert.equal(serviceAfterSecond?.assignedWorkerUid,worker1);

  const addNote=httpsCallable(c1.functions,"addServiceNote");
  const note=await addNote({serviceId:requestId,text:"Cliente pidió atención especial en cocina.",visibility:"worker"});
  assert.equal(note.data.ok,true);

  const incidentCall=httpsCallable(c1.functions,"reportIncident");
  const incident=await incidentCall({serviceId:requestId,description:"No hay acceso al área de lavado."});
  assert.equal(incident.data.ok,true);

  const progress=httpsCallable(c1.functions,"updateServiceStatus");
  assert.equal((await progress({serviceId:requestId,status:"en_route"})).data.status,"en_route");
  assert.equal((await progress({serviceId:requestId,status:"started"})).data.status,"started");
  assert.equal((await progress({serviceId:requestId,status:"completed"})).data.status,"completed");

  const close=httpsCallable(ops.functions,"closeService");
  const closed=await close({serviceId:requestId});
  assert.equal(closed.data.ok,true);
  assert.equal(closed.data.amount,500);

  const closedAgain=await close({serviceId:requestId});
  assert.equal(closedAgain.data.alreadyClosed,true);

  const earningSnap=await adminDb.collection("workerEarnings").doc(requestId).get();
  assert.equal(earningSnap.data()?.workerUid,worker1);
  assert.equal(earningSnap.data()?.paymentStatus,"pending");

  const markPaid=httpsCallable(acct.functions,"markWorkerPayment");
  const paid=await markPaid({serviceId:requestId,paymentStatus:"paid"});
  assert.equal(paid.data.paymentStatus,"paid");

  const finalEarning=(await adminDb.collection("workerEarnings").doc(requestId).get()).data();
  assert.equal(finalEarning?.paymentStatus,"paid");

  await Promise.all([signOut(c1.auth),signOut(c2.auth),signOut(ops.auth),signOut(acct.auth)]);
});
