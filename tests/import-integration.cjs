'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const engine=require('../reddit-engine.js');
const date=engine.age.bind(null);
function extract(name){const at=code.indexOf('  function '+name+'(');assert.ok(at>=0,'missing '+name);const rest=code.slice(at);const end=rest.search(/\n  function [A-Za-z_]/);return end>=0?rest.slice(0,end):rest;}
const names=['extractJsonPayload','redditImportRejectReason','normalizeRedditPost','importRedditResults','applyRedditFiltersAndRender'];
const setCalls=[];let shouldFail=false;
const inputs={
 redditImportText:{value:''},redditStatusFilter:{value:'verified'},redditFilterInput:{value:''},redditSortBy:{value:'score-desc'},
 redditImportFeedback:{hidden:true,textContent:''},redditImportCard:{},redditStatCount:{textContent:''},redditReviewCount:{textContent:''},redditArchiveCount:{textContent:''}
};
const state={redditPosts:[],redditCoverage:{},redditWorkedPosts:[],leadData:{},activeWorkspace:'vacant',redditVisiblePosts:[]};
const ctx={JSON,URL,Date,Number,Math,String,Map,Set,Array,Object,RegExp,console,
 RedditEngine:engine,els:inputs,state,
 window:{LeadForgeStorage:{setJson:(key,value)=>{setCalls.push({key,value:JSON.stringify(value)});return !shouldFail;}}},
 cleanText:x=>String(x||'').trim(),friendlyError:e=>e.message||String(e),
 getPipelineStage:()=> 'Unworked',renderRedditTable:()=>{},refreshSavedCounts:()=>{},renderFollowUpDashboard:()=>{},
 setRedditStatus:(msg,kind)=>{ctx.status={msg,kind}},setRedditImportCollapsed:()=>{},
 describeImportAudit:()=>'',currentRedditRegionId:()=> 'west',
 persistRedditPosts:()=>{if(!ctx.window.LeadForgeStorage.setJson('redditposts',state.redditPosts))throw Error('Reddit save failed')},
 persistRedditCoverage:()=>{if(!ctx.window.LeadForgeStorage.setJson('redditcoverage',state.redditCoverage))throw Error('Coverage save failed')},
 renderRedditCoverage:()=>{},isRedditWorked:()=>false,
};
vm.createContext(ctx);vm.runInContext(names.map(extract).join('\n')+'\nthis.importRedditResults=importRedditResults;this.applyRedditFiltersAndRender=applyRedditFiltersAndRender;',ctx);
const today=(()=>{const n=new Date();return [n.getFullYear(),String(n.getMonth()+1).padStart(2,'0'),String(n.getDate()).padStart(2,'0')].join('-')})();
const raw={title:'Moving to Plano, job in Dallas',dfw_area:'Plano',post_date:today,date_verified:true,visible_date_text:'Today',url:'https://reddit.com/r/AskDFW/comments/abc123/title/',opportunity_score:90};
inputs.redditImportText.value=JSON.stringify({region_id:'west',posts:[raw,{...raw,url:'https://reddit.com/r/AskDFW/comments/abc123/different_slug'}, {...raw,url:'https://reddit.com/r/Denton/comments/abc456/another',date_verified:false,visible_date_text:''}],search_audit:{region_id:'west',queries_checked:['moving Plano'],cities_checked:['Plano']}});
ctx.importRedditResults();assert.equal(state.redditPosts.length,2,JSON.stringify(state.redditPosts));assert.equal(state.redditPosts[0].area,'Plano');assert.equal(state.redditPosts[0].opportunityScore,90);assert.equal(state.redditCoverage.west.searchReported,true);assert.equal(ctx.status.kind,'success');
const priorWrites=setCalls.length;
inputs.redditStatusFilter.value='needs-review';ctx.applyRedditFiltersAndRender();assert.equal(state.redditVisiblePosts.length,1);assert.equal(setCalls.length,priorWrites,'filter rewrote persistent results');
inputs.redditStatusFilter.value='verified';ctx.applyRedditFiltersAndRender();assert.equal(state.redditVisiblePosts.length,1);
inputs.redditStatusFilter.value='all';ctx.applyRedditFiltersAndRender();assert.equal(state.redditVisiblePosts.length,2);
inputs.redditImportText.value=JSON.stringify({posts:[{...raw,url:'https://reddit.com/r/FortWorth/comments/abc789/newpost'}]});const old=state.redditPosts;shouldFail=true;ctx.importRedditResults();assert.equal(state.redditPosts,old,'failed persistence must restore prior list');assert.match(ctx.status.msg,/Import failed/);shouldFail=false;
console.log('INTEGRATION PASS: import, ID dedupe, explicit city, coverage audit, view filters with zero writes, failed-save rollback');

// Legacy entries with malformed links must not be silently deleted by a new import.
state.redditPosts.push({id:'reddit:legacy-bad-url',title:'Historical record',url:'https://www.reddit.com/r/AskDFW/'});
inputs.redditImportText.value=JSON.stringify({posts:[{...raw,url:'https://reddit.com/r/Dallas/comments/abc999/different'}]});
ctx.importRedditResults();
assert.equal(state.redditPosts.some(p=>p.id==='reddit:legacy-bad-url'),true);
inputs.redditStatusFilter.value='all';ctx.applyRedditFiltersAndRender();
assert.equal(state.redditVisiblePosts.some(p=>p.id==='reddit:legacy-bad-url'),false);
console.log('LEGACY PASS: invalid historical records remain stored without rendering unsafe/non-post URLs');
