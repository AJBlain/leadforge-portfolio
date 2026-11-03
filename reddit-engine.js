/* LeadForge Reddit Lead Machine model: no DOM, no network, no storage writes.
 * CommonJS tests and window.LeadForgeRedditEngine use exactly the same implementation.
 */
(function(root, factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.LeadForgeRedditEngine=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null, function() {
  'use strict';
  const MAX_AGE_DAYS=2;
  const BASE_SUBS=['r/AskDFW','r/dfw'];
  const REGIONS=[
    {id:'west',name:'West / Northwest — Weatherford & Bridgeport',cities:['Weatherford','Hudson Oaks','Willow Park','Aledo','Springtown','Azle','Bridgeport','Decatur','Boyd','Rhome','Newark','New Fairview','Paradise'],subreddits:['r/weatherford','r/FortWorth']},
    {id:'tarrant-north',name:'North Tarrant — Fort Worth, Keller & Grapevine',cities:['Fort Worth','Saginaw','Haslet','Blue Mound','Watauga','Keller','North Richland Hills','Richland Hills','Haltom City','Hurst','Bedford','Euless','Grapevine','Colleyville','Southlake','Westlake','Trophy Club','Roanoke'],subreddits:['r/FortWorth','r/PantherCity','r/Keller','r/bedford','r/GrapevineTX','r/SouthlakeTexas']},
    {id:'tarrant-south',name:'South Tarrant / Ellis — Arlington to Waxahachie',cities:['Lake Worth','White Settlement','Benbrook','Crowley','Burleson','Mansfield','Arlington','Grand Prairie','Kennedale','Pantego','Dalworthington Gardens','Everman','Forest Hill','River Oaks','Sansom Park','Westworth Village','Midlothian','Waxahachie','Red Oak','Ovilla','Glenn Heights','Ferris','Palmer','Joshua'],subreddits:['r/FortWorth','r/Arlington','r/burleson','r/Waxahachie']},
    {id:'dallas',name:'Dallas County — Dallas, Irving, Garland & south Dallas',cities:['Dallas','Irving','Coppell','Carrollton','Farmers Branch','Addison','Richardson','Garland','Rowlett','Mesquite','Sunnyvale','Balch Springs','Cedar Hill','DeSoto','Duncanville','Lancaster','Cockrell Hill','Highland Park','University Park'],subreddits:['r/Dallas','r/AskDallas','r/Irving','r/IrvingTexas','r/CarrolltonTX','r/Coppell','r/CoppellTexas','r/AddisonTX','r/Richardson','r/Garland','r/Rowlett','r/MesquiteTX','r/Farmersbranch','r/downtowndallas','r/UptownDallas','r/OakCliff']},
    {id:'denton',name:'Denton County — Denton, Flower Mound & Lewisville',cities:['Denton','Argyle','Northlake','Justin','Ponder','Corinth','Lake Dallas','Hickory Creek','Highland Village','Flower Mound','Lewisville','Little Elm','The Colony'],subreddits:['r/Denton','r/FlowerMound','r/LewisvilleTX']},
    {id:'collin-east',name:'Collin / East — McKinney, Plano, Forney & Rockwall',cities:['Plano','Frisco','McKinney','Allen','Princeton','Fairview','Lucas','Murphy','Wylie','Rockwall','Heath','Forney'],subreddits:['r/Plano','r/frisco','r/McKinney','r/Allen','r/Wylie','r/Rockwall']}
  ];
  const CITIES=REGIONS.flatMap(r=>r.cities);
  const sortedCities=[...CITIES].sort((a,b)=>b.length-a.length);
  function clean(v){return String(v??'').trim();}
  function isoLocal(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function dateOnly(s){const m=clean(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;}
  function age(date,now=new Date()){const d=dateOnly(date);if(!d)return null;const n=new Date(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((n-d)/86400000);}
  function postKey(url){
    try {
      const u=new URL(clean(url));const host=u.hostname.toLowerCase();
      if(host==='redd.it'){const id=u.pathname.match(/^\/([a-z0-9]+)\/?$/i)?.[1];return id? id.toLowerCase():'';}
      if(!/(^|\.)reddit\.com$/.test(host))return '';
      const path=u.pathname.split('/').filter(Boolean);
      if(path.length>=4&&path[0].toLowerCase()==='r'&&path[2].toLowerCase()==='comments'&&/^[a-z0-9]+$/i.test(path[3])&&path.length<=5)return path[3].toLowerCase();
      if(path.length===2&&path[0].toLowerCase()==='comments'&&/^[a-z0-9]+$/i.test(path[1]))return path[1].toLowerCase();
    } catch{}return '';
  }
  function canonicalUrl(url){
    const id=postKey(url);if(!id)return '';
    try {const u=new URL(clean(url));const m=u.pathname.match(/^\/r\/([^/]+)\/comments\//i);return m?`https://www.reddit.com/r/${encodeURIComponent(decodeURIComponent(m[1]))}/comments/${id}`:`https://www.reddit.com/comments/${id}`;}catch{return '';}
  }
  function postId(url){const id=postKey(url);return id?'reddit:'+id:'';}
  function samePost(a,b){const ka=postKey(a?.url||a?.link||a);return !!ka&&ka===postKey(b?.url||b?.link||b);}
  function hits(text){const s=clean(text);if(!s)return [];return sortedCities.filter(n=>new RegExp('(^|[^a-z])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')+'(?=$|[^a-z])','i').test(s));}
  function city(explicit, raw={}) {
    const name=clean(explicit);
    if(/^(dfw\s*\/\s*multiple|multiple|research|unknown|dfw|north texas)$/i.test(name))return 'DFW / Multiple';
    let found=hits(name);if(found.length===1)return found[0];if(found.length>1)return 'DFW / Multiple';
    for(const field of ['title','post_title','snippet','summary','description']){
      found=hits(raw[field]);if(found.length===1)return found[0];if(found.length>1)return 'DFW / Multiple';
    }
    found=hits(raw.subreddit||raw.community);
    return found.length===1?found[0]:'DFW / Multiple';
  }
  function intent(v){const t=clean(v).toLowerCase();if(/\b(rent|renter|renting|rental|apartment|lease|leasing)\b/.test(t))return 'Rent';if(/\b(buy|buyer|buying|purchase|purchasing|homebuy|house hunt|house-hunt|mortgage)\b/.test(t))return 'Buy';return 'Research';}
  function evidenceMatches(evidence,postDate,at){
    const s=clean(evidence).toLowerCase();if(!s)return false;
    const days=age(postDate,at);if(days===null||days<0||days>MAX_AGE_DAYS)return false;
    if(/^(today|just now|now)$/.test(s))return days<=1;
    if(s==='yesterday')return days>=0&&days<=2;
    const m=s.match(/^(?:about\s+)?(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)\s*(?:ago)?$/);
    if(m){const num=+m[1],unit=m[2];if(unit.startsWith('d'))return num<=2&&Math.abs(days-num)<=1;if(unit.startsWith('h'))return num<=48&&days<=Math.ceil(num/24)+1;return days<=1;}
    const iso=dateOnly(evidence);if(iso)return isoLocal(iso)===postDate;
    if(!/\b20\d{2}\b/.test(evidence))return false;
    const natural=new Date(evidence);return !Number.isNaN(natural.getTime())&&isoLocal(natural)===postDate;
  }
  function verification(raw,now=new Date()){
    const date=clean(raw.post_date||raw.postDate||raw.date);
    const n=age(date,now);
    if(n!==null&&n>MAX_AGE_DAYS)return 'expired';
    if(n===null||n<0)return 'needs-review';
    const marked=raw.date_verified===true||raw.dateVerified===true||String(raw.date_verified??raw.dateVerified).toLowerCase()==='true';
    const evidence=clean(raw.visible_date_text||raw.visibleDateText||raw.date_evidence);
    if(!marked||!evidence)return 'needs-review';
    const checkedAt=raw.dateEvidenceValidatedAt?new Date(raw.dateEvidenceValidatedAt):raw.importedAt?new Date(raw.importedAt):now;
    return evidenceMatches(evidence,date,Number.isNaN(checkedAt.getTime())?now:checkedAt)?'verified':'needs-review';
  }
  function scoreFor(raw,title,snippet,leadType){
    const supplied=Number(raw.opportunity_score??raw.opportunityScore);
    if((raw.opportunity_score!==undefined||raw.opportunityScore!==undefined)&&Number.isFinite(supplied))return Math.round(Math.max(0,Math.min(100,supplied)));
    const text=(title+' '+snippet+' '+clean(raw.timeline)).toLowerCase();let score=30;
    if(/\b(moving|relocat(?:e|ing|ion)|transferr?ing|move to|house hunt)\b/.test(text))score+=25;
    if(/\b(realtor|real estate agent|buying a house|buy a home|preapproved|pre-approved)\b/.test(text))score+=24;
    if(/\b(next week|next month|this month|30 days|60 days|soon|offer accepted|job offer)\b/.test(text))score+=15;
    if(leadType!=='Research')score+=8;
    if(/\b(school|commute|neighborhood|budget|\$\d|apartment|rent)\b/.test(text))score+=8;
    if(String(raw.has_agent??raw.hasAgent).toLowerCase()==='yes')score-=25;
    return Math.min(100,Math.max(0,score));
  }
  function normalize(raw,now=new Date()){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const url=canonicalUrl(raw.url||raw.link||raw.redditUrl);
    const title=clean(raw.title||raw.post_title||raw.redditTitle);
    if(!url||!title)return null;
    const postDate=dateOnly(raw.post_date||raw.postDate||raw.date)?clean(raw.post_date||raw.postDate||raw.date):'';
    const area=city(raw.dfw_area||raw.city||raw.area||raw.location,raw);
    const snippet=clean(raw.snippet||raw.summary||raw.description||raw.post_text);
    const stated=clean(raw.lead_type||raw.leadType||raw.intent);
    const leadType=/^(research|unclear|unknown)$/i.test(stated)?'Research':intent(stated||title+' '+snippet);
    const score=scoreFor(raw,title,snippet,leadType);
    const confidence=verification(raw,now);
    const subreddit=clean(raw.subreddit||raw.community)||('r/'+(url.match(/\/r\/([^/]+)/i)?.[1]||'unknown'));
    return {
      id: /^reddit:[^\s]+$/.test(clean(raw.id))?clean(raw.id):postId(url),
      postKey:postKey(url), url, title, subreddit:subreddit.startsWith('r/')?subreddit:'r/'+subreddit,
      area, postDate, parsedDate:postDate?dateOnly(postDate).toISOString():'',ageDays:age(postDate,now),
      verification:confidence,dateVerified:confidence==='verified',
      visibleDateText:clean(raw.visible_date_text||raw.visibleDateText||raw.date_evidence),
      dateSource:clean(raw.date_source||raw.dateSource||'unknown'),
      dateEvidenceValidatedAt:raw.dateEvidenceValidatedAt||raw.importedAt||now.toISOString(),
      leadType, snippet,timeline:clean(raw.timeline||'unknown'),engagement:clean(raw.engagement||'unknown'),
      hasAgent:clean(raw.has_agent||raw.hasAgent||'unknown').toLowerCase(),
      opportunityScore:score,temperature:score>=80?'Hot':score>=55?'Warm':'Cold',
      scoreReason:clean(raw.score_reason||raw.scoreReason)||'Score based on the stated relocation, housing and timing signals; verify details before outreach.',
      nextBestAction:leadType==='Research'?'Research Lead':(clean(raw.next_best_action||raw.nextBestAction)||'Research Lead'),
      nextActionReason:clean(raw.next_action_reason||raw.nextActionReason)||(leadType==='Research'?'Confirm target city, housing intent and date before outreach.':'Verify the details before outreach.'),
      importedAt:raw.importedAt||now.toISOString(),regionId:clean(raw.region_id||raw.regionId)
    };
  }
  function filter(posts,status='verified',now=new Date()){
    return (posts||[]).filter(p=>{
      const freshness=verification(p,now);
      return status==='all'||status===freshness;
    });
  }
  function regionForId(id){return REGIONS.find(x=>x.id===id)||REGIONS[0];}
  function buildPrompt(regionId,now=new Date()){
    const region=regionForId(regionId);const end=isoLocal(now);const start=isoLocal(new Date(now.getFullYear(),now.getMonth(),now.getDate()-MAX_AGE_DAYS));
    const subs=[...new Set([...BASE_SUBS,...region.subreddits])];
    return `Find up to 15 UNIQUE direct Reddit posts FIRST POSTED from ${start} through ${end} about a real person's residential move into or within the Dallas–Fort Worth area. This is ONE regional batch of six, not an exhaustive all-DFW search.\n\nREGION: ${region.name}\nregion_id: ${region.id}\nSearch EVERY city below (including outer cities) in Reddit-wide search or fresh indexed web search:\n${region.cities.join(', ')}\n\nCHECK REAL SUBREDDITS FIRST when accessible (do not invent communities):\n${subs.join(', ')}\nThen search Reddit-wide site:reddit.com/r/ with phrases like "moving to CITY", "relocating CITY", "buying home CITY", "renting CITY", "moving within DFW", schools, commute, neighborhoods and job transfer. Use targeted city/phrase queries instead of one enormous OR expression. Do not claim to have checked a city or subreddit you did not actually inspect. If newest Reddit is inaccessible, use fresh direct-post results from other legitimate web indexes and record the limitation.\n\nQUALIFY: genuine future/recent residential moves into/within DFW with possible buying, renting, neighborhood, schools, commute or transfer questions. Exclude general discussion, tourism, moves out, and agents promoting themselves. The post can be from ANY subreddit. If target city or Buy/Rent is unclear but move is genuine, include it as a research_candidate.\n\nDATE: verify the ORIGINAL POST date, not comment, crawl or indexed date. Do not invent dates. Set date_verified:true and visible_date_text only if you actually saw credible date evidence. If date or evidence is unavailable but moving intent and direct post are clear, include in research_candidates with date_verified:false, post_date:"" if unknown, and say why verification is needed. Never call these verified fresh leads. Exclude clearly old posts outside ${start}–${end}.\n\nONLY direct Reddit post URLs containing /comments/POST_ID; no subreddit homepage, general search URL or comment permalink. Deduplicate by POST_ID. Preserve post title, relevant summary, location, timeline, source URL and evidence. Score 0-100 on actual intent, timing, budget, buying/selling interest and agent status; missing single-city or Buy/Rent alone must not turn strong intent into Cold.\n\nOUTPUT ONLY one JSON object without prose, for immediate import into LeadForge:\n{"region_id":"${region.id}","posts":[{"title":"original title","subreddit":"r/name","dfw_area":"Plano","post_date":"YYYY-MM-DD","date_verified":true,"visible_date_text":"exact evidence seen","date_source":"direct_reddit or search_result","lead_type":"Buy or Rent or Research","snippet":"real relevant detail","timeline":"unknown","has_agent":"unknown","opportunity_score":78,"score_reason":"why","next_best_action":"Send DM or Research Lead","url":"https://www.reddit.com/r/name/comments/id/title/"}],"research_candidates":[],"search_audit":{"region_id":"${region.id}","cities_checked":[],"subreddits_checked":[],"queries_checked":[],"limitations":"","qualified_count":0,"research_count":0}}\n\nIn search_audit, list only cities/communities/queries actually searched. If no posts are found, return empty arrays and truthful audit. Do not invent posts or claim exhaustive results.`;
  }
  return {MAX_AGE_DAYS,REGIONS,CITIES,canonicalUrl,postKey,postId,samePost,city,dateOnly,age,verification,normalize,filter,buildPrompt,regionForId};
});
