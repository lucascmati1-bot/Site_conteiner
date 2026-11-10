(() => {
 const params=new URLSearchParams(location.search);
 let returnTo='/#reservar';
 try { const url=new URL(params.get('return_to')||'',location.origin);if(url.origin===location.origin&&url.pathname==='/reservar.html')returnTo=url.pathname+url.search; } catch {}
 const google=document.getElementById('google-login'),status=document.getElementById('login-status');
 function mode(create){document.getElementById('login-title').textContent=create?'Crie sua conta':'Entre para continuar';document.getElementById('login-description').textContent=create?'Use sua conta Google para criar seu cadastro e continuar a reserva.':'Acesse sua conta para seguir com a reserva. Suas datas e hóspedes serão mantidos.';google.textContent=create?'Criar conta com Google':'Continuar com Google';document.getElementById('create-account').hidden=create;document.getElementById('existing-account').hidden=!create;}
 document.getElementById('create-account').addEventListener('click',()=>mode(true));document.getElementById('existing-account').addEventListener('click',()=>mode(false));mode(params.get('mode')==='create');
 fetch('/api/auth/me').then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  if(data.user){location.replace(returnTo);return;}
  if(!data.googleEnabled){status.textContent='O acesso com Google está em configuração. Volte em breve para continuar sua reserva.';return;}
  google.href='/api/auth/google?return_to='+encodeURIComponent(returnTo);google.setAttribute('aria-disabled','false');google.removeAttribute('tabindex');status.hidden=true;
  const messages={cancelled:'O acesso foi cancelado. Você pode tentar novamente.',expired:'A sessão de entrada expirou. Tente novamente.',failed:'Não foi possível concluir o acesso com Google. Tente novamente.'};if(messages[params.get('error')]){status.hidden=false;status.textContent=messages[params.get('error')];}
 }).catch(()=>{status.textContent='Não foi possível verificar o acesso. Atualize a página para tentar novamente.';});
})();
