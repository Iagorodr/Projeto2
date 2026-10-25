// Feriados oficiais da Bélgica (para os lembretes do Dashboard). Só informativo: não muda a agenda
// nem as visitas previstas, porque a empresa trabalha em alguns feriados.
const NAMES = {
  newYear: { pt: "Ano Novo", en: "New Year's Day", fr: "Nouvel An" },
  easterMonday: { pt: "Segunda-feira de Páscoa", en: "Easter Monday", fr: "Lundi de Pâques" },
  labour: { pt: "Dia do Trabalhador", en: "Labour Day", fr: "Fête du Travail" },
  ascension: { pt: "Ascensão", en: "Ascension Day", fr: "Ascension" },
  whitMonday: { pt: "Segunda-feira de Pentecostes", en: "Whit Monday", fr: "Lundi de Pentecôte" },
  national: { pt: "Dia Nacional da Bélgica", en: "Belgian National Day", fr: "Fête nationale" },
  assumption: { pt: "Assunção", en: "Assumption", fr: "Assomption" },
  allSaints: { pt: "Todos os Santos", en: "All Saints' Day", fr: "Toussaint" },
  armistice: { pt: "Armistício", en: "Armistice Day", fr: "Armistice" },
  christmas: { pt: "Natal", en: "Christmas Day", fr: "Noël" },
};

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function belgianHolidays(year) {
  const e = easterSunday(year);
  return [
    { iso: `${year}-01-01`, key: "newYear" },
    { iso: iso(plus(e, 1)), key: "easterMonday" },
    { iso: `${year}-05-01`, key: "labour" },
    { iso: iso(plus(e, 39)), key: "ascension" },
    { iso: iso(plus(e, 50)), key: "whitMonday" },
    { iso: `${year}-07-21`, key: "national" },
    { iso: `${year}-08-15`, key: "assumption" },
    { iso: `${year}-11-01`, key: "allSaints" },
    { iso: `${year}-11-11`, key: "armistice" },
    { iso: `${year}-12-25`, key: "christmas" },
  ];
}

// Feriados de hoje até daqui a `days` dias: [{ iso, name }].
export function upcomingHolidays(today, days, lang) {
  const from = iso(today), to = iso(plus(today, days));
  return [...belgianHolidays(today.getFullYear()), ...belgianHolidays(today.getFullYear() + 1)]
    .filter((h) => h.iso >= from && h.iso <= to)
    .sort((a, b) => (a.iso < b.iso ? -1 : 1))
    .map((h) => ({ iso: h.iso, name: NAMES[h.key][lang] || NAMES[h.key].pt }));
}
