'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {languageKey,normalizeLanguage,translate,type Language} from '@/lib/i18n';
const LanguageContext=createContext({language:'bg' as Language,setLanguage:(_language:Language)=>{},t:(value:string)=>value});
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setState]=useState<Language>('bg');
 const setLanguage=(next:Language)=>{setState(next);try{localStorage.setItem(languageKey,next);}catch{}document.documentElement.lang=next;};
 useEffect(()=>{
  const read=()=>{let next:Language='bg';try{next=normalizeLanguage(localStorage.getItem(languageKey));}catch{}setState(next);document.documentElement.lang=next;};
  read();window.addEventListener('storage',read);window.addEventListener('pageshow',read);
  return()=>{window.removeEventListener('storage',read);window.removeEventListener('pageshow',read);};
 },[]);
 return <LanguageContext.Provider value={{language,setLanguage,t:value=>translate(value,language)}}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
export function LanguageSwitch(){
 const {language,setLanguage}=useLanguage();
 return <button type="button" onClick={()=>setLanguage(language==='bg'?'en':'bg')} aria-label={language==='bg'?'Switch to English':'Превключи на български'} style={{border:'1px solid #50633b',borderRadius:8,padding:'8px 12px',color:'#b8f535',background:'#152019',fontSize:14,fontWeight:700,flexShrink:0}}>{language==='bg'?'EN':'BG'}</button>;
}
