(() => {
  'use strict';
  const KEY='leadforgeContactSignatureV1';
  function getSignature(){try{return String(localStorage.getItem(KEY)||'').trim().slice(0,800);}catch{return '';}}
  function setSignature(text){localStorage.setItem(KEY,String(text??'').trim().slice(0,800));}
  window.LeadForgeSettings=Object.freeze({getSignature,setSignature});
  const btn=document.getElementById('settingsBtn');
  const dialog=document.getElementById('leadforgeSettingsDialog');
  const field=document.getElementById('leadforgeSignatureInput');
  if(btn&&dialog&&field){
    btn.addEventListener('click',()=>{field.value=getSignature();dialog.showModal();});
    document.getElementById('leadforgeSaveSignature')?.addEventListener('click',()=>{
      try{setSignature(field.value);dialog.close();}
      catch(err){window.alert('Could not save signature: '+(err?.message||err));}
    });
  }
})();
