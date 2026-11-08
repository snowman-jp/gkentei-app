/* G検定正式版: 本人が明示的に許可した場合だけ自動同期する。未同意なら通信しない。 */
(()=>{'use strict';
const API_URL='https://kuduxlkmuvongfdqyjoc.supabase.co';
const PUBLIC_KEY='sb_publishable_a2M9GVPbhf7xaTOnI3hH8Q_kXOKzIzy';
const OPT_IN='gkentei-formal-cloud-opt-in-v1';
const SESSION='gkentei-formal-cloud-session-v1';
const AUTO='gkentei-formal-cloud-auto-opt-in-v1';
const AUTO_DEBOUNCE_MS=2000, AUTO_MIN_INTERVAL_MS=30000;
let syncRunning=false,autoTimer=null,lastAutoAttempt=0,rerunAfterSync=false;
const $c=id=>document.getElementById(id);
let session=null;
let recoveryMode=false;
const status=(t,error=false)=>{const el=$c('cloudStatus');if(el){el.textContent=t;el.style.color=error?'#b42318':'#43556d'}};
const consent=()=>localStorage.getItem(OPT_IN)==='yes';
const autoEnabled=()=>consent()&&localStorage.getItem(AUTO)==='yes';
const canAuto=()=>autoEnabled()&&!!session?.access_token&&!recoveryMode&&!storageReadFailed&&!loaded.readOnly;
const headers=(token)=>({'apikey':PUBLIC_KEY,'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})});
async function call(path,{method='GET',body,token,extra={}}={}){
 const response=await fetch(API_URL+path,{method,headers:{...headers(token),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!response.ok){let message;try{const e=await response.json();message=e.msg||e.message||e.error_description||e.error}catch{}throw new Error(message||'HTTP '+response.status)}
 if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
}
function saveSession(s){session=s; if(s)sessionStorage.setItem(SESSION,JSON.stringify(s));else sessionStorage.removeItem(SESSION);render();}
function render(){
 const active=consent(),signed=!!session?.access_token;
 $c('cloudConsent').checked=active;
 $c('cloudAuto').checked=autoEnabled();
 $c('cloudAuto').disabled=!active||recoveryMode;
 $c('cloudLogin').hidden=signed||recoveryMode;
 $c('cloudRecovery').hidden=!recoveryMode;
 $c('cloudLoggedIn').hidden=!signed||recoveryMode;

 $c('cloudSyncButton').disabled=!active||!signed||recoveryMode;
 $c('cloudEmailLabel').textContent=signed?'認証済み（このブラウザ内のセッション）':'';
}
async function token(){
 if(!session?.access_token)throw new Error('先にメールでログインしてください。');
 if(session.expires_at && Date.now()/1000<session.expires_at-60)return session.access_token;
 if(!session.refresh_token)throw new Error('ログインの有効期限が切れました。再ログインしてください。');
 const s=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
 saveSession({...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)});
 return session.access_token;
}
async function approved(t){
 const rows=await call('/rest/v1/allowed_sync_users?select=user_id&limit=1',{token:t});
 if(!Array.isArray(rows)||rows.length===0)throw new Error('このアカウントはまだ同期許可リストに登録されていません。管理画面で本人を許可してからお試しください。');
}
async function eventUUID(row,index){
 const input=String(row.id)+'|'+String(row.at)+'|'+String(!!row.ok);
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)));
 const b=digest.slice(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
 const hex=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function makeBackup(){exportHistory()}
async function getAllEvents(t){
 let output=[];let offset=0;
 while(true){
  const rows=await call('/rest/v1/answer_events?select=event_id,question_id,is_correct,answered_at&order=answered_at.asc&limit=1000&offset='+offset,{token:t});
  if(!Array.isArray(rows))throw new Error('サーバーの履歴取得に失敗しました。');
  output.push(...rows);if(rows.length<1000)break;offset+=1000;
  if(offset>100000)throw new Error('履歴件数が多いため安全のため処理を中断しました。');
 }
 return output;
}
async function syncHistory(automatic=false){
 if(!consent())return status('先にクラウド同期に同意してください。',true);
 if(automatic&&!canAuto())return;
 if(syncRunning){if(automatic)rerunAfterSync=true;return;}
 syncRunning=true;
 const btn=$c('cloudSyncButton');btn.disabled=true;
 let phase='開始時の確認';
 try{
  if(storageReadFailed||loaded.readOnly)throw new Error('端末の保存状態を保護中です。先に履歴をバックアップして、保存状態を確認してください。');
  if(!Array.isArray(data.history))throw new Error('端末内の学習履歴を読み取れません。');
  phase='認証トークンの確認';status('同期処理：'+phase);
  const t=await token();
  phase='本人の同期許可の確認';status('同期処理：'+phase);await approved(t);
  const local=data.history.map(r=>({...r}));
  const startingHistory=JSON.stringify(data.history);
  phase='クラウド履歴の読み取り';status('同期処理：'+phase);
  const remote=await getAllEvents(t);
  const known=new Set(remote.map(x=>x.event_id));
  phase='ログインユーザーの確認';status('同期処理：'+phase);
  const user=await call('/auth/v1/user',{token:t});
  if(!user?.id)throw new Error('認証ユーザーを確認できません。');
  const outgoing=[];
  phase='送信対象の重複確認';status('同期処理：'+phase);
  for(let i=0;i<local.length;i++){
   const r=local[i];if(!r||!Number.isFinite(Number(r.id))||typeof r.ok!=='boolean'||!Number.isFinite(Date.parse(r.at)))continue;
   const eid=await eventUUID(r);
   if(!known.has(eid))outgoing.push({event_id:eid,user_id:user.id,question_id:String(r.id),is_correct:r.ok,answered_at:r.at});
  }
  if(!automatic&&!window.confirm('端末内の履歴 '+local.length+'件のうち、未登録の約'+outgoing.length+'件をクラウドへ送信します。既存の端末履歴は残し、他の端末で保存済みの記録も取り込みます。実行しますか？')){status('同期をキャンセルしました。');return}
  // iOS Safariでダウンロード直後のPOSTが中断される可能性があるため、
  // 同期処理中の自動ダウンロードは禁止。ユーザーは事前の手動JSONバックアップを保持する。
  phase='解答履歴の送信準備';status('同期処理：'+phase);
  // POSTは同一オリジンの検証版API経由。RLSはSupabase側で引き続き適用する。
  phase='解答履歴の送信';status('同期処理：'+phase);
  for(let i=0;i<outgoing.length;i+=100){
   const response=await fetch('/api/answer-sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(outgoing.slice(i,i+100)),cache:'no-store'});
   if(!response.ok){let details;try{details=await response.json()}catch{}throw new Error((details?.error||'Upload failed')+' (HTTP '+response.status+')');}
  }
  phase='保存結果の読み取り';status('同期処理：'+phase);
  const latest=await getAllEvents(t);
  const existing=new Set();
  const merged=[];
  // 同じ解答を識別できる限り保ち、端末内イベントを最優先して保持する
  for(let i=0;i<local.length;i++){
   const r=local[i];if(!r||typeof r.ok!=='boolean'||!Number.isFinite(Date.parse(r.at)))continue;
   const eid=await eventUUID(r);existing.add(eid);merged.push(r);
  }
  for(const r of latest){
   if(existing.has(r.event_id))continue;
   // 別端末の履歴。追加のみで端末側の既存履歴を上書きしない。
   merged.push({id:Number(r.question_id),ok:r.is_correct,at:r.answered_at});
  }
  merged.sort((a,b)=>new Date(a.at)-new Date(b.at));
  // wrongの整合性は、履歴から再構成する（過去の誤答を再生し最後の正解で消す）
  // Preserve legacy review flags for questions with no answer record.
  const answered=new Set(merged.map(r=>r.id));
  const wrong=new Set(data.wrong.filter(id=>!answered.has(id)));
  for(const r of merged){if(r.ok)wrong.delete(r.id);else wrong.add(r.id)}
  // 回答中に履歴が増えた場合、古いスナップショットで上書きしない。
  if(JSON.stringify(data.history)!==startingHistory){
   rerunAfterSync=automatic;
   throw new Error('同期中に新しい回答が記録されました。履歴は保持し、再同期します。');
  }
  // 既存履歴と完全に同じ場合は端末の保存領域を更新しない。
  const changed=JSON.stringify(local)!==JSON.stringify(merged)||JSON.stringify([...wrong])!==JSON.stringify(data.wrong);
  if(changed){
   const next={...data,history:merged,wrong:[...wrong]};
   phase='端末内履歴への反映';status('同期処理：'+phase);
   const previous=data;data=next;
   if(!persist()){data=previous;throw new Error('履歴保護のため端末への保存を中止しました。元データは保持されています。');}
   if(typeof dashboard==='function'&&!document.body.classList.contains('quiz-active'))dashboard();
  }
  status((automatic?'自動同期完了。':'同期完了。')+'クラウド '+latest.length+'件、端末内 '+merged.length+'件。');
 }catch(e){status((automatic?'自動同期':'同期')+'できませんでした（'+phase+'）：'+e.message+'。端末内の履歴は保持されています。バックアップを削除しないでください。',true)}
 finally{
  syncRunning=false;render();
  if(rerunAfterSync){rerunAfterSync=false;scheduleAuto('回答追加',AUTO_MIN_INTERVAL_MS)}
 }
}
function manualSync(){return syncHistory(false)}
function scheduleAuto(reason,delay=AUTO_DEBOUNCE_MS){
 if(!canAuto()||document.visibilityState!=='visible')return;
 if(autoTimer!==null)clearTimeout(autoTimer);
 const pause=Math.max(delay,AUTO_MIN_INTERVAL_MS-(Date.now()-lastAutoAttempt),0);
 autoTimer=setTimeout(()=>{autoTimer=null;if(!canAuto()||document.visibilityState!=='visible')return;lastAutoAttempt=Date.now();syncHistory(true)},pause);
}
function stopAuto(){if(autoTimer!==null)clearTimeout(autoTimer);autoTimer=null}
function init(){
 try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{session=null}
 // メールリンクから戻ってきた時のトークン。許可前にクラウド履歴を自動取得しない。
 const hash=new URLSearchParams(location.hash.replace(/^#/,''));const access=hash.get('access_token'),refresh=hash.get('refresh_token');
 recoveryMode=hash.get('type')==='recovery' && !!access;
 if(recoveryMode)$c('cloudDetails').open=true;
 if(access){
  saveSession({access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});
  history.replaceState(null,'',location.pathname+location.search);
  status(recoveryMode?'パスワード再設定用の認証を受け取りました。新しいパスワードを入力してください。':'ログインできました。クラウド同期はまだ自動実行されません。');
 }
 $c('cloudSetNewPassword').addEventListener('click',async()=>{
  if(!recoveryMode||!session?.access_token){status('パスワード再設定用の有効なリンクから開いてください。',true);return;}
  const pass=$c('cloudNewPassword').value,confirmPass=$c('cloudConfirmPassword').value;
  if(pass.length<12||pass.length>72){status('パスワードは12～72文字で設定してください。',true);return;}
  if(pass!==confirmPass){status('確認用パスワードが一致しません。',true);return;}
  const btn=$c('cloudSetNewPassword');btn.disabled=true;
  try{
    await call('/auth/v1/user',{method:'PUT',token:await token(),body:{password:pass}});
    $c('cloudNewPassword').value='';$c('cloudConfirmPassword').value='';
    recoveryMode=false;
    saveSession(null);
    status('パスワードを設定しました。iPhoneの「パスワード」アプリに保存してから、メール＋パスワードでログインしてください。同期はオフのままです。');
  }catch(e){status('パスワードを設定できませんでした。リンクの期限切れなどが考えられます：'+e.message,true)}
  finally{btn.disabled=false;render()}
 });
 $c('cloudConsent').addEventListener('change',e=>{
  if(e.target.checked){
   if(!confirm('問題ID・正誤・解答日時を、本人が「同期する」を押した場合だけSupabaseへ保存します。通常利用では送信しません。同意しますか？')){e.target.checked=false;return}
   localStorage.setItem(OPT_IN,'yes');status('クラウド同期の利用を許可しました。自動同期は別途オンにした場合のみ動きます。');
  }else{localStorage.removeItem(OPT_IN);localStorage.removeItem(AUTO);stopAuto();status('クラウド同期をオフにしました。送信済みのデータは自動削除されません。')}
  render();
 });
 $c('cloudAuto').addEventListener('change',e=>{
  if(e.target.checked){
   if(!consent()||!window.confirm('ログイン中は、回答後やアプリを再び開いたときに、問題ID・正誤・日時を本人専用クラウドへ自動送信・取得します。実行しますか？')){e.target.checked=false;return}
   localStorage.setItem(AUTO,'yes');status('自動同期をオンにしました。画面を開いているときに同期します。');scheduleAuto('設定変更',1500);
  }else{localStorage.removeItem(AUTO);stopAuto();status('自動同期をオフにしました。既存のクラウドデータは残ります。')}
  render();
 });
 $c('cloudRequestReset').addEventListener('click',async()=>{
  const email=$c('cloudEmail').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){status('登録済みメールアドレスを入力してください。',true);return;}
  const button=$c('cloudRequestReset');button.disabled=true;
  try{
    const redirect=location.origin+location.pathname;
    await call('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email}});
    status('再設定用のメールをリクエストしました。届いた最新のリンクをSafariで開いてください。');
  }catch(e){status('再設定メールを送信できませんでした：'+e.message,true)}
  finally{button.disabled=false;}
 });
 $c('cloudPasswordLogin').addEventListener('click',async()=>{
  const email=$c('cloudEmail').value.trim();
  const password=$c('cloudPassword').value;
  if(!/^\S+@\S+\.\S+$/.test(email)||!password){status('メールアドレスとパスワードを入力してください。',true);return;}
  const button=$c('cloudPasswordLogin');button.disabled=true;
  try{
   const result=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   if(!result?.access_token||!result?.refresh_token)throw new Error('ログイン情報を取得できませんでした。');
   saveSession({...result,expires_at:Math.floor(Date.now()/1000)+(result.expires_in||3600)});
   $c('cloudPassword').value='';
   status('ログインに成功しました。');scheduleAuto('ログイン',1500);
  }catch(e){status('ログインできませんでした。メールアドレスまたはパスワードを確認してください。',true);}
  finally{button.disabled=false;}
 });
 $c('cloudSignOut').addEventListener('click',async()=>{stopAuto();const t=session?.access_token;saveSession(null);if(t){try{await call('/auth/v1/logout',{method:'POST',token:t})}catch(_){}}status('ログアウトしました。端末の学習履歴は残っています。')});
 $c('cloudBackup').addEventListener('click',()=>{makeBackup();status('学習履歴のバックアップを実行しました。')});
 $c('cloudSyncButton').addEventListener('click',manualSync);
 window.addEventListener('gkentei:history-saved',()=>scheduleAuto('回答保存'));
 window.addEventListener('online',()=>scheduleAuto('通信復帰',1000));
 window.addEventListener('pageshow',()=>scheduleAuto('ページ表示',1000));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleAuto('アプリ復帰',1000);else stopAuto()});
 // 画面を開いたまま他端末から増えた回答も取得する（バックグラウンド同期ではない）。
 setInterval(()=>scheduleAuto('他端末の確認',1000),120000);
 render();scheduleAuto('起動',1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
