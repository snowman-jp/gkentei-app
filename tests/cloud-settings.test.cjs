const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../cloud-sync.js'),'utf8');
const keys={
 consent:'gkentei-formal-cloud-opt-in-v1',
 automatic:'gkentei-formal-cloud-auto-opt-in-v1',
 remember:'gkentei-formal-remember-login-v1',
 persisted:'gkentei-formal-persisted-session-v1',
 history:'gkentei-trainer-v3-exam-original'
};
function fakeStore(start={}){
 const values=new Map(Object.entries(start));
 return {
  getItem:k=>values.get(k)??null,
  setItem:(k,v)=>values.set(k,String(v)),
  removeItem:k=>values.delete(k),
  snapshot:()=>Object.fromEntries(values)
 };
}
function app({initial={},allow=true}={}){
 const elements=new Map();const listeners=new Map();
 const localStorage=fakeStore(initial),sessionStorage=fakeStore();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   checked:false,disabled:false,hidden:false,textContent:'',
   style:{},value:'',listeners:{},
   addEventListener(type,fn){this.listeners[type]=fn}
  });
  return elements.get(id);
 };
 let confirmations=0;
 const window={addEventListener:()=>{},confirm:()=>{confirmations++;return allow}};
 const context=vm.createContext({
  window,localStorage,sessionStorage,location:{hash:'',search:'',pathname:'/',origin:'https://example.test'},
  URLSearchParams,Date,JSON,Number,Set,Map,Array,Math,
  document:{readyState:'complete',visibilityState:'hidden',getElementById:element,addEventListener:()=>{}},
  setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},
  storageReadFailed:false,loaded:{readOnly:false},
  data:{history:[],wrong:[],sets:0,setCompletionEvents:[]},
  confirm:()=>allow
 });
 vm.runInContext(script,context);
 return {element,localStorage,sessionStorage,confirmations:()=>confirmations};
}
test('Only one sync checkbox is rendered, backup stays available in collapsed details',()=>{
 assert.equal((html.match(/id="cloudConsent"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="cloudAuto"|id="cloudRemember"/);
 assert.match(html,/<details id="cloudAdvanced">/);
 assert.match(html,/id="cloudSyncButton"[^>]*>今すぐ同期する/);
 assert.match(html,/クラウド同期を有効にする/);
});
test('Turning on sync saves explicit consent and login retention, but not automatic uploads before first manual sync',()=>{
 const a=app({initial:{[keys.history]:'{"history":[{"id":1}],"sets":5}'}});const b=a.element('cloudConsent');
 assert.equal(b.checked,false);b.checked=true;b.listeners.change({target:b});
 assert.equal(a.localStorage.getItem(keys.consent),'yes');
 assert.equal(a.localStorage.getItem(keys.remember),'yes');
 assert.equal(a.localStorage.getItem(keys.automatic),null);
 assert.equal(a.localStorage.getItem(keys.history),'{"history":[{"id":1}],"sets":5}');
 assert.match(a.element('cloudStatus').textContent,/今すぐ同期する/);
});
test('Declining confirmation sends nothing and leaves sync off',()=>{
 const a=app({allow:false});const b=a.element('cloudConsent');b.checked=true;b.listeners.change({target:b});
 assert.equal(b.checked,false);
 assert.equal(a.localStorage.getItem(keys.consent),null);
 assert.equal(a.localStorage.getItem(keys.remember),null);
 assert.equal(a.localStorage.getItem(keys.automatic),null);
});
test('Switching off clears auto-sync and local retained login, never study history',()=>{
 const a=app({initial:{[keys.consent]:'yes',[keys.automatic]:'yes',[keys.remember]:'yes',[keys.persisted]:'session-data',[keys.history]:'{"sets":15}'}});const b=a.element('cloudConsent');
 assert.equal(b.checked,true);b.checked=false;b.listeners.change({target:b});
 for(const k of [keys.consent,keys.automatic,keys.remember,keys.persisted])assert.equal(a.localStorage.getItem(k),null);
 assert.equal(a.localStorage.getItem(keys.history),'{"sets":15}');
 assert.match(a.element('cloudStatus').textContent,/学習履歴は残っています/);
});
test('Existing three-flag users stay opted in without resetting their preferences',()=>{
 const a=app({initial:{[keys.consent]:'yes',[keys.automatic]:'yes',[keys.remember]:'yes'}});
 assert.equal(a.element('cloudConsent').checked,true);
 assert.equal(a.localStorage.getItem(keys.automatic),'yes');
 assert.equal(a.localStorage.getItem(keys.remember),'yes');
});
test('Automatic synchronization is enabled only after a successful user-approved manual sync',()=>{
 const end=script.indexOf("status((automatic?'自動同期完了。':'同期完了。')");
 const auto=script.indexOf("localStorage.setItem(AUTO,'yes')");
 assert.ok(auto>=0&&auto<end);
 assert.match(script.slice(auto-180,auto),/!automatic&&consent\(\)&&!autoEnabled\(\)/);
 assert.ok(script.indexOf('const latestSets=await getAllSets(t);')<auto);
 assert.ok(script.indexOf('if(changed){')<auto);
 assert.ok(script.indexOf('if(!automatic&&!window.confirm(')<auto);
});
