function serviceStart(row){
  const hour=row.time_window==='morning'?8:row.time_window==='afternoon'?12:17;
  return new Date(`${row.requested_date}T${String(hour).padStart(2,'0')}:00:00-06:00`);
}

async function queueDueReminders(env){
  const now=new Date();
  const rows=await env.DB.prepare("SELECT id,requested_date,time_window,status FROM leads WHERE status IN ('assigned','confirmed') AND requested_date IS NOT NULL").all();
  let queued=0;
  for(const row of rows.results||[]){
    const start=serviceStart(row);
    const hours=(start.getTime()-now.getTime())/3600000;
    const type=hours>0&&hours<=3?'3h':hours>3&&hours<=48?'48h':'';
    if(!type) continue;
    const result=await env.DB.prepare("INSERT OR IGNORE INTO service_reminders(id,lead_id,reminder_type,due_at,status,channel,created_at) VALUES(?,?,?,?,'queued','pending',?)")
      .bind(crypto.randomUUID(),row.id,type,now.toISOString(),now.toISOString()).run();
    queued+=Number(result.meta?.changes||0);
  }
  return queued;
}

export default{
  async scheduled(event,env,ctx){ctx.waitUntil(queueDueReminders(env));},
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health')return Response.json({ok:true,service:'shinext-reminders'});
    return new Response('Not found',{status:404});
  }
};