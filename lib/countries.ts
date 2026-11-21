export const countries: Record<string, string[]> = {
  FR: ['France','Франция'], TR: ['Turkey','Türkiye','Турция'], HR: ['Croatia','Хърватия'], CZ: ['Czechia','Czech Republic','Чехия'], ES: ['Spain','Испания'],
  'GB-ENG': ['England','Англия'], 'GB-SCT': ['Scotland','Шотландия'], 'GB-WLS': ['Wales','Уелс'], 'GB-NIR': ['Northern Ireland','Северна Ирландия'],
  BG: ['Bulgaria','България'], DE: ['Germany','Германия'], IT: ['Italy','Италия'], PT: ['Portugal','Португалия'], NL: ['Netherlands','Нидерландия','Холандия'], BE: ['Belgium','Белгия'],
  GR: ['Greece','Гърция'], RS: ['Serbia','Сърбия'], RO: ['Romania','Румъния'], HU: ['Hungary','Унгария'], PL: ['Poland','Полша'], UA: ['Ukraine','Украйна'], RU: ['Russia','Русия'],
  AT: ['Austria','Австрия'], CH: ['Switzerland','Швейцария'], DK: ['Denmark','Дания'], SE: ['Sweden','Швеция'], NO: ['Norway','Норвегия'], FI: ['Finland','Финландия'], IS: ['Iceland','Исландия'],
  IE: ['Ireland','Republic of Ireland','Ирландия'], SK: ['Slovakia','Словакия'], SI: ['Slovenia','Словения'], AL: ['Albania','Албания'], MK: ['North Macedonia','Северна Македония'],
  BA: ['Bosnia and Herzegovina','Bosnia-Herzegovina','Босна и Херцеговина'], ME: ['Montenegro','Черна гора'], XK: ['Kosovo','Косово'], CY: ['Cyprus','Кипър'],
  EE: ['Estonia','Естония'], LV: ['Latvia','Латвия'], LT: ['Lithuania','Литва'], GE: ['Georgia','Грузия'], AM: ['Armenia','Армения'], IL: ['Israel','Израел'],
  BR: ['Brazil','Бразилия'], AR: ['Argentina','Аржентина'], US: ['USA','United States','САЩ'], CA: ['Canada','Канада'], MX: ['Mexico','Мексико'], JP: ['Japan','Япония'],
  KR: ['South Korea','Южна Корея'], AU: ['Australia','Австралия'], MA: ['Morocco','Мароко'], EG: ['Egypt','Египет'], SA: ['Saudi Arabia','Саудитска Арабия'],
};
export const teamCountry=(name:string,country?:string)=>country?.trim().toUpperCase() || Object.entries(countries).find(([,names])=>names.some(n=>n.toLowerCase()===name.trim().toLowerCase()))?.[0];
