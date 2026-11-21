import {translations} from './translations';
import {countries} from './countries';
export type Language = 'bg' | 'en';
export const languageKey = 'bazarsport-language';
export const normalizeLanguage = (value: unknown): Language => value === 'en' ? 'en' : 'bg';
const terms: Record<string,string> = {
 'Корнери първо полувреме':'First-half corners', 'корнери първо полувреме':'first-half corners',
 '1П корнери':'1H corners','Корнери 1П':'1H corners','корнери 1П':'1H corners',
 'Двойка':'Double','двойка':'double','Тройка':'Treble','Комбинация':'Combination','комбинация':'combination',
 'Талон':'Slip','талон':'slip','Двоен шанс':'Double chance','Краен резултат':'Match result',
 'Победа на домакина':'Home win','Над':'Over','Под':'Under',
};
const nationalNames = Object.values(countries).flatMap(names=>names.map(name=>[name,names[0]]));
export function translate(value: string, language: Language): string {
 if(language !== 'en') return value;
 if(translations[value]) return translations[value];
 const national = nationalNames.find(([name])=>name.toLowerCase()===value.trim().toLowerCase());
 if(national) return national[1];
 // Translate known editorial title/market templates only. Preserve unfamiliar prose verbatim.
 let result=value;
 for(const [name,en] of [...nationalNames].sort((a,b)=>b[0].length-a[0].length)) {
  if(/[А-Яа-я]/.test(name)) result=result.replace(new RegExp('(?<![\\p{L}])'+name+'(?![\\p{L}])','gu'),en);
 }
 for(const [bg,en] of Object.entries(terms)) result=result.replaceAll(bg,en);
 return /[А-Яа-я]/.test(result) ? value : result;
}
