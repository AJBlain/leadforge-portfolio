'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../reddit-engine.js');
const now=new Date('2026-10-08T17:00:00-05:00');
const base={url:'https://www.reddit.com/r/AskDFW/comments/abc123/a_move/',title:'Moving to Plano for a job in Dallas',dfw_area:'Plano',post_date:'2026-10-08',date_verified:true,visible_date_text:'Today',lead_type:'Research',snippet:'We have an offer and relocate next month; trying to choose neighborhoods in Plano.',opportunity_score:89};

test('rejects a subreddit homepage and comment URL; accepts only original posts',()=>{
  assert.equal(engine.canonicalUrl('https://reddit.com/r/AskDFW/'), '');
  assert.equal(engine.canonicalUrl('https://www.reddit.com/r/AskDFW/comments/abc123/title/def456/'), '');
  assert.equal(engine.canonicalUrl(base.url),'https://www.reddit.com/r/AskDFW/comments/abc123');
});
test('same post ID deduplicates across slugs and share links',()=>{
  assert.equal(engine.postId(base.url), engine.postId('https://old.reddit.com/r/Other/comments/abc123/renamed_title?x=1'));
  assert.equal(engine.postId(base.url), 'reddit:abc123');
});
test('prioritizes an explicit target city instead of a commute city',()=>{
  assert.equal(engine.city('Plano',base), 'Plano');
  assert.equal(engine.city('DFW / Multiple',{title:'Moving to Dallas or Plano'}),'DFW / Multiple');
  assert.equal(engine.city('',{title:'Planning a move to Rockwall, TX'}),'Rockwall');
});
test('unverified date evidence is retained as Needs Verification not rejected',()=>{
  const p=engine.normalize({...base,visible_date_text:undefined},now);
  assert.equal(p.verification,'needs-review');
  assert.equal(p.opportunityScore,89);
  assert.equal(p.leadType,'Research');
});
test('verified recent post stays recent and high intent remains hot',()=>{
  const p=engine.normalize(base,now);
  assert.equal(p.verification,'verified');
  assert.equal(p.temperature,'Hot');
  assert.equal(p.ageDays,0);
});
test('old verified data archived but retained without mutation',()=>{
  const p=engine.normalize({...base,post_date:'2026-09-28',visible_date_text:'September 28, 2026'},now);
  assert.equal(p.verification,'expired');
  assert.equal(p.ageDays,10);
});
test('unknown date is Needs Verification not invented',()=>{
  const p=engine.normalize({...base,post_date:'',visible_date_text:'',date_verified:false},now);
  assert.equal(p.verification,'needs-review');
  assert.equal(p.postDate,'');
});
test('preserves existing saved lead IDs and title/link during legacy migration',()=>{
  const p=engine.normalize({...base,id:'reddit:old-hash',postDate:base.post_date,dateVerified:true,visibleDateText:'Today'},now);
  assert.equal(p.id,'reddit:old-hash');
  assert.equal(p.url,'https://www.reddit.com/r/AskDFW/comments/abc123');
  assert.equal(p.title,base.title);
});
test('all city coverage in exactly six region prompts',()=>{
  assert.equal(engine.REGIONS.length,6);
  const unique=new Set(engine.REGIONS.flatMap(x=>x.cities));
  assert.equal(unique.size,engine.CITIES.length);
  assert.equal(unique.has('Weatherford'),true);
  assert.equal(unique.has('Bridgeport'),true);
  assert.equal(unique.has('Waxahachie'),true);
  assert.equal(unique.has('Forney'),true);
  assert.equal(unique.has('Rockwall'),true);
  assert.equal(unique.has('Denton'),true);
  assert.equal(unique.has('McKinney'),true);
  for (const region of engine.REGIONS) {
    const prompt=engine.buildPrompt(region.id,now);
    assert.ok(prompt.includes('2026-10-06 through 2026-10-08'));
    assert.ok(prompt.includes('region_id'));
    assert.ok(prompt.includes(region.id));
    assert.ok(prompt.length<9000);
  }
});
test('preserves review/expired posts and does not mutate source when making views',()=>{
  const records=[base,{...base,url:'https://reddit.com/r/AskDFW/comments/def234/another/',date_verified:false}].map(p=>engine.normalize(p,now));
  const prior=JSON.stringify(records);
  const visible=engine.filter(records,'verified',now);
  assert.equal(visible.length,1);
  assert.equal(engine.filter(records,'needs-review',now).length,1);
  assert.equal(records.length,2);
  assert.equal(JSON.stringify(records),prior);
});
test('same post key identifies worked item despite legacy URL slug',()=>{
  assert.equal(engine.samePost({url:base.url},{url:'https://www.reddit.com/r/AskDFW/comments/abc123/another-slug'}),true);
});
test('bad dates and posts outside footprint flagged, invalid URLs rejected',()=>{
  assert.equal(engine.normalize({...base,url:'https://reddit.com/r/AskDFW/'},now),null);
  assert.equal(engine.normalize({...base,post_date:'2026-13-40'},now).verification,'needs-review');
});
