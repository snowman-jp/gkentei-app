const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.disabled=false;this._text='';this.className='';this.classList={add:(...xs)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...xs])].join(' ')},remove:(x)=>{this.className=this.className.split(' ').filter(y=>y!==x).join(' ')},contains:(x)=>this.className.split(' ').includes(x),toggle:(x,on)=>{if(on===undefined)on=!this.classList.contains(x);on?this.classList.add(x):this.classList.remove(x)}}}
 set textContent(s){this._text=String(s);this.children=[]}get textContent(){return this._text+this.children.map(x=>x.textContent??x).join('')}
 set innerHTML(s){assert.equal(s,'');this.replaceChildren()}
 append(...xs){this.children.push(...xs)}replaceChildren(...xs){this._text='';this.children=[...xs]}
 setAttribute(k,v){this.attrs[k]=String(v)}
 querySelector(s){return this.children.find(x=>x.classList?.contains(s.slice(1)))}
}
function app(seedData){
 const elements=new Map();const saved=new Map();if(seedData)saved.set('gkentei-trainer-v3-exam-original',JSON.stringify(seedData));
 let seed=321;const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const context=vm.createContext({ReviewCoach:require('../coach.js'),document:{body:new Element(),addEventListener:()=>{},getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:t=>new Element(t),createTextNode:t=>({textContent:t})},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},Math:math,Date,Set,JSON,crypto:require('node:crypto').webcrypto,confirm:()=>true,window:{addEventListener:()=>{},dispatchEvent:()=>{},scrollTo:()=>{}},requestAnimationFrame:()=>{},setTimeout:()=>{},CustomEvent:class{constructor(type){this.type=type}}});
 for(const match of html.matchAll(/<script src="(questions-[^"]+\.js)"/g)){vm.runInContext(fs.readFileSync(path.join(__dirname,'..',match[1]),'utf8'),context);}
 vm.runInContext(script,context);return {run:code=>vm.runInContext(code,context),node:id=>elements.get(id),saved:()=>JSON.parse(saved.get('gkentei-trainer-v3-exam-original'))};
}
test('100 stable IDs, four unique choices and one answer; 100 complete six-part lessons',()=>{
 const a=app();assert.equal(a.run('QUESTIONS.length'),300);assert.equal(a.run('new Set(QUESTIONS.map(q=>q.id)).size'),300);
 assert.equal(a.run('QUESTIONS.every((q,i)=>q.id===i+1&&q.o.length===4&&new Set(q.o).size===4&&Number.isInteger(q.a)&&q.a>=0&&q.a<4)'),true);
 assert.equal(a.run('QUESTIONS.filter(q=>q.lesson).length'),300);
 assert.equal(a.run("QUESTIONS.filter(q=>q.lesson).every(q=>['intuition','conclusion','basics','example','point'].every(k=>q.lesson[k].length>0)&&q.lesson.wrong.length===4&&q.lesson.wrong[q.a]===null&&q.lesson.wrong.filter(Boolean).length===3)"),true);
});
test('all questions can score correctly after shuffle; all 24 permutations occur; double answer is ignored',()=>{
 const a=app();const permutations=new Set();
 const allPermutations=(xs)=>xs.length?xs.flatMap((x,i)=>allPermutations(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];
 for(let id=1;id<=100;id++)for(const expected of allPermutations([0,1,2,3])){
  const values=[0,1,2,3],draws=[];
  for(let j=3;j>0;j--){const k=values.indexOf(expected[j]);draws.push((k+0.1)/(j+1));[values[j],values[k]]=[values[k],values[j]]}
  a.run('Math.random=(()=>{const xs='+JSON.stringify(draws)+';return ()=>xs.shift()})()');
  a.run("start('review',["+id+"])");
  assert.equal(a.run('displayedChoices.map(c=>c.originalIndex).join()'),expected.join());permutations.add(expected.join());
  a.run('choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))');
  assert.equal(a.run('session[0].ok'),true);assert.equal(a.run('session[0].chosen===queue[0].a'),true);
  assert.equal(a.node('choices').children.filter(b=>b.classList.contains('right')).length,1);
  assert.equal(a.node('choices').children.every(b=>b.disabled),true);
  a.run('choose(0)');assert.equal(a.run('session.length'),1);
 }
 assert.equal(permutations.size,24);assert.equal(a.saved().history.length,2400);assert.equal(a.saved().history.every(x=>x.ok),true);assert.equal(new Set(a.saved().history.map(x=>x.id)).size,100);
});
test('legacy history survives; wrong answer and correct retry update the same problem ID',()=>{
 const a=app({history:[{id:1,ok:true,at:'2026-01-01T00:00:00Z'}],wrong:[21],sets:4});
 a.run("start('review',[9]);choose(displayedChoices.findIndex(c=>c.originalIndex!==queue[i].a))");
 assert.equal(a.run('session[0].ok'),false);assert.deepEqual(a.saved().wrong,[21,9]);assert.equal(a.saved().sets,4);
 assert.equal(a.node('choices').children.filter(b=>b.classList.contains('wrong')).length,1);
 a.run("start('review',data.wrong)");assert.equal(a.run('queue.some(q=>q.id===9)'),true);
 a.run("start('review',[9]);choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a));finish()");
 assert.deepEqual(a.saved().wrong,[21]);assert.equal(a.saved().history[0].id,1);assert.equal(a.saved().sets,4);assert.match(a.node('resultScore').textContent,/1 \/ 1/);
 const reload=app(a.saved());assert.equal(reload.node('attempts').textContent,'3');assert.equal(reload.node('missed').textContent,'1');
});
test('five-question score, set count and unique question queue remain correct',()=>{
 const a=app();a.run("start('normal')");assert.equal(a.run('new Set(queue.map(q=>q.id)).size'),5);
 for(let n=0;n<5;n++){
  a.run(`choose(displayedChoices.findIndex(c=>${n===0?'c.originalIndex!==':'c.originalIndex==='}queue[i].a))`);
  a.node('next').onclick();
 }
 assert.match(a.node('resultScore').textContent,/4 \/ 5.*80/);assert.equal(a.saved().sets,1);assert.equal(a.saved().wrong.length,1);
});
test('lesson error reasons follow display labels; all six sections render',()=>{
 const a=app();a.run("start('review',[9]);choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))");
 const detail=a.node('feedback').children[2];const sections=detail.children.filter(x=>x.tagName==='details');assert.equal(sections.length,5);
 const wrong=sections[3].children[1].children;assert.equal(wrong.length,3);
 const expected=JSON.parse(a.run("JSON.stringify(displayedChoices.map((c,n)=>({...c,n})).filter(c=>c.originalIndex!==queue[i].a).map(c=>({label:'選択肢'+'ABCD'[c.n]+'：'+c.text,reason:queue[i].lesson.wrong[c.originalIndex]})))"));
 wrong.forEach((li,i)=>{assert.equal(li.children[0].textContent,expected[i].label);assert.equal(li.children[1].textContent,expected[i].reason)});
 a.run("start('review',[21]);choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))");assert.equal(a.node('feedback').children[2].children.filter(x=>x.tagName==='details').length,5);
});
test('invalid display indices do not save an answer',()=>{const a=app();a.run("start('review',[21]);choose(-1);choose(4);choose(NaN)");assert.equal(a.run('data.history.length'),0)});
test('legal metadata matches verified effective law revisions and source evidence',()=>{
 const evidence=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../docs/legal-verification-2026-11-06.json'),'utf8'));
 assert.equal(Object.keys(evidence.laws).length,4);for(const law of Object.values(evidence.laws)){assert.equal(law.revisionStatus,'CurrentEnforced');assert.ok(law.effectiveFrom<=evidence.asOf);assert.equal(law.responseSha256.length,64);assert.ok(Object.keys(law.excerpts).length>0)}
 const a=app();assert.equal(a.run('QUESTIONS.filter(q=>q.legal).length'),6);
 const revisions=JSON.parse(a.run('JSON.stringify(QUESTIONS.filter(q=>q.legal).map(q=>q.legal.revisionId))'));assert.equal(revisions.every(id=>Object.values(evidence.laws).some(law=>law.revisionId===id)),true);
 assert.equal(a.run("QUESTIONS.filter(q=>q.legal).every(q=>q.legal.conditions&&q.legal.exceptions&&q.legal.basis&&q.legal.reviewedOn==='2026-11-06'&&q.legal.asOf==='2026-11-06'&&q.legal.revisionId&&q.legal.verification.includes('関係条文を確認')&&q.legal.url.startsWith('https://laws.e-gov.go.jp/law/'))"),true);
});
