(() => {
  'use strict';
  const STORAGE_KEY = 'lotLeaditLeadDataV2';
  const $ = id => document.getElementById(id);
  const els = {count:$('completedLeadCount'), search:$('completedSearchInput'), type:$('completedTypeFilter'), sort:$('completedSortBy'), body:$('completedResultsBody'), exportBtn:$('completedExportBtn')};
  let leadData = load();

  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{return{};}}
  function persist(){const ok=window.LeadForgeStorage.setJson(STORAGE_KEY,leadData,'Save completed-lead changes');if(!ok)throw new Error('Local archive update failed.');return true;}
  function clean(v){return v===null||v===undefined?'':String(v).replace(/\s+/g,' ').trim();}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(n){return Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
  function csv(v){const s=String(v??'');return/[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function stage(v){v=clean(v);if(v==='Lost')return'Completed';return v;}

  function sourceName(p){if(!p)return'';if(p.source)return clean(p.source);if(p.leadKind==='Facebook Lead')return'Facebook';if(p.leadKind==='DFW Relocation Post')return'Reddit';if(p.leadKind==='BiggerPockets Investor Post')return'BiggerPockets';if(/TheLayoff/i.test(p.leadKind||''))return'TheLayoff';if(/Fishbowl/i.test(p.leadKind||''))return'Fishbowl';return'';}
  function isCommunity(p){return Boolean(sourceName(p));}
  function badge(p){const src=sourceName(p);return src?`<span class="source-badge">${esc(src)}</span>`:'';}

  function entries(){return Object.entries(leadData).filter(([,lead])=>lead&&(lead.archived||stage(lead.pipelineStage)==='Completed')).map(([id,lead])=>({id,lead,p:lead.parcel||{}}));}
  function label(x){return x.p.redditTitle||x.p.address||`Lead ${x.id}`;}
  function owner(x){return isCommunity(x.p)?(x.p.personName||x.p.subreddit||x.p.owner||sourceName(x.p)||'Community'):(x.p.owner||'—');}
  function completedDate(x){const d=new Date(x.lead.pipelineChangedAt||x.lead.updatedAt||'');return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}

  function render(){
    let items=entries();const q=clean(els.search.value).toLowerCase(),type=els.type.value;
    if(q)items=items.filter(x=>[x.id,label(x),owner(x),x.p.city,x.p.zip,x.p.account,x.lead.notes].filter(Boolean).join(' ').toLowerCase().includes(q));
    if(type)items=items.filter(x=>(x.p.leadKind||'Vacant Lot')===type);
    const mode=els.sort.value;
    items.sort((a,b)=>mode==='address'?label(a).localeCompare(label(b)):mode==='value-desc'?Number(b.p.marketValue||0)-Number(a.p.marketValue||0):String(b.lead.pipelineChangedAt||b.lead.updatedAt||'').localeCompare(String(a.lead.pipelineChangedAt||a.lead.updatedAt||'')));
    els.count.textContent=entries().length.toLocaleString();els.exportBtn.disabled=!items.length;
    if(!items.length){els.body.innerHTML='<tr class="empty-row"><td colspan="7">No completed leads match these filters.</td></tr>';return;}
    const frag=document.createDocumentFragment();
    for(const x of items){const tr=document.createElement('tr');tr.innerHTML=`<td><div class="source-title-line">${badge(x.p)}<div class="address-main">${esc(label(x))}</div></div><div class="address-sub">${esc([x.p.city,x.p.zip,x.p.account].filter(Boolean).join(' · '))}</div></td><td>${esc(x.p.leadKind||'Vacant Lot')}</td><td>${esc(owner(x))}</td><td>${isCommunity(x.p)?'—':money(x.p.marketValue)}</td><td>${esc(completedDate(x))}</td><td><div class="action-reason">${esc(x.lead.notes||'—')}</div></td><td><button class="btn btn-outline btn-compact reactivate-lead" type="button" data-id="${esc(x.id)}">Reactivate</button></td>`;frag.appendChild(tr);}
    els.body.replaceChildren(frag);
  }

  function reactivate(id){const current=leadData[id];if(!current)return;const now=new Date().toISOString();leadData[id]={...current,pipelineStage:'Unworked',pipelineChangedAt:now,archived:false,saved:true,followUpAt:'',updatedAt:now};persist();render();}
  function exportCsv(){const items=entries();if(!items.length)return;const rows=[['Address / Lead','Lead Type','Owner / Source','City','ZIP','Market Value','Completed','Notes'],...items.map(x=>[label(x),x.p.leadKind||'Vacant Lot',owner(x),x.p.city||'',x.p.zip||'',x.p.marketValue||'',completedDate(x),x.lead.notes||''])];const blob=new Blob([rows.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LeadForge_Completed_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

  [els.search,els.type,els.sort].forEach(el=>el?.addEventListener(el.tagName==='INPUT'?'input':'change',render));
  els.body?.addEventListener('click',e=>{const b=e.target.closest('.reactivate-lead');if(b)reactivate(b.dataset.id);});
  els.exportBtn?.addEventListener('click',exportCsv);
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){leadData=load();render();}});
  render();
})();
