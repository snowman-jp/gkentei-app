const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
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
 const context=vm.createContext({document:{body:new Element(),getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:t=>new Element(t),createTextNode:t=>({textContent:t})},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},Math:math,Date,Set,JSON,confirm:()=>true});
 vm.runInContext(script,context);return {run:code=>vm.runInContext(code,context),node:id=>elements.get(id),saved:()=>JSON.parse(saved.get('gkentei-trainer-v3-exam-original'))};
}
test('100 stable IDs, four unique choices and one answer; ten complete structured lessons',()=>{
 const a=app();assert.equal(a.run('QUESTIONS.length'),100);assert.equal(a.run('new Set(QUESTIONS.map(q=>q.id)).size'),100);
 assert.equal(a.run('QUESTIONS.every((q,i)=>q.id===i+1&&q.o.length===4&&new Set(q.o).size===4&&Number.isInteger(q.a)&&q.a>=0&&q.a<4)'),true);
 assert.equal(a.run('JSON.stringify(QUESTIONS.filter(q=>q.lesson).map(q=>q.id))'),'[9,24,26,30,42,51,60,74,82,84]');
 assert.equal(a.run("QUESTIONS.filter(q=>q.lesson).every(q=>['conclusion','basics','example','point'].every(k=>q.lesson[k].length>0)&&q.lesson.wrong.length===4&&q.lesson.wrong[q.a]===null&&q.lesson.wrong.filter(Boolean).length===3)"),true);
});
test('all 24 display permutations score the original correct answer; double answer is ignored',()=>{
 const a=app();const permutations=new Set();
 for(let i=0;i<300;i++){
  a.run("start('review',[21])");permutations.add(a.run('displayedChoices.map(c=>c.originalIndex).join()'));
  a.run('choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))');
  assert.equal(a.run('session[0].ok'),true);assert.equal(a.run('session[0].chosen===queue[0].a'),true);
  assert.equal(a.node('choices').children.filter(b=>b.classList.contains('right')).length,1);
  assert.equal(a.node('choices').children.every(b=>b.disabled),true);
  a.run('choose(0)');assert.equal(a.run('session.length'),1);
 }
 assert.equal(permutations.size,24);assert.equal(a.saved().history.length,300);assert.equal(a.saved().history.every(x=>x.id===21&&x.ok),true);
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
test('lesson error reasons follow display labels; non-lesson questions retain their explanation',()=>{
 const a=app();a.run("start('review',[9]);choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))");
 const detail=a.node('feedback').children[2];const sections=detail.children.filter(x=>x.tagName==='details');assert.equal(sections.length,4);
 const wrong=sections[2].children[1].children;assert.equal(wrong.length,3);
 const expected=JSON.parse(a.run("JSON.stringify(displayedChoices.map((c,n)=>({...c,n})).filter(c=>c.originalIndex!==queue[i].a).map(c=>({label:'選択肢'+'ABCD'[c.n]+'：'+c.text,reason:queue[i].lesson.wrong[c.originalIndex]})))"));
 wrong.forEach((li,i)=>{assert.equal(li.children[0].textContent,expected[i].label);assert.equal(li.children[1].textContent,expected[i].reason)});
 a.run("start('review',[21]);choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))");assert.equal(a.node('feedback').children[2].children[1].textContent,a.run('queue[0].e'));
});
test('invalid display indices do not save an answer',()=>{const a=app();a.run("start('review',[21]);choose(-1);choose(4);choose(NaN)");assert.equal(a.run('data.history.length'),0)});
test('lesson entry selects five distinct lesson questions and counts a completed set',()=>{
 const a=app();a.node('lessonStart').onclick();assert.equal(a.run('queue.length'),5);assert.equal(a.run('queue.every(q=>q.lesson)'),true);assert.equal(a.run('new Set(queue.map(q=>q.id)).size'),5);
 for(let n=0;n<5;n++){a.run('choose(displayedChoices.findIndex(c=>c.originalIndex===queue[i].a))');a.node('next').onclick()}
 assert.equal(a.node('resultTitle').textContent,'詳しい解説5問の結果');assert.equal(a.saved().sets,1);
});
