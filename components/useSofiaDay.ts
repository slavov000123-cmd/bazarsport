'use client';
import {useEffect,useState} from 'react';
import {sofiaDay} from '@/lib/prediction-views';
export function useSofiaDay(initialDay=''){
 const [day,setDay]=useState(initialDay);
 useEffect(()=>{const update=()=>setDay(sofiaDay());update();const timer=setInterval(update,15000);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[]);
 return day;
}
