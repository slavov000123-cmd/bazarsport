'use client';
import TeamName from './TeamName';
import {teamCountry} from '@/lib/countries';
export default function MatchLeague({home,away,homeCountry,awayCountry,league}:{home:string;away:string;homeCountry?:string;awayCountry?:string;league:string}) {
 const homeCode=teamCountry(home,homeCountry);
 const sharedCountry=homeCode && homeCode===teamCountry(away,awayCountry) ? homeCode : undefined;
 return <TeamName name={league} country={sharedCountry} showFlag={!!sharedCountry}/>;
}
