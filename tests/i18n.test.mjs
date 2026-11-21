import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cache={};
function load(name){if(cache[name])return cache[name];const context={exports:{},require:p=>load(p.replace('./',''))};vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return cache[name]=context.exports;}
const {translate:t,normalizeLanguage,languageKey}=load('i18n');
assert.equal(languageKey,'bazarsport-language');
assert.equal(normalizeLanguage('en'),'en');assert.equal(normalizeLanguage('invalid'),'bg');
assert.equal(t('Прогнози','en'),'Predictions');assert.equal(t('Прогнози','bg'),'Прогнози');
assert.equal(t('QuantBet ELITE — Двойка 2.02 — 15.11.2026','en'),'QuantBet ELITE — Double 2.02 — 15.11.2026');
assert.equal(t('1П корнери (3-way)','en'),'1H corners (3-way)');
assert.equal(t('Франция','en'),'France');assert.equal(t('Хърватия','en'),'Croatia');
assert.equal(t('QuantBet 2.0 — 15.11.2026 — Хърватия 1 + Испания 1X (1.96)','en'),'QuantBet 2.0 — 15.11.2026 — Croatia 1 + Spain 1X (1.96)');
assert.equal(t('W1','en'),'W1');assert.equal(t('2.0234','en'),'2.0234');
assert.equal(t('Непознат авторски текст','en'),'Непознат авторски текст');
// Every translated UI key must be covered by the dictionary.
for(const file of ['app/predictions/PredictionsView.tsx','app/mobile/MobileApp.tsx']){
const src=readFileSync(file,'utf8');for(const match of src.matchAll(/t\("([^"\n]*[А-Яа-я][^"\n]*)"\)/g)) assert.notEqual(t(match[1],'en'),match[1],match[1]);
}
console.log('PASS: EN/BG UI coverage, national teams, slip and market templates, unchanged odds and unknown editorial content');
