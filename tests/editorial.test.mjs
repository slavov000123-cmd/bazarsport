import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let source=readFileSync('lib/editorial.ts','utf8').replace(/^import .*;$/gm,'');
const context={exports:{},Date,URL,console,crypto,Number,JSON,Math,Error,Set,sofiaDay:()=>"2026-11-21"};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {publicationErrors,combinedOdds}=context.exports;
const now=new Date().toISOString();
const selection={home:'Home',away:'Away',league:'League',kickoff:new Date(Date.now()+86400000).toISOString(),market:'1П корнери (3-way)',choice:'W1',odds:1.34,oddsSource:'owner_slip',oddsReceivedAt:now,fixtureVerified:true,fixtureCheckedAt:now,fixtureSources:['https://uefa.com/fixture','https://theguardian.com/fixture'],sources:[]};
const input={kind:'prediction',title:'Test',payload:{category:'elite',analysis:'Owner selection',risk:'Draw loses',selections:[selection,{...selection,odds:1.51}]}};
assert.equal(publicationErrors(input).length,0,'ELITE owner slip accepted without odds URLs');
assert.equal(combinedOdds(input.payload),2.0234);
for(const change of [{fixtureVerified:false},{fixtureSources:[]},{oddsReceivedAt:''},{choice:'DNB'},{market:'корнери 1П 2-way'},{kickoff:'unknown'}]) {
 const changed=structuredClone(input);Object.assign(changed.payload.selections[0],change);assert.ok(publicationErrors(changed).length,JSON.stringify(change));
}
const quant=structuredClone(input);quant.payload.category='quantbet';
assert.ok(publicationErrors(quant).some(e=>e.includes('коефициента')),'QuantBet must not accept slip exemption');
for(const s of quant.payload.selections){s.sources=['https://a.example/odds','https://b.example/odds'];s.oddsCheckedAt=now;}
assert.equal(publicationErrors(quant).length,0,'Old QuantBet format still accepted');
const result={kind:'result',title:'Result',payload:{predictionId:'id',outcome:'WIN',checkedAt:now,sources:[],description:'Checked'}};
assert.ok(publicationErrors(result).length,'Result still requires independent sources');
console.log('PASS: ELITE slip, fixture gates, W1 market, exact odds, QuantBet regression, result sources');
const saved=[];const audit=[];
context.entries={};context.auditEvents={};
context.getDb=()=>({insert:table=>({values:async row=>(table===context.entries?saved:audit).push(row)})});
const draft=await context.exports.createDraft(input,'owner');
assert.equal(draft.status,'draft');assert.equal(saved[0].status,'draft');
assert.equal(JSON.parse(saved[0].payload).selections[0].oddsSource,'owner_slip');
assert.equal(audit[0].action,'draft_created');
console.log('PASS: draft persistence retains source fields and never publishes');
const singleSource=structuredClone(input);
for(const s of singleSource.payload.selections){s.fixtureSources=['https://uefa.com/fixture'];s.market='1П корнери · 3-посочен W1';delete s.sources;delete s.oddsCheckedAt;}
assert.equal(publicationErrors(singleSource).length,0,'Owner slip + checked fixture accepted without odds URLs or historical corner stats');
const english=structuredClone(singleSource);english.payload.selections[0].market='1H corners (3-way)';assert.equal(publicationErrors(english).length,0);
// Presentation migration does not mutate stored titles, payloads, IDs or outcomes.
const brandContext={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/categories.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,brandContext);
const {presentEntry}=brandContext.exports;
const old={id:'old-id',title:'QuantBet ELITE — Test',payload:{category:'elite',analysis:'QuantBet ELITE',selections:[selection]}};
const original=JSON.stringify(old);const presented=presentEntry(old);
assert.equal(presented.title,'CORNER HUNTER — Test');assert.equal(presented.payload.category,'elite');assert.equal(JSON.stringify(old),original);
assert.equal(presentEntry({title:'QuantBet 2.0 — Test',payload:{}}).title,'BET STRIKE — Test');
// Exercise actual approval logic with an isolated database stub, including tie settlement.
context.eq=()=>true;context.and=()=>true;context.desc=()=>true;context.presentEntry=presentEntry;
const parent={id:'parent',kind:'prediction',status:'published',payload:JSON.stringify({...input.payload,selections:input.payload.selections.map(s=>({...s,kickoff:'2026-01-01T12:00:00Z'}))})};
let current={id:'draft',kind:'prediction',status:'draft',title:'CORNER HUNTER',payload:JSON.stringify(singleSource.payload),revision:1};
let updates=[];let sequence=[];
context.getDb=()=>({select:()=>({from:()=>({where:()=>{const rows=sequence.shift();return {limit:async()=>rows,then:resolve=>resolve(rows)};}})}),update:()=>({set:v=>({where:()=>({returning:async()=>{updates.push(v);return [{id:current.id}];}})})}),insert:()=>({values:async()=>{}})});
sequence=[[current]];await context.exports.decideDraft('draft','publish','owner');assert.equal(updates[0].status,'published');
const resultPayload={...result.payload,predictionId:'parent',sources:['https://a.example/result','https://b.example/result'],cornerResults:[{home:2,away:2},{home:3,away:1}]};
current={id:'result-draft',kind:'result',status:'draft',title:'Result',referenceId:'parent',revision:1,payload:JSON.stringify(resultPayload)};
sequence=[[current],[parent],[]];await assert.rejects(context.exports.decideDraft('result-draft','publish','owner'),/LOSS/);
current.payload=JSON.stringify({...resultPayload,outcome:'LOSS'});sequence=[[current],[parent],[]];await context.exports.decideDraft('result-draft','publish','owner');
// Exact corner counts are optional for owner-confirmed results, never invented.
for (const counts of [undefined, []]) {
  current.payload=JSON.stringify({...resultPayload,cornerResults:counts});
  sequence=[[current],[parent],[]]; updates=[];
  await context.exports.decideDraft('result-draft','publish','owner');
  const published=JSON.parse(updates[0].payload);
  assert.equal(published.outcome,'WIN');
  assert.equal(published.cornerVerificationMethod,'owner_confirmation');
  assert.equal(published.cornerResults,undefined);
}
current.payload=JSON.stringify({...resultPayload,cornerResults:[{home:-1,away:2}]});
sequence=[[current],[parent],[]];
await assert.rejects(context.exports.decideDraft('result-draft','publish','owner'),/корнери/);
current.payload=JSON.stringify({...resultPayload,cornerResults:undefined});
sequence=[[current],[parent],[{id:'existing'}]];
await assert.rejects(context.exports.decideDraft('result-draft','publish','owner'),/вече има/);
console.log('PASS: owner-confirmed results without fabricated corner counts; malformed counts and duplicate results rejected');
// Unverified outcomes are excluded from actual public-report metrics.
const reportRows=[parent,{id:'unknown',kind:'result',status:'published',title:'Unknown',payload:JSON.stringify({...resultPayload,outcome:'UNVERIFIED'})}];parent.title='QuantBet ELITE';
context.getDb=()=>({select:()=>({from:()=>({where:()=>({orderBy:async()=>reportRows})})})});
const report=await context.exports.publicReport();assert.equal(report.metrics.wins,0);assert.equal(report.metrics.verified,0);assert.equal(report.metrics.roi,null);
console.log('PASS: renamed history without mutation; single fixture source; owner-slip approval; draw loses; UNVERIFIED excluded from ROI');
const missingFixtures=structuredClone(singleSource);
for(const s of missingFixtures.payload.selections){delete s.fixtureVerified;delete s.fixtureCheckedAt;delete s.fixtureSources;}
assert.ok(publicationErrors(missingFixtures).length);
assert.equal(publicationErrors(missingFixtures,true).length,0);
const badOdds=structuredClone(missingFixtures);badOdds.payload.selections[0].odds=0;
assert.ok(publicationErrors(badOdds,true).length,'Owner confirmation cannot bypass odds validation');
const wrongMarket=structuredClone(missingFixtures);wrongMarket.payload.selections[0].choice='DNB';
assert.ok(publicationErrors(wrongMarket,true).length,'Owner confirmation cannot bypass W1');
const started=structuredClone(missingFixtures);started.payload.selections[0].kickoff='2020-01-01T12:00:00Z';assert.ok(publicationErrors(started,true).length);
const unverifiedQuant=structuredClone(missingFixtures);unverifiedQuant.payload.category='quantbet';assert.ok(publicationErrors(unverifiedQuant,true).some(e=>e.includes('коефициента')));
current={id:'confirm-owner',kind:'prediction',status:'draft',title:missingFixtures.title,payload:JSON.stringify(missingFixtures.payload),revision:1};updates=[];
context.getDb=()=>({select:()=>({from:()=>({where:()=>({limit:async()=>[current]})})}),update:()=>({set:v=>({where:()=>({returning:async()=>{updates.push(v);return [{id:current.id}];}})})}),insert:()=>({values:async()=>{}})});
await assert.rejects(context.exports.decideDraft(current.id,'publish','owner'),/среща/);
assert.equal(updates.length,0);
await context.exports.decideDraft(current.id,'publish','owner',true);
const confirmed=JSON.parse(updates[0].payload).selections[0];
assert.equal(confirmed.fixtureVerificationMethod,'owner_confirmation');assert.equal(confirmed.oddsSource,'owner_slip');assert.equal(confirmed.fixtureVerified,true);assert.ok(confirmed.fixtureCheckedAt);
console.log('PASS: explicit owner confirmation unblocks only missing fixture checks; provenance recorded; odds, market, kickoff and BET STRIKE gates preserved');

