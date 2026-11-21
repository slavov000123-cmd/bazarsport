'use client';
import TeamName from './TeamName';
import {teamCountry} from '@/lib/countries';
export default function MatchTeams({home,away,homeCountry,awayCountry,homeLogo,awayLogo}:{home:string;away:string;homeCountry?:string;awayCountry?:string;homeLogo?:string;awayLogo?:string}){
 const sameCountry=!!teamCountry(home,homeCountry) && teamCountry(home,homeCountry)===teamCountry(away,awayCountry);
 return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"><TeamName name={home} logo={homeLogo} country={homeCountry} showFlag={!sameCountry}/><span className="text-white/35">—</span><TeamName name={away} logo={awayLogo} country={awayCountry} showFlag={!sameCountry}/></span>;
}
