'use client';
// Explicit club country codes take priority. Name matching is only for national teams.
import {useState} from 'react';
import {safeImageUrl} from '@/lib/media';
import {countries,teamCountry} from '@/lib/countries';
import {useLanguage} from '@/components/LanguageProvider';
const regional: Record<string,string> = { 'GB-ENG':'gbeng', 'GB-SCT':'gbsct', 'GB-WLS':'gbwls' };
export default function TeamName({name,country,showFlag=true,logo}:{name:string;country?:string;showFlag?:boolean;logo?:string}) {
  const {t}=useLanguage();
  const [failed,setFailed]=useState('');
  const logoUrl=safeImageUrl(logo);
  const code = showFlag ? teamCountry(name,country) : undefined;
  let flag = '';
  if (code && /^[A-Z]{2}$/.test(code)) flag = [...code].map(c=>String.fromCodePoint(127397+c.charCodeAt(0))).join('');
  else if (code && regional[code]) flag = '🏴' + [...regional[code]].map(c=>String.fromCodePoint(0xe0000+c.charCodeAt(0))).join('') + String.fromCodePoint(0xe007f);
  const label = code ? countries[code]?.at(-1) || code : '';
  return <span className="inline-flex items-center gap-1.5">{logoUrl && failed!==logoUrl ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-5 w-5 shrink-0 object-contain" onError={()=>setFailed(logoUrl)}/> : code === 'GB-ENG' ? <svg role="img" aria-label={t("Англия")} viewBox="0 0 30 20" className="inline-block h-4 w-6 shrink-0 rounded-sm"><rect width="30" height="20" fill="white"/><path d="M13 0h4v20h-4zM0 8h30v4H0z" fill="#ce1124"/></svg> : flag ? <span role="img" aria-label={t(label)} className="text-lg leading-none">{flag}</span> : null}<span>{t(name)}</span></span>;
}
