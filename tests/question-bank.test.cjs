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
for(let i=1;i<=4;i++){
 vm.runInNewContext(fs.readFileSync('questions-deep-'+i+'.js','utf8'),context,{filename:'questions-deep-'+i+'.js'});
 vm.runInNewContext(fs.readFileSync('questions-traps-'+i+'.js','utf8'),context,{filename:'questions-traps-'+i+'.js'});
}
const start=html.indexOf('const QUESTIONS=['),end=html.indexOf('const KEY=',start);
assert(start>=0&&end>start,'Question bank not found');
vm.runInNewContext(html.slice(start,end)+'\nthis.BANK=QUESTIONS;',context,{filename:'index.html'});
const bank=context.BANK;
assert.equal(bank.length,300);
assert.equal(context.GK_EXTRA_RAW.length,200);
assert.equal(context.GK_EXAM_UPGRADES.length,200);
assert.equal(context.GK_DEEP_QUESTIONS.length,200);
assert.equal(context.GK_DEEP_TRAPS.length,200);
// Protect original 100 question source, not just their IDs.
const originalBlock=html.slice(start,html.indexOf('];\n// IDs',start)+1);
let checksum=2166136261;
for(let i=0;i<originalBlock.length;i++){checksum^=originalBlock.charCodeAt(i);checksum=Math.imul(checksum,16777619);}
assert.equal((checksum>>>0).toString(16).padStart(8,'0'),'d279f020','Original questions 1–100 were edited');
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
 if(q.id>100){
  const at=q.id-101,deep=context.GK_DEEP_QUESTIONS[at],traps=context.GK_DEEP_TRAPS[at];
  assert.equal(q.q,deep[0],'Question is not redesigned: '+q.id);
  assert.equal(q.contentVersion,'deep-rewrite-2026-11','Missing rewrite marker: '+q.id);
  assert.equal(q.o[q.a],context.GK_EXAM_UPGRADES[at][1],'Curated correct answer: '+q.id);
  assert.equal(q.lesson.intuition,deep[1],'Specific intuition: '+q.id);
  assert.equal(q.lesson.basics,deep[2],'Specific basics: '+q.id);
  assert.equal(q.lesson.example,deep[3],'Specific example: '+q.id);
  assert.equal(q.lesson.point,deep[4],'Specific exam point: '+q.id);
  assert(q.lesson.basics.length>=60,'Explanation too brief: '+q.id);
  assert(q.lesson.example.length>=24,'Example too brief: '+q.id);
  assert(q.lesson.point.length>=24,'Exam point too brief: '+q.id);
  assert.equal(new Set(traps.map(x=>x.split('^')[0])).size,3,'Duplicate distractors: '+q.id);
  assert.equal(new Set(q.o).size,4,'Duplicate answer choices: '+q.id);
  for(const item of traps)assert(item.includes('^')&&item.split('^')[1].length>=9,'No reason for distractor: '+q.id);
 }
 else assert(q.lesson.basics.length>0,'Original question intact: '+q.id);
 positions[q.a]++;
}
assert.deepEqual(positions,[50,50,50,50].map(n=>n+25),'Answer position balance including original questions');
assert.equal(positions.reduce((a,b)=>a+b,0),300);
assert(html.includes("const KEY='gkentei-trainer-v3-exam-original'"),'Keep existing local history');
assert(html.includes("src=\"cloud-sync.js\""),'Keep cloud-sync');
console.log('OK: 300 questions, 200 deep rewrites, 600 reviewed distractors, unique IDs, original bank checksum, five lesson sections, cloud history key');
