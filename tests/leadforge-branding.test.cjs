const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sourceFiles=['index.html','saved.html','completed.html','app.js','saved.js','completed.js','server.ps1','reddit-engine.js','community-hub.js','storage-utils.js','launch_chrome.ps1','START_APP.bat','styles.css'];
for(const f of sourceFiles){
  assert.ok(fs.existsSync(path.join(root,f)),`missing ${f}`);
  const text=read(f);
  assert.doesNotMatch(text,/License\s*#\d{7}|\b\d{3}[-.]\d{3}[-.]\d{4}\b/i,`${f} may leak personal branding/details`);
  assert.doesNotMatch(text,/\/api\/muse\/|MuseClientKey|MuseServiceUrl/i,`${f} must not expose unused AI service`);
}
for(const f of ['index.html','saved.html','completed.html']){
 assert.match(read(f),/LeadForge/,`${f} must show LeadForge branding`);
 assert.doesNotMatch(read(f),/muse-research\.js/i,`${f} must not load Muse`);
}
assert.equal(fs.existsSync(path.join(root,'muse-research.js')),false,'Muse module must not ship');
assert.equal(fs.existsSync(path.join(root,'MUSE_SETUP.txt')),false,'Muse setup must not ship');
assert.doesNotMatch(read('server.ps1'),/\/api\/muse\/|MuseClientKey|MuseServiceUrl/i);
assert.doesNotMatch(read('app.js'),/attachMuseResearch|REDDIT_DM_SIGNATURE/);
assert.doesNotMatch(read('saved.js'),/attachSavedMuseResearch/);
assert.match(read('app.js'),/lotLeaditLeadDataV2/,'lead data key must remain unchanged');
assert.match(read('server.ps1'),/\$Port\s*=\s*8765/,'preserve origin');
assert.match(read('START_APP.bat'),/LeadForge v1\.0/);
assert.ok(fs.existsSync(path.join(root,'README.md')));
assert.ok(fs.existsSync(path.join(root,'about.html')));
assert.ok(fs.existsSync(path.join(root,'LeadForge.ico')));
console.log('PASS LeadForge branding/security/compatibility');
