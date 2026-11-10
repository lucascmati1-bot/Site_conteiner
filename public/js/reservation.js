(() => {
 const params = new URLSearchParams(location.search);
 for(const key of ['checkin','checkout']) document.getElementById(key+'-date').value=params.get(key)||'';
 for(const [key,fallback] of [['adults',2],['children',0],['infants',0]]) document.getElementById('guest-'+key).textContent=String(Number(params.get(key)??fallback));
 const adults=Number(document.getElementById('guest-adults').textContent), children=Number(document.getElementById('guest-children').textContent), infants=Number(document.getElementById('guest-infants').textContent);
 document.getElementById('guest-count').value=adults+children;
 const format=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.split('-').reverse().join('/'):'Selecione as datas';
 document.getElementById('reservation-dates').textContent=format(params.get('checkin'))+' até '+format(params.get('checkout'));
 document.getElementById('reservation-guests').textContent=adults+' adulto(s), '+children+' criança(s), '+infants+' bebê(s)';
 const continueGuest=document.getElementById('continue-guest');
 const createAccount=document.getElementById('reservation-create-account');
 createAccount.href='/login.html?mode=create&return_to='+encodeURIComponent(location.pathname+location.search);
 const logout=document.createElement('button');logout.type='button';logout.textContent='Sair da conta';logout.hidden=true;logout.className='account-logout';continueGuest.after(logout);logout.addEventListener('click',async()=>{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)location.reload();});
 const account=document.createElement('p');account.className='small';account.setAttribute('role','status');continueGuest.before(account);
 let signedInUser=null;
 async function loadGuest(){const response=await fetch('/api/auth/me');if(!response.ok)throw Error('Não foi possível verificar sua conta. Tente novamente.');const data=await response.json();signedInUser=data.user;if(signedInUser){document.getElementById('pix-name').value ||= signedInUser.name;document.getElementById('pix-email').value ||= signedInUser.email;account.textContent='Você está conectado como '+signedInUser.name;logout.hidden=false;document.getElementById('guest-contact-fields').hidden=false;document.getElementById('guest-step-title').textContent='1. Seus dados';document.getElementById('guest-step-description').textContent='Confira seus dados para continuar a reserva.';createAccount.hidden=true;}return data;}
 loadGuest().catch(()=>{});
 continueGuest.addEventListener('click',async()=>{
  continueGuest.disabled=true;
  try {
   const data=await loadGuest();
   if(!data.user){location.href='/login.html?return_to='+encodeURIComponent(location.pathname+location.search);return;}
   const name=document.getElementById('pix-name'),email=document.getElementById('pix-email');if(!name.reportValidity()||!email.reportValidity())return;
   document.getElementById('payment-step').hidden=false;update();window.dispatchEvent(new Event('eco-payment-step'));document.querySelector('input[name="payment-choice"]').focus();
  } catch(error){account.textContent=error.message;}finally{continueGuest.disabled=false;}
 });

 function update(){document.getElementById('pix-submit').disabled=!signedInUser||document.getElementById('payment-step').hidden||!window.ecoPaymentsEnabled||!document.getElementById('pix-summary').textContent;}
 document.addEventListener('eco-payment-config',update);
})();
