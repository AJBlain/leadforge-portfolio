(() => {
  'use strict';

  const STORAGE_KEY = 'lotLeaditLeadDataV2';
  const SEARCH_TIMING_KEY = 'lotLeaditSearchTimingV1';
  const EXCLUDED_STREETS_KEY = 'lotLeaditExcludedStreetsV1';
  const EXCLUDED_COMMERCIAL_OWNERS_KEY = 'leadforgeExcludedCommercialOwnersV1';
  const REDDIT_POSTS_KEY = 'leadforgeRedditRelocationPostsV1';
  const REDDIT_WORKED_KEY = 'leadforgeRedditWorkedPostsV1';
  const REDDIT_COVERAGE_KEY = 'leadforgeRedditCoverageV1';
  const RedditEngine = window.LeadForgeRedditEngine;
  const APP_VERSION = '1.0';
  const RENDER_BATCH_SIZE = 125;
  let followUpDashboardDirty = true;
  let followUpDashboardLastRender = 0;
  // Reddit geography, normalization, and evidence validation live in reddit-engine.js.
  const KNOWN_BUILDER_PATTERNS = [
    /FIRST\s+TEXAS\s+HOMES?/, /D\s*R\s*HORTON/, /DHI\s+COMMUNITIES?/, /LENNAR/, /PULTE/, /CENTEX/,
    /KB\s+HOME/, /MERITAGE/, /TAYLOR\s+MORRISON/, /HIGHLAND\s+HOMES?/, /PERRY\s+HOMES?/,
    /BLOOMFIELD\s+HOMES?/, /DAVID\s+WEEKLEY/, /M\s*[\/\&]\s*I\s+HOMES?/, /HISTORYMAKER/,
    /CHESMAR/, /COVENTRY\s+HOMES?/, /CASTLEROCK/, /TRI\s+POINTE/, /ASHTON\s+WOODS/, /LANDSEA/
  ];

  const state = {
    allResults: [], filteredResults: [], visibleResults: [], selectedId: null,
    commercialResults: [], commercialVisibleResults: [], commercialSelectedId: null,
    vacantCommercialResults: [], vacantCommercialVisibleResults: [],
    ownerResults: [], ownerVisibleResults: [], ownerSelectedId: null,
    redditPosts: loadRedditPosts(), redditVisiblePosts: [], redditWorkedPosts: loadRedditWorkedPosts(), redditCoverage: loadRedditCoverage(), activeRedditDmId: null, activeWorkspace: 'vacant',
    detailMap: null, detailLayer: null, leadData: loadLeadData(), excludedStreets: loadExcludedStreets(), excludedCommercialOwners: loadExcludedCommercialOwners(), progressKind: 'vacant',
    areaMap: null, areaPoints: [], areaPolygon: null, areaMarkers: [], areaKind: 'vacant', areaBaseMode: 'map', areaStreetLayer: null, areaSatelliteLayer: null, areaSatelliteLabelLayers: []
  };

  const $ = id => document.getElementById(id);
  const els = {
    searchMode: $('searchMode'), locationInput: $('locationInput'), locationLabel: $('locationLabel'), lotType: $('lotType'),
    minAcres: $('minAcres'), maxAcres: $('maxAcres'), maxValue: $('maxValue'), excludeBuilt: $('excludeBuilt'),
    neighborhoodOnly: $('neighborhoodOnly'), excludeNonBuildable: $('excludeNonBuildable'), hideGovernment: $('hideGovernment'),
    searchBtn: $('searchBtn'), clearBtn: $('clearBtn'), statusText: $('statusText'), resultsBody: $('resultsBody'),
    sortBy: $('sortBy'), exportBtn: $('exportBtn'), savedLeadsLink: $('savedLeadsLink'), savedCount: $('savedCount'), completedCount: $('completedCount'),
    statCount: $('statCount'),
    excludedStreetsBtn: $('excludedStreetsBtn'), excludedStreetCount: $('excludedStreetCount'), excludedStreetsModal: $('excludedStreetsModal'),
    excludedStreetsList: $('excludedStreetsList'), clearExcludedStreetsBtn: $('clearExcludedStreetsBtn'),
    detailDrawer: $('detailDrawer'), detailAddress: $('detailAddress'), detailContent: $('detailContent'), detailTemplate: $('detailTemplate'),
    progressModal: $('searchProgressModal'), progressBar: $('searchProgressBar'), progressPct: $('searchProgressPct'),
    progressStep: $('searchProgressStep'), progressEta: $('searchProgressEta'), progressElapsed: $('searchProgressElapsed'),
    progressTitle: $('searchProgressTitle'),
    vacantTabBtn: $('vacantTabBtn'), commercialTabBtn: $('commercialTabBtn'), vacantCommercialTabBtn: $('vacantCommercialTabBtn'), ownerTabBtn: $('ownerTabBtn'), redditTabBtn: $('redditTabBtn'),
    vacantWorkspace: $('vacantWorkspace'), commercialWorkspace: $('commercialWorkspace'), vacantCommercialWorkspace: $('vacantCommercialWorkspace'), ownerWorkspace: $('ownerWorkspace'), redditWorkspace: $('redditWorkspace'),
    commercialSearchMode: $('commercialSearchMode'), commercialLocationInput: $('commercialLocationInput'), commercialLocationLabel: $('commercialLocationLabel'),
    commercialType: $('commercialType'), commercialMaxValue: $('commercialMaxValue'), commercialForSaleFilter: $('commercialForSaleFilter'), commercialSearchBtn: $('commercialSearchBtn'), commercialClearBtn: $('commercialClearBtn'),
    commercialStatusText: $('commercialStatusText'), commercialResultsBody: $('commercialResultsBody'), commercialSortBy: $('commercialSortBy'), commercialStatCount: $('commercialStatCount'), commercialDetailTemplate: $('commercialDetailTemplate'),
    vcZip:$('vcZip'), vcCity:$('vcCity'), vcCounty:$('vcCounty'), vcNeighborhood:$('vcNeighborhood'), vcRadiusCenter:$('vcRadiusCenter'), vcRadius:$('vcRadius'), vcCorridor:$('vcCorridor'), vcType:$('vcType'), vcBuildingSize:$('vcBuildingSize'), vcLotSize:$('vcLotSize'), vcValueRange:$('vcValueRange'), vcOwnerType:$('vcOwnerType'), vcOwnership:$('vcOwnership'), vcLastSale:$('vcLastSale'), vcConfidence:$('vcConfidence'), vcSearchBtn:$('vcSearchBtn'), vcClearBtn:$('vcClearBtn'), vcStatusText:$('vcStatusText'), vcResultsBody:$('vcResultsBody'), vcStatCount:$('vcStatCount'), vcSortBy:$('vcSortBy'),
    ownerSearchMode: $('ownerSearchMode'), ownerLocationInput: $('ownerLocationInput'), ownerLocationLabel: $('ownerLocationLabel'), ownerYears: $('ownerYears'), ownerOccupancy: $('ownerOccupancy'), ownerMaxValue: $('ownerMaxValue'),
    ownerSearchBtn: $('ownerSearchBtn'), ownerClearBtn: $('ownerClearBtn'), ownerStatusText: $('ownerStatusText'), ownerResultsBody: $('ownerResultsBody'),
    ownerSortBy: $('ownerSortBy'), ownerStatCount: $('ownerStatCount'), ownerDetailTemplate: $('ownerDetailTemplate'), detailEyebrow: $('detailEyebrow'),
    vacantMapSearchBtn: $('vacantMapSearchBtn'), commercialMapSearchBtn: $('commercialMapSearchBtn'), ownerMapSearchBtn: $('ownerMapSearchBtn'),
    mapSearchModal: $('mapSearchModal'), mapSearchMap: $('mapSearchMap'), mapSearchStreetBtn: $('mapSearchStreetBtn'), mapSearchSatelliteBtn: $('mapSearchSatelliteBtn'), mapSearchCloseBtn: $('mapSearchCloseBtn'), mapSearchUndoBtn: $('mapSearchUndoBtn'), mapSearchClearBtn: $('mapSearchClearBtn'), mapSearchRunBtn: $('mapSearchRunBtn'), mapSearchHint: $('mapSearchHint'), mapSearchTitle: $('mapSearchTitle'),
    excludedCommercialOwnersBtn: $('excludedCommercialOwnersBtn'), excludedCommercialOwnersModal: $('excludedCommercialOwnersModal'), excludedCommercialOwnersList: $('excludedCommercialOwnersList'), clearExcludedCommercialOwnersBtn: $('clearExcludedCommercialOwnersBtn'),
    redditRunChatGPTBtn: $('redditRunChatGPTBtn'), redditCopyPromptBtn: $('redditCopyPromptBtn'), redditClearBtn: $('redditClearBtn'), redditStatusText: $('redditStatusText'),
    redditImportText: $('redditImportText'), redditImportBtn: $('redditImportBtn'), redditImportCard: $('redditImportCard'), redditImportCollapsed: $('redditImportCollapsed'), redditImportCollapsedSummary: $('redditImportCollapsedSummary'), redditImportHideBtn: $('redditImportHideBtn'), redditImportOpenBtn: $('redditImportOpenBtn'), redditImportFeedback: $('redditImportFeedback'), redditPromptPreview: $('redditPromptPreview'), redditResultsBody: $('redditResultsBody'), redditStatCount: $('redditStatCount'),
    redditSortBy: $('redditSortBy'), redditFilterInput: $('redditFilterInput'), redditStatusFilter: $('redditStatusFilter'), redditBatchSelect: $('redditBatchSelect'), redditCoverageGrid: $('redditCoverageGrid'), redditReviewCount: $('redditReviewCount'), redditArchiveCount: $('redditArchiveCount'), redditWorkedPostsBtn: $('redditWorkedPostsBtn'), redditWorkedPostsModal: $('redditWorkedPostsModal'), redditWorkedPostsList: $('redditWorkedPostsList'), restoreAllRedditWorkedBtn: $('restoreAllRedditWorkedBtn'),
    redditDmModal: $('redditDmModal'), redditDmText: $('redditDmText'), redditDmPostTitle: $('redditDmPostTitle'), redditDmCopyBtn: $('redditDmCopyBtn'), redditDmRegenerateBtn: $('redditDmRegenerateBtn')
  };

  init();

  async function init() {
    bindEvents(); refreshSavedCounts(); refreshExcludedStreetCount(); updateSearchModeUI(); updateCommercialSearchModeUI(); updateOwnerSearchModeUI(); initRedditCoverageControls(); refreshRedditPrompt(); applyRedditFiltersAndRender();
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) throw new Error('local service unavailable');
      const data = await r.json().catch(() => ({}));
      const readyText = `Ready. Local parcel service connected${data.version ? ` · v${data.version}` : ''}.`;
      setStatus(readyText, 'success'); setCommercialStatus(readyText, 'success'); setVcStatus(readyText, 'success'); setOwnerStatus(readyText, 'success'); setRedditStatus('Ready. Use ChatGPT to research recent Reddit relocation leads.', 'success');
    } catch {
      const errText = 'Local parcel service is not connected. Close this window and start the app with START_APP.bat.';
      setStatus(errText, 'error'); setCommercialStatus(errText, 'error'); setVcStatus(errText, 'error'); setOwnerStatus(errText, 'error'); setRedditStatus('Ready. Reddit research uses ChatGPT and does not require the local parcel service.', 'success');
    }
  }

  function bindEvents() {
    els.searchMode.addEventListener('change', updateSearchModeUI);
    els.commercialSearchMode.addEventListener('change', updateCommercialSearchModeUI);
    els.ownerSearchMode.addEventListener('change', updateOwnerSearchModeUI);
    els.vacantTabBtn.addEventListener('click', () => setWorkspace('vacant'));
    els.commercialTabBtn.addEventListener('click', () => setWorkspace('commercial'));
    els.vacantCommercialTabBtn?.addEventListener('click', () => setWorkspace('vacant-commercial'));
    els.ownerTabBtn.addEventListener('click', () => setWorkspace('owners'));
    els.redditTabBtn?.addEventListener('click', () => setWorkspace('reddit'));
    els.searchBtn.addEventListener('click', runSearch);
    els.vacantMapSearchBtn?.addEventListener('click', () => openMapSearch('vacant'));
    els.clearBtn.addEventListener('click', clearSearch);
    els.sortBy.addEventListener('change', applySortAndRender);
    els.exportBtn.addEventListener('click', exportActiveCSV);
    els.excludedStreetsBtn?.addEventListener('click', openExcludedStreetsModal);
    els.clearExcludedStreetsBtn?.addEventListener('click', restoreAllExcludedStreets);
    els.locationInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });

    
    els.vcSearchBtn?.addEventListener('click', runVacantCommercialSearch);
    els.vcClearBtn?.addEventListener('click', clearVacantCommercialSearch);
    els.vcSortBy?.addEventListener('change', applyVacantCommercialFiltersAndRender);
    [els.vcType,els.vcBuildingSize,els.vcLotSize,els.vcValueRange,els.vcOwnerType,els.vcOwnership,els.vcLastSale,els.vcConfidence].forEach(x=>x?.addEventListener('change',()=>{ if(state.vacantCommercialResults.length) applyVacantCommercialFiltersAndRender(); }));

    els.commercialLocationInput.addEventListener('keydown', e => { if (e.key === 'Enter') runCommercialSearch(); });
    els.commercialSearchBtn.addEventListener('click', runCommercialSearch);
    els.commercialMapSearchBtn?.addEventListener('click', () => openMapSearch('commercial'));
    els.commercialClearBtn.addEventListener('click', clearCommercialSearch);
    els.excludedCommercialOwnersBtn?.addEventListener('click', openExcludedCommercialOwnersModal);
    els.clearExcludedCommercialOwnersBtn?.addEventListener('click', restoreAllExcludedCommercialOwners);
    els.commercialSortBy.addEventListener('change', applyCommercialSortAndRender);
    [els.commercialType, els.commercialMaxValue, els.commercialForSaleFilter].forEach(el => el && el.addEventListener('change', () => {
      if (state.commercialResults.length) { applyCommercialFilters(); applyCommercialSortAndRender(); updateCommercialFilterStatus(); }
    }));

    els.ownerLocationInput.addEventListener('keydown', e => { if (e.key === 'Enter') runOwnerSearch(); });
    els.ownerSearchBtn.addEventListener('click', runOwnerSearch);
    els.ownerMapSearchBtn?.addEventListener('click', () => openMapSearch('owners'));
    els.ownerClearBtn.addEventListener('click', clearOwnerSearch);
    els.ownerSortBy.addEventListener('change', applyOwnerSortAndRender);
    [els.ownerYears, els.ownerOccupancy].forEach(el => el.addEventListener('change', () => {
      if (els.ownerLocationInput.value.trim() && state.ownerResults.length) runOwnerSearch();
    }));
    els.ownerMaxValue.addEventListener('change', () => {
      if (state.ownerResults.length) { applyOwnerFilters(); applyOwnerSortAndRender(); updateOwnerFilterStatus(); }
    });

    els.redditRunChatGPTBtn?.addEventListener('click', openChatGPTRelocationSearch);
    els.redditCopyPromptBtn?.addEventListener('click', copyRelocationPrompt);
    els.redditImportBtn?.addEventListener('click', importRedditResults);
    els.redditImportHideBtn?.addEventListener('click', () => setRedditImportCollapsed(true));
    els.redditImportOpenBtn?.addEventListener('click', () => setRedditImportCollapsed(false));
    els.redditClearBtn?.addEventListener('click', clearRedditPosts);
    els.redditSortBy?.addEventListener('change', applyRedditFiltersAndRender);
    els.redditStatusFilter?.addEventListener('change', applyRedditFiltersAndRender);
    els.redditBatchSelect?.addEventListener('change', () => { refreshRedditPrompt(); renderRedditCoverage(); });
    els.redditFilterInput?.addEventListener('input', applyRedditFiltersAndRender);
    els.redditWorkedPostsBtn?.addEventListener('click', openRedditWorkedPostsModal);
    els.restoreAllRedditWorkedBtn?.addEventListener('click', restoreAllRedditWorkedPosts);
    els.redditDmCopyBtn?.addEventListener('click', copyActiveRedditDm);
    els.redditDmRegenerateBtn?.addEventListener('click', regenerateActiveRedditDm);
    document.querySelectorAll('[data-close-reddit-worked]').forEach(el => el.addEventListener('click', closeRedditWorkedPostsModal));
    document.querySelectorAll('[data-close-reddit-dm]').forEach(el => el.addEventListener('click', closeRedditDmModal));
    document.querySelectorAll('[data-close-drawer]').forEach(el => el.addEventListener('click', closeDrawer));
    document.querySelectorAll('[data-close-excluded-streets]').forEach(el => el.addEventListener('click', closeExcludedStreetsModal));
    document.querySelectorAll('[data-close-excluded-commercial-owners]').forEach(el => el.addEventListener('click', closeExcludedCommercialOwnersModal));
    els.mapSearchCloseBtn?.addEventListener('click', closeMapSearch);
    els.mapSearchStreetBtn?.addEventListener('click', () => setAreaBaseMode('map'));
    els.mapSearchSatelliteBtn?.addEventListener('click', () => setAreaBaseMode('satellite'));
    els.mapSearchUndoBtn?.addEventListener('click', undoMapPoint);
    els.mapSearchClearBtn?.addEventListener('click', clearMapBoundary);
    els.mapSearchRunBtn?.addEventListener('click', runMapAreaSearch);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeExcludedStreetsModal(); closeExcludedCommercialOwnersModal(); closeRedditWorkedPostsModal(); closeRedditDmModal(); closeMapSearch(); } });
    window.addEventListener('focus', syncLeadDataFromStorage);
    window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) syncLeadDataFromStorage(); });
    [els.lotType, els.minAcres, els.maxAcres, els.maxValue, els.excludeBuilt, els.neighborhoodOnly, els.excludeNonBuildable, els.hideGovernment].forEach(el => {
      el.addEventListener('change', () => {
        if (state.allResults.length) { applyClientFilters(); applySortAndRender(); updateFilterStatus(); }
      });
    });
  }

  function updateSearchModeUI() {
    const cfg = { zip:['ZIP Code',''], city:['City','Fort Worth'], county:['County','Tarrant'] }[els.searchMode.value];
    els.locationLabel.textContent = cfg[0];
    els.locationInput.placeholder = cfg[1];
  }

  function updateCommercialSearchModeUI() {
    const cfg = { zip:['ZIP Code',''], city:['City','Fort Worth'], subdivision:['Subdivision','Subdivision name'] }[els.commercialSearchMode.value];
    els.commercialLocationLabel.textContent = cfg[0];
    els.commercialLocationInput.placeholder = cfg[1];
  }

  function updateOwnerSearchModeUI() {
    const cfg = { zip:['ZIP Code',''], city:['City','Fort Worth'], subdivision:['Subdivision','Subdivision name'] }[els.ownerSearchMode.value];
    els.ownerLocationLabel.textContent = cfg[0];
    els.ownerLocationInput.placeholder = cfg[1];
  }

  function currentRedditRegionId(){ return els.redditBatchSelect?.value || RedditEngine.REGIONS[0].id; }
  function loadRedditCoverage(){ try { const x=JSON.parse(localStorage.getItem(REDDIT_COVERAGE_KEY)||'{}');return x && typeof x==='object'&&!Array.isArray(x)?x:{}; }catch{return {};} }
  function persistRedditCoverage(){ if(!window.LeadForgeStorage.setJson(REDDIT_COVERAGE_KEY,state.redditCoverage,'Save Reddit coverage'))throw new Error('Could not save search coverage. Existing information was not intentionally cleared.'); }
  function initRedditCoverageControls(){
    if(!els.redditBatchSelect)return;
    els.redditBatchSelect.replaceChildren(...RedditEngine.REGIONS.map(region=>{
      const opt=document.createElement('option');opt.value=region.id;opt.textContent=region.name;return opt;
    }));
    renderRedditCoverage();
  }
  function renderRedditCoverage(){
    if(!els.redditCoverageGrid)return;
    const rows=RedditEngine.REGIONS.map(region=>{
      const item=state.redditCoverage[region.id]||{};
      const count=state.redditPosts.filter(p=>p.regionId===region.id).length;
      const last=item.lastImportedAt?new Date(item.lastImportedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not imported';
      const searched=item.searchReported?'Search reported by ChatGPT':'Coverage not verified';
      const note=item.limitations?' · Some sources unavailable':'';
      return `<div class="reddit-coverage-item"><strong>${escapeHtml(region.name)}</strong><small>${escapeHtml(last)} · ${escapeHtml(searched)} · ${count} retained${escapeHtml(note)}</small></div>`;
    });
    els.redditCoverageGrid.innerHTML=rows.join('');
  }
  function refreshRedditPrompt(){if(els.redditPromptPreview)els.redditPromptPreview.textContent=buildRelocationPrompt();}

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      return ok;
    }
  }

  async function copyRelocationPrompt() {
    refreshRedditPrompt();
    const ok = await copyTextToClipboard(buildRelocationPrompt());
    setRedditStatus(ok ? 'ChatGPT search prompt copied to your clipboard.' : 'Could not copy automatically. Open the prompt preview and copy it manually.', ok ? 'success' : 'error');
  }

  async function openChatGPTRelocationSearch() {
    const prompt = buildRelocationPrompt();
    const ok = await copyTextToClipboard(prompt);
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
    setRedditStatus(ok
      ? 'ChatGPT opened and the 2-day relocation prompt was copied. Paste it into ChatGPT, then paste the returned JSON into Import Relocation Posts.'
      : 'ChatGPT opened. Copy the prompt from the preview, run it in ChatGPT, then paste the returned JSON below.', 'success');
  }

  function loadRedditPosts() {
    try {
      const arr = JSON.parse(localStorage.getItem(REDDIT_POSTS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function persistRedditPosts() {
    if (!window.LeadForgeStorage.setJson(REDDIT_POSTS_KEY,state.redditPosts,'Save Reddit leads')) throw new Error('Reddit results could not be saved locally. Free storage space before importing more.');
  }


  function loadRedditWorkedPosts() {
    try {
      const arr = JSON.parse(localStorage.getItem(REDDIT_WORKED_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function persistRedditWorkedPosts() {
    if (!window.LeadForgeStorage.setJson(REDDIT_WORKED_KEY,state.redditWorkedPosts,'Save worked Reddit posts')) throw new Error('Worked Reddit posts could not be saved locally.');
  }

  function isRedditWorked(postOrUrl){
    const post=typeof postOrUrl==='string'?{url:postOrUrl}:postOrUrl;
    return state.redditWorkedPosts.some(x=>(post?.id&&post.id===x.id)||RedditEngine.samePost(post,x));
  }

  function parseIsoDateOnly(value) {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2])-1 || d.getDate() !== Number(m[3])) return null;
    return d;
  }

  function formatRedditPostDate(value) {
    const d = parseIsoDateOnly(String(value || '').trim());
    return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '—';
  }

  function extractJsonPayload(text) {
    const original = String(text || '').trim();
    const fenced = original.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const raw = fenced ? fenced[1].trim() : original.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
    try { return JSON.parse(raw); } catch {}
    const starts = [raw.indexOf('{'), raw.indexOf('[')].filter(x => x >= 0).sort((a,b) => a-b);
    if (!starts.length) throw new Error('No JSON found. Copy the JSON code block from ChatGPT.');
    const left = starts[0], right = raw[left] === '{' ? raw.lastIndexOf('}') : raw.lastIndexOf(']');
    if (right <= left) throw new Error('Incomplete JSON. Copy the complete JSON code block.');
    try { return JSON.parse(raw.slice(left, right+1)); }
    catch { throw new Error('Invalid JSON. Copy the complete JSON code block; do not add explanatory text inside it.'); }
  }

  function markRedditWorked(id) {
    const p = state.redditPosts.find(x => x.id === id); if (!p) return;
    const now = new Date().toISOString();
    const current = state.leadData[id] || {};
    state.leadData[id] = {...current, pipelineStage:current.pipelineStage && current.pipelineStage !== 'Unworked' ? current.pipelineStage : 'Contacted', pipelineChangedAt:now, parcel:current.parcel || redditSnapshot(p), updatedAt:now};
    persistLeadData();
    const record = {...p, workedAt:now};
    state.redditWorkedPosts = [record, ...state.redditWorkedPosts.filter(x => x.id !== p.id && !RedditEngine.samePost(x,p))];
    persistRedditWorkedPosts();
    state.redditPosts = state.redditPosts.filter(x => x.id !== p.id);
    persistRedditPosts();
    followUpDashboardDirty=true;
    applyRedditFiltersAndRender();
  }

  function openRedditWorkedPostsModal() {
    renderRedditWorkedPostsList();
    if (!els.redditWorkedPostsModal) return;
    els.redditWorkedPostsModal.classList.add('open');
    els.redditWorkedPostsModal.setAttribute('aria-hidden','false');
  }

  function closeRedditWorkedPostsModal() {
    if (!els.redditWorkedPostsModal) return;
    els.redditWorkedPostsModal.classList.remove('open');
    els.redditWorkedPostsModal.setAttribute('aria-hidden','true');
  }

  function renderRedditWorkedPostsList() {
    if (!els.redditWorkedPostsList) return;
    if (!state.redditWorkedPosts.length) {
      els.redditWorkedPostsList.innerHTML = '<div class="excluded-street-empty">No worked Reddit posts yet.</div>';
      return;
    }
    els.redditWorkedPostsList.innerHTML = state.redditWorkedPosts.map(x => `
      <div class="excluded-street-row">
        <div><div class="excluded-street-name">${escapeHtml(x.title || 'Reddit post')}</div><div class="excluded-street-scope">${escapeHtml([x.subreddit,x.area,formatRedditPostDate(x.postDate)].filter(Boolean).join(' · '))}</div></div>
        <button class="btn btn-outline restore-street-btn reddit-restore-worked" type="button" data-id="${escapeHtml(x.id)}">Restore</button>
      </div>`).join('');
    els.redditWorkedPostsList.querySelectorAll('.reddit-restore-worked').forEach(btn => btn.addEventListener('click', () => restoreRedditWorkedPost(btn.dataset.id)));
  }

  function restoreRedditWorkedPost(id) {
    const worked = state.redditWorkedPosts.find(x => x.id === id);
    state.redditWorkedPosts = state.redditWorkedPosts.filter(x => x.id !== id);
    persistRedditWorkedPosts();
    const restored = normalizeRedditPost(worked);
    if (restored) {
      const byUrl = new Map(state.redditPosts.map(p => [RedditEngine.postKey(p.url), p]));
      byUrl.set(RedditEngine.postKey(restored.url), restored);
      state.redditPosts = [...byUrl.values()];
      const current=state.leadData[restored.id]||{};
      state.leadData[restored.id]={...current,pipelineStage:'Unworked',pipelineChangedAt:new Date().toISOString(),parcel:current.parcel||redditSnapshot(restored),updatedAt:new Date().toISOString()};
      persistLeadData();
      persistRedditPosts();
      followUpDashboardDirty=true;
      applyRedditFiltersAndRender();
    }
    renderRedditWorkedPostsList();
  }

  function restoreAllRedditWorkedPosts() {
    if (!state.redditWorkedPosts.length) return;
    if (!window.confirm('Restore all worked Reddit posts so future imports can show them again?')) return;
    const now=new Date().toISOString();
    for(const worked of state.redditWorkedPosts){const id=String(worked?.id||'');if(!id)continue;const current=state.leadData[id]||{};state.leadData[id]={...current,pipelineStage:'Unworked',pipelineChangedAt:now,updatedAt:now};}
    persistLeadData();
    state.redditWorkedPosts = [];
    persistRedditWorkedPosts();
    followUpDashboardDirty=true;
    renderFollowUpDashboard();
    renderRedditWorkedPostsList();
  }

  function openRedditDm(id) {
    const p = state.redditPosts.find(x => x.id === id); if (!p) return;
    state.activeRedditDmId = id;
    if (els.redditDmPostTitle) els.redditDmPostTitle.textContent = p.title;
    if (els.redditDmText) els.redditDmText.value = generateRedditDm(p);
    if (!els.redditDmModal) return;
    els.redditDmModal.classList.add('open');
    els.redditDmModal.setAttribute('aria-hidden','false');
    setTimeout(() => els.redditDmText?.focus(), 0);
  }

  function closeRedditDmModal() {
    if (!els.redditDmModal) return;
    els.redditDmModal.classList.remove('open');
    els.redditDmModal.setAttribute('aria-hidden','true');
  }

  function regenerateActiveRedditDm() {
    const p = state.redditPosts.find(x => x.id === state.activeRedditDmId); if (!p || !els.redditDmText) return;
    els.redditDmText.value = generateRedditDm(p);
  }

  async function copyActiveRedditDm() {
    const text = els.redditDmText?.value || '';
    if (!text.trim()) return;
    const ok = await copyTextToClipboard(text);
    if (!els.redditDmCopyBtn) return;
    const original = 'Copy DM';
    els.redditDmCopyBtn.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => { if (els.redditDmCopyBtn) els.redditDmCopyBtn.textContent = original; }, 1200);
  }

  function redditSnapshot(p) {
    return {
      leadKind:'DFW Relocation Post', type:'Reddit Relocation Lead', address:p.title, city:p.area, zip:'', county:'DFW',
      owner:p.subreddit, ownerAddress:'', account:p.id, marketValue:0, landValue:0, acres:0, sqft:0,
      redditUrl:p.url, redditTitle:p.title, subreddit:p.subreddit, postDate:p.postDate, ageDays:p.ageDays,
      leadType:p.leadType, snippet:p.snippet, dateVerification:p.verification||RedditEngine.verification(p), opportunityScore:p.opportunityScore, temperature:p.temperature, scoreReason:p.scoreReason, nextBestAction:p.nextBestAction, nextActionReason:p.nextActionReason,
      source:'Reddit', source_id:p.id, source_url:p.url, person_name:'', username:'', post_text:p.snippet, post_date:p.postDate, location:p.area,
      lead_type:p.leadType, intent:p.leadType, timeframe:p.timeline||'unknown', budget:'unknown', score:p.opportunityScore, temperature_label:p.temperature,
      score_reason:p.scoreReason, status:getPipelineStage(p.id), notes:state.leadData[p.id]?.notes||'', created_at:p.importedAt||new Date().toISOString(), updated_at:new Date().toISOString(),
      geometry:null
    };
  }

  function toggleRedditLeadSaved(id) {
    const p = state.redditPosts.find(x => x.id === id); if (!p) return;
    const current = state.leadData[id] || {}, nextSaved = !current.saved;
    state.leadData[id] = {...current, saved:nextSaved, parcel:redditSnapshot(p), updatedAt:new Date().toISOString()};
    persistLeadData(); refreshSavedCounts(); renderRedditTable();
  }

  function clearRedditPosts() {
    if (state.redditPosts.length && !window.confirm('Clear all imported DFW relocation posts from this tab? Saved leads will remain in Saved Leads.')) return;
    state.redditPosts = []; state.redditVisiblePosts = []; persistRedditPosts();
    if (els.redditImportText) els.redditImportText.value = '';
    if (els.redditFilterInput) els.redditFilterInput.value = '';
    renderRedditTable(); if (els.redditStatCount) els.redditStatCount.textContent='0';
    setRedditStatus('Ready. Use ChatGPT to run a fresh 2-day DFW relocation search.', 'success');
  }

  function exportRedditCSV() {
    if (!state.redditVisiblePosts.length) return;
    const headers=['Post Title','Subreddit','DFW Area','Post Date','Date Verification','Age Days','Lead Type','Opportunity Score','Temperature','Why This Score','Next Best Action','Next Action Reason','Summary','Reddit URL','Saved Lead','Contact Status','Priority','Notes'];
    const rows=state.redditVisiblePosts.map(p=>{const lead=state.leadData[p.id]||{};return[p.title,p.subreddit,p.area,p.postDate,p.verification,p.ageDays,p.leadType,p.opportunityScore||0,p.temperature||'',p.scoreReason||'',(getNextBestAction(p,'reddit').action),(getNextBestAction(p,'reddit').reason),p.snippet,p.url,lead.saved?'Yes':'No',lead.status||'Not researched',lead.priority||'Normal',lead.notes||''];});
    const csv=[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`LeadForge_Relocation_Leads_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }


  function opportunityCell(p) {
    let score = Number(p?.opportunityScore || 0);
    score = Math.max(0, Math.min(100, score));
    const temp = p?.temperature || (score >= 80 ? 'Hot' : score >= 55 ? 'Warm' : 'Cold');
    const reason = p?.scoreReason || 'Imported without a detailed scoring explanation.';
    return `<div class="opportunity-score ${temp.toLowerCase()}"><strong>${Math.round(score)}</strong><span>${escapeHtml(temp)}</span></div><div class="action-reason">${escapeHtml(reason)}</div>`;
  }

  function nextBestActionCell(p, kind) {
    const a = getNextBestAction(p, kind);
    const css = String(a.action || '').toLowerCase().replace(/[^a-z]+/g,'-');
    return `<div class="next-action-badge ${css}">${escapeHtml(a.action)}</div><div class="action-reason">${escapeHtml(a.reason)}</div>`;
  }

  function yearsSinceDate(date) {
    if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const now = new Date(); let y = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth(); if (m < 0 || (m === 0 && now.getDate() < date.getDate())) y--;
    return Math.max(0,y);
  }

  function commercialBuildingEvidence(p) {
    const signals = [];
    if (Number(p.structureCount || 0) > 0) signals.push('structure count');
    if (Number(p.livingArea || 0) > 0) signals.push('building square footage');
    if (Number(p.yearBuilt || 0) > 0) signals.push('year built');
    if (cleanText(p.buildingType)) signals.push('building type');
    if (cleanText(p.buildingNumber)) signals.push('building number');
    if (Number(p.improvementValue || 0) > 0) signals.push('improvement value');
    if (p.hasBuildingFootprint) signals.push('building footprint');
    return { count:signals.length, signals, confirmed:p.useCode !== 'C1C' && signals.length >= 2 };
  }

  function vacancySignalsForCommercial(p) {
    let score = 25; const reasons=[];
    const years = yearsSinceDate(p.parsedDeedDate);
    const ratio = p.marketValue > 0 ? p.improvementValue / p.marketValue : 0;
    const building = commercialBuildingEvidence(p);
    reasons.push(`Building confirmed from ${building.count} public-record indicators.`);
    if (ratio > 0 && ratio < .10) { score += 25; reasons.push('Improvement value is very low relative to total market value.'); }
    else if (ratio > 0 && ratio < .25) { score += 15; reasons.push('Improvement value is low relative to total market value.'); }
    if (p.useCode === 'C2C') { score += 10; reasons.push('Commercial-land classification includes recorded improvements.'); }
    if (p.yearBuilt && p.yearBuilt < new Date().getFullYear()-40) { score += 10; reasons.push('The recorded building is more than 40 years old.'); }
    if (years !== null && years >= 15) { score += 12; reasons.push(`Owner has held the property about ${years} years.`); }
    else if (years !== null && years >= 8) { score += 6; reasons.push(`Owner has held the property about ${years} years.`); }
    if (looksInstitutionalCommercialOwner(p.owner)) { score -= 15; reasons.push('Owner appears institutional, reducing prospecting usefulness.'); }
    score = Math.max(0,Math.min(100,Math.round(score)));
    return { score, reason: reasons.slice(0,3).join(' '), yearsOwned:years };
  }

  function rangeMatch(value, spec) {
    if (!spec || spec === 'all') return true;
    const v=Number(value||0);
    if (spec.endsWith('+')) return v >= Number(spec.slice(0,-1));
    const [a,b]=spec.split('-').map(Number); return v>=a && v<=b;
  }

  function normalizeVacantCommercialFeature(feature, sourceName='Public parcel/GIS records') {
    const p=normalizeCommercialFeature(feature); if(!p) return null;
    const building = commercialBuildingEvidence(p);
    if (!building.confirmed) return null;
    const sig=vacancySignalsForCommercial(p);
    return {...p, buildingEvidenceCount:building.count, buildingEvidence:building.signals, vacancyConfidence:sig.score, vacancyReason:sig.reason, yearsOwned:sig.yearsOwned, vacancySource:sourceName, searchKind:'vacant-commercial', leadKind:'Vacant Commercial Building Candidate'};
  }

  async function runVacantCommercialSearch() {
    const params=new URLSearchParams();
    const vals={zip:els.vcZip?.value.trim(),city:els.vcCity?.value.trim(),county:els.vcCounty?.value,neighborhood:els.vcNeighborhood?.value.trim(),radiusCenter:els.vcRadiusCenter?.value.trim(),radius:els.vcRadius?.value,corridor:els.vcCorridor?.value.trim()};
    Object.entries(vals).forEach(([k,v])=>{if(v)params.set(k,v)});
    if(!vals.zip&&!vals.city&&!vals.county&&!vals.neighborhood&&!vals.radiusCenter&&!vals.corridor) return showError('Enter at least one location filter for Vacant Commercial Properties.');
    if(vals.zip && !/^\d{5}$/.test(vals.zip)) return showError('Vacant Commercial ZIP must be 5 digits.');
    if(vals.radiusCenter && !vals.radius) return showError('Choose a radius when using a ZIP/address radius center.');
    setVcStatus('Searching public commercial property records…');
    try{
      const r=await fetch(`/api/vacant-commercial?${params.toString()}`,{cache:'no-store'}); let data; try{data=await r.json();}catch{throw new Error(`local service returned HTTP ${r.status}`)}
      if(!r.ok||data.error)throw new Error(data.error||`local service returned HTTP ${r.status}`);
      const source=data.source||'Public parcel/GIS records';
      state.vacantCommercialResults=(Array.isArray(data.features)?data.features:[]).map(esriFeatureToGeoJson).map(f=>normalizeVacantCommercialFeature(f,source)).filter(Boolean);state.renderLimits['vacant-commercial']=RENDER_BATCH_SIZE;
      hydrateSavedLeadParcels(state.vacantCommercialResults); applyVacantCommercialFiltersAndRender();
      setVcStatus(`Found ${state.vacantCommercialVisibleResults.length.toLocaleString()} improved commercial properties after the building-required gate and stacked filters. Vacancy scores are prospecting signals and require verification. Source: ${source}.`,'success');
    }catch(err){console.error(err);setVcStatus(`Search failed: ${friendlyError(err)}.`,'error');showError(`Search failed: ${friendlyError(err)}.`)}
  }

  function toggleVacantCommercialLeadSaved(id){const p=state.vacantCommercialResults.find(x=>x.id===id);if(!p)return;const current=state.leadData[id]||{},nextSaved=!current.saved;state.leadData[id]={...current,saved:nextSaved,parcel:parcelSnapshot(p),updatedAt:new Date().toISOString()};persistLeadData();refreshSavedCounts();renderVacantCommercialTable()}
  function clearVacantCommercialSearch(){state.vacantCommercialResults=[];state.vacantCommercialVisibleResults=[];['vcZip','vcCity','vcNeighborhood','vcRadiusCenter','vcCorridor'].forEach(k=>{if(els[k])els[k].value=''});['vcCounty','vcRadius','vcType','vcBuildingSize','vcLotSize','vcValueRange','vcOwnerType','vcOwnership','vcLastSale','vcConfidence'].forEach(k=>{if(els[k])els[k].selectedIndex=0});renderVacantCommercialTable();if(els.vcStatCount)els.vcStatCount.textContent='0';setVcStatus('Ready.')}

  function exportVacantCommercialCSV(){if(!state.vacantCommercialVisibleResults.length)return;const headers=['Address','City','ZIP','County','Type','Owner','Vacancy Signal Score (Estimate)','Why This Score','Source','Years Owned','Building SF','Lot Acres','Market Value','Next Best Action','Next Action Reason'];const rows=state.vacantCommercialVisibleResults.map(p=>{const a=getNextBestAction(p,'vacant-commercial');return[p.address,p.city,p.zip,p.county,p.type,p.owner,p.vacancyConfidence,p.vacancyReason,p.vacancySource,p.yearsOwned??'',p.livingArea,p.acres,p.marketValue,a.action,a.reason]});const csv=[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LeadForge_Vacant_Commercial_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

  async function runCommercialSearch() {
    const mode = els.commercialSearchMode.value;
    const location = els.commercialLocationInput.value.trim();
    if (!location) return showError(`Enter a ${els.commercialLocationLabel.textContent.toLowerCase()}.`);
    if (mode === 'zip' && !/^\d{5}$/.test(location)) return showError('Enter a valid 5-digit ZIP code.');

    const timingKey = `commercial:${mode}:${location.toUpperCase()}`;
    const startedAt = performance.now();
    setCommercialLoading(true); closeDrawer();
    startSearchProgress(timingKey, 'commercial');
    try {
      setCommercialStatus('Searching commercial property records…');
      const url = `/api/commercial?mode=${encodeURIComponent(mode)}&location=${encodeURIComponent(location)}`;
      const response = await fetch(url, { cache:'no-store' });
      let data;
      try { data = await response.json(); } catch { throw new Error(`local service returned HTTP ${response.status}`); }
      if (!response.ok || data.error) throw new Error(data.error || `local service returned HTTP ${response.status}`);

      updateSearchProgressImmediate(94, 'Preparing commercial property results…');
      const raw = Array.isArray(data.features) ? data.features : [];
      state.commercialResults = raw.map(esriFeatureToGeoJson).map(normalizeCommercialFeature).filter(Boolean); state.renderLimits.commercial=RENDER_BATCH_SIZE;
      hydrateSavedLeadParcels(state.commercialResults);
      applyCommercialFilters(); applyCommercialSortAndRender();

      const durationMs = performance.now() - startedAt;
      rememberSearchDuration(timingKey, durationMs);
      finishSearchProgress(true, `Complete · ${state.commercialVisibleResults.length.toLocaleString()} results ready`);
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setCommercialStatus(`Found ${state.commercialVisibleResults.length.toLocaleString()} commercial properties. Results come from public property records and are not limited to active listings. Source: ${data.source || 'public parcel data'}.${warnings}`, 'success');
    } catch (err) {
      console.error(err);
      finishSearchProgress(false, 'Search failed');
      setCommercialStatus(`Search failed: ${friendlyError(err)}.`, 'error');
      showError(`Search failed: ${friendlyError(err)}.`);
    } finally { setCommercialLoading(false); }
  }

  function commercialCategoryForCode(code) {
    const c = cleanText(code).toUpperCase();
    if (c === 'F2') return 'Industrial';
    if (c === 'C1C' || c === 'C2C') return 'Commercial Land';
    if (c === 'B' || c === 'BC') return 'Multifamily';
    if (c === 'EC') return 'Commercial';
    return 'Commercial';
  }

  function normalizeCommercialFeature(feature) {
    const p = feature.properties || {};
    const account = String(p.ACCOUNT || p.TAXPIN || p.PIDN || p.OBJECTID || '').trim();
    if (!account) return null;
    const useCode = cleanText(p.STATE_USE_CODE || p.PROPERTY_CLASS_CODE).toUpperCase();
    if (!['C1C','C2C','F1','F2','B','BC','EC'].includes(useCode)) return null;
    const acres = finiteOrNull(p.LAND_ACRE) ?? finiteOrNull(p.CalcAcres) ?? (finiteOrNull(p.LAND_SQFT) !== null ? Number(p.LAND_SQFT) / 43560 : null);
    const address = cleanText(p.SITUS_ADDR || p.STREET_ADDRESS || 'Property address unavailable');
    const deedDate = cleanText(p.DEED_DATE);
    const parsedDeedDate = parseDateLoose(deedDate);
    return {
      id:account, objectId:p.OBJECTID, account, address,
      zip:cleanText(p.Situs_ZipCode), city:resolveDisplayCity(p.DISPLAY_CITY || p.CITYNAME, p.Situs_ZipCode), county:cleanText(p.COUNTYNAME),
      legal:cleanText(p.PARCEL_LEGAL_DESCRIPTION), type:commercialCategoryForCode(useCode), useCode,
      propertyClass:cleanText(p.PROPERTY_CLASS_CODE), acres, sqft:finiteOrNull(p.LAND_SQFT),
      marketValue:Number(finiteOrNull(p.MARKET_VALUE) || 0), landValue:Number(finiteOrNull(p.LAND_VAL) || 0),
      improvementValue:Number(finiteOrNull(p.IMPR_VAL) || 0), structureCount:Number(finiteOrNull(p.STRUCT_CNT) || 0),
      yearBuilt:Number(finiteOrNull(p.YR_BUILT) || 0), livingArea:Number(finiteOrNull(p.LIVING_AREA) || 0),
      buildingType:cleanText(p.BUILDING_TYPE), buildingNumber:cleanText(p.BUILDING_NUM), hasBuildingFootprint:truthy(p.HAS_BUILDING_FOOTPRINT), owner:cleanText(p.OWNER_NAME || 'Owner not listed'),
      ownerAddress:cleanText([p.OWNER_ADDRESS,p.OWNER_CITY_ST,p.OWNER_ZIP_CODE].filter(Boolean).join(', ')),
      deedDate, parsedDeedDate,
      geometry:feature.geometry || null, dataLoadDate:p.Data_Load_Date || null,
      searchKind:'commercial', leadKind:'Commercial Property'
    };
  }

  function applyCommercialFilters() {
    const wanted = els.commercialType.value;
    const maxVal = numOrNull(els.commercialMaxValue.value);
    const saleFilter = els.commercialForSaleFilter?.value || 'all';
    state.commercialVisibleResults = state.commercialResults.filter(p => {
      if (wanted === 'commercial' && p.type !== 'Commercial') return false;
      if (wanted === 'industrial' && p.type !== 'Industrial') return false;
      if (wanted === 'land' && p.type !== 'Commercial Land') return false;
      if (wanted === 'multifamily' && p.type !== 'Multifamily') return false;
      if (maxVal !== null && p.marketValue > maxVal) return false;
      if (isCommercialOwnerExcluded(p.owner)) return false;
      if (looksInstitutionalCommercialOwner(p.owner)) return false;
      if (saleFilter !== 'all') {
        const sale = normalizeForSaleStatus((state.leadData[p.id] || {}).forSale);
        if (sale !== saleFilter) return false;
      }
      return true;
    });
  }

  function openCommercialDetails(id) {
    const p = state.commercialResults.find(x => x.id === id); if (!p) return;
    state.commercialSelectedId = id;
    markSelectedRow(els.commercialResultsBody, id);
    destroyDetailMap();
    const node = els.commercialDetailTemplate.content.cloneNode(true), lead = state.leadData[id] || {};
    els.detailAddress.textContent = p.address;
    if (els.detailEyebrow) els.detailEyebrow.textContent = 'COMMERCIAL PROPERTY DETAILS';

    const person = parseIndividualOwner(p.owner);
    node.querySelector('#cOwner').textContent = person ? person.display : (p.owner || '—');
    node.querySelector('#cOwnerAddress').textContent = p.ownerAddress || '—';
    const fps = node.querySelector('#commercialFastPeopleSearchBtn');
    if (person?.firstName && person?.lastName) fps.href = buildFastPeopleSearchUrl(person, p.ownerAddress); else fps.hidden = true;
    node.querySelector('#cAccount').textContent = p.account || '—';
    node.querySelector('#cType').textContent = p.type || 'Commercial';
    node.querySelector('#cMarket').textContent = money(p.marketValue);
    node.querySelector('#cForSale').textContent = normalizeForSaleStatus(lead.forSale);
    node.querySelector('#cLastSold').textContent = formatDateDisplay(p.parsedDeedDate, p.deedDate);
    node.querySelector('#cLandValue').textContent = money(p.landValue);
    node.querySelector('#cBuildingArea').textContent = p.livingArea ? `${Math.round(p.livingArea).toLocaleString()} sf` : '—';
    node.querySelector('#cYearBuilt').textContent = p.yearBuilt || '—';
    node.querySelector('#cSize').textContent = formatSize(p);
    node.querySelector('#cUseCode').textContent = p.useCode || p.propertyClass || '—';
    node.querySelector('#cLegal').textContent = p.legal || '—';

    const excludeOwnerBtn = node.querySelector('#commercialDetailExcludeOwner');
    excludeOwnerBtn?.addEventListener('click', () => { if (excludeCommercialOwner(p)) closeDrawer(); });

    const saveBtn = node.querySelector('#commercialDetailSaveLead');
    saveBtn.textContent = lead.saved ? 'Saved Lead ✓' : 'Save Lead';
    saveBtn.addEventListener('click', () => { toggleCommercialLeadSaved(id); saveBtn.textContent=(state.leadData[id]||{}).saved?'Saved Lead ✓':'Save Lead'; });
    const tad = node.querySelector('#commercialDetailTadLink');
    if ((p.county||'').toUpperCase().includes('TARRANT') && p.account) tad.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`; else tad.style.display='none';
    const fullAddress=[p.address,p.city,'TX',p.zip].filter(Boolean).join(', ');
    node.querySelector('#commercialDetailGoogleLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    node.querySelector('#commercialListingSearchLink').href=`https://www.google.com/search?q=${encodeURIComponent(`"${fullAddress}" commercial property for sale`)}`;

    node.querySelector('#commercialLeadEmail').value=lead.email||'';
    node.querySelector('#commercialForSale').value=normalizeForSaleStatus(lead.forSale);
    node.querySelector('#commercialLeadStatus').value=lead.status||'Not researched';
    node.querySelector('#commercialLeadPriority').value=lead.priority||'Normal';
    node.querySelector('#commercialLeadNotes').value=lead.notes||'';
    node.querySelector('#saveCommercialContactBtn').addEventListener('click', () => {
      saveLeadRecord(id,{
        email:els.detailContent.querySelector('#commercialLeadEmail').value.trim(),
        forSale:els.detailContent.querySelector('#commercialForSale').value,
        status:els.detailContent.querySelector('#commercialLeadStatus').value,
        priority:els.detailContent.querySelector('#commercialLeadPriority').value,
        notes:els.detailContent.querySelector('#commercialLeadNotes').value.trim()
      },p);
      refreshSavedCounts(); updateCommercialRow(id); saveBtn.textContent='Saved Lead ✓';
      if (state.commercialResults.length) { applyCommercialFilters(); applyCommercialSortAndRender(); }
      const msg=els.detailContent.querySelector('#commercialSaveConfirmation'); msg.textContent='Saved locally.'; setTimeout(()=>{if(msg)msg.textContent='';},1800);
    });

    els.detailContent.replaceChildren(node);
    els.detailDrawer.classList.add('open'); els.detailDrawer.setAttribute('aria-hidden','false');
    setTimeout(() => renderDetailMap(p), 0);
  }

  function toggleCommercialLeadSaved(id) {
    const p=state.commercialResults.find(x=>x.id===id); if(!p) return;
    const current=state.leadData[id]||{}; const nextSaved=!current.saved;
    state.leadData[id]={...current,saved:nextSaved,parcel:parcelSnapshot(p),updatedAt:new Date().toISOString()};
    persistLeadData(); refreshSavedCounts(); updateCommercialRow(id);
  }

  function updateCommercialRow(id) {
    const row=els.commercialResultsBody.querySelector(`tr[data-id="${cssEscape(id)}"]`);
    const p=state.commercialResults.find(x=>x.id===id); if(!row||!p) return;
    const lead=state.leadData[id]||{};
    const star=row.querySelector('.star-btn'); if(star){star.classList.toggle('saved',Boolean(lead.saved));star.title=lead.saved?'Remove saved lead':'Save lead';}
    const sale=row.querySelector('.sale-badge'); if(sale){const value=normalizeForSaleStatus(lead.forSale);sale.textContent=value;sale.classList.toggle('yes',value==='Yes');sale.classList.toggle('no',value==='No');sale.classList.toggle('unknown',value==='Unknown');}
    const status=row.querySelector('.status-badge'); if(status){status.textContent=lead.status||'Not researched';status.classList.toggle('hot',lead.priority==='Hot');}
  }

  function updateCommercialFilterStatus() {
    if (!state.commercialResults.length) return;
    setCommercialStatus(`Showing ${state.commercialVisibleResults.length.toLocaleString()} commercial properties with the current filters.`, 'success');
  }

  function clearCommercialSearch() {
    state.commercialResults=[]; state.commercialVisibleResults=[]; state.commercialSelectedId=null;
    els.commercialLocationInput.value=''; els.commercialMaxValue.value=''; if(els.commercialForSaleFilter) els.commercialForSaleFilter.value='all'; closeDrawer(); renderCommercialTable();
    if (els.commercialStatCount) els.commercialStatCount.textContent='0';
    setCommercialStatus('Ready.'); if (state.activeWorkspace === 'commercial') els.exportBtn.disabled = true;
  }

  async function runOwnerSearch() {
    const mode = els.ownerSearchMode.value;
    const location = els.ownerLocationInput.value.trim();
    const years = Number(els.ownerYears.value || 5);
    if (!location) return showError(`Enter a ${els.ownerLocationLabel.textContent.toLowerCase()}.`);
    if (mode === 'zip' && !/^\d{5}$/.test(location)) return showError('Enter a valid 5-digit ZIP code.');

    const timingKey = `owners:${mode}:${location.toUpperCase()}:${years}`;
    const startedAt = performance.now();
    setOwnerLoading(true); closeDrawer();
    startSearchProgress(timingKey, 'owners');
    try {
      setOwnerStatus('Searching residential ownership records…');
      const url = `/api/owners?mode=${encodeURIComponent(mode)}&location=${encodeURIComponent(location)}&years=${encodeURIComponent(years)}&occupancy=${encodeURIComponent(els.ownerOccupancy.value)}`;
      const response = await fetch(url, { cache:'no-store' });
      let data;
      try { data = await response.json(); } catch { throw new Error(`local service returned HTTP ${response.status}`); }
      if (!response.ok || data.error) throw new Error(data.error || `local service returned HTTP ${response.status}`);

      updateSearchProgressImmediate(94, 'Preparing verified long-term owner results…');
      const raw = Array.isArray(data.features) ? data.features : [];
      state.ownerResults = raw.map(esriFeatureToGeoJson).map(normalizeOwnerFeature).filter(Boolean); state.renderLimits.owners=RENDER_BATCH_SIZE;
      hydrateSavedLeadParcels(state.ownerResults);
      applyOwnerFilters(); applyOwnerSortAndRender();

      const durationMs = performance.now() - startedAt;
      rememberSearchDuration(timingKey, durationMs);
      finishSearchProgress(true, `Complete · ${state.ownerVisibleResults.length.toLocaleString()} results ready`);
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setOwnerStatus(`Found ${state.ownerVisibleResults.length.toLocaleString()} residential owners with verified deed dates matching the current filters. Source: ${data.source || 'public parcel data'}.${warnings}`, 'success');
    } catch (err) {
      console.error(err);
      finishSearchProgress(false, 'Search failed');
      setOwnerStatus(`Search failed: ${friendlyError(err)}.`, 'error');
      showError(`Search failed: ${friendlyError(err)}.`);
    } finally { setOwnerLoading(false); }
  }

  function normalizeOwnerFeature(feature) {
    const p = feature.properties || {};
    const account = String(p.ACCOUNT || p.TAXPIN || p.PIDN || p.OBJECTID || '').trim();
    if (!account) return null;
    const acres = finiteOrNull(p.LAND_ACRE) ?? finiteOrNull(p.CalcAcres) ?? (finiteOrNull(p.LAND_SQFT) !== null ? Number(p.LAND_SQFT) / 43560 : null);
    const deedDate = cleanText(p.DEED_DATE);
    const parsedDeedDate = parseDateLoose(deedDate);
    if (!parsedDeedDate) return null;
    const yearsOwned = Number.isFinite(Number(p.OWNERSHIP_YEARS)) ? Number(p.OWNERSHIP_YEARS) : fullYearsSince(parsedDeedDate);
    const address = cleanText(p.SITUS_ADDR || p.STREET_ADDRESS || 'Property address unavailable');
    const owner = cleanText(p.OWNER_NAME || 'Owner not listed');
    const ownerAddress = cleanText([p.OWNER_ADDRESS,p.OWNER_CITY_ST,p.OWNER_ZIP_CODE].filter(Boolean).join(', '));
    const ownerOccupied = truthy(p.LIKELY_OWNER_OCCUPIED) || addressesLikelyMatch(address, cleanText(p.Situs_ZipCode), p.OWNER_ADDRESS, p.OWNER_ZIP_CODE);
    return {
      id:account, objectId:p.OBJECTID, account, address,
      zip:cleanText(p.Situs_ZipCode), city:resolveDisplayCity(p.DISPLAY_CITY || p.CITYNAME, p.Situs_ZipCode), county:cleanText(p.COUNTYNAME),
      legal:cleanText(p.PARCEL_LEGAL_DESCRIPTION), type:'Residential', useCode:cleanText(p.STATE_USE_CODE || p.PROPERTY_CLASS_CODE),
      propertyClass:cleanText(p.PROPERTY_CLASS_CODE), acres, sqft:finiteOrNull(p.LAND_SQFT),
      marketValue:Number(finiteOrNull(p.MARKET_VALUE) || 0), landValue:Number(finiteOrNull(p.LAND_VAL) || 0),
      improvementValue:Number(finiteOrNull(p.IMPR_VAL) || 0), structureCount:Number(finiteOrNull(p.STRUCT_CNT) || 0),
      yearBuilt:Number(finiteOrNull(p.YR_BUILT) || 0), livingArea:Number(finiteOrNull(p.LIVING_AREA) || 0),
      bedrooms:Number(finiteOrNull(p.BEDROOM_CNT) || 0), bathrooms:Number(finiteOrNull(p.BATHROOM_CNT) || 0),
      owner, ownerAddress, deedDate, parsedDeedDate, yearsOwned, ownerOccupied,
      geometry:feature.geometry || null, dataLoadDate:p.Data_Load_Date || null,
      searchKind:'owner', leadKind:'Long-Term Owner'
    };
  }

  function applyOwnerFilters() {
    const minYears = Number(els.ownerYears.value || 5);
    const maxVal = numOrNull(els.ownerMaxValue.value);
    state.ownerVisibleResults = state.ownerResults.filter(p => {
      if (!Number.isFinite(p.yearsOwned) || p.yearsOwned < minYears) return false;
      if (els.ownerOccupancy.value === 'owner' && !p.ownerOccupied) return false;
      if (maxVal !== null && p.marketValue > maxVal) return false;
      if (looksGovernmentOwned(p.owner) || looksBuilderOwned(p.owner) || looksHoaOwned(p.owner) || looksCorporateOwner(p.owner)) return false;
      return true;
    });
  }

  function openOwnerDetails(id) {
    const p = state.ownerResults.find(x => x.id === id); if (!p) return;
    state.ownerSelectedId = id; markSelectedRow(els.ownerResultsBody, id); destroyDetailMap();
    const node = els.ownerDetailTemplate.content.cloneNode(true), lead = state.leadData[id] || {};
    els.detailAddress.textContent = p.address;
    if (els.detailEyebrow) els.detailEyebrow.textContent = 'LONG-TERM OWNER DETAILS';

    const person = parseIndividualOwner(p.owner);
    node.querySelector('#oOwner').textContent = person ? person.display : (p.owner || '—');
    node.querySelector('#oOwnerAddress').textContent = p.ownerAddress || '—';
    const fps = node.querySelector('#ownerFastPeopleSearchBtn');
    if (person?.firstName && person?.lastName) fps.href = buildFastPeopleSearchUrl(person, p.ownerAddress); else fps.hidden = true;
    node.querySelector('#oYearsOwned').textContent = `${p.yearsOwned} years`;
    node.querySelector('#oDeedDate').textContent = formatDateDisplay(p.parsedDeedDate, p.deedDate);
    node.querySelector('#oOwnerOccupied').textContent = p.ownerOccupied ? 'Likely — mailing address matches property' : 'Not indicated by mailing address';
    node.querySelector('#oAccount').textContent = p.account || '—';
    node.querySelector('#oMarket').textContent = money(p.marketValue);
    node.querySelector('#oLivingArea').textContent = p.livingArea ? `${Math.round(p.livingArea).toLocaleString()} sf` : '—';
    node.querySelector('#oYearBuilt').textContent = p.yearBuilt || '—';
    node.querySelector('#oUseCode').textContent = p.useCode || p.propertyClass || '—';
    node.querySelector('#oSize').textContent = formatSize(p);
    node.querySelector('#oLegal').textContent = p.legal || '—';

    const saveBtn = node.querySelector('#ownerDetailSaveLead');
    saveBtn.textContent = lead.saved ? 'Saved Lead ✓' : 'Save Lead';
    saveBtn.addEventListener('click', () => { toggleOwnerLeadSaved(id); saveBtn.textContent=(state.leadData[id]||{}).saved?'Saved Lead ✓':'Save Lead'; });
    const tad = node.querySelector('#ownerDetailTadLink');
    if ((p.county||'').toUpperCase().includes('TARRANT') && p.account) tad.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`; else tad.style.display='none';
    node.querySelector('#ownerDetailGoogleLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.address,p.city,'TX',p.zip].filter(Boolean).join(', '))}`;

    node.querySelector('#ownerLeadEmail').value=lead.email||'';
    node.querySelector('#ownerLeadStatus').value=lead.status||'Not researched';
    node.querySelector('#ownerLeadPriority').value=lead.priority||'Normal';
    node.querySelector('#ownerLeadNotes').value=lead.notes||'';
    node.querySelector('#saveOwnerContactBtn').addEventListener('click', () => {
      saveLeadRecord(id,{
        email:els.detailContent.querySelector('#ownerLeadEmail').value.trim(),
        status:els.detailContent.querySelector('#ownerLeadStatus').value,
        priority:els.detailContent.querySelector('#ownerLeadPriority').value,
        notes:els.detailContent.querySelector('#ownerLeadNotes').value.trim()
      },p);
      refreshSavedCounts(); updateOwnerRow(id); saveBtn.textContent='Saved Lead ✓';
      const msg=els.detailContent.querySelector('#ownerSaveConfirmation'); msg.textContent='Saved locally.'; setTimeout(()=>{if(msg)msg.textContent='';},1800);
    });

    els.detailContent.replaceChildren(node);
    els.detailDrawer.classList.add('open'); els.detailDrawer.setAttribute('aria-hidden','false');
    setTimeout(() => renderDetailMap(p), 0);
  }

  function toggleOwnerLeadSaved(id) {
    const p=state.ownerResults.find(x=>x.id===id); if(!p) return;
    const current=state.leadData[id]||{}; const nextSaved=!current.saved;
    state.leadData[id]={...current,saved:nextSaved,parcel:parcelSnapshot(p),updatedAt:new Date().toISOString()};
    persistLeadData(); refreshSavedCounts(); updateOwnerRow(id);
  }

  function updateOwnerFilterStatus() {
    if (!state.ownerResults.length) return;
    setOwnerStatus(`Showing ${state.ownerVisibleResults.length.toLocaleString()} long-term residential owners with the current filters.`, 'success');
  }

  function clearOwnerSearch() {
    state.ownerResults=[]; state.ownerVisibleResults=[]; state.ownerSelectedId=null;
    els.ownerLocationInput.value=''; els.ownerMaxValue.value=''; closeDrawer(); renderOwnerTable();
    if (els.ownerStatCount) els.ownerStatCount.textContent='0';
    setOwnerStatus('Ready.'); els.exportBtn.disabled = state.activeWorkspace === 'owners';
  }

  function parseDateLoose(value) {
    const s = cleanText(value); if (!s) return null;
    let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) { const d=new Date(Number(m[3]),Number(m[1])-1,Number(m[2])); return Number.isNaN(d.getTime())?null:d; }
    m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) { const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); return Number.isNaN(d.getTime())?null:d; }
    const d=new Date(s); return Number.isNaN(d.getTime())?null:d;
  }

  function fullYearsSince(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
    const now=new Date(); let years=now.getFullYear()-date.getFullYear();
    const anniversary=new Date(now.getFullYear(),date.getMonth(),date.getDate());
    if (now < anniversary) years--;
    return Math.max(0,years);
  }

  function formatDateDisplay(date, raw='') {
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
    return raw || '—';
  }

  function normalizeAddressForMatch(v) {
    return cleanText(v).toUpperCase().replace(/\b(STREET)\b/g,'ST').replace(/\b(DRIVE)\b/g,'DR').replace(/\b(ROAD)\b/g,'RD')
      .replace(/\b(AVENUE)\b/g,'AVE').replace(/\b(BOULEVARD)\b/g,'BLVD').replace(/\b(LANE)\b/g,'LN').replace(/\b(COURT)\b/g,'CT')
      .replace(/\b(TRAIL)\b/g,'TRL').replace(/\b(PARKWAY)\b/g,'PKWY').replace(/\b(PLACE)\b/g,'PL').replace(/[^A-Z0-9]/g,'');
  }

  function addressesLikelyMatch(situsAddress, situsZip, ownerStreet, ownerZip) {
    const a=normalizeAddressForMatch(situsAddress), b=normalizeAddressForMatch(ownerStreet);
    if (!a || !b || a!==b) return false;
    const sz=cleanText(situsZip).slice(0,5), oz=cleanText(ownerZip).slice(0,5);
    return !sz || !oz || sz===oz;
  }

  async function runSearch() {
    const input = els.locationInput.value.trim();
    if (!input) return showError(`Enter a ${els.locationLabel.textContent.toLowerCase()}.`);
    if (els.searchMode.value === 'zip' && !/^\d{5}$/.test(input)) return showError('Enter a valid 5-digit ZIP code.');

    const timingKey = `${els.searchMode.value}:${input.toUpperCase()}`;
    const startedAt = performance.now();
    setLoading(true); closeDrawer();
    startSearchProgress(timingKey, 'vacant');
    try {
      setStatus('Searching public parcel records…');
      const url = `/api/search?mode=${encodeURIComponent(els.searchMode.value)}&location=${encodeURIComponent(input)}`;
      const response = await fetch(url, { cache: 'no-store' });
      let data;
      try { data = await response.json(); } catch { throw new Error(`local service returned HTTP ${response.status}`); }
      if (!response.ok || data.error) throw new Error(data.error || `local service returned HTTP ${response.status}`);

      updateSearchProgressImmediate(94, 'Scrubbing builders, stale build-out streets and unsuitable parcels…');
      const raw = Array.isArray(data.features) ? data.features : [];
      state.allResults = raw.map(esriFeatureToGeoJson).map(normalizeFeature).filter(Boolean); state.renderLimits.vacant=RENDER_BATCH_SIZE;
      hydrateSavedLeadParcels(state.allResults);
      applyPortfolioSignals(state.allResults);
      applyBuildoutStreetSignals(state.allResults);
      applyClientFilters(); applySortAndRender();

      const durationMs = performance.now() - startedAt;
      rememberSearchDuration(timingKey, durationMs);
      finishSearchProgress(true, `Complete · ${state.filteredResults.length.toLocaleString()} results ready`);

      const removed = Math.max(0, state.allResults.length - state.filteredResults.length);
      const builders = state.allResults.filter(x => x.builderOwned).length;
      const buildout = state.allResults.filter(x => x.staleBuildoutCluster).length;
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? ` ${data.warnings.join(' ')}` : '';
      setStatus(`Loaded ${state.allResults.length.toLocaleString()} vacant-code parcels. Showing ${state.filteredResults.length.toLocaleString()} after removing ${removed.toLocaleString()} built, unsuitable, weak, builder-owned or likely stale build-out parcels${builders ? ` (${builders.toLocaleString()} builder/developer-owned)` : ''}${buildout ? ` (${buildout.toLocaleString()} stale build-out cluster)` : ''}. Source: ${data.source || 'public parcel data'}.${warnings}`, 'success');
    } catch (err) {
      console.error(err);
      finishSearchProgress(false, 'Search failed');
      setStatus(`Search failed: ${friendlyError(err)}.`, 'error');
      showError(`Search failed: ${friendlyError(err)}.`);
    } finally { setLoading(false); }
  }

  function esriFeatureToGeoJson(feature) {
    if (feature?.type === 'Feature') return feature;
    const g = feature?.geometry || null;
    let geometry = null;
    if (g && Array.isArray(g.rings)) geometry = { type:'Polygon', coordinates:g.rings };
    else if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) geometry = { type:'Point', coordinates:[g.x,g.y] };
    return { type:'Feature', properties:feature?.attributes || feature?.properties || {}, geometry };
  }

  function normalizeFeature(feature) {
    const p = feature.properties || {};
    const account = String(p.ACCOUNT || p.TAXPIN || p.PIDN || p.OBJECTID || '').trim();
    if (!account) return null;

    const stateUse = cleanText(p.STATE_USE_CODE).toUpperCase();
    const propertyClass = cleanText(p.PROPERTY_CLASS_CODE).toUpperCase();
    const codes = [stateUse, propertyClass].filter(Boolean);
    const isCommercialVacant = codes.some(c => /^C1C(?:\b|\s|-)/.test(c));
    const isResidentialVacant = codes.some(c => /^C1(?:\b|\s|-)/.test(c) && !/^C1C/.test(c));
    const isResidentialInventory = codes.some(c => /^O1?(?:\b|\s|-)/.test(c));
    const type = isCommercialVacant ? 'Commercial' : (isResidentialVacant || isResidentialInventory) ? 'Residential' : 'Other';

    const acres = finiteOrNull(p.LAND_ACRE) ?? finiteOrNull(p.CalcAcres) ?? (finiteOrNull(p.LAND_SQFT) !== null ? Number(p.LAND_SQFT) / 43560 : null);
    const address = cleanText(p.SITUS_ADDR || p.STREET_ADDRESS || p.LOTTRACT_ADDRESS || 'Unaddressed parcel');
    const deedDate = cleanText(p.DEED_DATE);
    const parsedDeedDate = parseDateLoose(deedDate);
    const structureCount = Number(finiteOrNull(p.STRUCT_CNT) || 0);
    const improvementValue = Number(finiteOrNull(p.IMPR_VAL) || 0);
    const lotTractImprovement = Number(finiteOrNull(p.LOTTRACT_IMPRVALUE) || 0);
    const yearBuilt = Number(finiteOrNull(p.YR_BUILT) || 0);
    const livingArea = Number(finiteOrNull(p.LIVING_AREA) || 0);
    const bedrooms = Number(finiteOrNull(p.BEDROOM_CNT) || 0);
    const bathrooms = Number(finiteOrNull(p.BATHROOM_CNT) || 0);
    const buildingType = cleanText(p.BUILDING_TYPE);
    const hasBuildingFootprint = truthy(p.HAS_BUILDING_FOOTPRINT);

    const item = {
      id: account, objectId:p.OBJECTID, account, address,
      zip:cleanText(p.Situs_ZipCode), city:resolveDisplayCity(p.DISPLAY_CITY || p.CITYNAME, p.Situs_ZipCode), county:cleanText(p.COUNTYNAME),
      legal:cleanText(p.PARCEL_LEGAL_DESCRIPTION), type, useCode:cleanText(p.STATE_USE_CODE || p.PROPERTY_CLASS_CODE),
      propertyClass:cleanText(p.PROPERTY_CLASS_CODE), acres, sqft:finiteOrNull(p.LAND_SQFT),
      marketValue:Number(finiteOrNull(p.MARKET_VALUE) || 0), landValue:Number(finiteOrNull(p.LAND_VAL) || 0),
      appraisedValue:Number(finiteOrNull(p.APPRAISED_VALUE) || 0), improvementValue, lotTractImprovement, structureCount,
      yearBuilt, livingArea, bedrooms, bathrooms, buildingType, hasBuildingFootprint,
      agDeferral:cleanText(p.AG_DEFERRAL_CODE), agAcres:Number(finiteOrNull(p.AG_ACRE) || 0), exemption:cleanText(p.EXEMPTION_CODE),
      owner:cleanText(p.OWNER_NAME || 'Owner not listed'),
      ownerAddress:cleanText([p.OWNER_ADDRESS,p.OWNER_CITY_ST,p.OWNER_ZIP_CODE].filter(Boolean).join(', ')),
      subdivision:cleanText(p.SUBDIVISION), block:cleanText(p.BLOCK), lot:cleanText(p.LOT), lotSubtype:Number(finiteOrNull(p.LOT_SUBTYPE) || 0),
      deedDate, parsedDeedDate,
      geometry:feature.geometry || null, dataLoadDate:p.Data_Load_Date || null
    };

    item.builtEvidence = Boolean(
      item.hasBuildingFootprint || item.structureCount > 0 || item.improvementValue > 0 || item.lotTractImprovement > 0 ||
      item.yearBuilt > 0 || item.livingArea > 0 || item.bedrooms > 0 || item.bathrooms > 0 || item.buildingType
    );
    item.shape = geometryShapeSignals(item.geometry);
    Object.assign(item, screenCandidate(item));
    return item;
  }

  function screenCandidate(p) {
    const positive = [], concerns = [];
    let score = 0;
    const numberedAddress = /^\d+[A-Z-]?\s+/i.test(p.address || '');
    const hasRecordedLot = Boolean(p.subdivision || p.block || p.lot || p.lotSubtype === 1);
    const text = `${p.legal} ${p.subdivision} ${p.owner}`.toUpperCase();
    const commonArea = /\b(DRAINAGE|DETENTION|RETENTION|OPEN SPACE|COMMON AREA|COMMON ELEMENT|GREENBELT|GREEN BELT|RIGHT OF WAY|R\/O\/W|UTILITY EASEMENT|ACCESS EASEMENT|BUFFER LOT|FLOODWAY|CHANNEL|RESERVE TRACT|NON[- ]?BUILDABLE)\b/.test(text);
    const hoaOwned = looksHoaOwned(p.owner);
    const govOwned = looksGovernmentOwned(p.owner);
    const builderOwned = looksBuilderOwned(p.owner);
    const tiny = p.acres > 0 && p.acres < 0.04;
    const extremeSliver = Number.isFinite(p.shape.aspectRatio) && p.shape.aspectRatio > 22;
    const largeForNeighborhood = p.acres > 10;

    if (p.builtEvidence) concerns.push('Building evidence found in appraisal/building-footprint data.');
    else { positive.push('No building evidence found in the available parcel/building-footprint fields.'); score += 3; }

    if (p.type === 'Residential') { positive.push('TAD use code is residential vacant land/inventory.'); score += 2; }
    if (numberedAddress) { positive.push('Parcel has a numbered street address.'); score += 2; }
    else concerns.push('No numbered situs address is recorded.');

    if (p.subdivision) { positive.push(`Recorded subdivision: ${p.subdivision}.`); score += 2; }
    if (hasRecordedLot) { positive.push('Matched to a recorded lot/tract record.'); score += 2; }
    else concerns.push('No lot/subdivision enrichment match was found.');

    if (p.acres >= 0.06 && p.acres <= 3) { positive.push('Parcel size is typical of many residential lots.'); score += 2; }
    else if (p.acres > 3 && p.acres <= 10) { positive.push('Parcel is larger acreage but still potentially residential.'); score += 1; }
    if (tiny) concerns.push('Parcel is extremely small.');
    if (largeForNeighborhood) concerns.push('Parcel is unusually large for a neighborhood lot.');
    if (extremeSliver) concerns.push('Parcel geometry appears extremely narrow/irregular.');
    if (commonArea) concerns.push('Legal/subdivision text looks like common, drainage, utility or reserved land.');
    if (hoaOwned) concerns.push('Owner name appears to be an HOA/property-owners association.');
    if (govOwned) concerns.push('Owner name appears governmental/public.');
    if (builderOwned) concerns.push('Owner appears to be a home builder/developer.');

    const nonBuildableLooking = commonArea || hoaOwned || tiny || extremeSliver;
    let quality = 'Review';
    if (p.builtEvidence || nonBuildableLooking || govOwned || builderOwned) quality = 'Exclude';
    else if (p.type === 'Residential' && score >= 9) quality = 'Strong';
    else if (p.type === 'Residential' && score >= 6) quality = 'Likely';
    else if (p.type === 'Commercial' && numberedAddress && p.acres >= 0.08) quality = 'Strong';
    else if (p.type === 'Commercial') quality = 'Likely';

    return { candidateScore:score, candidateQuality:quality, positiveReasons:positive, concernReasons:concerns, nonBuildableLooking, governmentOwned:govOwned, hoaOwned, builderOwned, numberedAddress, hasRecordedLot };
  }

  function geometryShapeSignals(geometry) {
    const coords = [];
    collectCoords(geometry?.coordinates, coords);
    if (!coords.length) return { aspectRatio:null };
    const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const midLat=(minY+maxY)/2*Math.PI/180;
    const width=Math.abs(maxX-minX)*Math.max(0.2,Math.cos(midLat));
    const height=Math.abs(maxY-minY);
    const small=Math.max(Math.min(width,height),1e-9), large=Math.max(width,height);
    return { aspectRatio:large/small };
  }

  function collectCoords(value, out) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) { out.push([Number(value[0]),Number(value[1])]); return; }
    value.forEach(v => collectCoords(v,out));
  }

  function applyClientFilters() {
    let items = state.allResults.filter(p => {
      if (els.lotType.value === 'residential' && p.type !== 'Residential') return false;
      if (els.lotType.value === 'commercial' && p.type !== 'Commercial') return false;
      if (els.lotType.value === 'both' && !['Residential','Commercial'].includes(p.type)) return false;
      if (els.excludeBuilt.checked && p.builtEvidence) return false;
      if (els.neighborhoodOnly.checked && p.type === 'Residential' && !['Strong','Likely'].includes(p.candidateQuality)) return false;
      if (els.excludeNonBuildable.checked && p.nonBuildableLooking) return false;
      if (els.hideGovernment.checked && p.governmentOwned) return false;
      if (p.builderOwned) return false;
      if (p.staleBuildoutCluster) return false;
      if (isStreetExcluded(p)) return false;
      const min=numOrNull(els.minAcres.value), max=numOrNull(els.maxAcres.value), maxVal=numOrNull(els.maxValue.value);
      if (min !== null && p.acres < min) return false;
      if (max !== null && p.acres > max) return false;
      if (maxVal !== null && p.marketValue > maxVal) return false;
      return true;
    });
    state.filteredResults = items;
  }

  function renderStats() {
    if (els.statCount) els.statCount.textContent = state.visibleResults.length.toLocaleString();
  }

  function openDetails(id) {
    const p = state.allResults.find(x => x.id === id); if (!p) return;
    state.selectedId = id; markSelectedRow(els.resultsBody, id); destroyDetailMap();
    const node = els.detailTemplate.content.cloneNode(true), lead = state.leadData[id] || {};
    els.detailAddress.textContent = p.address;
    if (els.detailEyebrow) els.detailEyebrow.textContent = 'PARCEL / LEAD DETAILS';

    node.querySelector('#dAccount').textContent = p.account || '—';
    node.querySelector('#dType').textContent = p.type;
    node.querySelector('#dLastSold').textContent = formatDateDisplay(p.parsedDeedDate, p.deedDate);
    node.querySelector('#dSize').textContent = formatSize(p);
    node.querySelector('#dMarket').textContent = money(p.marketValue);
    node.querySelector('#dLandValue').textContent = money(p.landValue);
    node.querySelector('#dUseCode').textContent = p.useCode || p.propertyClass || '—';
    node.querySelector('#dSubdivision').textContent = p.subdivision || '—';
    node.querySelector('#dBlockLot').textContent = [p.block && `Block ${p.block}`, p.lot && `Lot ${p.lot}`].filter(Boolean).join(' · ') || '—';
    node.querySelector('#dLegal').textContent = p.legal || '—';
    const ownerPerson = parseIndividualOwner(p.owner);
    node.querySelector('#dOwner').textContent = ownerPerson ? ownerPerson.display : (p.owner || '—');
    node.querySelector('#dOwnerAddress').textContent = p.ownerAddress || '—';
    const fastPeopleBtn = node.querySelector('#fastPeopleSearchBtn');
    if (ownerPerson && ownerPerson.firstName && ownerPerson.lastName) {
      fastPeopleBtn.href = buildFastPeopleSearchUrl(ownerPerson, p.ownerAddress);
      fastPeopleBtn.setAttribute('aria-label', `Search FastPeopleSearch for ${ownerPerson.display}`);
    } else {
      fastPeopleBtn.hidden = true;
    }

    const saveLeadBtn = node.querySelector('#detailSaveLead');
    saveLeadBtn.textContent = lead.saved ? 'Saved Lead ✓' : 'Save Lead';
    saveLeadBtn.addEventListener('click', () => { toggleLeadSaved(id); saveLeadBtn.textContent=(state.leadData[id]||{}).saved?'Saved Lead ✓':'Save Lead'; });

    const excludeStreetBtn = node.querySelector('#detailExcludeStreet');
    const street = streetIdentity(p);
    if (!street) excludeStreetBtn.hidden = true;
    else {
      excludeStreetBtn.textContent = `Exclude ${street.street}`;
      excludeStreetBtn.addEventListener('click', () => excludeStreetForParcel(p));
    }

    const tadLink = node.querySelector('#detailTadLink');
    if ((p.county||'').toUpperCase().includes('TARRANT') && p.account) tadLink.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`;
    else tadLink.style.display='none';
    const vacantFullAddress=[p.address,p.city,'TX',p.zip].filter(Boolean).join(', ');
    node.querySelector('#detailGoogleLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vacantFullAddress)}`;
    const vacantListingLink=node.querySelector('#vacantListingSearchLink');
    if (vacantListingLink) vacantListingLink.href=`https://www.google.com/search?q=${encodeURIComponent(`"${vacantFullAddress}" property for sale`)}`;

    node.querySelector('#leadEmail').value=lead.email||'';
    node.querySelector('#vacantForSale').value=normalizeForSaleStatus(lead.forSale);
    node.querySelector('#leadStatus').value=lead.status||'Not researched'; node.querySelector('#leadPriority').value=lead.priority||'Normal';
    node.querySelector('#leadNotes').value=lead.notes||'';
    node.querySelector('#saveContactBtn').addEventListener('click',()=>{
      saveLeadRecord(id,{
        email:els.detailContent.querySelector('#leadEmail').value.trim(),
        forSale:els.detailContent.querySelector('#vacantForSale').value,
        status:els.detailContent.querySelector('#leadStatus').value,
        priority:els.detailContent.querySelector('#leadPriority').value,
        notes:els.detailContent.querySelector('#leadNotes').value.trim()
      },p);
      refreshSavedCounts(); updateVacantRow(id); saveLeadBtn.textContent='Saved Lead ✓';
      const msg=els.detailContent.querySelector('#saveConfirmation'); msg.textContent='Saved locally.'; setTimeout(()=>{ if(msg) msg.textContent=''; },1800);
    });

    els.detailContent.replaceChildren(node);
    els.detailDrawer.classList.add('open'); els.detailDrawer.setAttribute('aria-hidden','false');
    setTimeout(() => renderDetailMap(p), 0);
  }

  function openMapSearch(kind) {
    state.areaKind = ['vacant','commercial','owners'].includes(kind) ? kind : 'vacant';
    state.areaPoints = [];
    if (els.mapSearchTitle) els.mapSearchTitle.textContent = state.areaKind === 'commercial' ? 'Commercial Map Search' : state.areaKind === 'owners' ? 'Long-Term Owner Map Search' : 'Vacant Lot Map Search';
    els.mapSearchModal?.classList.add('open'); els.mapSearchModal?.setAttribute('aria-hidden','false');
    if (els.mapSearchRunBtn) els.mapSearchRunBtn.disabled = true;
    if (els.mapSearchHint) els.mapSearchHint.textContent = 'Click the map to place boundary points. Use at least 3 points.';
    setTimeout(initAreaMap, 0);
  }

  function initAreaMap() {
    if (!els.mapSearchMap || typeof L === 'undefined') return;
    if (state.areaMap) { try { state.areaMap.remove(); } catch {} }
    state.areaMap = L.map(els.mapSearchMap, { zoomControl:true, attributionControl:true, doubleClickZoom:false }).setView([32.7555,-97.3308],11);
    state.areaStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' });
    state.areaSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles &copy; Esri' });
    state.areaSatelliteLabelLayers = [
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Labels &copy; Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Labels &copy; Esri' })
    ];
    state.areaBaseMode = 'map';
    setAreaBaseMode('map');
    state.areaMap.on('click', e => {
      if (state.areaPoints.length >= 60) { if (els.mapSearchHint) els.mapSearchHint.textContent='Boundary limit reached (60 points). Search or remove a point.'; return; }
      state.areaPoints.push([e.latlng.lat,e.latlng.lng]);
      redrawAreaBoundary();
    });
    state.areaMap.invalidateSize();
  }

  function setAreaBaseMode(mode) {
    state.areaBaseMode = mode === 'satellite' ? 'satellite' : 'map';
    if (!state.areaMap) return;
    try {
      if (state.areaStreetLayer && state.areaMap.hasLayer(state.areaStreetLayer)) state.areaMap.removeLayer(state.areaStreetLayer);
      if (state.areaSatelliteLayer && state.areaMap.hasLayer(state.areaSatelliteLayer)) state.areaMap.removeLayer(state.areaSatelliteLayer);
      for (const layer of (state.areaSatelliteLabelLayers || [])) if (state.areaMap.hasLayer(layer)) state.areaMap.removeLayer(layer);
      if (state.areaBaseMode === 'satellite') {
        state.areaSatelliteLayer?.addTo(state.areaMap);
        for (const layer of (state.areaSatelliteLabelLayers || [])) layer.addTo(state.areaMap);
      } else {
        state.areaStreetLayer?.addTo(state.areaMap);
      }
      els.mapSearchStreetBtn?.classList.toggle('active', state.areaBaseMode === 'map');
      els.mapSearchSatelliteBtn?.classList.toggle('active', state.areaBaseMode === 'satellite');
    } catch {}
  }

  function redrawAreaBoundary() {
    if (!state.areaMap) return;
    if (state.areaPolygon) { try { state.areaMap.removeLayer(state.areaPolygon); } catch {} state.areaPolygon=null; }
    for (const m of state.areaMarkers) { try { state.areaMap.removeLayer(m); } catch {} }
    state.areaMarkers=[];
    for (const pt of state.areaPoints) state.areaMarkers.push(L.circleMarker(pt,{radius:4,color:'#121212',weight:2,fillColor:'#BEAF87',fillOpacity:1}).addTo(state.areaMap));
    if (state.areaPoints.length >= 2) state.areaPolygon = L.polygon(state.areaPoints,{color:'#121212',weight:3,fillColor:'#BEAF87',fillOpacity:.28}).addTo(state.areaMap);
    if (els.mapSearchRunBtn) els.mapSearchRunBtn.disabled = state.areaPoints.length < 3;
    if (els.mapSearchHint) els.mapSearchHint.textContent = state.areaPoints.length < 3 ? `${state.areaPoints.length} point${state.areaPoints.length===1?'':'s'} placed · at least 3 required` : `${state.areaPoints.length} boundary points placed · ready to search`;
  }

  function undoMapPoint() { if (!state.areaPoints.length) return; state.areaPoints.pop(); redrawAreaBoundary(); }
  function clearMapBoundary() { state.areaPoints=[]; redrawAreaBoundary(); }
  function closeMapSearch() {
    els.mapSearchModal?.classList.remove('open'); els.mapSearchModal?.setAttribute('aria-hidden','true');
    if (state.areaMap) { try { state.areaMap.remove(); } catch {} }
    state.areaMap=null; state.areaPolygon=null; state.areaMarkers=[]; state.areaPoints=[];
  }

  async function runMapAreaSearch() {
    if (state.areaPoints.length < 3) return;
    const kind=state.areaKind;
    const ring = state.areaPoints.map(([lat,lng]) => [Number(lng.toFixed(7)),Number(lat.toFixed(7))]);
    const first=ring[0], last=ring[ring.length-1];
    if (first[0]!==last[0] || first[1]!==last[1]) ring.push([...first]);
    closeMapSearch();
    if (kind==='commercial') return runCommercialAreaSearch(ring);
    if (kind==='owners') return runOwnerAreaSearch(ring);
    return runVacantAreaSearch(ring);
  }

  async function fetchAreaEndpoint(path, ring) {
    const geometry = encodeURIComponent(JSON.stringify({rings:[ring],spatialReference:{wkid:4326}}));
    const response = await fetch(`${path}?polygon=${geometry}`, { cache:'no-store' });
    let data; try { data=await response.json(); } catch { throw new Error(`local service returned HTTP ${response.status}`); }
    if (!response.ok || data.error) throw new Error(data.error || `local service returned HTTP ${response.status}`);
    return data;
  }

  async function runVacantAreaSearch(ring) {
    const timingKey=`vacant:map:${ring.length}`; const startedAt=performance.now(); setLoading(true); closeDrawer(); startSearchProgress(timingKey,'vacant');
    try {
      const data=await fetchAreaEndpoint('/api/search-area',ring);
      updateSearchProgressImmediate(94,'Scrubbing builders, stale build-out streets and unsuitable parcels…');
      const raw=Array.isArray(data.features)?data.features:[];
      state.allResults=raw.map(esriFeatureToGeoJson).map(normalizeFeature).filter(Boolean);
      hydrateSavedLeadParcels(state.allResults); applyPortfolioSignals(state.allResults); applyBuildoutStreetSignals(state.allResults); applyClientFilters(); applySortAndRender();
      rememberSearchDuration(timingKey,performance.now()-startedAt); finishSearchProgress(true,`Complete · ${state.filteredResults.length.toLocaleString()} results ready`);
    } catch(err){console.error(err);finishSearchProgress(false,'Search failed');window.alert(`Map search failed: ${friendlyError(err)}.`);} finally {setLoading(false);}
  }

  async function runCommercialAreaSearch(ring) {
    const timingKey=`commercial:map:${ring.length}`; const startedAt=performance.now(); setCommercialLoading(true); closeDrawer(); startSearchProgress(timingKey,'commercial');
    try {
      const data=await fetchAreaEndpoint('/api/commercial-area',ring);
      updateSearchProgressImmediate(94,'Preparing commercial property results…');
      const raw=Array.isArray(data.features)?data.features:[]; state.commercialResults=raw.map(esriFeatureToGeoJson).map(normalizeCommercialFeature).filter(Boolean);
      hydrateSavedLeadParcels(state.commercialResults); applyCommercialFilters(); applyCommercialSortAndRender();
      rememberSearchDuration(timingKey,performance.now()-startedAt); finishSearchProgress(true,`Complete · ${state.commercialVisibleResults.length.toLocaleString()} results ready`);
    } catch(err){console.error(err);finishSearchProgress(false,'Search failed');window.alert(`Map search failed: ${friendlyError(err)}.`);} finally {setCommercialLoading(false);}
  }

  async function runOwnerAreaSearch(ring) {
    const years=Number(els.ownerYears.value||5); const occupancy=els.ownerOccupancy.value;
    const timingKey=`owners:map:${years}:${ring.length}`; const startedAt=performance.now(); setOwnerLoading(true); closeDrawer(); startSearchProgress(timingKey,'owners');
    try {
      const geometry=encodeURIComponent(JSON.stringify({rings:[ring],spatialReference:{wkid:4326}}));
      const response=await fetch(`/api/owners-area?polygon=${geometry}&years=${encodeURIComponent(years)}&occupancy=${encodeURIComponent(occupancy)}`,{cache:'no-store'});
      let data; try{data=await response.json();}catch{throw new Error(`local service returned HTTP ${response.status}`);} if(!response.ok||data.error)throw new Error(data.error||`local service returned HTTP ${response.status}`);
      updateSearchProgressImmediate(94,'Preparing verified long-term owner results…');
      const raw=Array.isArray(data.features)?data.features:[]; state.ownerResults=raw.map(esriFeatureToGeoJson).map(normalizeOwnerFeature).filter(Boolean);
      hydrateSavedLeadParcels(state.ownerResults); applyOwnerFilters(); applyOwnerSortAndRender();
      rememberSearchDuration(timingKey,performance.now()-startedAt); finishSearchProgress(true,`Complete · ${state.ownerVisibleResults.length.toLocaleString()} results ready`);
    } catch(err){console.error(err);finishSearchProgress(false,'Search failed');window.alert(`Map search failed: ${friendlyError(err)}.`);} finally {setOwnerLoading(false);}
  }

  function renderDetailMap(p) {
    const host = els.detailContent.querySelector('#detailMap'); if (!host || typeof L === 'undefined') return;
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
      mapBtn.textContent = 'Map'; satelliteBtn.textContent = 'Satellite';
      mapBtn.title = 'Street map'; satelliteBtn.title = 'Satellite imagery';
      const switchMode = mode => {
        const useSatellite = mode === 'satellite';
        if (useSatellite) {
          if (state.detailMap.hasLayer(street)) state.detailMap.removeLayer(street);
          if (!state.detailMap.hasLayer(satellite)) satellite.addTo(state.detailMap);
        } else {
          if (state.detailMap.hasLayer(satellite)) state.detailMap.removeLayer(satellite);
          if (!state.detailMap.hasLayer(street)) street.addTo(state.detailMap);
        }
        mapBtn.classList.toggle('active', !useSatellite);
        satelliteBtn.classList.toggle('active', useSatellite);
      };
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      L.DomEvent.on(mapBtn, 'click', () => switchMode('map'));
      L.DomEvent.on(satelliteBtn, 'click', () => switchMode('satellite'));
      return wrap;
    };
    modeControl.addTo(state.detailMap);
    if (p.geometry) {
      state.detailLayer = L.geoJSON({type:'Feature',geometry:p.geometry,properties:{}}, { style:{ color:'#121212', weight:3, fillColor:'#BEAF87', fillOpacity:.38 } }).addTo(state.detailMap);
      const b = state.detailLayer.getBounds?.(); if (b && b.isValid()) state.detailMap.fitBounds(b.pad(.35), { maxZoom:18 });
    }
    state.detailMap.invalidateSize();
  }

  function destroyDetailMap() {
    if (state.detailMap) { try { state.detailMap.remove(); } catch {} }
    state.detailMap=null; state.detailLayer=null;
  }

  function closeDrawer() {
    els.detailDrawer.classList.remove('open'); els.detailDrawer.setAttribute('aria-hidden','true');
    setTimeout(destroyDetailMap, 220);
  }

  function toggleLeadSaved(id) {
    const current=state.leadData[id]||{};
    const p=state.allResults.find(x=>x.id===id);
    const nextSaved=!current.saved;
    state.leadData[id]={...current,saved:nextSaved,parcel:p?parcelSnapshot(p):(current.parcel||null),updatedAt:new Date().toISOString()};
    persistLeadData(); refreshSavedCounts(); updateVacantRow(id); renderStats();
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/(["\\.#:[\](),=+~*' ])/g, '\\$1');
  }

  function markSelectedRow(tbody, id) {
    if (!tbody) return;
    tbody.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
    const row = tbody.querySelector(`tr[data-id="${cssEscape(id)}"]`);
    if (row) row.classList.add('selected');
  }

  function updateVacantRow(id) {
    const row=els.resultsBody.querySelector(`tr[data-id="${cssEscape(id)}"]`);
    if (!row) return;
    const lead=state.leadData[id]||{};
    const star=row.querySelector('.star-btn'); if(star){star.classList.toggle('saved',Boolean(lead.saved));star.title=lead.saved?'Remove saved lead':'Save lead';}
    const sale=row.querySelector('.sale-badge'); if(sale){const value=normalizeForSaleStatus(lead.forSale);sale.textContent=value;sale.classList.toggle('yes',value==='Yes');sale.classList.toggle('no',value==='No');sale.classList.toggle('unknown',value==='Unknown');}
    const status=row.querySelector('.status-badge'); if(status){status.textContent=lead.status||'Not researched';status.classList.toggle('hot',lead.priority==='Hot');}
  }

  function updateOwnerRow(id) {
    const row=els.ownerResultsBody.querySelector(`tr[data-id="${cssEscape(id)}"]`);
    if (!row) return;
    const lead=state.leadData[id]||{};
    const star=row.querySelector('.star-btn'); if(star){star.classList.toggle('saved',Boolean(lead.saved));star.title=lead.saved?'Remove saved lead':'Save lead';}
    const status=row.querySelector('.status-badge'); if(status){status.textContent=lead.status||'Not researched';status.classList.toggle('hot',lead.priority==='Hot');}
  }

  function refreshSavedCounts() {
    const entries = Object.values(state.leadData || {});
    const count = entries.filter(x => x?.saved && normalizePipelineStageValue(x.pipelineStage) !== 'Completed' && !x.archived).length;
    const completed = entries.filter(x => normalizePipelineStageValue(x?.pipelineStage) === 'Completed' || x?.archived).length;
    if (els.savedCount && document.body.contains(els.savedCount)) els.savedCount.textContent=count;
    if (els.completedCount && document.body.contains(els.completedCount)) els.completedCount.textContent=completed;
  }

  function hydrateSavedLeadParcels(items) {
    let changed=false;
    for (const p of items) {
      const lead=state.leadData[p.id];
      if (!lead?.saved) continue;
      state.leadData[p.id]={...lead,parcel:parcelSnapshot(p)};
      changed=true;
    }
    if (changed) persistLeadData();
  }

  function updateFilterStatus() {
    if (!state.allResults.length) return;
    const removed=Math.max(0,state.allResults.length-state.filteredResults.length);
    setStatus(`Showing ${state.filteredResults.length.toLocaleString()} of ${state.allResults.length.toLocaleString()} raw vacant-code parcels; ${removed.toLocaleString()} are hidden by the built/junk/builder scrub.`, 'success');
  }

  function loadExcludedCommercialOwners() {
    try {
      const value = JSON.parse(localStorage.getItem(EXCLUDED_COMMERCIAL_OWNERS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function persistExcludedCommercialOwners() {
    window.LeadForgeStorage.setJson(EXCLUDED_COMMERCIAL_OWNERS_KEY, state.excludedCommercialOwners, 'Save excluded commercial owners');
  }

  function commercialOwnerKey(owner) {
    return cleanText(owner).toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function isCommercialOwnerExcluded(owner) {
    const key = commercialOwnerKey(owner);
    return Boolean(key && state.excludedCommercialOwners[key]);
  }

  function excludeCommercialOwner(p) {
    const owner = cleanText(p?.owner);
    const key = commercialOwnerKey(owner);
    if (!key || !owner) return false;
    const matching = state.commercialResults.filter(x => commercialOwnerKey(x.owner) === key).length;
    if (!window.confirm(`Exclude ${owner} and hide all ${matching} matching commercial propert${matching===1?'y':'ies'} from current and future searches?`)) return false;
    state.excludedCommercialOwners[key] = { key, owner, addedAt:new Date().toISOString() };
    persistExcludedCommercialOwners();
    applyCommercialFilters(); applyCommercialSortAndRender();
    return true;
  }

  function openExcludedCommercialOwnersModal() {
    renderExcludedCommercialOwnersList();
    els.excludedCommercialOwnersModal?.classList.add('open');
    els.excludedCommercialOwnersModal?.setAttribute('aria-hidden','false');
  }
  function closeExcludedCommercialOwnersModal() {
    els.excludedCommercialOwnersModal?.classList.remove('open');
    els.excludedCommercialOwnersModal?.setAttribute('aria-hidden','true');
  }
  function renderExcludedCommercialOwnersList() {
    if (!els.excludedCommercialOwnersList) return;
    const entries = Object.values(state.excludedCommercialOwners || {}).sort((a,b)=>String(a.owner||'').localeCompare(String(b.owner||'')));
    if (!entries.length) {
      els.excludedCommercialOwnersList.innerHTML = '<div class="excluded-street-empty">No commercial owners are excluded.</div>';
      if (els.clearExcludedCommercialOwnersBtn) els.clearExcludedCommercialOwnersBtn.disabled = true;
      return;
    }
    if (els.clearExcludedCommercialOwnersBtn) els.clearExcludedCommercialOwnersBtn.disabled = false;
    const frag=document.createDocumentFragment();
    for (const entry of entries) {
      const row=document.createElement('div'); row.className='excluded-street-row';
      row.innerHTML=`<div><div class="excluded-street-name">${escapeHtml(entry.owner||'Owner')}</div></div><button class="btn btn-outline restore-street-btn" type="button">Restore</button>`;
      row.querySelector('button').addEventListener('click',()=>restoreExcludedCommercialOwner(entry.key));
      frag.appendChild(row);
    }
    els.excludedCommercialOwnersList.replaceChildren(frag);
  }
  function restoreExcludedCommercialOwner(key) {
    if (!state.excludedCommercialOwners[key]) return;
    delete state.excludedCommercialOwners[key]; persistExcludedCommercialOwners(); renderExcludedCommercialOwnersList();
    if (state.commercialResults.length) { applyCommercialFilters(); applyCommercialSortAndRender(); }
  }
  function restoreAllExcludedCommercialOwners() {
    const count=Object.keys(state.excludedCommercialOwners||{}).length; if (!count) return;
    if (!window.confirm(`Restore all ${count} excluded commercial owner${count===1?'':'s'}?`)) return;
    state.excludedCommercialOwners={}; persistExcludedCommercialOwners(); renderExcludedCommercialOwnersList();
    if (state.commercialResults.length) { applyCommercialFilters(); applyCommercialSortAndRender(); }
  }

  function streetIdentity(p) {
    const raw = cleanText(p?.address);
    if (!raw || /^UNADDRESSED\b/i.test(raw)) return null;
    let street = raw
      .replace(/^\s*\d+[A-Z]?(?:\s*-\s*\d+[A-Z]?)?\s+/i, '')
      .replace(/\s+(?:APT|UNIT|STE|SUITE|#)\s*[A-Z0-9-]+.*$/i, '')
      .trim();
    if (!street || street === raw) return null;
    street = titleCasePlace(street);
    const scope = cleanText(p.zip) || cleanText(p.city) || 'LOCAL';
    const normalized = street.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return { key:`${scope.toUpperCase()}|${normalized}`, street, scope, city:cleanText(p.city), zip:cleanText(p.zip) };
  }

  function loadExcludedStreets() {
    try {
      const value = JSON.parse(localStorage.getItem(EXCLUDED_STREETS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function persistExcludedStreets() {
    window.LeadForgeStorage.setJson(EXCLUDED_STREETS_KEY, state.excludedStreets, 'Save excluded streets');
  }

  function isStreetExcluded(p) {
    const info = streetIdentity(p);
    return Boolean(info && state.excludedStreets[info.key]);
  }

  function excludeStreetForParcel(p) {
    const info = streetIdentity(p);
    if (!info) return;
    const scopeText = info.zip ? `${info.city ? `${info.city} · ` : ''}${info.zip}` : (info.city || info.scope);
    const matching = state.allResults.filter(x => streetIdentity(x)?.key === info.key).length;
    const message = matching > 1
      ? `Hide all ${matching} current results on ${info.street} (${scopeText})? This street will stay excluded in future searches until you restore it.`
      : `Hide ${info.street} (${scopeText}) from current and future search results until you restore it?`;
    if (!window.confirm(message)) return;
    state.excludedStreets[info.key] = { key:info.key, street:info.street, scope:info.scope, city:info.city, zip:info.zip, addedAt:new Date().toISOString() };
    persistExcludedStreets();
    closeDrawer();
    applyClientFilters();
    applySortAndRender();
    updateFilterStatus();
    renderExcludedStreetsList();
    setStatus(`${info.street} is now excluded. ${matching.toLocaleString()} matching parcel${matching===1?'':'s'} hidden from this search.`, 'success');
  }

  function refreshExcludedStreetCount() {
    const count = Object.keys(state.excludedStreets || {}).length;
    if (els.excludedStreetCount) els.excludedStreetCount.textContent = count.toLocaleString();
  }

  function openExcludedStreetsModal() {
    renderExcludedStreetsList();
    els.excludedStreetsModal?.classList.add('open');
    els.excludedStreetsModal?.setAttribute('aria-hidden','false');
  }

  function closeExcludedStreetsModal() {
    els.excludedStreetsModal?.classList.remove('open');
    els.excludedStreetsModal?.setAttribute('aria-hidden','true');
  }

  function renderExcludedStreetsList() {
    if (!els.excludedStreetsList) return;
    const entries = Object.values(state.excludedStreets || {}).sort((a,b) => String(a.street||'').localeCompare(String(b.street||'')));
    if (!entries.length) {
      els.excludedStreetsList.innerHTML = '<div class="excluded-street-empty">No streets are manually excluded.</div>';
      if (els.clearExcludedStreetsBtn) els.clearExcludedStreetsBtn.disabled = true;
      refreshExcludedStreetCount();
      return;
    }
    if (els.clearExcludedStreetsBtn) els.clearExcludedStreetsBtn.disabled = false;
    const frag = document.createDocumentFragment();
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'excluded-street-row';
      const scopeText = [entry.city, entry.zip].filter(Boolean).join(' · ') || entry.scope || '';
      row.innerHTML = `<div><div class="excluded-street-name">${escapeHtml(entry.street || 'Street')}</div><div class="excluded-street-scope">${escapeHtml(scopeText)}</div></div><button class="btn btn-outline restore-street-btn" type="button">Restore</button>`;
      row.querySelector('button').addEventListener('click', () => restoreExcludedStreet(entry.key));
      frag.appendChild(row);
    });
    els.excludedStreetsList.replaceChildren(frag);
    refreshExcludedStreetCount();
  }

  function restoreExcludedStreet(key) {
    const entry = state.excludedStreets[key];
    if (!entry) return;
    delete state.excludedStreets[key];
    persistExcludedStreets();
    if (state.allResults.length) { applyClientFilters(); applySortAndRender(); updateFilterStatus(); }
    renderExcludedStreetsList();
    setStatus(`${entry.street || 'Street'} restored to search results.`, 'success');
  }

  function restoreAllExcludedStreets() {
    const count = Object.keys(state.excludedStreets || {}).length;
    if (!count) return;
    if (!window.confirm(`Restore all ${count} excluded street${count===1?'':'s'}?`)) return;
    state.excludedStreets = {};
    persistExcludedStreets();
    if (state.allResults.length) { applyClientFilters(); applySortAndRender(); updateFilterStatus(); }
    renderExcludedStreetsList();
    setStatus('All manually excluded streets have been restored.', 'success');
  }

  function exportCommercialCSV() {
    const headers=['Address','City','ZIP','County','Commercial Type','Parcel/Account','Acres','Square Feet','Building Area','Year Built','Market Value','Land Value','Use Code','For Sale','Last Sold','Owner Name','Owner Mailing Address','Email','Contact Status','Priority','Saved Lead','Notes','Legal Description'];
    const rows=state.commercialVisibleResults.map(p=>{const lead=state.leadData[p.id]||{};const person=parseIndividualOwner(p.owner);return[p.address,p.city,p.zip,p.county,p.type,p.account,p.acres,p.sqft,p.livingArea,p.yearBuilt,p.marketValue,p.landValue,p.useCode,normalizeForSaleStatus(lead.forSale),formatDateDisplay(p.parsedDeedDate,p.deedDate),person?person.display:p.owner,p.ownerAddress,lead.email||'',lead.status||'Not researched',lead.priority||'Normal',lead.saved?'Yes':'No',lead.notes||'',p.legal||''];});
    const csv=[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url; const scope=els.commercialLocationInput.value.trim().replace(/[^a-z0-9]+/gi,'_')||'search'; a.download=`LeadForge_Commercial_${scope}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function exportOwnerCSV() {
    const headers=['Address','City','ZIP','County','Years Owned','Deed Date','Likely Owner Occupied','Parcel/Account','Market Value','Living Area','Year Built','Use Code','Owner Name','Owner Mailing Address','Email','Contact Status','Priority','Saved Lead','Notes','Legal Description'];
    const rows=state.ownerVisibleResults.map(p=>{const lead=state.leadData[p.id]||{};const person=parseIndividualOwner(p.owner);return[p.address,p.city,p.zip,p.county,p.yearsOwned,formatDateDisplay(p.parsedDeedDate,p.deedDate),p.ownerOccupied?'Yes':'No',p.account,p.marketValue,p.livingArea,p.yearBuilt,p.useCode,person?person.display:p.owner,p.ownerAddress,lead.email||'',lead.status||'Not researched',lead.priority||'Normal',lead.saved?'Yes':'No',lead.notes||'',p.legal||''];});
    const csv=[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url; const scope=els.ownerLocationInput.value.trim().replace(/[^a-z0-9]+/gi,'_')||'search'; a.download=`LeadForge_Long_Term_Owners_${scope}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const headers=['Address','City','ZIP','County','Lot Type','Last Sold','For Sale','Parcel/Account','Acres','Square Feet','Market Value','Land Value','Use Code','Subdivision','Block','Lot','Building Footprint','Recorded Structures','Improvement Value','Owner Name','Owner Mailing Address','Email','Contact Status','Priority','Saved Lead','Screening Concerns','Notes','Legal Description'];
    const rows=state.visibleResults.map(p=>{const lead=state.leadData[p.id]||{};return[p.address,p.city,p.zip,p.county,p.type,formatDateDisplay(p.parsedDeedDate,p.deedDate),normalizeForSaleStatus(lead.forSale),p.account,p.acres,p.sqft,p.marketValue,p.landValue,p.useCode,p.subdivision,p.block,p.lot,p.hasBuildingFootprint?'Yes':'No',p.structureCount,p.improvementValue,p.owner,p.ownerAddress,lead.email||'',lead.status||'Not researched',lead.priority||'Normal',lead.saved?'Yes':'No',p.concernReasons.join(' | '),lead.notes||'',p.legal||''];});
    const csv=[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url; const scope=els.locationInput.value.trim().replace(/[^a-z0-9]+/gi,'_')||'search'; a.download=`LeadForge_Vacant_Lots_${scope}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function clearSearch() {
    state.allResults=[]; state.filteredResults=[]; state.visibleResults=[]; state.selectedId=null;
    els.locationInput.value=''; els.minAcres.value=''; els.maxAcres.value=''; els.maxValue.value=''; closeDrawer(); renderAll(); setStatus('Ready.');
  }

  function candidateHeadline(p) {
    if (p.candidateQuality==='Strong') return p.type==='Residential' ? 'Strong residential-neighborhood candidate' : 'Strong vacant-lot candidate';
    if (p.candidateQuality==='Likely') return p.type==='Residential' ? 'Likely residential-neighborhood candidate' : 'Likely vacant-lot candidate';
    if (p.candidateQuality==='Exclude') return 'Internal screening found a reason to hide this parcel by default';
    return 'Needs manual review before prospecting';
  }

  function applyPortfolioSignals(items) {
    const byOwnerSubdivision = new Map(), byOwner = new Map();
    for (const p of items) {
      if (p.type !== 'Residential') continue;
      const ownerKey = normalizeOwnerKey(p.owner);
      if (!ownerKey || looksGovernmentOwned(p.owner) || looksHoaOwned(p.owner)) continue;
      if (!byOwner.has(ownerKey)) byOwner.set(ownerKey, []);
      byOwner.get(ownerKey).push(p);
      const sub = cleanText(p.subdivision).toUpperCase();
      if (sub) {
        const k = `${ownerKey}||${sub}`;
        if (!byOwnerSubdivision.has(k)) byOwnerSubdivision.set(k, []);
        byOwnerSubdivision.get(k).push(p);
      }
    }

    const mark = (p, reason) => {
      p.builderOwned = true;
      p.candidateQuality = 'Exclude';
      if (!p.concernReasons.includes(reason)) p.concernReasons.push(reason);
    };

    for (const group of byOwnerSubdivision.values()) {
      if (group.length < 3) continue;
      const owner = group[0].owner;
      const inventoryHeavy = group.filter(p => /^O1?(?:\b|\s|-)/i.test(p.useCode || '')).length >= Math.ceil(group.length / 2);
      if (looksBuilderOwned(owner) || inventoryHeavy || (looksCorporateOwner(owner) && group.length >= 5)) {
        group.forEach(p => mark(p, `Owner controls ${group.length} vacant/inventory lots in the same subdivision.`));
      }
    }

    for (const group of byOwner.values()) {
      if (group.length < 8) continue;
      const owner = group[0].owner;
      if (looksBuilderOwned(owner) || looksCorporateOwner(owner)) {
        group.forEach(p => mark(p, `Owner controls ${group.length} vacant/inventory parcels in this search area.`));
      }
    }
  }

  function applyBuildoutStreetSignals(items) {
    const groups = new Map();
    for (const p of items) {
      p.staleBuildoutCluster = false;
      if (p.type !== 'Residential' || p.builtEvidence || p.builderOwned || p.governmentOwned || p.hoaOwned) continue;
      const parsed = parseStreetAddress(p.address);
      if (!parsed || !parsed.number || !parsed.street) continue;
      const key = `${cleanText(p.zip)}||${parsed.street}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ p, number:parsed.number });
    }

    for (const group of groups.values()) {
      if (group.length < 5) continue;
      const parcels = group.map(x => x.p);
      const numbers = group.map(x => x.number).filter(Number.isFinite).sort((a,b)=>a-b);
      if (numbers.length < 5) continue;

      const uniqueOwnerRatio = new Set(parcels.map(p => normalizeOwnerKey(p.owner)).filter(Boolean)).size / parcels.length;
      const individualRatio = parcels.filter(p => !looksCorporateOwner(p.owner) && !looksBuilderOwned(p.owner) && !looksGovernmentOwned(p.owner) && !looksHoaOwned(p.owner)).length / parcels.length;
      const lotLikeRatio = parcels.filter(p => p.acres >= 0.07 && p.acres <= 0.60).length / parcels.length;
      const subdivisionRatio = Math.max(...Array.from(countBy(parcels.map(p => cleanText(p.subdivision).toUpperCase()).filter(Boolean)).values()), 0) / parcels.length;
      const values = parcels.map(p => Number(p.marketValue || 0)).filter(v => v > 0);
      const medValue = median(values);
      const similarValueRatio = medValue > 0 ? values.filter(v => Math.abs(v-medValue)/medValue <= 0.12).length / parcels.length : 0;
      const span = numbers[numbers.length-1] - numbers[0];
      const compactAddresses = span <= Math.max(80, group.length * 8);
      const inventoryRatio = parcels.filter(p => /^O1?(?:\b|\s|-)/i.test(p.useCode || '')).length / parcels.length;

      // This targets the stale-record pattern seen in completed subdivisions:
      // many consecutive, similarly sized/value lots on one street, now owned by different individuals.
      const strongBuildoutPattern =
        group.length >= 5 &&
        compactAddresses &&
        uniqueOwnerRatio >= 0.65 &&
        individualRatio >= 0.65 &&
        lotLikeRatio >= 0.70 &&
        similarValueRatio >= 0.65 &&
        (subdivisionRatio >= 0.60 || inventoryRatio >= 0.40 || group.length >= 8);

      if (!strongBuildoutPattern) continue;
      const reason = `Likely stale vacant record: ${group.length} compact, similarly valued residential lots on the same street are now mostly owned by different individuals.`;
      for (const p of parcels) {
        p.staleBuildoutCluster = true;
        p.candidateQuality = 'Exclude';
        if (!p.concernReasons.includes(reason)) p.concernReasons.push(reason);
      }
    }
  }

  function parseStreetAddress(address) {
    const s = cleanText(address).toUpperCase();
    const m = s.match(/^(\d+)[A-Z-]?\s+(.+)$/);
    if (!m) return null;
    let street = m[2]
      .replace(/\b(APT|UNIT|STE|SUITE)\b.*$/, '')
      .replace(/[.,#]/g, ' ')
      .replace(/\b(NORTH|SOUTH|EAST|WEST)\b/g, x => ({NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W'})[x])
      .replace(/\b(STREET|AVENUE|ROAD|DRIVE|LANE|COURT|BOULEVARD|PARKWAY|PLACE|TRAIL|CIRCLE|WAY|HIGHWAY)\b/g, x => ({STREET:'ST',AVENUE:'AVE',ROAD:'RD',DRIVE:'DR',LANE:'LN',COURT:'CT',BOULEVARD:'BLVD',PARKWAY:'PKWY',PLACE:'PL',TRAIL:'TRL',CIRCLE:'CIR',WAY:'WAY',HIGHWAY:'HWY'})[x])
      .replace(/\s+/g, ' ').trim();
    return { number:Number(m[1]), street };
  }

  function countBy(values) {
    const m = new Map();
    for (const v of values) m.set(v, (m.get(v)||0)+1);
    return m;
  }

  function median(values) {
    if (!values.length) return 0;
    const a = [...values].sort((x,y)=>x-y), i = Math.floor(a.length/2);
    return a.length % 2 ? a[i] : (a[i-1]+a[i])/2;
  }

  function parseIndividualOwner(owner) {
    const raw = cleanText(owner);
    if (!raw || raw === 'Owner not listed') return null;
    const upper = raw.toUpperCase();
    const entityWords = /\b(INC|INCORPORATED|LLC|L\.?L\.?C|LTD|LIMITED|LP|L\.?P|CORP|CORPORATION|COMPANY|CO|GROUP|HOLDINGS|PARTNERS?|PARTNERSHIP|TRUST|TRUSTEE|ESTATE|EST|BANK|ASSOCIATION|CHURCH|MINISTR(?:Y|IES)|FOUNDATION|CITY|COUNTY|STATE|SCHOOL|DISTRICT|AUTHORITY|DEVELOP(?:MENT|ERS?)|HOMES?|BUILDERS?|CONSTRUCTION|COMMUNITIES|PROPERTIES|PROPERTY|REALTY|INVESTMENTS?|CAPITAL|VENTURES?|LAND|MANAGEMENT|ENTERPRISES|SERVICES|FUND)\b/;
    if (entityWords.test(upper) || looksCorporateOwner(raw) || looksBuilderOwned(raw) || looksGovernmentOwned(raw) || looksHoaOwned(raw)) return null;

    if (raw.includes(',')) {
      const parts = raw.split(',').map(cleanText).filter(Boolean);
      if (parts.length < 2) return null;
      const lastName = parts[0];
      const given = parts.slice(1).join(' ').replace(/\s+/g, ' ').trim();
      if (!given || !lastName) return null;
      const firstName = given.split(/\s+/)[0].replace(/[^A-Za-z'’-]/g, '');
      if (!firstName) return null;
      return { raw, firstName:titleCasePerson(firstName), lastName:titleCasePerson(lastName), display:`${titleCasePerson(given)} ${titleCasePerson(lastName)}`.trim() };
    }

    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 7) return null;

    // Tarrant appraisal records normally store individuals as LAST FIRST [MIDDLE].
    // If the source arrives in all caps, treat the first token as the surname and
    // move it to the end for display. Mixed-case names are assumed to already be
    // in normal display order.
    const tadStyle = raw === raw.toUpperCase();
    if (tadStyle) {
      const lastName = words[0].replace(/[^A-Za-z'’-]/g, '');
      const given = words.slice(1).join(' ').trim();
      const firstName = words[1].replace(/[^A-Za-z'’-]/g, '');
      if (!firstName || !lastName || !given) return null;
      return { raw, firstName:titleCasePerson(firstName), lastName:titleCasePerson(lastName), display:`${titleCasePerson(given)} ${titleCasePerson(lastName)}`.trim() };
    }

    const firstName = words[0].replace(/[^A-Za-z'’-]/g, '');
    const lastName = words[words.length-1].replace(/[^A-Za-z'’-]/g, '');
    if (!firstName || !lastName) return null;
    return { raw, firstName:titleCasePerson(firstName), lastName:titleCasePerson(lastName), display:titleCasePerson(raw) };
  }

  function titleCasePerson(value) {
    return cleanText(value).toLowerCase().replace(/(^|[\s&'’-])([a-z])/g, (_, lead, c) => lead + c.toUpperCase())
      .replace(/\b(Jr|Sr|Ii|Iii|Iv)\b/g, m => m.toUpperCase());
  }

  function slugPart(value) {
    return cleanText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function ownerMailingState(ownerAddress) {
    const s = cleanText(ownerAddress).toUpperCase();
    const zipMatch = s.match(/\b([A-Z]{2})[ ,]+\d{5}(?:-\d{4})?\b/);
    if (zipMatch) return zipMatch[1];
    const stateMatch = s.match(/(?:,|\s)\s*([A-Z]{2})(?:,|\s|$)/g);
    if (!stateMatch?.length) return '';
    const m = stateMatch[stateMatch.length-1].match(/([A-Z]{2})/);
    return m ? m[1] : '';
  }

  function buildFastPeopleSearchUrl(person, ownerAddress) {
    const first = slugPart(person.firstName), last = slugPart(person.lastName);
    if (!first || !last) return 'https://www.fastpeoplesearch.com/';
    const stateCode = ownerMailingState(ownerAddress).toLowerCase();
    const suffix = stateCode ? `_${stateCode}` : '';
    return `https://www.fastpeoplesearch.com/name/${encodeURIComponent(first)}-${encodeURIComponent(last)}${suffix}`;
  }

  function normalizeOwnerKey(owner) {
    return cleanText(owner).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\b(THE|OF|TEXAS)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function looksCorporateOwner(owner) {
    const s = cleanText(owner).toUpperCase();
    return /\b(INC|INCORPORATED|LLC|L\.L\.C|LTD|LP|L\.P|CORP|CORPORATION|COMPANY|CO|GROUP|HOLDINGS|PARTNERS|PARTNERSHIP)\b/.test(s);
  }

  function looksInstitutionalCommercialOwner(owner) {
    const s = cleanText(owner).toUpperCase();
    if (!s) return false;
    if (looksGovernmentOwned(s) || looksBuilderOwned(s) || looksHoaOwned(s)) return true;
    if (/\b(INC|INCORPORATED|CORP|CORPORATION|REIT|REAL ESTATE INVESTMENT TRUST|BANK|BANC|CREDIT UNION|INSURANCE|HOSPITAL|HEALTH SYSTEM|UNIVERSITY|COLLEGE|SCHOOL DISTRICT|AUTHORITY|UTILITY|UTILITIES|RAILROAD|AIRPORT|FOUNDATION|CHURCH|MINISTR(?:Y|IES))\b/.test(s)) return true;
    if (/\b(WALMART|WAL-MART|TARGET|AMAZON|COSTCO|KROGER|HOME DEPOT|LOWE'?S|CVS|WALGREENS|7-ELEVEN|MCDONALD'?S|STARBUCKS|AT&T|VERIZON|ONCOR|BNSF|UNION PACIFIC)\b/.test(s)) return true;
    return false;
  }

  function looksBuilderOwned(owner) {
    const s = cleanText(owner).toUpperCase();
    if (!s) return false;
    if (KNOWN_BUILDER_PATTERNS.some(re => re.test(s))) return true;
    const builderWords = /\b(BUILDERS?|HOME(?:S)?|HOMEBUILDERS?|CONSTRUCTION|DEVELOP(?:MENT|ERS?)|COMMUNITIES|RESIDENTIAL)\b/.test(s);
    return builderWords && looksCorporateOwner(s);
  }

  function resolveDisplayCity(rawCity, zip) {
    const city = cleanText(rawCity);
    if (city && !/^(NO\s+CITY\s+LIMITS?|NO\s+CITY\s+LIMIT|UNINCORPORATED|NONE|N\/A)$/i.test(city)) return titleCasePlace(city);
    const z = cleanText(zip);
    const known = {
      '76179':'Fort Worth','76177':'Fort Worth','76137':'Fort Worth','76135':'Fort Worth','76131':'Fort Worth',
      '76106':'Fort Worth','76114':'Fort Worth','76116':'Fort Worth','76108':'Fort Worth','76120':'Fort Worth',
      '76148':'Watauga','76180':'North Richland Hills','76182':'North Richland Hills','76052':'Haslet',
      '76020':'Azle','76021':'Bedford','76022':'Bedford','76034':'Colleyville','76039':'Euless','76040':'Euless',
      '76051':'Grapevine','76053':'Hurst','76054':'Hurst','76060':'Kennedale','76063':'Mansfield','76092':'Southlake'
    };
    if (known[z]) return known[z];
    if (/^761\d{2}$/.test(z)) return 'Fort Worth';
    return 'Fort Worth';
  }

  function titleCasePlace(value) {
    const s = cleanText(value);
    if (!s || /[a-z]/.test(s)) return s;
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bTx\b/g, 'TX');
  }

  let progressTimer = null;
  let progressStartedAt = 0;
  let progressEstimateMs = 45000;

  function getTimingStore() { try { return JSON.parse(localStorage.getItem(SEARCH_TIMING_KEY) || '{}') || {}; } catch { return {}; } }
  function estimatedDurationFor(key) {
    const store = getTimingStore(), arr = Array.isArray(store[key]) ? store[key] : [];
    if (!arr.length) return 45000;
    return Math.max(12000, Math.min(180000, arr.reduce((a,b)=>a+b,0) / arr.length));
  }
  function rememberSearchDuration(key, ms) {
    const store = getTimingStore(), arr = Array.isArray(store[key]) ? store[key] : [];
    arr.push(Math.round(ms)); while (arr.length > 4) arr.shift(); store[key] = arr;
    window.LeadForgeStorage.setJson(SEARCH_TIMING_KEY, store, 'Save search timing', {silent:true});
  }
  function startSearchProgress(key, kind='vacant') {
    clearInterval(progressTimer);
    state.progressKind = kind;
    if (els.progressTitle) els.progressTitle.textContent = kind === 'owners' ? 'Finding long-term owners' : kind === 'commercial' ? 'Finding commercial properties' : 'Finding vacant lots';
    progressStartedAt = performance.now(); progressEstimateMs = estimatedDurationFor(key);
    els.progressModal?.classList.remove('failed'); els.progressModal?.classList.add('open'); els.progressModal?.setAttribute('aria-hidden','false');
    updateSearchProgressImmediate(3, 'Starting search…');
    progressTimer = setInterval(() => {
      const elapsed = performance.now() - progressStartedAt;
      if (elapsed > progressEstimateMs * .92) progressEstimateMs = Math.max(progressEstimateMs, elapsed * 1.28);
      const ratio = Math.min(.94, elapsed / progressEstimateMs);
      const pct = Math.max(3, Math.round(3 + ratio * 91));
      const eta = Math.max(1, Math.round((progressEstimateMs - elapsed) / 1000));
      let step;
      if (state.progressKind === 'owners') {
        step = 'Finding residential property records…';
        if (pct >= 30) step = 'Checking verified deed dates…';
        if (pct >= 58) step = 'Matching owner mailing addresses…';
        if (pct >= 82) step = 'Preparing matching owners…';
      } else if (state.progressKind === 'commercial') {
        step = 'Finding commercial property records…';
        if (pct >= 35) step = 'Loading parcel and ownership data…';
        if (pct >= 70) step = 'Classifying commercial property types…';
        if (pct >= 88) step = 'Preparing commercial leads…';
      } else {
        step = 'Finding vacant parcels…';
        if (pct >= 25) step = 'Loading parcel records and geometry…';
        if (pct >= 50) step = 'Checking building footprints…';
        if (pct >= 70) step = 'Matching neighborhood and lot records…';
        if (pct >= 86) step = 'Scrubbing builders and unsuitable parcels…';
      }
      updateSearchProgressImmediate(pct, step, eta, elapsed);
    }, 250);
  }
  function updateSearchProgressImmediate(pct, step, etaSeconds=null, elapsedMs=null) {
    if (els.progressBar) els.progressBar.style.width = `${Math.max(0,Math.min(100,pct))}%`;
    if (els.progressPct) els.progressPct.textContent = `${Math.round(pct)}%`;
    if (els.progressStep) els.progressStep.textContent = step;
    const elapsed = elapsedMs ?? (progressStartedAt ? performance.now()-progressStartedAt : 0);
    if (els.progressElapsed) els.progressElapsed.textContent = `${Math.max(0,Math.round(elapsed/1000))}s elapsed`;
    if (els.progressEta) els.progressEta.textContent = etaSeconds === null ? 'Estimating time…' : `About ${etaSeconds}s remaining`;
  }
  function finishSearchProgress(success, message) {
    clearInterval(progressTimer); progressTimer = null;
    if (!els.progressModal) return;
    if (success) {
      updateSearchProgressImmediate(100, message || 'Complete', 0);
      setTimeout(() => { els.progressModal.classList.remove('open'); els.progressModal.setAttribute('aria-hidden','true'); }, 650);
    } else {
      updateSearchProgressImmediate(100, message || 'Search failed', 0);
      els.progressModal.classList.add('failed');
      setTimeout(() => { els.progressModal.classList.remove('open','failed'); els.progressModal.setAttribute('aria-hidden','true'); }, 1400);
    }
  }

  function normalizeForSaleStatus(value) {
    const v = String(value || '').trim();
    if (v === 'Yes') return 'Yes';
    if (v === 'No') return 'No';
    return 'Unknown';
  }

  function qualityClass(q) { return ({Strong:'strong',Likely:'likely',Review:'review',Exclude:'exclude'})[q] || 'review'; }
  function looksGovernmentOwned(owner){const s=String(owner||'').toUpperCase();return /\b(CITY OF|COUNTY OF|STATE OF|UNITED STATES|US GOV|U S GOV|ISD\b|SCHOOL DISTRICT|WATER DISTRICT|TARRANT COUNTY|TEXAS STATE OF|FORT WORTH CITY OF|CITY OF FORT WORTH)\b/.test(s);}
  function looksHoaOwned(owner){const s=String(owner||'').toUpperCase();return /\b(HOMEOWNERS? ASSOCIATION|HOME OWNERS? ASSOCIATION|PROPERTY OWNERS? ASSOCIATION|COMMUNITY ASSOCIATION|HOA\b|POA\b)\b/.test(s);}
  function truthy(v){if(v===true||v===1||v==='1')return true;return String(v||'').toLowerCase()==='true';}
  function saveLeadRecord(id, patch, parcel) {
    const key = String(id || '').trim();
    if (!key) return false;
    const current = state.leadData[key] || {};
    state.leadData[key] = {...current, ...patch, saved:true, parcel:parcel ? parcelSnapshot(parcel) : (patch?.parcel || current.parcel || null), updatedAt:new Date().toISOString()};
    persistLeadData();
    const persisted = loadLeadData();
    if (persisted[key]) state.leadData[key] = persisted[key];
    return Boolean(state.leadData[key]);
  }

  function loadLeadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{return{};}}

  function isSaved(id){return Boolean(state.leadData[id]?.saved);}
  function showError(message){window.alert(String(message||'Something went wrong.'));}
  function setLoading(on){els.searchBtn.disabled=on;els.searchBtn.classList.toggle('loading',on);els.searchBtn.textContent=on?'Searching':'Search';}
  function setCommercialLoading(on){els.commercialSearchBtn.disabled=on;els.commercialSearchBtn.classList.toggle('loading',on);els.commercialSearchBtn.textContent=on?'Searching':'Search';}
  function setOwnerLoading(on){els.ownerSearchBtn.disabled=on;els.ownerSearchBtn.classList.toggle('loading',on);els.ownerSearchBtn.textContent=on?'Searching':'Search';}
  function setStatus(text,type=''){if(!els.statusText)return;els.statusText.textContent=text;els.statusText.className=`status-text ${type}`.trim();}
  function setCommercialStatus(text,type=''){if(!els.commercialStatusText)return;els.commercialStatusText.textContent=text;els.commercialStatusText.className=`status-text ${type}`.trim();}
  function setVcStatus(text,type=''){if(!els.vcStatusText)return;els.vcStatusText.textContent=text;els.vcStatusText.className=`status-text ${type}`.trim();}
  function setOwnerStatus(text,type=''){if(!els.ownerStatusText)return;els.ownerStatusText.textContent=text;els.ownerStatusText.className=`status-text ${type}`.trim();}
  function setRedditStatus(text,type=''){if(!els.redditStatusText)return;els.redditStatusText.textContent=text;els.redditStatusText.className=`status-text ${type}`.trim();}
  function formatSize(p){if(p.acres>=.1)return `${p.acres.toLocaleString(undefined,{maximumFractionDigits:3})} ac`;if(p.sqft)return `${Math.round(p.sqft).toLocaleString()} sf`;return'—';}
  function money(n){return Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
  function finiteOrNull(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function numOrNull(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function cleanText(v){return v===null||v===undefined?'':String(v).replace(/\s+/g,' ').trim();}
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function csvEscape(v){const s=String(v??'');return/[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function friendlyError(err){const m=String(err?.message||err||'Unknown error');if(/Failed to fetch/i.test(m))return'the local LeadForge service stopped. Restart START_APP.bat';return m;}

  /* =========================================================
     v4.2 — optimized lead pipeline, smart follow-up, property lookup,
     vacant-commercial detail drawer, and fresher Reddit search
     ========================================================= */

  function renderLimitFor(kind) {
    state.renderLimits = state.renderLimits || {};
    return Math.max(RENDER_BATCH_SIZE, Number(state.renderLimits[kind] || RENDER_BATCH_SIZE));
  }
  function appendLoadMoreButton(host, kind, total, colspan) {
    if (!host) return;
    const shown = Math.min(renderLimitFor(kind), total);
    if (shown >= total) return;
    const tr = document.createElement('tr');
    tr.className = 'load-more-row';
    tr.innerHTML = `<td colspan="${colspan}"><button class="btn btn-outline load-more-results" type="button" data-render-kind="${escapeHtml(kind)}">Show More <span>${shown.toLocaleString()} of ${total.toLocaleString()}</span></button></td>`;
    host.appendChild(tr);
  }
  function loadMoreResults(kind) {
    state.renderLimits = state.renderLimits || {};
    state.renderLimits[kind] = renderLimitFor(kind) + RENDER_BATCH_SIZE;
    if (kind === 'vacant') renderTable();
    else if (kind === 'commercial') renderCommercialTable();
    else if (kind === 'vacant-commercial') renderVacantCommercialTable();
    else if (kind === 'owners') renderOwnerTable();
  }

  function setupV4() {
    state.propertyResults = state.propertyResults || [];
    state.propertyVisibleResults = state.propertyVisibleResults || [];
    state.propertySelectedId = state.propertySelectedId || null;
    state.workflowTarget = null;
    state.renderLimits = state.renderLimits || {vacant:RENDER_BATCH_SIZE, commercial:RENDER_BATCH_SIZE, 'vacant-commercial':RENDER_BATCH_SIZE, owners:RENDER_BATCH_SIZE};

    $('propertyTabBtn')?.addEventListener('click', () => setWorkspace('property'));
    $('communityTabBtn')?.addEventListener('click', () => setWorkspace('community'));
    window.addEventListener('leadforge-lead-data-updated', syncLeadDataFromStorage);
    $('propertySearchBtn')?.addEventListener('click', runPropertySearch);
    $('propertyClearBtn')?.addEventListener('click', clearPropertySearch);
    $('propertyAddressInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') runPropertySearch(); });
    $('propertyPipelineFilter')?.addEventListener('change', applyPropertyFiltersAndRender);

    $('vacantPipelineFilter')?.addEventListener('change', () => { if (state.allResults.length) { applyClientFilters(); applySortAndRender(); } });
    $('commercialPipelineFilter')?.addEventListener('change', () => { if (state.commercialResults.length) { applyCommercialFilters(); applyCommercialSortAndRender(); } });
    $('vcPipelineFilter')?.addEventListener('change', () => { if (state.vacantCommercialResults.length) applyVacantCommercialFiltersAndRender(); });
    $('ownerPipelineFilter')?.addEventListener('change', () => { if (state.ownerResults.length) { applyOwnerFilters(); applyOwnerSortAndRender(); } });


    document.addEventListener('change', e => {
      const select = e.target.closest?.('.pipeline-select');
      if (!select) return;
      savePipelineStage(select.dataset.leadId, select.value, select.dataset.leadKind || 'stored');
    });
    document.addEventListener('click', e => {
      const more = e.target.closest?.('.load-more-results');
      if (more) {
        e.preventDefault(); e.stopPropagation();
        loadMoreResults(more.dataset.renderKind);
        return;
      }
      const stageBtn = e.target.closest?.('.pipeline-stage-btn');
      if (stageBtn) {
        e.preventDefault(); e.stopPropagation();
        openWorkflowModal(stageBtn.dataset.leadKind || 'stored', stageBtn.dataset.leadId);
        return;
      }
      const follow = e.target.closest?.('.pipeline-followup-btn');
      if (follow) {
        e.preventDefault(); e.stopPropagation();
        openWorkflowModal(follow.dataset.leadKind || 'stored', follow.dataset.leadId);
        return;
      }
      const dashboard = e.target.closest?.('.followup-item');
      if (dashboard) {
        e.preventDefault();
        openWorkflowModal('stored', dashboard.dataset.leadId);
      }
    });

    document.querySelectorAll('[data-close-workflow]').forEach(el => el.addEventListener('click', closeWorkflowModal));
    $('workflowSaveBtn')?.addEventListener('click', saveWorkflowModal);
    $('workflowClearFollowUp')?.addEventListener('click', () => { if ($('workflowFollowUp')) $('workflowFollowUp').value = ''; });
    document.querySelectorAll('[data-followup-days]').forEach(btn => btn.addEventListener('click', () => setQuickFollowUp(Number(btn.dataset.followupDays || 0))));
    document.querySelector('[data-followup-custom]')?.addEventListener('click', () => $('workflowFollowUp')?.focus());

    renderFollowUpDashboard(true);
  }

  function pipelineStages() { return ['Unworked','Contacted','Appointment','Closed','Completed']; }
  function normalizePipelineStageValue(value) {
    const v = cleanText(value);
    if (pipelineStages().includes(v)) return v;
    if (v === 'Responded' || v === 'Nurture') return 'Contacted';
    if (v === 'Client') return 'Appointment';
    if (v === 'Lost') return 'Completed';
    return 'Unworked';
  }
  function getPipelineStage(id) {
    return normalizePipelineStageValue(state.leadData[String(id || '')]?.pipelineStage);
  }
  function pipelineFilterMatches(id, filterId) {
    const filter = $(filterId)?.value || '';
    return !filter || getPipelineStage(id) === filter;
  }
  function formatFollowUpShort(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }
  function followUpState(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d < now) return 'overdue';
    return d.toDateString() === now.toDateString() ? 'due' : '';
  }
  function pipelineCell(p, kind) {
    const id = String(p?.id || p?.account || '');
    const stage = getPipelineStage(id);
    const follow = state.leadData[id]?.followUpAt || '';
    const followClass = followUpState(follow);
    const stageCss = stage.toLowerCase().replace(/[^a-z]+/g,'-');
    return `<div class="pipeline-cell pipeline-cell-compact"><button class="pipeline-stage-btn stage-${escapeHtml(stageCss)}" type="button" data-lead-id="${escapeHtml(id)}" data-lead-kind="${escapeHtml(kind)}" title="Manage pipeline and follow-up">${escapeHtml(stage)}</button>${follow ? `<button class="pipeline-followup-btn ${followClass}" type="button" data-lead-id="${escapeHtml(id)}" data-lead-kind="${escapeHtml(kind)}" title="${escapeHtml(formatFollowUpShort(follow))}">Follow-Up</button><div class="pipeline-date">${escapeHtml(formatFollowUpShort(follow))}</div>` : `<button class="pipeline-followup-btn" type="button" data-lead-id="${escapeHtml(id)}" data-lead-kind="${escapeHtml(kind)}">Follow-Up</button>`}</div>`;
  }

  function pipelineStageButton(p, kind) {
    const id=String(p?.id||p?.account||'');
    const stage=getPipelineStage(id);
    const css=stage.toLowerCase().replace(/[^a-z]+/g,'-');
    const follow=state.leadData[id]?.followUpAt||'';
    const title=follow?`${stage} · Follow-up ${formatFollowUpShort(follow)}`:`${stage} · Manage pipeline / follow-up`;
    return `<button class="pipeline-stage-btn stage-${escapeHtml(css)}" type="button" data-lead-id="${escapeHtml(id)}" data-lead-kind="${escapeHtml(kind)}" title="${escapeHtml(title)}">${escapeHtml(stage)}</button>`;
  }

  function getLeadItem(kind, id) {
    id = String(id || '');
    if (kind === 'vacant') return state.allResults.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    if (kind === 'commercial') return state.commercialResults.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    if (kind === 'vacant-commercial') return state.vacantCommercialResults.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    if (kind === 'owners') return state.ownerResults.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    if (kind === 'reddit') return state.redditPosts.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    if (kind === 'property') return state.propertyResults.find(x => x.id === id) || state.leadData[id]?.parcel || null;
    return state.leadData[id]?.parcel || null;
  }
  function snapshotForKind(item, kind) {
    if (!item) return null;
    if (kind === 'reddit' || item.leadKind === 'DFW Relocation Post' || item.source === 'Reddit') {
      if (item.redditUrl || item.redditTitle) {
        return {...item,
          leadKind:item.leadKind || 'DFW Relocation Post',
          type:item.type || 'Reddit Relocation Lead',
          source:'Reddit',
          redditUrl:item.redditUrl || item.url || item.source_url || '',
          redditTitle:item.redditTitle || item.title || item.address || 'Reddit lead',
          address:item.address || item.redditTitle || item.title || 'Reddit lead'
        };
      }
      return redditSnapshot(item);
    }
    if (kind === 'stored') return item;
    return parcelSnapshot(item);
  }
  function savePipelineStage(id, stage, kind) {
    id = String(id || ''); if (!id || !pipelineStages().includes(stage)) return;
    const current = state.leadData[id] || {};
    const item = getLeadItem(kind, id);
    const changed = getPipelineStage(id) !== stage;
    const completing = stage === 'Completed';
    const restoring = Boolean(current.archived) && !completing;
    state.leadData[id] = {...current, pipelineStage:stage, pipelineChangedAt:changed ? new Date().toISOString() : (current.pipelineChangedAt || new Date().toISOString()), parcel:current.parcel || snapshotForKind(item, kind), archived:completing ? true : false, saved:completing ? false : (restoring ? true : current.saved), followUpAt:completing ? '' : (current.followUpAt || ''), updatedAt:new Date().toISOString()};
    persistLeadData();
    refreshSavedCounts();
    rerenderLeadKind(kind);
  }
  function rerenderLeadKind(kind) {
    if (kind === 'vacant') { applyClientFilters(); applySortAndRender(); }
    else if (kind === 'commercial') { applyCommercialFilters(); applyCommercialSortAndRender(); }
    else if (kind === 'vacant-commercial') applyVacantCommercialFiltersAndRender();
    else if (kind === 'owners') { applyOwnerFilters(); applyOwnerSortAndRender(); }
    else if (kind === 'reddit') applyRedditFiltersAndRender();
    else if (kind === 'property') applyPropertyFiltersAndRender();
    else refreshAllLeadViews();
  }

  function openWorkflowModal(kind, id) {
    id = String(id || ''); if (!id) return;
    const item = getLeadItem(kind, id);
    const lead = state.leadData[id] || {};
    state.workflowTarget = {kind, id};
    const label = item?.redditTitle || item?.title || item?.address || lead.parcel?.redditTitle || lead.parcel?.address || `Lead ${id}`;
    if ($('workflowLeadLabel')) $('workflowLeadLabel').textContent = label;
    if ($('workflowStage')) $('workflowStage').value = getPipelineStage(id);
    if ($('workflowFollowUp')) $('workflowFollowUp').value = toDateTimeLocal(lead.followUpAt);
    $('workflowModal')?.classList.add('open'); $('workflowModal')?.setAttribute('aria-hidden','false');
  }
  function closeWorkflowModal() {
    $('workflowModal')?.classList.remove('open'); $('workflowModal')?.setAttribute('aria-hidden','true');
    state.workflowTarget = null;
  }
  function toDateTimeLocal(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function setQuickFollowUp(days) {
    if (!days) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setSeconds(0,0); d.setMinutes(Math.ceil(d.getMinutes()/15)*15);
    if ($('workflowFollowUp')) $('workflowFollowUp').value = toDateTimeLocal(d.toISOString());
  }
  function saveWorkflowModal() {
    const target = state.workflowTarget; if (!target) return;
    const id = target.id, kind = target.kind;
    const current = state.leadData[id] || {};
    const item = getLeadItem(kind, id);
    const stage = $('workflowStage')?.value || 'Unworked';
    const local = $('workflowFollowUp')?.value || '';
    let followUpAt = '';
    if (local) { const d = new Date(local); if (!Number.isNaN(d.getTime())) followUpAt = d.toISOString(); }
    const changed = getPipelineStage(id) !== stage;
    const completing = stage === 'Completed';
    const restoring = Boolean(current.archived) && !completing;
    state.leadData[id] = {...current, pipelineStage:stage, pipelineChangedAt:changed ? new Date().toISOString() : (current.pipelineChangedAt || new Date().toISOString()), followUpAt:completing ? '' : followUpAt, parcel:current.parcel || snapshotForKind(item, kind), archived:completing ? true : false, saved:completing ? false : (restoring ? true : current.saved), updatedAt:new Date().toISOString()};
    persistLeadData(); closeWorkflowModal(); rerenderLeadKind(kind); refreshSavedCounts();
  }

  function renderFollowUpDashboard(force=false) {
    const nowMs = Date.now();
    if (!force && !followUpDashboardDirty && nowMs - followUpDashboardLastRender < 60000) return;
    const now = new Date(nowMs);
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const entries = Object.entries(state.leadData || {}).map(([id,lead]) => ({id,lead,when:lead?.followUpAt ? new Date(lead.followUpAt) : null})).filter(x => x.when && !Number.isNaN(x.when.getTime()) && getPipelineStage(x.id) !== 'Completed');
    const overdue = entries.filter(x => x.when < now).sort((a,b)=>a.when-b.when);
    const today = entries.filter(x => x.when >= now && x.when < endToday).sort((a,b)=>a.when-b.when);
    const upcoming = entries.filter(x => x.when >= endToday).sort((a,b)=>a.when-b.when);
    renderFollowUpBucket('followUpOverdueCount','followUpOverdueList',overdue);
    renderFollowUpBucket('followUpTodayCount','followUpTodayList',today);
    renderFollowUpBucket('followUpUpcomingCount','followUpUpcomingList',upcoming);
    followUpDashboardDirty = false;
    followUpDashboardLastRender = nowMs;
  }
  function renderFollowUpBucket(countId, listId, items) {
    const count = $(countId), host=$(listId); if (!count || !host) return;
    count.textContent = items.length.toLocaleString();
    if (!items.length) { host.innerHTML='<span class="followup-empty">None</span>'; return; }
    host.innerHTML = items.slice(0,5).map(({id,lead,when}) => {
      const p=lead.parcel||{}, label=p.redditTitle||p.address||`Lead ${id}`;
      return `<button class="followup-item" type="button" data-lead-id="${escapeHtml(id)}"><span class="followup-item-main"><span class="followup-item-name">${escapeHtml(label)}</span><span class="followup-item-meta">${escapeHtml(getPipelineStage(id))}</span></span><span class="followup-item-meta">${escapeHtml(when.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</span></button>`;
    }).join('');
  }

  function migrateLegacyRedditWorkedPosts() {
    if (!Array.isArray(state.redditWorkedPosts) || !state.redditWorkedPosts.length) return;
    const byUrl = new Map(state.redditPosts.map(p => [RedditEngine.postKey(p.url), p]));
    for (const old of state.redditWorkedPosts) {
      const p = normalizeRedditPost(old);
      if (!p) continue;
      byUrl.set(RedditEngine.postKey(p.url),p);
      const current=state.leadData[p.id]||{};
      state.leadData[p.id]={...current,pipelineStage:current.pipelineStage||'Contacted',pipelineChangedAt:current.pipelineChangedAt||old.workedAt||new Date().toISOString(),parcel:current.parcel||redditSnapshot(p),updatedAt:new Date().toISOString()};
    }
    state.redditPosts=[...byUrl.values()]; persistRedditPosts();
    state.redditWorkedPosts=[]; persistRedditWorkedPosts(); persistLeadData();
  }

  function setWorkspace(kind) {
    state.activeWorkspace = ['vacant','commercial','vacant-commercial','property','owners','reddit','community'].includes(kind) ? kind : 'vacant';
    const modes = {vacant:'vacant',commercial:'commercial','vacant-commercial':'vacantCommercial',property:'property',owners:'owner',reddit:'reddit',community:'community'};
    const current = modes[state.activeWorkspace];
    [['vacantTabBtn','vacantWorkspace','vacant'],['commercialTabBtn','commercialWorkspace','commercial'],['vacantCommercialTabBtn','vacantCommercialWorkspace','vacantCommercial'],['propertyTabBtn','propertyWorkspace','property'],['ownerTabBtn','ownerWorkspace','owner'],['redditTabBtn','redditWorkspace','reddit'],['communityTabBtn','communityWorkspace','community']].forEach(([btn,panel,key])=>{
      $(btn)?.classList.toggle('active',current===key); if($(panel)){ $(panel).hidden=current!==key; $(panel).classList.toggle('active',current===key); }
    });
    closeDrawer();
    if (state.activeWorkspace==='commercial') els.exportBtn.disabled=!state.commercialVisibleResults.length;
    else if(state.activeWorkspace==='vacant-commercial') els.exportBtn.disabled=!state.vacantCommercialVisibleResults.length;
    else if(state.activeWorkspace==='property') els.exportBtn.disabled=!state.propertyVisibleResults.length;
    else if(state.activeWorkspace==='owners') els.exportBtn.disabled=!state.ownerVisibleResults.length;
    else if(state.activeWorkspace==='reddit') els.exportBtn.disabled=!state.redditVisiblePosts.length;
    else if(state.activeWorkspace==='community') els.exportBtn.disabled=true; // Community Leads has its own export control.
    else els.exportBtn.disabled=!state.visibleResults.length;
  }

  function applySortAndRender() {
    const mode = els.sortBy.value;
    const stageFilter = $('vacantPipelineFilter')?.value || '';
    const list = state.filteredResults.filter(p => !stageFilter || getPipelineStage(p.id)===stageFilter);
    list.sort((a,b) => {
      if (mode === 'value-asc') return a.marketValue-b.marketValue;
      if (mode === 'value-desc') return b.marketValue-a.marketValue;
      if (mode === 'acres-desc') return b.acres-a.acres;
      if (mode === 'acres-asc') return a.acres-b.acres;
      return a.address.localeCompare(b.address);
    });
    state.visibleResults = list; renderAll();
  }
  function renderAll() {
    renderTable(); renderStats(); refreshSavedCounts(); refreshExcludedStreetCount(); renderFollowUpDashboard();
    if (!els.exportBtn) return;
    if (state.activeWorkspace==='commercial') els.exportBtn.disabled=!state.commercialVisibleResults.length;
    else if(state.activeWorkspace==='vacant-commercial') els.exportBtn.disabled=!state.vacantCommercialVisibleResults.length;
    else if(state.activeWorkspace==='property') els.exportBtn.disabled=!state.propertyVisibleResults.length;
    else if(state.activeWorkspace==='owners') els.exportBtn.disabled=!state.ownerVisibleResults.length;
    else if(state.activeWorkspace==='reddit') els.exportBtn.disabled=!state.redditVisiblePosts.length;
    else if(state.activeWorkspace==='community') els.exportBtn.disabled=true; // Community Leads has its own export control.
    else els.exportBtn.disabled=!state.visibleResults.length;
  }
  function renderTable() {
    if (!state.visibleResults.length) { els.resultsBody.innerHTML='<tr class="empty-row"><td colspan="11">No parcels match the current screening or pipeline filters.</td></tr>'; return; }
    const frag=document.createDocumentFragment();
    state.visibleResults.slice(0,renderLimitFor('vacant')).forEach(p=>{
      const lead=state.leadData[p.id]||{}, tr=document.createElement('tr'); tr.dataset.id=p.id; if(state.selectedId===p.id)tr.classList.add('selected');
      tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.address)}</div><div class="address-sub">${escapeHtml([p.city,p.zip,p.account].filter(Boolean).join(' · '))}</div>${streetIdentity(p)?'<button class="street-exclude-inline" type="button">Exclude street</button>':''}</td><td><span class="type-badge ${p.type.toLowerCase()}">${escapeHtml(p.type)}</span></td><td>${escapeHtml(formatDateDisplay(p.parsedDeedDate,p.deedDate))}</td><td>${escapeHtml(formatSize(p))}</td><td>${money(p.marketValue)}</td><td>${escapeHtml(p.owner)}</td><td><span class="sale-badge ${normalizeForSaleStatus(lead.forSale)==='Yes'?'yes':normalizeForSaleStatus(lead.forSale)==='No'?'no':'unknown'}">${normalizeForSaleStatus(lead.forSale)}</span></td><td><span class="status-badge ${lead.priority==='Hot'?'hot':''}">${escapeHtml(lead.status||'Not researched')}</span></td><td>${pipelineCell(p,'vacant')}</td><td>${nextBestActionCell(p,'vacant')}</td>`;
      tr.addEventListener('click',e=>{if(e.target.closest('.star-btn,.street-exclude-inline,.pipeline-stage-btn,.pipeline-followup-btn'))return;openDetails(p.id)});
      tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();toggleLeadSaved(p.id)}); const sb=tr.querySelector('.street-exclude-inline'); if(sb)sb.addEventListener('click',e=>{e.stopPropagation();excludeStreetForParcel(p)}); frag.appendChild(tr);
    }); els.resultsBody.replaceChildren(frag); appendLoadMoreButton(els.resultsBody,'vacant',state.visibleResults.length,11);
  }

  function applyCommercialSortAndRender() {
    const mode=els.commercialSortBy.value, stage=$('commercialPipelineFilter')?.value||'';
    const list=state.commercialVisibleResults.filter(p=>!stage||getPipelineStage(p.id)===stage);
    list.sort((a,b)=>mode==='value-desc'?b.marketValue-a.marketValue||a.address.localeCompare(b.address):mode==='value-asc'?a.marketValue-b.marketValue||a.address.localeCompare(b.address):mode==='building-desc'?b.livingArea-a.livingArea||a.address.localeCompare(b.address):mode==='acres-desc'?b.acres-a.acres||a.address.localeCompare(b.address):a.address.localeCompare(b.address));
    state.commercialVisibleResults=list;renderCommercialTable();if(els.commercialStatCount)els.commercialStatCount.textContent=list.length.toLocaleString();if(state.activeWorkspace==='commercial')els.exportBtn.disabled=!list.length;refreshSavedCounts();renderFollowUpDashboard();
  }
  function renderCommercialTable() {
    if(!state.commercialVisibleResults.length){els.commercialResultsBody.innerHTML='<tr class="empty-row"><td colspan="11">No commercial properties match the current filters.</td></tr>';return}
    const frag=document.createDocumentFragment(); for(const p of state.commercialVisibleResults.slice(0,renderLimitFor('commercial'))){const lead=state.leadData[p.id]||{},ownerPerson=parseIndividualOwner(p.owner),tr=document.createElement('tr');tr.dataset.id=p.id;if(state.commercialSelectedId===p.id)tr.classList.add('selected');const forSale=normalizeForSaleStatus(lead.forSale);tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.address)}</div><div class="address-sub">${escapeHtml([p.city,p.zip,p.account].filter(Boolean).join(' · '))}</div></td><td><span class="type-badge commercial">${escapeHtml(p.type)}</span></td><td>${p.livingArea?`${Math.round(p.livingArea).toLocaleString()} sf`:'—'}</td><td>${money(p.marketValue)}</td><td><span class="sale-badge ${forSale==='Yes'?'yes':forSale==='No'?'no':'unknown'}">${forSale}</span></td><td>${escapeHtml(formatDateDisplay(p.parsedDeedDate,p.deedDate))}</td><td><div>${escapeHtml(ownerPerson?ownerPerson.display:p.owner)}</div><button class="exclude-owner-inline" type="button">Exclude owner</button></td><td><span class="status-badge ${lead.priority==='Hot'?'hot':''}">${escapeHtml(lead.status||'Not researched')}</span></td><td>${pipelineCell(p,'commercial')}</td><td>${nextBestActionCell(p,'commercial')}</td>`;tr.addEventListener('click',e=>{if(e.target.closest('.star-btn,.exclude-owner-inline,.pipeline-stage-btn,.pipeline-followup-btn'))return;openCommercialDetails(p.id)});tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();toggleCommercialLeadSaved(p.id)});tr.querySelector('.exclude-owner-inline').addEventListener('click',e=>{e.stopPropagation();excludeCommercialOwner(p)});frag.appendChild(tr)}els.commercialResultsBody.replaceChildren(frag);appendLoadMoreButton(els.commercialResultsBody,'commercial',state.commercialVisibleResults.length,11);
  }

  function applyOwnerSortAndRender() {
    const mode=els.ownerSortBy.value,stage=$('ownerPipelineFilter')?.value||'';
    const list=state.ownerVisibleResults.filter(p=>!stage||getPipelineStage(p.id)===stage);
    list.sort((a,b)=>mode==='years-desc'?b.yearsOwned-a.yearsOwned||a.address.localeCompare(b.address):mode==='years-asc'?a.yearsOwned-b.yearsOwned||a.address.localeCompare(b.address):mode==='value-desc'?b.marketValue-a.marketValue||a.address.localeCompare(b.address):mode==='value-asc'?a.marketValue-b.marketValue||a.address.localeCompare(b.address):a.address.localeCompare(b.address));
    state.ownerVisibleResults=list;renderOwnerTable();if(els.ownerStatCount)els.ownerStatCount.textContent=list.length.toLocaleString();if(state.activeWorkspace==='owners')els.exportBtn.disabled=!list.length;refreshSavedCounts();renderFollowUpDashboard();
  }
  function renderOwnerTable() {
    if(!state.ownerVisibleResults.length){els.ownerResultsBody.innerHTML='<tr class="empty-row"><td colspan="10">No long-term owners match the current filters.</td></tr>';return}
    const frag=document.createDocumentFragment();for(const p of state.ownerVisibleResults.slice(0,renderLimitFor('owners'))){const lead=state.leadData[p.id]||{},ownerPerson=parseIndividualOwner(p.owner),tr=document.createElement('tr');tr.dataset.id=p.id;if(state.ownerSelectedId===p.id)tr.classList.add('selected');tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.address)}</div><div class="address-sub">${escapeHtml([p.city,p.zip,p.account].filter(Boolean).join(' · '))}</div></td><td><strong>${escapeHtml(String(p.yearsOwned))} years</strong></td><td>${escapeHtml(formatDateDisplay(p.parsedDeedDate,p.deedDate))}</td><td>${money(p.marketValue)}</td><td>${escapeHtml(ownerPerson?ownerPerson.display:p.owner)}</td><td><span class="occupancy-badge ${p.ownerOccupied?'yes':'no'}">${p.ownerOccupied?'Likely':'No match'}</span></td><td><span class="status-badge ${lead.priority==='Hot'?'hot':''}">${escapeHtml(lead.status||'Not researched')}</span></td><td>${pipelineCell(p,'owners')}</td><td>${nextBestActionCell(p,'owners')}</td>`;tr.addEventListener('click',e=>{if(e.target.closest('.star-btn,.pipeline-stage-btn,.pipeline-followup-btn'))return;openOwnerDetails(p.id)});tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();toggleOwnerLeadSaved(p.id)});frag.appendChild(tr)}els.ownerResultsBody.replaceChildren(frag);appendLoadMoreButton(els.ownerResultsBody,'owners',state.ownerVisibleResults.length,10);
  }

  function applyVacantCommercialFiltersAndRender() {
    let list=state.vacantCommercialResults.filter(p=>{
      if(els.vcZip?.value.trim()&&p.zip.slice(0,5)!==els.vcZip.value.trim())return false;if(els.vcCity?.value.trim()&&!p.city.toLowerCase().includes(els.vcCity.value.trim().toLowerCase()))return false;if(els.vcCounty?.value&&!p.county.toLowerCase().includes(els.vcCounty.value.toLowerCase()))return false;if(els.vcNeighborhood?.value.trim()&&!p.legal.toLowerCase().includes(els.vcNeighborhood.value.trim().toLowerCase()))return false;if(els.vcCorridor?.value.trim()&&!p.address.toLowerCase().includes(els.vcCorridor.value.trim().toLowerCase()))return false;if(els.vcType?.value&&els.vcType.value!=='all'&&p.type!==els.vcType.value)return false;if(!rangeMatch(p.livingArea,els.vcBuildingSize?.value||'all'))return false;if(!rangeMatch(p.acres,els.vcLotSize?.value||'all'))return false;if(!rangeMatch(p.marketValue,els.vcValueRange?.value||'all'))return false;const ot=els.vcOwnerType?.value||'all';if(ot!=='all'){const person=Boolean(parseIndividualOwner(p.owner)),inst=looksInstitutionalCommercialOwner(p.owner);if(ot==='individual'&&!person)return false;if(ot==='institutional'&&!inst)return false;if(ot==='local-entity'&&(person||inst))return false}const own=Number(els.vcOwnership?.value||0);if(own&&(!(Number.isFinite(p.yearsOwned))||p.yearsOwned<own))return false;const sale=Number(els.vcLastSale?.value||0);if(sale&&(!(Number.isFinite(p.yearsOwned))||p.yearsOwned<sale))return false;if(p.vacancyConfidence<Number(els.vcConfidence?.value||0))return false;const stage=$('vcPipelineFilter')?.value||'';if(stage&&getPipelineStage(p.id)!==stage)return false;if(isCommercialOwnerExcluded(p.owner))return false;return true});
    const sort=els.vcSortBy?.value||'confidence-desc';list=[...list].sort((a,b)=>sort==='value-desc'?b.marketValue-a.marketValue:sort==='ownership-desc'?(b.yearsOwned||0)-(a.yearsOwned||0):sort==='address'?a.address.localeCompare(b.address):b.vacancyConfidence-a.vacancyConfidence);state.vacantCommercialVisibleResults=list;renderVacantCommercialTable();if(els.vcStatCount)els.vcStatCount.textContent=list.length.toLocaleString();if(state.activeWorkspace==='vacant-commercial')els.exportBtn.disabled=!list.length;renderFollowUpDashboard();
  }
  function renderVacantCommercialTable() {
    if(!els.vcResultsBody)return;
    if(!state.vacantCommercialVisibleResults.length){els.vcResultsBody.innerHTML='<tr class="empty-row"><td colspan="12">No improved commercial-building candidates match the stacked or pipeline filters.</td></tr>';return}
    const frag=document.createDocumentFragment();
    state.vacantCommercialVisibleResults.slice(0,renderLimitFor('vacant-commercial')).forEach(p=>{
      const lead=state.leadData[p.id]||{},tr=document.createElement('tr');tr.dataset.id=p.id;
      tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.address)}</div><div class="address-sub">${escapeHtml([p.city,p.zip,p.account].filter(Boolean).join(' · '))}</div></td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(parseIndividualOwner(p.owner)?.display||p.owner)}</td><td>${money(p.marketValue)}</td><td>${p.livingArea?`${Math.round(p.livingArea).toLocaleString()} sf`:'—'}</td><td>${p.yearBuilt||'—'}</td><td><div class="vacancy-score"><strong>${p.vacancyConfidence}</strong><span>/100</span></div></td><td><div class="action-reason">${escapeHtml(p.vacancyReason)}</div></td><td>${escapeHtml(p.vacancySource)}</td><td>${pipelineCell(p,'vacant-commercial')}</td><td>${nextBestActionCell(p,'vacant-commercial')}</td>`;
      tr.addEventListener('click',e=>{if(e.target.closest('.star-btn,.pipeline-stage-btn,.pipeline-followup-btn'))return;openVacantCommercialDetails(p.id)});
      tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();toggleVacantCommercialLeadSaved(p.id)});
      frag.appendChild(tr);
    });
    els.vcResultsBody.replaceChildren(frag);
    appendLoadMoreButton(els.vcResultsBody,'vacant-commercial',state.vacantCommercialVisibleResults.length,12);
  }
  function leadQualityForProperty(p) {
    let score=35;const reasons=[];const years=Number.isFinite(Number(p?.yearsOwned))?Number(p.yearsOwned):null;
    if(years!==null){if(years>=20){score+=22;reasons.push(`Owned about ${years} years.`)}else if(years>=10){score+=15;reasons.push(`Owned about ${years} years.`)}else if(years>=5){score+=8;reasons.push(`Owned about ${years} years.`)}}else reasons.push('Ownership length is not verified.');
    if(parseIndividualOwner(p?.owner)){score+=12;reasons.push('County record appears to show an individual owner.')}else if(looksInstitutionalCommercialOwner(p?.owner)||looksGovernmentOwned(p?.owner)||looksBuilderOwned(p?.owner)){score-=18;reasons.push('Owner appears institutional, governmental, or development-related.')}else{score+=6;reasons.push('Owner appears to be a local/entity owner rather than a major institution.')}
    if(p?.ownerOccupied===false&&p?.ownerAddress){score+=10;reasons.push('Mailing address does not appear to match the property address.')}else if(p?.ownerOccupied){reasons.push('Owner mailing address appears to match the property.')}
    if(Number(p?.marketValue||0)>0)score+=5;if(p?.deedDate)score+=5;
    score=Math.max(0,Math.min(100,Math.round(score)));return{score,reason:reasons.slice(0,3).join(' ')||'Score uses available ownership and property-record signals.'};
  }
  function qualityScoreCell(p) { const q=leadQualityForProperty(p); return `<div class="lead-quality-score"><strong>${q.score}</strong><span>/100</span></div><div class="lead-quality-reason">${escapeHtml(q.reason)}</div>`; }

  function normalizePropertyFeature(feature) {
    const a=feature?.properties||{},account=String(a.ACCOUNT||a.TAXPIN||a.PIDN||a.OBJECTID||'').trim();if(!account)return null;
    const useCode=cleanText(a.STATE_USE_CODE||a.PROPERTY_CLASS_CODE).toUpperCase();let type='Property';if(/^A/.test(useCode))type='Residential';else if(/^B/.test(useCode))type='Multifamily';else if(['F1','EC'].includes(useCode))type='Commercial';else if(useCode==='F2')type='Industrial';else if(['C1C','C2C'].includes(useCode))type='Commercial Land';else if(/^C/.test(useCode)||/^O/.test(useCode))type='Vacant Land';else if(cleanText(a.BUILDING_TYPE))type=cleanText(a.BUILDING_TYPE);
    const acres=finiteOrNull(a.LAND_ACRE)??finiteOrNull(a.CalcAcres)??(finiteOrNull(a.LAND_SQFT)!==null?Number(a.LAND_SQFT)/43560:null),address=cleanText(a.SITUS_ADDR||a.STREET_ADDRESS||'Property address unavailable'),deedDate=cleanText(a.DEED_DATE),parsedDeedDate=parseDateLoose(deedDate),yearsOwned=parsedDeedDate?fullYearsSince(parsedDeedDate):null,ownerStreet=cleanText(a.OWNER_ADDRESS),ownerZip=cleanText(a.OWNER_ZIP_CODE),zip=cleanText(a.Situs_ZipCode),ownerOccupied=addressesLikelyMatch(address,zip,ownerStreet,ownerZip);
    const p={id:account,objectId:a.OBJECTID,account,address,zip,city:resolveDisplayCity(a.DISPLAY_CITY||a.CITYNAME,zip),county:cleanText(a.COUNTYNAME),legal:cleanText(a.PARCEL_LEGAL_DESCRIPTION),type,useCode,propertyClass:cleanText(a.PROPERTY_CLASS_CODE),acres,sqft:finiteOrNull(a.LAND_SQFT),marketValue:Number(finiteOrNull(a.MARKET_VALUE)||finiteOrNull(a.APPRAISED_VALUE)||0),appraisedValue:Number(finiteOrNull(a.APPRAISED_VALUE)||0),landValue:Number(finiteOrNull(a.LAND_VAL)||0),improvementValue:Number(finiteOrNull(a.IMPR_VAL)||0),structureCount:Number(finiteOrNull(a.STRUCT_CNT)||0),yearBuilt:Number(finiteOrNull(a.YR_BUILT)||0),livingArea:Number(finiteOrNull(a.LIVING_AREA)||0),buildingType:cleanText(a.BUILDING_TYPE),owner:cleanText(a.OWNER_NAME||'Owner not listed'),ownerAddress:cleanText([a.OWNER_ADDRESS,a.OWNER_CITY_ST,a.OWNER_ZIP_CODE].filter(Boolean).join(', ')),deedDate,parsedDeedDate,yearsOwned,ownerOccupied,geometry:feature.geometry||null,dataLoadDate:a.Data_Load_Date||null,searchKind:'property',leadKind:'Property Search'};const q=leadQualityForProperty(p);p.leadQualityScore=q.score;p.leadQualityReason=q.reason;return p;
  }
  async function runPropertySearch() {
    const address=$('propertyAddressInput')?.value.trim()||'';if(address.length<5)return showError('Enter a property address.');
    if($('propertySearchBtn')){$('propertySearchBtn').disabled=true;$('propertySearchBtn').textContent='Searching';}setPropertyStatus('Searching public parcel records…');closeDrawer();
    try{const r=await fetch(`/api/property?address=${encodeURIComponent(address)}`,{cache:'no-store'});let data;try{data=await r.json()}catch{throw new Error(`local service returned HTTP ${r.status}`)}if(!r.ok||data.error)throw new Error(data.error||`local service returned HTTP ${r.status}`);state.propertyResults=(Array.isArray(data.features)?data.features:[]).map(esriFeatureToGeoJson).map(normalizePropertyFeature).filter(Boolean);hydrateSavedLeadParcels(state.propertyResults);applyPropertyFiltersAndRender();if(!state.propertyResults.length)setPropertyStatus('No matching parcel was found in the currently supported public GIS sources.','error');else setPropertyStatus(`Found ${state.propertyResults.length} matching parcel${state.propertyResults.length===1?'':'s'}. Source: ${data.source||'public parcel/GIS records'}.`,'success');}
    catch(err){console.error(err);setPropertyStatus(`Search failed: ${friendlyError(err)}.`,'error');showError(`Property search failed: ${friendlyError(err)}.`)}finally{if($('propertySearchBtn')){$('propertySearchBtn').disabled=false;$('propertySearchBtn').textContent='Search';}}
  }
  function applyPropertyFiltersAndRender(){const stage=$('propertyPipelineFilter')?.value||'';state.propertyVisibleResults=state.propertyResults.filter(p=>!stage||getPipelineStage(p.id)===stage);renderPropertyTable();if($('propertyStatCount'))$('propertyStatCount').textContent=state.propertyVisibleResults.length.toLocaleString();if(state.activeWorkspace==='property')els.exportBtn.disabled=!state.propertyVisibleResults.length;renderFollowUpDashboard();}
  function renderPropertyTable(){const host=$('propertyResultsBody');if(!host)return;if(!state.propertyVisibleResults.length){host.innerHTML='<tr class="empty-row"><td colspan="8">No property result matches the current pipeline filter.</td></tr>';return}const frag=document.createDocumentFragment();for(const p of state.propertyVisibleResults){const lead=state.leadData[p.id]||{},tr=document.createElement('tr');tr.dataset.id=p.id;tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.address)}</div><div class="address-sub">${escapeHtml([p.city,p.zip,p.account].filter(Boolean).join(' · '))}</div></td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(parseIndividualOwner(p.owner)?.display||p.owner)}</td><td>${money(p.marketValue)}</td><td>${qualityScoreCell(p)}</td><td>${pipelineCell(p,'property')}</td><td>${nextBestActionCell(p,'property')}</td>`;tr.addEventListener('click',e=>{if(e.target.closest('.star-btn,.pipeline-stage-btn,.pipeline-followup-btn'))return;openPropertyDetails(p.id)});tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();togglePropertyLeadSaved(p.id)});frag.appendChild(tr)}host.replaceChildren(frag)}
  function togglePropertyLeadSaved(id){const p=state.propertyResults.find(x=>x.id===id);if(!p)return;const current=state.leadData[id]||{},nextSaved=!current.saved;state.leadData[id]={...current,saved:nextSaved,parcel:parcelSnapshot(p),updatedAt:new Date().toISOString()};persistLeadData();refreshSavedCounts();renderPropertyTable()}
  function clearPropertySearch(){state.propertyResults=[];state.propertyVisibleResults=[];state.propertySelectedId=null;if($('propertyAddressInput'))$('propertyAddressInput').value='';if($('propertyPipelineFilter'))$('propertyPipelineFilter').value='';renderPropertyTable();if($('propertyStatCount'))$('propertyStatCount').textContent='0';setPropertyStatus('Ready.')}
  function setPropertyStatus(text,type=''){const el=$('propertyStatusText');if(!el)return;el.textContent=text;el.className=`status-text ${type}`.trim()}

  function openVacantCommercialDetails(id){const p=state.vacantCommercialResults.find(x=>x.id===id);if(!p)return;destroyDetailMap();const tpl=$('vacantCommercialDetailTemplate');if(!tpl)return;const node=tpl.content.cloneNode(true),lead=state.leadData[id]||{},person=parseIndividualOwner(p.owner),q=leadQualityForProperty(p),nba=getNextBestAction(p,'vacant-commercial');els.detailAddress.textContent=p.address;if(els.detailEyebrow)els.detailEyebrow.textContent='VACANT COMMERCIAL DETAILS';node.querySelector('#vcOwner').textContent=person?person.display:(p.owner||'—');node.querySelector('#vcOwnerAddress').textContent=p.ownerAddress||'—';const fps=node.querySelector('#vcFastPeopleSearchBtn');if(person?.firstName&&person?.lastName)fps.href=buildFastPeopleSearchUrl(person,p.ownerAddress);else fps.hidden=true;node.querySelector('#vcVacancyScore').textContent=`${p.vacancyConfidence}/100`;node.querySelector('#vcLeadQuality').textContent=`${q.score}/100 — ${q.reason}`;node.querySelector('#vcVacancyReason').textContent=p.vacancyReason||'—';node.querySelector('#vcVacancySource').textContent=p.vacancySource||'Public parcel/GIS records';node.querySelector('#vcNextAction').textContent=`${nba.action} — ${nba.reason}`;node.querySelector('#vcAccount').textContent=p.account||'—';node.querySelector('#vcPropertyType').textContent=p.type||'—';node.querySelector('#vcMarket').textContent=money(p.marketValue);node.querySelector('#vcLastSold').textContent=formatDateDisplay(p.parsedDeedDate,p.deedDate);node.querySelector('#vcYearsOwned').textContent=Number.isFinite(p.yearsOwned)?`${p.yearsOwned} years`:'—';node.querySelector('#vcBuildingArea').textContent=p.livingArea?`${Math.round(p.livingArea).toLocaleString()} sf`:'—';node.querySelector('#vcLotSizeDetail').textContent=formatSize(p);node.querySelector('#vcYearBuilt').textContent=p.yearBuilt||'—';node.querySelector('#vcUseCode').textContent=p.useCode||p.propertyClass||'—';node.querySelector('#vcForSaleDisplay').textContent=normalizeForSaleStatus(lead.forSale);node.querySelector('#vcLegal').textContent=p.legal||'—';const saveBtn=node.querySelector('#vcDetailSaveLead');saveBtn.textContent=lead.saved?'Saved Lead ✓':'Save Lead';saveBtn.addEventListener('click',()=>{toggleVacantCommercialLeadSaved(id);saveBtn.textContent=(state.leadData[id]||{}).saved?'Saved Lead ✓':'Save Lead'});const excludeBtn=node.querySelector('#vcDetailExcludeOwner');excludeBtn?.addEventListener('click',()=>{const owner=cleanText(p.owner),key=commercialOwnerKey(owner);if(!key||!owner)return;const matching=state.vacantCommercialResults.filter(x=>commercialOwnerKey(x.owner)===key).length;if(!window.confirm(`Exclude ${owner} and hide all ${matching} matching vacant-commercial propert${matching===1?'y':'ies'} from current and future searches?`))return;state.excludedCommercialOwners[key]={key,owner,addedAt:new Date().toISOString()};persistExcludedCommercialOwners();closeDrawer();applyVacantCommercialFiltersAndRender();});const tad=node.querySelector('#vcDetailTadLink');if((p.county||'').toUpperCase().includes('TARRANT')&&p.account)tad.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`;else tad.style.display='none';const full=[p.address,p.city,'TX',p.zip].filter(Boolean).join(', ');node.querySelector('#vcDetailGoogleLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;node.querySelector('#vcListingSearchLink').href=`https://www.google.com/search?q=${encodeURIComponent(`"${full}" property for sale`)}`;node.querySelector('#vcLeadEmail').value=lead.email||'';node.querySelector('#vcForSale').value=normalizeForSaleStatus(lead.forSale);node.querySelector('#vcLeadStatus').value=lead.status||'Not researched';node.querySelector('#vcLeadPriority').value=lead.priority||'Normal';node.querySelector('#vcLeadNotes').value=lead.notes||'';node.querySelector('#saveVcContactBtn').addEventListener('click',()=>{saveLeadRecord(id,{email:els.detailContent.querySelector('#vcLeadEmail').value.trim(),forSale:els.detailContent.querySelector('#vcForSale').value,status:els.detailContent.querySelector('#vcLeadStatus').value,priority:els.detailContent.querySelector('#vcLeadPriority').value,notes:els.detailContent.querySelector('#vcLeadNotes').value.trim()},p);refreshSavedCounts();renderVacantCommercialTable();saveBtn.textContent='Saved Lead ✓';const msg=els.detailContent.querySelector('#vcSaveConfirmation');msg.textContent='Saved locally.';setTimeout(()=>{if(msg)msg.textContent=''},1800)});els.detailContent.replaceChildren(node);els.detailDrawer.classList.add('open');els.detailDrawer.setAttribute('aria-hidden','false');setTimeout(()=>renderDetailMap(p),0)}

  function openPropertyDetails(id){const p=state.propertyResults.find(x=>x.id===id);if(!p)return;destroyDetailMap();const tpl=$('propertyDetailTemplate');if(!tpl)return;const node=tpl.content.cloneNode(true),lead=state.leadData[id]||{},person=parseIndividualOwner(p.owner),q=leadQualityForProperty(p),nba=getNextBestAction(p,'property');els.detailAddress.textContent=p.address;if(els.detailEyebrow)els.detailEyebrow.textContent='PROPERTY SEARCH DETAILS';node.querySelector('#pOwner').textContent=person?person.display:(p.owner||'—');node.querySelector('#pOwnerAddress').textContent=p.ownerAddress||'—';const fps=node.querySelector('#propertyFastPeopleSearchBtn');if(person?.firstName&&person?.lastName)fps.href=buildFastPeopleSearchUrl(person,p.ownerAddress);else fps.hidden=true;node.querySelector('#pLeadQuality').textContent=`${q.score}/100`;node.querySelector('#pQualityReason').textContent=q.reason;node.querySelector('#pNextAction').textContent=`${nba.action} — ${nba.reason}`;node.querySelector('#pForSaleDisplay').textContent=normalizeForSaleStatus(lead.forSale);node.querySelector('#pAccount').textContent=p.account||'—';node.querySelector('#pType').textContent=p.type||p.useCode||'—';node.querySelector('#pMarket').textContent=money(p.marketValue||p.appraisedValue);node.querySelector('#pLastSold').textContent=formatDateDisplay(p.parsedDeedDate,p.deedDate);node.querySelector('#pYearsOwned').textContent=Number.isFinite(p.yearsOwned)?`${p.yearsOwned} years`:'—';node.querySelector('#pLotSize').textContent=formatSize(p);node.querySelector('#pBuildingSize').textContent=p.livingArea?`${Math.round(p.livingArea).toLocaleString()} sf`:'—';node.querySelector('#pYearBuilt').textContent=p.yearBuilt||'—';node.querySelector('#pUseCode').textContent=p.useCode||p.propertyClass||'—';node.querySelector('#pOwnerOccupied').textContent=p.ownerOccupied?'Likely — mailing address matches property':'Not indicated by mailing address';node.querySelector('#pLegal').textContent=p.legal||'—';const saveBtn=node.querySelector('#propertyDetailSaveLead');saveBtn.textContent=lead.saved?'Saved Lead ✓':'Save Lead';saveBtn.addEventListener('click',()=>{togglePropertyLeadSaved(id);saveBtn.textContent=(state.leadData[id]||{}).saved?'Saved Lead ✓':'Save Lead'});const tad=node.querySelector('#propertyDetailTadLink');if((p.county||'').toUpperCase().includes('TARRANT')&&p.account)tad.href=`https://www.tad.org/property?account=${encodeURIComponent(p.account)}`;else tad.style.display='none';const full=[p.address,p.city,'TX',p.zip].filter(Boolean).join(', ');node.querySelector('#propertyDetailGoogleLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;node.querySelector('#propertyListingSearchLink').href=`https://www.google.com/search?q=${encodeURIComponent(`"${full}" property for sale`)}`;node.querySelector('#propertyLeadEmail').value=lead.email||'';node.querySelector('#propertyForSale').value=normalizeForSaleStatus(lead.forSale);node.querySelector('#propertyLeadStatus').value=lead.status||'Not researched';node.querySelector('#propertyLeadPriority').value=lead.priority||'Normal';node.querySelector('#propertyLeadNotes').value=lead.notes||'';node.querySelector('#savePropertyContactBtn').addEventListener('click',()=>{saveLeadRecord(id,{email:els.detailContent.querySelector('#propertyLeadEmail').value.trim(),forSale:els.detailContent.querySelector('#propertyForSale').value,status:els.detailContent.querySelector('#propertyLeadStatus').value,priority:els.detailContent.querySelector('#propertyLeadPriority').value,notes:els.detailContent.querySelector('#propertyLeadNotes').value.trim()},p);refreshSavedCounts();renderPropertyTable();saveBtn.textContent='Saved Lead ✓';const msg=els.detailContent.querySelector('#propertySaveConfirmation');msg.textContent='Saved locally.';setTimeout(()=>{if(msg)msg.textContent=''},1800)});els.detailContent.replaceChildren(node);els.detailDrawer.classList.add('open');els.detailDrawer.setAttribute('aria-hidden','false');setTimeout(()=>renderDetailMap(p),0)}

  // The pure engine handles ID normalization, date verification, scoring and region search prompts.
  // Never reject legitimate direct-post candidates only because date evidence is missing.
  function redditImportRejectReason(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'Invalid post entry';
    if(!RedditEngine.canonicalUrl(raw.url||raw.link||raw.redditUrl))return 'Missing or invalid original Reddit post URL';
    if(!cleanText(raw.title||raw.post_title||raw.redditTitle))return 'Missing post title';
    return '';
  }
  function normalizeRedditPost(raw){return RedditEngine.normalize(raw);}
  function buildRelocationPrompt(){return RedditEngine.buildPrompt(currentRedditRegionId());}

  function setRedditImportCollapsed(collapsed, message = '') {
    if (!els.redditImportCard || !els.redditImportCollapsed) return;
    els.redditImportCard.hidden = !!collapsed;
    els.redditImportCollapsed.hidden = !collapsed;
    if (message && els.redditImportCollapsedSummary) els.redditImportCollapsedSummary.textContent = message;
    if (!collapsed) els.redditImportText?.focus();
  }

  function describeImportAudit(audit) {
    if (!audit || typeof audit !== 'object') return '';
    const values = ['newest_subreddit_pass','community_discovery_pass','city_web_pass','gap_check','web_index_pass','newest_pass','city_expansion_pass','fresh_pass','broad_pass','limitations'].map(key => {
      const entry = audit[key];
      if (!entry) return '';
      const val = Array.isArray(entry) ? entry.join(', ') : typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
      return `${key.replace('_',' ')}: ${val.slice(0, 300)}`;
    }).filter(Boolean);
    return values.length ? values.join(' | ') : '';
  }

  function importRedditResults(){
    const content=els.redditImportText?.value||'';
    if(!content.trim()){setRedditStatus('Paste the JSON results from ChatGPT first.','error');return;}
    try{
      const payload=extractJsonPayload(content);
      const standard=Array.isArray(payload)?payload:(Array.isArray(payload?.posts)?payload.posts:[]);
      const research=Array.isArray(payload?.research_candidates)?payload.research_candidates:[];
      const list=[...standard,...research.map(x=>x&&typeof x==='object'?{...x,lead_type:'Research'}:x)];
      const normalized=[],seen=new Set(),rejects=new Map();let duplicates=0,alreadyWorked=0;
      for(const raw of list){
        const reason=redditImportRejectReason(raw);
        if(reason){rejects.set(reason,(rejects.get(reason)||0)+1);continue;}
        const p=normalizeRedditPost(raw);
        if(!p){rejects.set('Could not normalize post',(rejects.get('Could not normalize post')||0)+1);continue;}
        if(isRedditWorked(p)){alreadyWorked++;continue;}
        if(seen.has(p.postKey)){duplicates++;continue;}
        seen.add(p.postKey);normalized.push(p);
      }
      const existing=new Map(),preservedLegacy=[];
      // Retain even unrecognized legacy entries on deliberate imports, never silently delete them.
      for(const raw of state.redditPosts){
        const p=normalizeRedditPost(raw);if(!p){preservedLegacy.push(raw);continue;}
        if(!existing.has(p.postKey)||state.leadData[p.id]?.saved)existing.set(p.postKey,p);
      }
      let added=0,review=0,verified=0,expired=0;
      const selectedRegion=currentRedditRegionId();
      const reportedRegion=cleanText(payload?.region_id||payload?.search_audit?.region_id);
      const importRegionId=RedditEngine.REGIONS.some(r=>r.id===reportedRegion)?reportedRegion:selectedRegion;
      for(const p of normalized){
        if(!p.regionId)p.regionId=importRegionId;
        if(p.verification==='verified')verified++;else if(p.verification==='expired')expired++;else review++;
        const prev=existing.get(p.postKey);
        if(!prev){added++;existing.set(p.postKey,p);}else{
          // An existing saved/pipeline identity must not be lost because an imported URL changed.
          const oldStage=state.leadData[prev.id];
          const keepPrev=!!(oldStage?.saved||oldStage?.pipelineStage&&oldStage.pipelineStage!=='Unworked');
          const better=p.verification==='verified'&&prev.verification!=='verified';
          if(better||!keepPrev)existing.set(p.postKey,{...p,id:prev.id,importedAt:prev.importedAt||p.importedAt});
        }
      }
      const previous=state.redditPosts;
      state.redditPosts=[...existing.values(),...preservedLegacy];
      try {persistRedditPosts();}catch(err){state.redditPosts=previous;throw err;}
      const regionId=importRegionId;
      const audit=payload?.search_audit;
      const searched=!!(audit&&typeof audit==='object'&&(['cities_checked','queries_checked','subreddits_checked'].some(k=>Array.isArray(audit[k])&&audit[k].length>0)));
      const priorAudit=state.redditCoverage[regionId];
      state.redditCoverage[regionId]={lastImportedAt:new Date().toISOString(),searchReported:searched,verifiedCount:verified,reviewCount:review,expiredCount:expired,rejectedCount:[...rejects.values()].reduce((a,b)=>a+b,0),limitations:cleanText(audit?.limitations),searchAudit:audit||null};
      let coverageWarning='';
      try{persistRedditCoverage();}catch(err){state.redditCoverage[regionId]=priorAudit;coverageWarning=friendlyError(err);}
      renderRedditCoverage();applyRedditFiltersAndRender();
      const rejectsCount=[...rejects.values()].reduce((a,b)=>a+b,0);
      const summary=`${added} new lead${added===1?'':'s'}; ${verified} date-verified, ${review} need date review, ${expired} older; ${duplicates} duplicate${duplicates===1?'':'s'}, ${alreadyWorked} worked, ${rejectsCount} invalid.`;
      if(added>0){els.redditImportText.value='';setRedditImportCollapsed(true,summary);setRedditStatus(coverageWarning?summary+' Coverage save failed: '+coverageWarning:summary,coverageWarning?'error':'success');}
      else {setRedditImportCollapsed(false);setRedditStatus((!list.length?'No posts returned. ': 'No new posts. ')+summary+(coverageWarning?' Coverage save failed: '+coverageWarning:''),coverageWarning?'error':'success');}
      if(els.redditImportFeedback){
        const reasons=[...rejects].map(([reason,n])=>`${reason}: ${n}`).join('; ');
        els.redditImportFeedback.textContent=[summary,coverageWarning?'Coverage save failed: '+coverageWarning:'',reasons?`Invalid: ${reasons}`:'',`Coverage for ${regionId}: ${searched?'ChatGPT reported queries checked (not independently confirmed)':'No auditable searches reported'}.`,describeImportAudit(audit),'Date evidence is supplied by ChatGPT and not independently fetched by LeadForge. Unverified posts are review candidates, not confirmed fresh posts.'].filter(Boolean).join('\n');
        els.redditImportFeedback.hidden=false;
      }
    }catch(err){setRedditStatus(`Import failed: ${friendlyError(err)}`,'error');setRedditImportCollapsed(false);if(els.redditImportFeedback){els.redditImportFeedback.textContent=`Import failed: ${friendlyError(err)}`;els.redditImportFeedback.hidden=false;}}
  }
  function applyRedditFiltersAndRender(){
    const q=cleanText(els.redditFilterInput?.value).toLowerCase();
    const status=els.redditStatusFilter?.value||'verified';
    // VIEW ONLY: no storage writes. Aging posts remain saved for review/history/pipeline.
    let list=state.redditPosts.map(p=>{
      const fresh=RedditEngine.verification(p);
      return {...p,verification:fresh,ageDays:RedditEngine.age(p.postDate)};
    }).filter(p=>!!RedditEngine.canonicalUrl(p.url)).filter(p=>!isRedditWorked(p)).filter(p=>status==='all'||p.verification===status)
      .filter(p=>!q||[p.title,p.subreddit,p.area,p.leadType,p.snippet].filter(Boolean).join(' ').toLowerCase().includes(q));
    const sort=els.redditSortBy?.value||'score-desc';
    list.sort((a,b)=>sort==='score-desc'?(b.opportunityScore||0)-(a.opportunityScore||0)||((a.ageDays??1e5)-(b.ageDays??1e5)):sort==='oldest'?(b.ageDays??-1)-(a.ageDays??-1):sort==='area'?a.area.localeCompare(b.area):sort==='subreddit'?a.subreddit.localeCompare(b.subreddit):(a.ageDays??1e5)-(b.ageDays??1e5));
    state.redditVisiblePosts=list;renderRedditTable();
    if(els.redditStatCount)els.redditStatCount.textContent=state.redditPosts.filter(p=>!isRedditWorked(p)&&RedditEngine.verification(p)==='verified'&&getPipelineStage(p.id)==='Unworked').length.toLocaleString();
    if(els.redditReviewCount)els.redditReviewCount.textContent=state.redditPosts.filter(p=>!isRedditWorked(p)&&RedditEngine.verification(p)==='needs-review').length.toLocaleString();
    if(els.redditArchiveCount)els.redditArchiveCount.textContent=state.redditPosts.filter(p=>!isRedditWorked(p)&&RedditEngine.verification(p)==='expired').length.toLocaleString();
    if(state.activeWorkspace==='reddit'||(state.activeWorkspace==='community'&&window.__leadForgeCommunitySource==='reddit'))els.exportBtn.disabled=!list.length;
    refreshSavedCounts();renderFollowUpDashboard();
  }
  function renderRedditTable() {
    if(!els.redditResultsBody)return;
    if(!state.redditVisiblePosts.length){els.redditResultsBody.innerHTML='<tr class="empty-row"><td colspan="10">No leads in this view. Try Needs Date Verification or Older / Archive, or import a regional search.</td></tr>';return}
    const frag=document.createDocumentFragment();
    for(const p of state.redditVisiblePosts){
      const lead=state.leadData[p.id]||{},tr=document.createElement('tr');tr.dataset.id=p.id;
      tr.innerHTML=`<td><button class="star-btn ${lead.saved?'saved':''}" title="${lead.saved?'Remove saved lead':'Save lead'}">★</button></td><td><div class="address-main">${escapeHtml(p.title)}</div><div class="reddit-snippet">${escapeHtml(p.snippet||'')}</div></td><td>${escapeHtml(p.subreddit)}</td><td>${escapeHtml(p.area)}</td><td>${escapeHtml(formatRedditPostDate(p.postDate))}<div class="reddit-date-note">${p.verification==='verified'?'ChatGPT-reported date':p.verification==='expired'?'Older / Archive':'Needs date verification'}</div></td><td><span class="reddit-age-badge">${p.ageDays===null?'?':p.ageDays===0?'Today':`${p.ageDays}d`}</span></td><td>${escapeHtml(p.leadType)}</td><td>${opportunityCell(p)}</td><td>${nextBestActionCell(p,'reddit')}<div class="reddit-pipeline-compact">${pipelineStageButton(p,'reddit')}</div></td><td><div class="reddit-row-actions"><a class="btn btn-outline btn-compact reddit-open-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Open</a><button class="btn btn-outline btn-compact reddit-dm-btn" type="button">DM</button><button class="btn btn-dark btn-compact reddit-worked-btn" type="button">Worked</button></div></td>`;
      tr.querySelector('.star-btn').addEventListener('click',e=>{e.stopPropagation();toggleRedditLeadSaved(p.id)});
      tr.querySelector('.reddit-dm-btn').addEventListener('click',e=>{e.stopPropagation();openRedditDm(p.id)});
      tr.querySelector('.reddit-worked-btn').addEventListener('click',e=>{e.stopPropagation();markRedditWorked(p.id)});
      tr.addEventListener('dblclick',e=>{if(!e.target.closest('button,a,select'))window.open(p.url,'_blank','noopener,noreferrer')});
      frag.appendChild(tr);
    }
    els.redditResultsBody.replaceChildren(frag);
  }
  function generateRedditDm(p) {const area=cleanText(p?.area)||'DFW',intent=cleanText(p?.leadType);const opener=intent==='Rent'?`I saw your post about moving to ${area} and looking for a rental.`:intent==='Buy'?`I saw your post about moving to ${area} and looking to buy a home.`:`I saw your post about your upcoming move to ${area}.`;const signature=window.LeadForgeSettings?.getSignature?.()||'';return [`Hey! ${opener} I’m a local Realtor in the DFW area and I’d be happy to help you narrow down neighborhoods, housing options, or commute questions. If you’d like some help, message me back and tell me what you’re looking for.`,signature].filter(Boolean).join('\n\n');}

  function getNextBestAction(p, kind) {
    const lead=state.leadData[p?.id]||{},stage=getPipelineStage(p?.id),follow=lead.followUpAt?new Date(lead.followUpAt):null,now=new Date();
    if(stage==='Completed')return{action:'Skip',reason:'This lead is completed and archived from active follow-up.'};
    if(stage==='Closed')return{action:'Follow Up Later',reason:'The transaction is closed; finish any final follow-up, then mark the lead Completed.'};
    if(stage==='Appointment')return{action:follow&&follow<=now?'Call Now':'Follow Up Later',reason:'An appointment-stage lead should be advanced through the scheduled appointment or immediate follow-up.'};
    if(stage==='Contacted')return{action:follow&&follow<=now?'Call Now':'Follow Up Later',reason:follow?'A follow-up is already scheduled for this contacted lead.':'This lead has already been contacted; schedule the next follow-up.'};
    if(kind==='reddit'){if(p?.verification==='needs-review')return{action:'Research Lead',reason:'Original post date has not been verified; confirm freshness before outreach.'};if(p?.verification==='expired')return{action:'Follow Up Later',reason:'Older imported post; evaluate relevance before new outreach.'};if(p?.leadType==='Research')return{action:'Research Lead',reason:p.nextActionReason||'Confirm Buy/Rent intent and the target DFW area before outreach.'};if(p?.nextBestAction)return{action:p.nextBestAction,reason:p.nextActionReason||'Based on the relocation lead details provided by ChatGPT.'};const score=Number(p?.opportunityScore||0);if(String(p?.hasAgent||'').toLowerCase()==='yes')return{action:'Follow Up Later',reason:'The poster appears to already have an agent.'};if(score>=55)return{action:'Send DM',reason:'The post shows actionable relocation intent and can be contacted directly on Reddit.'};return{action:'Research Lead',reason:'The post needs more context before outreach.'}}
    const status=cleanText(lead.status).toLowerCase(),priority=cleanText(lead.priority).toLowerCase();if(/closed|dead|do not contact|not interested/.test(status))return{action:'Skip',reason:'The saved lead status indicates this prospect should not be worked now.'};if(lead.email)return{action:'Send Email',reason:'A usable email address is already saved for this lead.'};if(priority==='hot'&&parseIndividualOwner(p?.owner))return{action:'Call Now',reason:'This is a high-priority owner lead; research the public phone number and contact promptly.'};if(kind==='vacant-commercial'&&Number(p?.vacancyConfidence||0)>=75)return{action:'Research Lead',reason:'Public-record vacancy signals are strong enough to justify owner/contact research; occupancy is not verified.'};if(kind==='owners'&&Number(p?.yearsOwned||0)>=15)return{action:'Research Lead',reason:'Long ownership makes this a stronger prospect, but contact information still needs research.'};if(kind==='property'){const q=leadQualityForProperty(p);return{action:q.score>=70?'Research Lead':'Research Lead',reason:q.score>=70?'The property has stronger ownership/prospecting signals; verify contact information next.':'Review ownership and contact data before selecting an outreach method.'}}if(kind==='vacant'&&(p?.candidateQuality==='Strong'||p?.candidateQuality==='Likely'))return{action:'Research Lead',reason:'The parcel passed the vacancy screening and is worth researching before outreach.'};return{action:'Research Lead',reason:'Research the owner and contact information before choosing an outreach method.'};
  }

  function parcelSnapshot(p) {
    if(!p)return null;return{id:p.id,account:p.account,address:p.address,city:p.city,zip:p.zip,county:p.county,type:p.type,acres:p.acres,sqft:p.sqft,marketValue:p.marketValue,appraisedValue:p.appraisedValue||0,landValue:p.landValue,useCode:p.useCode,propertyClass:p.propertyClass,subdivision:p.subdivision,block:p.block,lot:p.lot,legal:p.legal,owner:p.owner,ownerAddress:p.ownerAddress,geometry:p.geometry||null,leadKind:p.leadKind||(p.searchKind==='owner'?'Long-Term Owner':p.searchKind==='commercial'?'Commercial Property':p.searchKind==='property'?'Property Search':p.searchKind==='vacant-commercial'?'Vacant Commercial Candidate':'Vacant Lot'),deedDate:p.deedDate||'',yearsOwned:(p.yearsOwned!==null&&p.yearsOwned!==undefined&&p.yearsOwned!==''&&Number.isFinite(Number(p.yearsOwned)))?Number(p.yearsOwned):null,ownerOccupied:Boolean(p.ownerOccupied),livingArea:p.livingArea||0,yearBuilt:p.yearBuilt||0,vacancyConfidence:p.vacancyConfidence||0,vacancyReason:p.vacancyReason||'',vacancySource:p.vacancySource||'',leadQualityScore:p.leadQualityScore||leadQualityForProperty(p).score,leadQualityReason:p.leadQualityReason||leadQualityForProperty(p).reason};
  }
  function persistLeadData(){const ok=window.LeadForgeStorage.setJson(STORAGE_KEY,state.leadData,'Save lead data');if(!ok){state.leadData=loadLeadData();throw new Error('Local lead save failed. The previous saved data was restored.');}followUpDashboardDirty=true;return true;}
  function syncLeadDataFromStorage(){state.leadData=loadLeadData();followUpDashboardDirty=true;refreshSavedCounts();if(state.allResults.length){applyClientFilters();applySortAndRender()}if(state.commercialResults.length){applyCommercialFilters();applyCommercialSortAndRender()}if(state.vacantCommercialResults.length)applyVacantCommercialFiltersAndRender();if(state.propertyResults?.length)applyPropertyFiltersAndRender();if(state.ownerResults.length){applyOwnerFilters();applyOwnerSortAndRender()}if(state.redditPosts.length)applyRedditFiltersAndRender();renderFollowUpDashboard();}
  function refreshAllLeadViews(){refreshSavedCounts();if(state.allResults.length){applyClientFilters();applySortAndRender()}if(state.commercialResults.length){applyCommercialFilters();applyCommercialSortAndRender()}if(state.vacantCommercialResults.length)applyVacantCommercialFiltersAndRender();if(state.propertyResults?.length)applyPropertyFiltersAndRender();if(state.ownerResults.length){applyOwnerFilters();applyOwnerSortAndRender()}if(state.redditPosts.length)applyRedditFiltersAndRender();renderFollowUpDashboard();}

  function exportActiveCSV(){if(state.activeWorkspace==='commercial')return exportCommercialCSV();if(state.activeWorkspace==='vacant-commercial')return exportVacantCommercialCSV();if(state.activeWorkspace==='property')return exportPropertyCSV();if(state.activeWorkspace==='owners')return exportOwnerCSV();if(state.activeWorkspace==='reddit'||(state.activeWorkspace==='community'&&window.__leadForgeCommunitySource==='reddit'))return exportRedditCSV();if(state.activeWorkspace==='community')return;return exportCSV()}
  function exportPropertyCSV(){if(!state.propertyVisibleResults.length)return;const headers=['Address','City','ZIP','County','Property Type','Owner','Owner Mailing Address','Market Value','Appraised Value','Parcel/Account','Last Sold','Years Owned','Lot Acres','Building SF','Year Built','Use Code','Likely Owner Occupied','Lead Quality Score','Why This Score','Pipeline Stage','Follow Up','Next Best Action','Next Action Reason'];const rows=state.propertyVisibleResults.map(p=>{const lead=state.leadData[p.id]||{},q=leadQualityForProperty(p),a=getNextBestAction(p,'property');return[p.address,p.city,p.zip,p.county,p.type,p.owner,p.ownerAddress,p.marketValue,p.appraisedValue,p.account,formatDateDisplay(p.parsedDeedDate,p.deedDate),p.yearsOwned??'',p.acres,p.livingArea,p.yearBuilt,p.useCode,p.ownerOccupied?'Yes':'No',q.score,q.reason,getPipelineStage(p.id),lead.followUpAt||'',a.action,a.reason]});const csv=[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LeadForge_Property_Search_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

  setupV4();

})();