// Manual publication skips optional source and timestamp gates, not basic validity.
const manual = structuredClone(missingFixtures);
manual.payload.analysis='';
manual.payload.risk='';
for(const selection of manual.payload.selections){
  selection.oddsSource='independent_urls';
  selection.sources=[];
  delete selection.oddsCheckedAt;
  delete selection.oddsReceivedAt;
}
assert.ok(publicationErrors(manual).length>0,'Source checks still apply to standard publication');
assert.equal(publicationErrors(manual,false,true).length,0,'Owner can manually publish without independent sources');
const manualStarted=structuredClone(manual);
manualStarted.payload.selections[0].kickoff='2020-01-01T12:00:00Z';
assert.ok(publicationErrors(manualStarted,false,true).some(e=>e.includes('започнал')),'Manual approval cannot backdate');
const manualInvalid=structuredClone(manual);
manualInvalid.payload.selections[0].choice='DNB';
assert.ok(publicationErrors(manualInvalid,false,true).some(e=>e.includes('3-way')),'Corner Hunter market safety remains');
assert.ok(publicationErrors(result,false,true).length,'Results remain verified independently');
current={id:'manual',kind:'prediction',status:'draft',title:manual.title,payload:JSON.stringify(manual.payload),revision:1};
updates=[];
await context.exports.decideDraft(current.id,'publish','owner',false,true);
assert.equal(updates[0].status,'published');
assert.equal(JSON.parse(updates[0].payload).approvalMode,'owner_unverified');
console.log('PASS: manual unverified publishing, audit provenance, future kickoff and corner market gates');

