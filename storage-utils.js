/* LeadForge shared local-storage helpers.
   Critical saves are never silently ignored: failures are surfaced once per page. */
(() => {
  'use strict';
  let alertShown = false;
  // Preserve existing browser data from earlier pre-rebrand builds. Old keys are
  // constructed only for compatibility, never written again or deleted.
  function legacyKeyHash(input) {
    let h = 2166136261;
    for(let i=0;i<input.length;i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
    return h >>> 0;
  }
  function migrateLegacyKeys() {
    // Historic browser key identifiers are matched by a stable hash to
    // avoid exposing old personal branding in public source code.
    const compatibility = {
      4045959137:'leadforgeExcludedCommercialOwnersV1',
      1844715588:'leadforgeRedditRelocationPostsV1',
      1993767714:'leadforgeRedditWorkedPostsV1',
      4206592155:'leadforgeRedditCoverageV1',
      420609009:'leadforgeCommunitySourceV1',
    };
    try {
      const candidates=[];
      for(let i=0;i<localStorage.length;i++) candidates.push(localStorage.key(i));
      for(const previous of candidates) {
        if(!previous) continue;
        const nextKey=compatibility[legacyKeyHash(previous)];
        if(!nextKey || localStorage.getItem(nextKey)!==null) continue;
        const value=localStorage.getItem(previous);
        if(value!==null) localStorage.setItem(nextKey,value); // Copy first. Never delete older data.
      }
    } catch(error){console.warn('[LeadForge] Previous data could not be copied. Original records are unchanged.',error);}
  }
  migrateLegacyKeys();
  function report(context, err, silent = false) {
    const detail = err && err.message ? err.message : String(err || 'Unknown storage error');
    console.error(`[LeadForge] ${context || 'Local save'} failed:`, err);
    try { window.dispatchEvent(new CustomEvent('leadforge-storage-error', { detail:{ context:context || 'Local save', message:detail } })); } catch {}
    if (!silent && !alertShown) {
      alertShown = true;
      setTimeout(() => window.alert(`LeadForge could not save data locally (${context || 'save'}). Your latest change may not have been stored.\n\n${detail}`), 0);
    }
  }
  function setJson(key, value, context = 'Save', options = {}) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (err) { report(context, err, Boolean(options.silent)); return false; }
  }
  function setText(key, value, context = 'Save', options = {}) {
    try { localStorage.setItem(key, String(value)); return true; }
    catch (err) { report(context, err, Boolean(options.silent)); return false; }
  }
  function getJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === '') return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (err) { console.warn(`[LeadForge] Could not read ${key}:`, err); return fallback; }
  }
  window.LeadForgeStorage = Object.freeze({ setJson, setText, getJson });
})();
