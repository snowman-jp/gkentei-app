// Same-origin upload for unique completed-set events; Supabase RLS remains authoritative.
const SUPABASE=process.env.GKENTEI_STAGING_SUPABASE_URL;
const PUBLIC_KEY=process.env.GKENTEI_STAGING_PUBLISHABLE_KEY;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE||'')||!PUBLIC_KEY?.startsWith('sb_publishable_')||SUPABASE.includes('kuduxlkmuvongfdqyjoc'))return res.status(503).json({error:'Staging cloud sync not configured'});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const origin=req.headers.origin,host=req.headers.host;
 if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Cross-origin request rejected'});}catch{return res.status(403).json({error:'Invalid origin'});}}
 const auth=req.headers.authorization||'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return res.status(401).json({error:'Log in first'});
 try{
  const rows=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!Array.isArray(rows)||rows.length<1||rows.length>100)return res.status(400).json({error:'Invalid batch size'});
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!rows.every(r=>r&&uuid.test(r.event_id)&&uuid.test(r.user_id)
      &&typeof r.legacy_import==='boolean'
      &&(r.legacy_import?r.completed_at===null:(typeof r.completed_at==='string'&&Number.isFinite(Date.parse(r.completed_at))))))
    return res.status(400).json({error:'Invalid completion event'});
  const upstream=await fetch(SUPABASE+'/rest/v1/set_completion_events?on_conflict=event_id',{
   method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify(rows),signal:AbortSignal.timeout(12000)
  });
  if(!upstream.ok)return res.status(upstream.status===401||upstream.status===403?upstream.status:502).json({error:'Completion save rejected',status:upstream.status});
  return res.status(200).json({ok:true,batch:rows.length});
 }catch{return res.status(502).json({error:'Completion upload unavailable'});}
}