parent.createdBy='private-owner';parent.approvedBy='private-owner';
const privatePayload=JSON.parse(parent.payload);privatePayload.selections[0].slipImage='data:image/png;base64,c2VjcmV0';parent.payload=JSON.stringify(privatePayload);
context.getDb=()=>({select:()=>({from:()=>({where:()=>({orderBy:async()=>reportRows})})})});
const publicData=await context.exports.publicReport();
assert.equal(publicData.predictions[0].createdBy,undefined);
assert.equal(publicData.predictions[0].approvedBy,undefined);
assert.equal(publicData.predictions[0].payload.selections[0].slipImage,undefined);
const invalidProtocol=structuredClone(quant);invalidProtocol.payload.selections[0].sources=['javascript://a.example/x','https://b.example/x'];assert.ok(publicationErrors(invalidProtocol).length);
console.log('PASS: private identity/slip images excluded; non-HTTP sources rejected');

// Explicit admin approval overrides editorial warnings, never invents an outcome.
context.getDb=()=>({select:()=>({from:()=>({where:()=>{const rows=sequence.shift();return {limit:async()=>rows,then:resolve=>resolve(rows)};}})}),update:()=>({set:v=>({where:()=>({returning:async()=>{updates.push(v);return [{id:current.id}];}})})}),insert:()=>({values:async()=>{}})});
current={id:'old-pick',kind:'prediction',status:'draft',title:'Old pick',revision:1,payload:JSON.stringify({...manual.payload,selections:manual.payload.selections.map(s=>({...s,kickoff:'2020-01-01T12:00:00Z'}))})};
sequence=[[current]];updates=[];
await context.exports.decideDraft(current.id,'publish','owner',false,true);
assert.equal(updates[0].status,'published');
const ownerResult={predictionId:'parent',outcome:'LOSS',sources:[],checkedAt:'',description:''};
current={id:'owner-result',kind:'result',status:'draft',title:'Owner result',referenceId:'parent',revision:1,payload:JSON.stringify(ownerResult)};
sequence=[[current],[parent],[]];updates=[];
await context.exports.decideDraft(current.id,'publish','owner',false,true);
const ownerPublished=JSON.parse(updates[0].payload);
assert.equal(ownerPublished.outcome,'LOSS');assert.equal(ownerPublished.approvalMode,'owner_confirmation');assert.equal(ownerPublished.cornerResults,undefined);assert.equal(ownerPublished.checkedAt,'');
sequence=[[{...current,status:'published'}]];updates=[];
await context.exports.decideDraft(current.id,'publish','owner',false,true);assert.equal(updates.length,0);
console.log('PASS: explicit owner approval overrides editorial warnings, retains chosen outcome and safely handles repeated clicks');
