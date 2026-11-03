(() => {
  'use strict';

  const STORAGE_KEY = 'lotLeaditLeadDataV2';
  const state = { leadData: loadLeadData(), visible: [], selectedId: null, detailMap: null, detailLayer: null };
  const $ = id => document.getElementById(id);
  const els = {
    count:$('savedLeadCount'), search:$('savedSearchInput'), status:$('savedStatusFilter'), priority:$('savedPriorityFilter'), sort:$('savedSortBy'),
    body:$('savedResultsBody'), exportBtn:$('savedExportBtn'), drawer:$('savedDetailDrawer'), detailAddress:$('savedDetailAddress'),
    detailContent:$('savedDetailContent'), detailTemplate:$('savedDetailTemplate'), backToSearch:$('backToSearchLink')
  };

  init();

  function init() {
    bindEvents();
    render();
  }

  function loadLeadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
  }

  function persistLeadData() {
    const ok=window.LeadForgeStorage.setJson(STORAGE_KEY,state.leadData,'Save saved-lead changes');
    if(!ok){state.leadData=loadLeadData();throw new Error('Local saved-lead update failed.');}
    return true;
  }



  function formatRedditPostDate(value) {
    const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return value || '—';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', { month:'long', day:'numeric' });
  }

  function savedEntries() {
    return Object.entries(state.leadData)
      .filter(([,lead]) => lead && lead.saved && !lead.archived && normalizeSavedPipelineStage(lead.pipelineStage) !== 'Completed')
      .map(([id,lead]) => ({ id, lead, parcel: lead.parcel || null }));
  }

  function communitySource(p){
    if(!p)return'';
    if(p.source)return cleanText(p.source);
    if(p.leadKind==='Facebook Lead')return'Facebook';
    if(p.leadKind==='DFW Relocation Post')return'Reddit';
    if(p.leadKind==='BiggerPockets Investor Post')return'BiggerPockets';
    if(/TheLayoff/i.test(p.leadKind||''))return'TheLayoff';
    if(/Fishbowl/i.test(p.leadKind||''))return'Fishbowl';
    if(/Community Lead/i.test(p.leadKind||''))return p.owner||p.subreddit||'Community';
    return'';
  }
  function isCommunityLead(p){return Boolean(communitySource(p));}
  function sourceBadgeHtml(p){const src=communitySource(p);return src?`<span class="source-badge source-${escapeHtml(src.toLowerCase().replace(/[^a-z0-9]+/g,'-'))}">${escapeHtml(src)}</span>`:'';}

  function removeSavedLead(id, fromDrawer=false) {
    const lead = state.leadData[id];
    if (!lead) return;
    if (!window.confirm('Remove this property from Saved Leads?')) return;
    state.leadData[id] = {...lead, saved:false, updatedAt:new Date().toISOString()};
    persistLeadData();
    if (fromDrawer) closeDrawer();
    render();
  }

  function renderMap(p) {
    const host = els.detailContent.querySelector('#savedDetailMap');
    if (!host || typeof L === 'undefined') return;
    state.detailMap = L.map(host, { zoomControl:true, attributionControl:true }).setView([32.81,-97.36],11);
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles &copy; Esri' });
    satellite.addTo(state.detailMap);

    const modeControl = L.control({ position:'topright' });
    modeControl.onAdd = () => {
      const wrap = L.DomUtil.create('div', 'map-mode-toggle leaflet-bar');
      const mapBtn = L.DomUtil.create('button', 'map-mode-btn', wrap);
      const satelliteBtn = L.DomUtil.create('button', 'map-mode-btn active', wrap);
      mapBtn.type = satelliteBtn.type = 'button';
      mapBtn.textContent='Map'; satelliteBtn.textContent='Satellite';
      const switchMode = mode => {
        const sat = mode === 'satellite';
        if (sat) {
          if (state.detailMap.hasLayer(street)) state.detailMap.removeLayer(street);
          if (!state.detailMap.hasLayer(satellite)) satellite.addTo(state.detailMap);
        } else {
          if (state.detailMap.hasLayer(satellite)) state.detailMap.removeLayer(satellite);
          if (!state.detailMap.hasLayer(street)) street.addTo(state.detailMap);
        }
        mapBtn.classList.toggle('active', !sat); satelliteBtn.classList.toggle('active', sat);
      };
      L.DomEvent.disableClickPropagation(wrap); L.DomEvent.disableScrollPropagation(wrap);
      L.DomEvent.on(mapBtn,'click',()=>switchMode('map')); L.DomEvent.on(satelliteBtn,'click',()=>switchMode('satellite'));
      return wrap;
    };
    modeControl.addTo(state.detailMap);

    if (p.geometry) {
      state.detailLayer = L.geoJSON({type:'Feature',geometry:p.geometry,properties:{}},{style:{color:'#121212',weight:3,fillColor:'#BEAF87',fillOpacity:.38}}).addTo(state.detailMap);
      const b=state.detailLayer.getBounds?.(); if (b && b.isValid()) state.detailMap.fitBounds(b.pad(.35),{maxZoom:18});
    }
    state.detailMap.invalidateSize();
  }

  function closeDrawer() {
    els.drawer.classList.remove('open'); els.drawer.setAttribute('aria-hidden','true');
    setTimeout(destroyMap,220);
  }

  function destroyMap() {
    if (state.detailMap) { try { state.detailMap.remove(); } catch {} }
    state.detailMap=null; state.detailLayer=null;
  }

  function normalizeForSaleStatus(value) {
    const v=String(value||'').trim();
    if(v==='Yes')return 'Yes'; if(v==='No')return 'No'; return 'Unknown';
  }

  function displayOwner(owner) { const p=parseIndividualOwner(owner); return p ? p.display : (owner||'—'); }

  function parseIndividualOwner(owner) {
    const raw=cleanText(owner); if (!raw || raw==='Owner not listed') return null;
    const upper=raw.toUpperCase();
    const entityWords=/\b(INC|INCORPORATED|LLC|L\.?L\.?C|LTD|LIMITED|LP|L\.?P|CORP|CORPORATION|COMPANY|CO|GROUP|HOLDINGS|PARTNERS?|PARTNERSHIP|TRUST|TRUSTEE|ESTATE|EST|BANK|ASSOCIATION|CHURCH|MINISTR(?:Y|IES)|FOUNDATION|CITY|COUNTY|STATE|SCHOOL|DISTRICT|AUTHORITY|DEVELOP(?:MENT|ERS?)|HOMES?|BUILDERS?|CONSTRUCTION|COMMUNITIES|PROPERTIES|PROPERTY|REALTY|INVESTMENTS?|CAPITAL|VENTURES?|LAND|MANAGEMENT|ENTERPRISES|SERVICES|FUND)\b/;
    if (entityWords.test(upper)) return null;
    if (raw.includes(',')) {
      const parts=raw.split(',').map(cleanText).filter(Boolean); if(parts.length<2)return null;
      const last=parts[0], given=parts.slice(1).join(' '), first=given.split(/\s+/)[0].replace(/[^A-Za-z'’-]/g,'');
      if(!first||!last)return null; return {firstName:titleCasePerson(first),lastName:titleCasePerson(last),display:`${titleCasePerson(given)} ${titleCasePerson(last)}`.trim()};
    }
    const words=raw.split(/\s+/).filter(Boolean); if(words.length<2||words.length>7)return null;
    if(raw===raw.toUpperCase()) {
      const last=words[0].replace(/[^A-Za-z'’-]/g,''), given=words.slice(1).join(' '), first=words[1].replace(/[^A-Za-z'’-]/g,'');
      if(!first||!last)return null; return {firstName:titleCasePerson(first),lastName:titleCasePerson(last),display:`${titleCasePerson(given)} ${titleCasePerson(last)}`.trim()};
    }
    const first=words[0].replace(/[^A-Za-z'’-]/g,''), last=words.at(-1).replace(/[^A-Za-z'’-]/g,''); if(!first||!last)return null;
    return {firstName:titleCasePerson(first),lastName:titleCasePerson(last),display:titleCasePerson(raw)};
  }

  function buildFastPeopleSearchUrl(person, ownerAddress) {
    const first=slugPart(person.firstName), last=slugPart(person.lastName); if(!first||!last)return 'https://www.fastpeoplesearch.com/';
    const stateCode=ownerMailingState(ownerAddress).toLowerCase(); const suffix=stateCode?`_${stateCode}`:'';
    return `https://www.fastpeoplesearch.com/name/${encodeURIComponent(first)}-${encodeURIComponent(last)}${suffix}`;
  }
  function ownerMailingState(ownerAddress) {
    const s=cleanText(ownerAddress).toUpperCase(); const z=s.match(/\b([A-Z]{2})[ ,]+\d{5}(?:-\d{4})?\b/); if(z)return z[1];
    const matches=s.match(/(?:,|\s)\s*([A-Z]{2})(?:,|\s|$)/g); if(!matches?.length)return ''; const m=matches.at(-1).match(/([A-Z]{2})/); return m?m[1]:'';
  }
  function slugPart(v){return cleanText(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
  function titleCasePerson(v){return cleanText(v).toLowerCase().replace(/(^|[\s&'’-])([a-z])/g,(_,lead,c)=>lead+c.toUpperCase()).replace(/\b(Jr|Sr|Ii|Iii|Iv)\b/g,m=>m.toUpperCase());}
  function formatSize(p){if(Number(p.acres)>=.1)return `${Number(p.acres).toLocaleString(undefined,{maximumFractionDigits:3})} ac`;if(Number(p.sqft))return `${Math.round(Number(p.sqft)).toLocaleString()} sf`;return'—';}
  function money(n){return Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
  function cleanText(v){return v===null||v===undefined?'':String(v).replace(/\s+/g,' ').trim();}
  function csvEscape(v){const s=String(v??'');return/[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  /* v4.0 saved-lead pipeline and smart follow-up */
  function savedPipelineStages(){return ['Unworked','Contacted','Appointment','Closed','Completed'];}
  function normalizeSavedPipelineStage(v){v=cleanText(v);if(savedPipelineStages().includes(v))return v;if(v==='Responded'||v==='Nurture')return'Contacted';if(v==='Client')return'Appointment';if(v==='Lost')return'Completed';return'Unworked';}
  function savedPipelineStage(id){return normalizeSavedPipelineStage(state.leadData[id]?.pipelineStage);}
  function savedToDateTimeLocal(value){if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return'';const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function savedFollowUpText(value){if(!value)return'—';const d=new Date(value);if(Number.isNaN(d.getTime()))return'—';return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}

  function bindEvents() {
    [els.search, els.status, els.priority, $('savedPipelineFilter'), els.sort].filter(Boolean).forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', render));
    els.exportBtn.addEventListener('click', exportSavedCSV);
    els.backToSearch?.addEventListener('click', e => { if(window.opener&&!window.opener.closed){e.preventDefault();window.opener.focus();window.close();} });
    document.querySelectorAll('[data-close-saved-drawer]').forEach(el => el.addEventListener('click', closeDrawer));
    document.addEventListener('keydown', e => { if(e.key==='Escape')closeDrawer(); });
    window.addEventListener('storage', e => { if(e.key===STORAGE_KEY){state.leadData=loadLeadData();render();} });
    document.addEventListener('change', e => {
      const sel=e.target.closest?.('.saved-pipeline-select'); if(!sel)return;
      const id=sel.dataset.leadId,current=state.leadData[id]||{},stage=sel.value,changed=savedPipelineStage(id)!==stage;
      state.leadData[id]={...current,pipelineStage:stage,pipelineChangedAt:changed?new Date().toISOString():(current.pipelineChangedAt||new Date().toISOString()),archived:stage==='Completed',saved:stage==='Completed'?false:current.saved,followUpAt:stage==='Completed'?'':(current.followUpAt||''),updatedAt:new Date().toISOString()};persistLeadData();render();
    });
  }

  function render() {
    let items=savedEntries();const q=cleanText(els.search.value).toLowerCase(),status=els.status.value,priority=els.priority.value,pipeline=$('savedPipelineFilter')?.value||'';
    if(q)items=items.filter(({id,lead,parcel})=>[id,parcel?.address,parcel?.owner,parcel?.account,parcel?.city,parcel?.zip,parcel?.redditTitle,parcel?.subreddit,parcel?.source,parcel?.personName,parcel?.groupName,parcel?.leadType,parcel?.snippet,lead.email,lead.notes].filter(Boolean).join(' ').toLowerCase().includes(q));
    if(status)items=items.filter(({lead})=>(lead.status||'Not researched')===status);if(priority)items=items.filter(({lead})=>(lead.priority||'Normal')===priority);if(pipeline)items=items.filter(({id})=>savedPipelineStage(id)===pipeline);
    const mode=els.sort.value;items.sort((a,b)=>{const pa=a.parcel||{},pb=b.parcel||{};if(mode==='address')return cleanText(pa.address||a.id).localeCompare(cleanText(pb.address||b.id));if(mode==='value-desc')return Number(pb.marketValue||0)-Number(pa.marketValue||0);if(mode==='value-asc')return Number(pa.marketValue||0)-Number(pb.marketValue||0);if(mode==='acres-desc')return Number(pb.acres||0)-Number(pa.acres||0);return String(b.lead.updatedAt||'').localeCompare(String(a.lead.updatedAt||''));});
    state.visible=items;els.count.textContent=savedEntries().length.toLocaleString();els.exportBtn.disabled=!items.length;renderTable();
  }

  function renderTable() {
    if(!state.visible.length){els.body.innerHTML=`<tr class="empty-row"><td colspan="11">${savedEntries().length?'No saved leads match these filters.':'No saved leads yet. Save a property or relocation post and it will appear here.'}</td></tr>`;return;}
    const frag=document.createDocumentFragment();for(const item of state.visible){const{id,lead,parcel:p}=item,tr=document.createElement('tr');tr.dataset.id=id;const legacy=!p,isReddit=isCommunityLead(p),owner=isReddit?(p.personName||p.subreddit||p.owner||p.source||'Community'):(p?displayOwner(p.owner):'Property details unavailable'),sizeYears=isReddit?`${Number(p.ageDays||0)}d old`:(p?(p.leadKind==='Long-Term Owner'?`${Number(p.yearsOwned||0)} years`:formatSize(p)):'—'),valueText=isReddit?'—':(p?money(p.marketValue):'—'),subline=legacy?'Saved before property details were attached':isReddit?[p.subreddit,p.city||'DFW',formatRedditPostDate(p.postDate)].filter(Boolean).join(' · '):[p.city,p.zip,p.account].filter(Boolean).join(' · '),stage=savedPipelineStage(id),opts=savedPipelineStages().map(x=>`<option ${x===stage?'selected':''}>${escapeHtml(x)}</option>`).join(''),follow=lead.followUpAt||'',overdue=follow&&new Date(follow)<new Date();tr.innerHTML=`<td><div class="source-title-line">${sourceBadgeHtml(p)}<div class="address-main">${escapeHtml(p?.redditTitle||p?.address||`Saved lead ${id}`)}</div></div><div class="address-sub">${escapeHtml(subline)}</div></td><td>${escapeHtml(p?.leadKind||'Vacant Lot')}</td><td>${escapeHtml(sizeYears)}</td><td>${valueText}</td><td>${escapeHtml(owner)}</td><td>${escapeHtml(isReddit?'—':(lead.email||'—'))}</td><td><span class="status-badge ${lead.priority==='Hot'?'hot':''}">${escapeHtml(lead.status||'Not researched')}</span></td><td>${escapeHtml(lead.priority||'Normal')}</td><td><select class="pipeline-select saved-pipeline-select" data-lead-id="${escapeHtml(id)}">${opts}</select></td><td><span class="${overdue?'followup-overdue-text':''}">${escapeHtml(savedFollowUpText(follow))}</span></td><td><button class="saved-remove-inline" type="button">Remove</button></td>`;tr.addEventListener('click',e=>{if(e.target.closest('.saved-remove-inline,.saved-pipeline-select'))return;openDetails(id)});tr.querySelector('.saved-remove-inline').addEventListener('click',e=>{e.stopPropagation();removeSavedLead(id)});frag.appendChild(tr);}els.body.replaceChildren(frag);
  }

  function openDetails(id) {
    const lead=state.leadData[id];if(!lead||!lead.saved)return;const p=lead.parcel,isReddit=isCommunityLead(p);state.selectedId=id;destroyMap();const node=els.detailTemplate.content.cloneNode(true);els.detailAddress.textContent=p?.redditTitle||p?.address||`Saved lead ${id}`;
    const ownerSection=node.querySelector('#savedOwnerSection'),mapSection=node.querySelector('#savedMapSection'),propertySection=node.querySelector('#savedPropertySection'),redditSection=node.querySelector('#savedRedditSection'),ownershipSection=node.querySelector('#savedOwnershipSection'),commercialSection=node.querySelector('#savedCommercialSection'),emailField=node.querySelector('#savedEmailField'),forSaleField=node.querySelector('#savedForSaleField'),tad=node.querySelector('#savedTadLink'),gm=node.querySelector('#savedGoogleLink');
    if(isReddit){if(ownerSection)ownerSection.hidden=true;if(mapSection)mapSection.hidden=true;if(propertySection)propertySection.hidden=true;if(ownershipSection)ownershipSection.hidden=true;if(commercialSection)commercialSection.hidden=true;if(emailField)emailField.hidden=true;if(forSaleField)forSaleField.hidden=true;if(tad)tad.style.display='none';if(gm)gm.style.display='none';if(redditSection)redditSection.hidden=false;node.querySelector('#sRedditSubreddit').textContent=[communitySource(p),p.groupName||p.subreddit].filter(Boolean).join(' · ')||'Community';node.querySelector('#sRedditArea').textContent=p.city||'DFW';node.querySelector('#sRedditDate').textContent=formatRedditPostDate(p.postDate);node.querySelector('#sRedditAge').textContent=Number(p.ageDays||0)===0?'Today':`${Number(p.ageDays||0)} days`;node.querySelector('#sRedditIntent').textContent=p.leadType||'Relocation';node.querySelector('#sRedditSnippet').textContent=p.snippet||'—';const redditLink=node.querySelector('#sRedditLink');if(p.redditUrl){redditLink.href=p.redditUrl;redditLink.textContent=`Open ${communitySource(p)||'Community'} Post`;}else redditLink.style.display='none';}
    else{const ownerPerson=p?parseIndividualOwner(p.owner):null;node.querySelector('#sOwner').textContent=p?(ownerPerson?ownerPerson.display:(p.owner||'—')):'Property details unavailable';node.querySelector('#sOwnerAddress').textContent=p?.ownerAddress||'—';const fps=node.querySelector('#savedFastPeopleSearchBtn');if(ownerPerson?.firstName&&ownerPerson?.lastName)fps.href=buildFastPeopleSearchUrl(ownerPerson,p.ownerAddress);else fps.hidden=true;node.querySelector('#sAccount').textContent=p?.account||id||'—';node.querySelector('#sType').textContent=p?.type||'—';node.querySelector('#sSize').textContent=p?formatSize(p):'—';node.querySelector('#sMarket').textContent=p?money(p.marketValue):'—';node.querySelector('#sLandValue').textContent=p?money(p.landValue):'—';node.querySelector('#sUseCode').textContent=p?.useCode||p?.propertyClass||'—';node.querySelector('#sBuildingArea').textContent=p?.livingArea?`${Math.round(Number(p.livingArea)).toLocaleString()} sf`:'—';node.querySelector('#sYearBuilt').textContent=p?.yearBuilt||'—';node.querySelector('#sSubdivision').textContent=p?.subdivision||'—';node.querySelector('#sBlockLot').textContent=p?([p.block&&`Block ${p.block}`,p.lot&&`Lot ${p.lot}`].filter(Boolean).join(' · ')||'—'):'—';node.querySelector('#sLegal').textContent=p?.legal||'—';if(p?.leadKind==='Long-Term Owner'){ownershipSection.hidden=false;node.querySelector('#sYearsOwned').textContent=`${Number(p.yearsOwned||0)} years`;node.querySelector('#sDeedDate').textContent=p.deedDate||'—';node.querySelector('#sOwnerOccupied').textContent=p.ownerOccupied?'Likely — mailing address matches property':'Not indicated by mailing address';node.querySelector('#sLeadType').textContent=p.leadKind;}if(['Commercial Property','Vacant Commercial Candidate'].includes(p?.leadKind)){commercialSection.hidden=false;node.querySelector('#sForSale').textContent=normalizeForSaleStatus(lead.forSale);node.querySelector('#sLastSold').textContent=p.deedDate||'—';}if(p&&cleanText(p.county).toUpperCase().includes('TARRANT')&&p.account)tad.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`;else tad.style.display='none';if(p)gm.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.address,p.city,'TX',p.zip].filter(Boolean).join(', '))}`;else gm.style.display='none';if(forSaleField&&p?.leadKind==='Long-Term Owner')forSaleField.hidden=true;}
    node.querySelector('#savedLeadEmail').value=lead.email||'';node.querySelector('#savedLeadForSale').value=normalizeForSaleStatus(lead.forSale);node.querySelector('#savedLeadStatus').value=lead.status||'Not researched';node.querySelector('#savedLeadPriority').value=lead.priority||'Normal';node.querySelector('#savedLeadPipeline').value=savedPipelineStage(id);node.querySelector('#savedLeadFollowUp').value=savedToDateTimeLocal(lead.followUpAt);node.querySelector('#savedLeadNotes').value=lead.notes||'';
    node.querySelectorAll('[data-saved-followup-days]').forEach(btn=>btn.addEventListener('click',()=>{const d=new Date();d.setDate(d.getDate()+Number(btn.dataset.savedFollowupDays||0));d.setSeconds(0,0);d.setMinutes(Math.ceil(d.getMinutes()/15)*15);node.querySelector('#savedLeadFollowUp').value=savedToDateTimeLocal(d.toISOString());}));node.querySelector('[data-saved-followup-clear]')?.addEventListener('click',()=>{node.querySelector('#savedLeadFollowUp').value='';});
    node.querySelector('#saveSavedLeadBtn').addEventListener('click',()=>{const current=state.leadData[id]||{},stage=els.detailContent.querySelector('#savedLeadPipeline').value,local=els.detailContent.querySelector('#savedLeadFollowUp').value;let followUpAt='';if(local){const d=new Date(local);if(!Number.isNaN(d.getTime()))followUpAt=d.toISOString();}const changed=savedPipelineStage(id)!==stage;state.leadData[id]={...current,email:isReddit?(current.email||''):els.detailContent.querySelector('#savedLeadEmail').value.trim(),forSale:isReddit?(current.forSale||'Unknown'):els.detailContent.querySelector('#savedLeadForSale').value,status:els.detailContent.querySelector('#savedLeadStatus').value,priority:els.detailContent.querySelector('#savedLeadPriority').value,pipelineStage:stage,pipelineChangedAt:changed?new Date().toISOString():(current.pipelineChangedAt||new Date().toISOString()),followUpAt:stage==='Completed'?'':followUpAt,archived:stage==='Completed',saved:stage==='Completed'?false:current.saved,notes:els.detailContent.querySelector('#savedLeadNotes').value.trim(),updatedAt:new Date().toISOString()};persistLeadData();render();if(stage==='Completed')closeDrawer();const msg=els.detailContent.querySelector('#savedSaveConfirmation');msg.textContent='Saved locally.';setTimeout(()=>{if(msg)msg.textContent='';},1800);});node.querySelector('#removeSavedLeadBtn').addEventListener('click',()=>removeSavedLead(id,true));
els.detailContent.replaceChildren(node);els.drawer.classList.add('open');els.drawer.setAttribute('aria-hidden','false');if(p&&!isReddit)setTimeout(()=>renderMap(p),80);
  }

  function exportSavedCSV() {
    if(!state.visible.length)return;const headers=['Address','City','ZIP','County','Lead Type','Property Type','For Sale','Years Owned','Deed Date / Last Sold','Likely Owner Occupied','Parcel/Account','Acres','Square Feet','Market Value','Land Value','Use Code','Subdivision','Block','Lot','Owner Name','Owner Mailing Address','Email','Contact Status','Priority','Pipeline Stage','Pipeline Changed','Follow Up','Notes','Legal Description'];const rows=state.visible.map(({id,lead,parcel:p})=>{if(isCommunityLead(p))return[p.redditTitle||p.address||'',p.city||'','','DFW',p.leadKind,p.type||'Community Lead','Unknown','',p.postDate||'','',p.account||id,'','','','','','','','',p.subreddit||p.owner||'','', '',lead.status||'Not researched',lead.priority||'Normal',savedPipelineStage(id),lead.pipelineChangedAt||'',lead.followUpAt||'',lead.notes||'',`${p.leadType||''} | ${p.snippet||''} | ${p.redditUrl||''}`];return[p?.address||'',p?.city||'',p?.zip||'',p?.county||'',p?.leadKind||'Vacant Lot',p?.type||'',normalizeForSaleStatus(lead.forSale),p?.yearsOwned||'',p?.deedDate||'',p?.ownerOccupied?'Yes':'No',p?.account||id,p?.acres||'',p?.sqft||'',p?.marketValue||'',p?.landValue||'',p?.useCode||'',p?.subdivision||'',p?.block||'',p?.lot||'',p?.owner||'',p?.ownerAddress||'',lead.email||'',lead.status||'Not researched',lead.priority||'Normal',savedPipelineStage(id),lead.pipelineChangedAt||'',lead.followUpAt||'',lead.notes||'',p?.legal||''];});const csv=[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LeadForge_Saved_Leads_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

})();
