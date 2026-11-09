(() => {
 const params = new URLSearchParams(location.search);
 for(const key of ['checkin','checkout']) document.getElementById(key+'-date').value=params.get(key)||'';
 for(const [key,fallback] of [['adults',2],['children',0],['infants',0]]) document.getElementById('guest-'+key).textContent=String(Number(params.get(key)??fallback));
 const adults=Number(document.getElementById('guest-adults').textContent), children=Number(document.getElementById('guest-children').textContent), infants=Number(document.getElementById('guest-infants').textContent);
 document.getElementById('guest-count').value=adults+children;
 const format=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.split('-').reverse().join('/'):'Selecione as datas';
 document.getElementById('reservation-dates').textContent=format(params.get('checkin'))+' até '+format(params.get('checkout'));
 document.getElementById('reservation-guests').textContent=adults+' adulto(s), '+children+' criança(s), '+infants+' bebê(s)';
 document.getElementById('continue-guest').addEventListener('click',()=>{const name=document.getElementById('pix-name'),email=document.getElementById('pix-email');if(!name.reportValidity()||!email.reportValidity())return;document.getElementById('payment-step').hidden=false;document.getElementById('continue-payment').focus();});
 let reviewed=false;
 function update(){document.getElementById('pix-submit').disabled=!reviewed||!window.ecoPaymentsEnabled||!document.getElementById('pix-summary').textContent;}
 document.getElementById('continue-payment').addEventListener('click',()=>{reviewed=true;document.getElementById('review-step').hidden=false;update();});
 document.addEventListener('eco-payment-config',update);
})();
