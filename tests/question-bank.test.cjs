/* Run with: node tests/question-bank.test.cjs (Node standard library only). */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const context={};context.window=context;
for(let i=1;i<=4;i++){
  vm.runInNewContext(fs.readFileSync('questions-extra-'+i+'.js','utf8'),context,{filename:'questions-extra-'+i+'.js'});
}
for(let i=1;i<=4;i++){
  vm.runInNewContext(fs.readFileSync('questions-exam-'+i+'.js','utf8'),context,{filename:'questions-exam-'+i+'.js'});
}
const start=html.indexOf('const QUESTIONS=['),end=html.indexOf('const KEY=',start);
assert(start>=0&&end>start,'Question bank not found');
vm.runInNewContext(html.slice(start,end)+'\nthis.BANK=QUESTIONS;',context,{filename:'index.html'});
const bank=context.BANK;
assert.equal(bank.length,300);
assert.equal(context.GK_EXTRA_RAW.length,200);
assert.equal(context.GK_EXAM_UPGRADES.length,200);
assert.equal(new Set(bank.map(q=>q.id)).size,300);
assert.equal(new Set(bank.map(q=>q.q)).size,300);
const positions=[0,0,0,0],required=['intuition','conclusion','basics','example','point'];
for(let i=0;i<bank.length;i++){
 const q=bank[i];assert.equal(q.id,i+1,'Stable question ID');
 assert.equal(q.o.length,4,'Four choices: '+q.id);
 assert.equal(new Set(q.o).size,4,'Unique choices: '+q.id);
 assert(q.a>=0&&q.a<4,'Valid answer: '+q.id);
 assert.equal(q.lesson.wrong.length,4,'All distractor explanations: '+q.id);
 assert.equal(q.lesson.wrong[q.a],null,'Correct answer is not a distractor: '+q.id);
 assert(q.lesson.wrong.every((x,n)=>n===q.a||(typeof x==='string'&&x.length>0)),'Non-empty distractor explanation: '+q.id);
 for(const key of required)assert(typeof q.lesson[key]==='string'&&q.lesson[key].trim().length>0,'Explanation '+key+': '+q.id);
 assert(q.syllabus?.version,'Syllabus version: '+q.id);
 if(q.id>100)assert.equal(q.o[q.a],context.GK_EXAM_UPGRADES[q.id-101][1],'Curated correct answer: '+q.id);
 else assert(q.lesson.basics.length>0,'Original question intact: '+q.id);
 positions[q.a]++;
}
assert(positions.every(n=>n>=40&&n<=110),'Answer position balance');
assert.equal(positions.reduce((a,b)=>a+b,0),300);
assert(html.includes("const KEY='gkentei-trainer-v3-exam-original'"),'Keep existing local history');
assert(html.includes("src=\"cloud-sync.js\""),'Keep cloud-sync');
console.log('OK: 300 questions, unique IDs, four choices, answers, five lesson sections, and history key');
