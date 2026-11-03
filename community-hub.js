/* LeadForge v5.0 Reddit-only Lead Machine.
   Deprecated external community sources were removed from
   active discovery. Existing saved/completed records from those sources remain untouched. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function updateExportState() {
    const exportBtn = $('exportBtn');
    if (!exportBtn) return;
    const body = $('redditResultsBody');
    exportBtn.disabled = !body || body.querySelectorAll('tr[data-id]').length === 0;
  }

  function showReddit() {
    const reddit = $('redditWorkspace');
    if (!reddit) return;
    window.__leadForgeCommunitySource = 'reddit';
    try {
      if (window.LeadForgeStorage?.setText) {
        window.LeadForgeStorage.setText('leadforgeCommunitySourceV1', 'reddit', 'Save Lead Machine source', { silent: true });
      } else {
        localStorage.setItem('leadforgeCommunitySourceV1', 'reddit');
      }
    } catch (_) {}
    reddit.hidden = false;
    reddit.classList.add('active');
    updateExportState();
  }

  function init() {
    const community = $('communityWorkspace');
    const reddit = $('redditWorkspace');
    if (!community || !reddit) return;

    window.__leadForgeCommunitySource = 'reddit';

    const header = document.createElement('section');
    header.className = 'search-panel card community-hub-card';
    header.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">LEAD MACHINE</p>
          <h1 class="dead-kansas-heading">Lead Machine</h1>
          <p class="community-intro">Reddit relocation leads across the expanded Dallas–Fort Worth search footprint.</p>
        </div>
        <div class="community-source-tabs" aria-label="Lead source">
          <span class="community-source-tab active source-badge" aria-current="true">Reddit</span>
        </div>
      </div>`;

    reddit.classList.add('community-source-panel');
    community.appendChild(header);
    community.appendChild(reddit);

    // app.js owns workspace switching. Its community click handler runs first and hides the
    // legacy Reddit panel; this second listener reveals it inside the Lead Machine container.
    $('communityTabBtn')?.addEventListener('click', showReddit);
    window.addEventListener('leadforge-lead-data-updated', updateExportState);

    // Direct/legacy Reddit workspace activation is normalized back into Lead Machine.
    $('redditTabBtn')?.addEventListener('click', () => {
      $('communityTabBtn')?.click();
      showReddit();
    });

    if (!$('communityWorkspace').hidden) showReddit();
  }

  init();
})();
