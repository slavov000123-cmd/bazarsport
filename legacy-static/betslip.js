
'use strict';
// Transcribed from user screenshots; not independently verified or live odds.
const market='Домакинът с повече корнери · Първо полувреме';
const slips=[
 {title:'Корнери · Талон 1',total:'1.958',picks:[{home:'Борусия Дортмунд',away:'Вердер Бремен',league:'Германия · DFB Pokal',odds:1.44},{home:'Рома',away:'Каляри',league:'Италия · Serie A',odds:1.36}]},
 {title:'Корнери · Талон 2',total:'2.34',picks:[{home:'Лестър Сити',away:'Уигън Атлетик',league:'Англия · League One',odds:1.55},{home:'Милтън Кийнс Донс',away:'Бромли',league:'Англия · League One',odds:1.51}]},
 {title:'Други залози',picks:[]}
];
const container=document.querySelector('#slip-columns');
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
for(const [index,slip] of slips.entries()){
 const section=element('section','','slip-column');
 section.append(element('span','БЕЗПЛАТНО','access'),element('p',index<2?'КОРНЕРИ / ПЪРВО ПОЛУВРЕМЕ':'ФУТБОЛНИ СЕЛЕКЦИИ','category'),element('h2',slip.title));
 if(!slip.picks.length){const empty=element('div','','no-selections');empty.append(element('strong','Очаквайте следващия талон'),element('p','Все още няма публикувани селекции.'));section.append(empty)}
 else{
  for(const pick of slip.picks){const article=element('article','','pick');article.append(element('p',pick.league,'slip-meta'),element('p','27.10.2026 · 21:45*','match-time'));
   const teams=element('div','','teams');teams.append(element('strong',pick.home),element('span','VS','versus'),element('strong',pick.away));
   const selection=element('div','','selection-line');selection.append(element('p',market),element('b',pick.odds.toFixed(2),'odd-badge'));article.append(teams,selection);section.append(article)}
  const total=element('div','','slip-total');total.append(element('span','Общ коефициент от снимката'),element('b',slip.total));section.append(total,element('p','Източник: предоставена снимка · Непроверени данни','slip-meta'),element('small','* Часът е преписан от снимката; часовата зона не е посочена. Първенствата и коефициентите не са независимо проверени. Общият коефициент може да се различава от произведението на закръглените стойности.','source-note'));
 }
 container.append(section);
}
