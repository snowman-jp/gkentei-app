const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../coach.js');
const bank=Array.from({length:100},(_,i)=>({id:i+1}));const ids=bank.map(q=>q.id);
const now=Date.parse('2026-11-07T12:00:00+09:00');
const load=value=>C.normalize(value,ids).data;
const event=(id,ok,at)=>at===undefined?{id,ok}:{id,ok,at};
const ago=d=>{const x=new Date(now);x.setDate(x.getDate()-d);return x.toISOString()};
const recommend=(history=[],wrong=[])=>C.recommend(bank,load({history,wrong,sets:0}),now);
test('empty / all unseen: five unique IDs, no invented stats or dates',()=>{
 const r=recommend();assert.equal(r.items.length,5);assert.equal(new Set(r.items.map(x=>x.id)).size,5);assert.equal(r.reviewCount,0);
 for(const s of Object.values(r.stats)){assert.equal(s.totalAttempts,0);assert.equal(s.lastCorrect,null);assert.equal(s.lastAnsweredAt,null);assert.equal(s.nextReviewAt,null)}
 assert.ok(r.items.every(x=>x.unseen&&x.reason.includes('解答記録がない')));
});
test('same local day and unchanged history produce identical choices, even across due time',()=>{
 const d=load({history:[event(1,true,ago(3))],wrong:[],sets:0});const day=new Date(now);day.setHours(0,1,0,0);const early=C.recommend(bank,d,day.getTime());day.setHours(23,59,0,0);const late=C.recommend(bank,d,day.getTime());assert.deepEqual(early.items,late.items);
});
test('day change rotates deterministic tie order; ties fall back to question ID',()=>{
 const d=load({});const a=C.recommend(bank,d,now),b=C.recommend(bank,d,now+86400000);assert.notDeepEqual(a.items.map(x=>x.id),b.items.map(x=>x.id));assert.deepEqual(a,C.recommend(bank,d,now));
 const many=C.recommend([...bank].reverse(),d,now);assert.deepEqual(a.items,many.items);
});
test('last incorrect and repeated mistakes outrank unseen; reasons use actual counts',()=>{
 const history=[event(1,false,ago(5)),event(1,false,ago(4)),event(1,true,ago(0)),event(2,false,ago(0))];const r=recommend(history);assert.deepEqual(new Set(r.items.slice(0,2).map(x=>x.id)),new Set([1,2]));assert.equal(r.items.find(x=>x.id===2).reason,'前回不正解だったため');assert.equal(r.items.find(x=>x.id===1).reason,'直近3回のうち2回不正解のため');assert.equal(r.stats[1].wrongCount,2);assert.equal(r.stats[1].correctCount,1);assert.equal(r.stats[1].correctStreak,1);
});
test('due recommendations respect streak intervals: wrong 1, then 3/7/14/30 days',()=>{
 for(const [correct,streak,days] of [[false,0,1],[true,1,3],[true,2,7],[true,3,14],[true,4,30],[true,8,30]]){
  assert.equal(C.intervalDays(correct,streak),days);const at=ago(days);const history=correct?Array.from({length:streak},()=>event(1,true,at)):[event(1,false,at)];const r=recommend(history);assert.ok(r.items.some(x=>x.id===1));assert.equal(r.stats[1].nextReviewAt,C.nextReview(at,correct,streak));assert.equal(r.items.find(x=>x.id===1).due,true);
 }
});
test('all correct, not due: fill with studied questions without claiming unseen or missed',()=>{
 const r=recommend(ids.map(id=>event(id,true,ago(0))));assert.equal(r.reviewCount,0);assert.equal(r.items.length,5);assert.ok(r.items.every(x=>!x.unseen&&!x.due&&x.reason.includes('復習日前')));
});
test('all correct and due: select five without duplicates',()=>{
 const r=recommend(ids.map(id=>event(id,true,ago(7))));assert.equal(r.dueCount,100);assert.equal(new Set(r.items.map(x=>x.id)).size,5);assert.ok(r.items.every(x=>x.reason.includes('7日')));
});
test('last answer with missing/invalid time never inherits an earlier time',()=>{
 for(const at of [undefined,'bad','2026-02-30T12:00:00Z','2026-11-07']){
  const history=[event(1,false,ago(30)),event(1,false,ago(20)),event(1,true,at)];const d=load({history});const r=C.recommend(bank,d,now);assert.equal(r.stats[1].lastAnsweredAt,null);assert.equal(r.stats[1].nextReviewAt,null);assert.equal(r.stats[1].totalAttempts,3);assert.equal(r.stats[1].correctStreak,1);assert.equal(r.items.find(x=>x.id===1).due,false);assert.ok(!r.items.find(x=>x.id===1).reason.includes('日経過'));assert.deepEqual(d.history,history);
 }
});
test('legacy review IDs with no answer history do not invent an incorrect answer or date',()=>{
 const r=recommend([],[8]);assert.equal(r.items[0].id,8);assert.equal(r.stats[8].totalAttempts,0);assert.equal(r.stats[8].lastCorrect,null);assert.ok(r.items[0].reason.includes('復習対象として保存'));assert.equal(r.stats[8].nextReviewAt,null);
});
test('corrupt JSON and malformed entries remain safe and request a recovery copy',()=>{
 for(const raw of ['{bad','42','[]','{"history":{},"wrong":null,"sets":-3}','{"history":[null,{"id":999,"ok":true},{"id":1,"ok":"true"}],"wrong":[1,1,999]}']){
  const p=C.parse(raw,ids);assert.ok(p.requiresBackup);assert.equal(C.recommend(bank,p.data,now).items.length,5);assert.ok(p.issues.length);
 }
});
test('valid legacy records and unknown top-level data survive normalization unchanged',()=>{
 const original={history:[{id:1,ok:true,at:ago(4),custom:'keep'},{id:2,ok:false}],wrong:[2],sets:3,custom:{keep:42}};const copy=JSON.stringify(original),r=C.normalize(original,ids);assert.deepEqual(r.data.history,original.history);assert.deepEqual(r.data.custom,original.custom);assert.equal(JSON.stringify(original),copy);assert.equal(r.requiresBackup,false);assert.equal(r.data.sets,3);
});
test('saved summaries are derived from real history, not trusted or fabricated',()=>{
 const d=load({history:[event(1,false)],questionStats:{1:{correctCount:100,nextReviewAt:ago(1)}}});const r=C.recommend(bank,d,now);assert.equal(r.stats[1].wrongCount,1);assert.equal(r.stats[1].correctCount,0);assert.equal(r.stats[1].nextReviewAt,null);
});
test('answer changes recompute recommendations; streak resets after a mistake',()=>{
 const d=load({history:[event(1,true,ago(3)),event(1,true,ago(2)),event(1,true,ago(1))]});const before=C.recommend(bank,d,now);d.history.push(event(1,false,ago(0)));const after=C.recommend(bank,d,now);assert.notEqual(C.fingerprint(d),C.fingerprint(load({history:d.history.slice(0,-1)})));assert.equal(after.stats[1].correctStreak,0);assert.equal(after.items[0].id,1);assert.equal(after.stats[1].nextReviewAt,C.nextReview(ago(0),false,0));assert.notDeepEqual(before.items,after.items);
});
test('only three available questions: return three, not duplicate IDs',()=>{const d=load({});const r=C.recommend([{id:1},{id:1},{id:2},{id:3}],d,now);assert.equal(r.total,3);assert.equal(r.items.length,3);assert.equal(new Set(r.items.map(x=>x.id)).size,3)});
test('future-format data is read-only; future times do not claim elapsed days or due',()=>{
 assert.equal(C.normalize({schemaVersion:99},ids).readOnly,true);const r=recommend([event(1,true,ago(-10))]);assert.equal(r.stats[1].lastAnsweredAt,ago(-10));assert.equal(r.items.some(x=>x.id===1&&x.due),false);
});
test('calendar review interval survives a daylight-saving transition',()=>{
 const {execFileSync}=require('node:child_process');const script="const C=require('./coach.js');const at='2026-03-07T12:00:00-05:00';const next=C.nextReview(at,false,0);console.log(JSON.stringify({hours:(Date.parse(next)-Date.parse(at))/3600000,day:new Date(next).getDate(),hour:new Date(next).getHours()}));";
 const result=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}));assert.deepEqual(result,{hours:23,day:8,hour:12});
});
