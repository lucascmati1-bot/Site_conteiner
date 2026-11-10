import { ApiError, sha256 } from './payment.mjs';
export function safeAuthReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/reservar.html?') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/#reservar';
  const url = new URL(value, 'https://local.invalid');
  if (url.origin !== 'https://local.invalid' || url.pathname !== '/reservar.html') return '/#reservar';
  const params = new URLSearchParams();
  for (const key of ['checkin','checkout','adults','children','infants']) if (url.searchParams.has(key)) params.set(key,url.searchParams.get(key).slice(0,20));
  return '/reservar.html?' + params;
}
function authCookie(request, name) { return (request.headers.get('cookie') || '').split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1) || ''; }
function randomAuthToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function authSetCookie(name,value,seconds,env) { return name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+seconds+(env.PUBLIC_BASE_URL.startsWith('https:')?'; Secure':''); }
function authJson(data,status=200,headers={}) { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}}); }
function authRedirect(url,cookie) { return new Response(null,{status:303,headers:{Location:url,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}}); }
export async function authUser(request,env) {
  const token=authCookie(request,'eco_session'); if(!/^[a-f0-9]{64}$/.test(token)||!env.DB)return null;
  return env.DB.prepare('SELECT u.id,u.name,u.email FROM auth_sessions s JOIN guest_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token),Date.now()).first();
}
export async function requireGuest(request,env) { const user=await authUser(request,env);if(!user)throw new ApiError(401,'Entre na sua conta para continuar a reserva.');return user; }
export async function verifyGoogleIdentity(jwt,clientId,nonce,fetcher=fetch) {
  const parts=(jwt||'').split('.');if(parts.length!==3)throw new Error('Invalid identity');
  const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));
  const decode=value=>JSON.parse(new TextDecoder().decode(bytes(value)));
  const header=decode(parts[0]),claims=decode(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('Invalid signature algorithm');
  const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Identity service unavailable');
  const jwks=await response.json(),jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw new Error('Unknown identity key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if(!valid||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!Number.isFinite(claims.iat)||claims.iat*1000>Date.now()+60000||claims.nonce!==nonce||typeof claims.sub!=='string'||!claims.sub||claims.email_verified!==true||typeof claims.email!=='string'||claims.email.length>254)throw new Error('Invalid identity claims');
  return claims;
}
export async function authApi(request,env,url) {
  const route=url.pathname,ready=!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET;
  if(route==='/api/auth/me'&&request.method==='GET')return authJson({user:await authUser(request,env),googleEnabled:ready});
  if(route==='/api/auth/logout'&&request.method==='POST') {
    if(request.headers.get('origin')!==env.PUBLIC_BASE_URL)throw new ApiError(403,'Origem inválida.');
    await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(authCookie(request,'eco_session'))).run();
    return authJson({ok:true},200,{'Set-Cookie':authSetCookie('eco_session','',0,env)});
  }
  if(route==='/api/auth/google'&&request.method==='GET') {
    const returnTo=safeAuthReturn(url.searchParams.get('return_to'));
    if(!ready)return authRedirect('/login.html?error=not_configured&return_to='+encodeURIComponent(returnTo));
    const state=randomAuthToken(),browser=randomAuthToken(),verifier=randomAuthToken(),nonce=randomAuthToken();
    await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(Date.now()).run();
    await env.DB.prepare('INSERT INTO oauth_states(state_hash,browser_hash,verifier,nonce,return_to,expires_at) VALUES (?,?,?,?,?,?)').bind(await sha256(state),await sha256(browser),verifier,nonce,returnTo,Date.now()+600000).run();
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    const challenge=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.PUBLIC_BASE_URL+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
    return authRedirect(target.href,authSetCookie('eco_oauth',browser,600,env));
  }
  if(route==='/api/auth/google/callback'&&request.method==='GET') {
    const state=url.searchParams.get('state')||'',browser=authCookie(request,'eco_oauth');
    if(!ready||!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(browser))return authRedirect('/login.html?error=expired');
    const transaction=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING *').bind(await sha256(state),await sha256(browser),Date.now()).first();
    if(!transaction)return authRedirect('/login.html?error=expired',authSetCookie('eco_oauth','',0,env));
    const returnTo=safeAuthReturn(transaction.return_to);
    if(url.searchParams.has('error'))return authRedirect('/login.html?error=cancelled&return_to='+encodeURIComponent(returnTo),authSetCookie('eco_oauth','',0,env));
    try {
      const code=url.searchParams.get('code');if(!code||code.length>4096)throw new Error('Missing code');
      const fetcher=env.GOOGLE_FETCH||fetch;
      const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.PUBLIC_BASE_URL+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:transaction.verifier}),signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('Token exchange failed');const tokens=await response.json();
      const profile=await verifyGoogleIdentity(tokens.id_token,env.GOOGLE_CLIENT_ID,transaction.nonce,fetcher);
      const userId=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO guest_users(id,google_sub,name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET name=excluded.name,email=excluded.email').bind(userId,profile.sub,String(profile.name||profile.email).slice(0,120),profile.email,Date.now()).run();
      const user=await env.DB.prepare('SELECT id FROM guest_users WHERE google_sub=?').bind(profile.sub).first();
      const session=randomAuthToken();
      await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(Date.now()).run();
      await env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha256(session),user.id,Date.now()+7*86400000).run();
      const result=authRedirect(returnTo);result.headers.append('Set-Cookie',authSetCookie('eco_session',session,7*86400,env));result.headers.append('Set-Cookie',authSetCookie('eco_oauth','',0,env));return result;
    } catch { return authRedirect('/login.html?error=failed&return_to='+encodeURIComponent(returnTo),authSetCookie('eco_oauth','',0,env)); }
  }
  return authJson({error:'Rota não encontrada.'},404);
}
