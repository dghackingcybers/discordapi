import { formatDateTimePT, formatDurationPT } from "./profileFormat.js";

const BOOST_TIER_NAMES = ["Nitro", "Bronze", "Prata", "Ouro", "Platina", "Diamante", "Esmeralda", "Rubi", "Opala"];
const NITRO_TIER_NAMES = ["Nitro", "Bronze", "Prata", "Ouro", "Platina", "Diamante", "Esmeralda", "Rubi"];

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function buildTierTimeline(sinceDate, tierMonths, tierNames = []) {
  if (!sinceDate) return [];

  const start = sinceDate instanceof Date ? sinceDate : new Date(sinceDate);
  if (Number.isNaN(start.getTime())) return [];

  const now = new Date();
  let currentIndex = -1;

  for (let i = tierMonths.length - 1; i >= 0; i -= 1) {
    if (now >= addMonths(start, tierMonths[i])) {
      currentIndex = i;
      break;
    }
  }

  return tierMonths.map((months, index) => {
    const tierDate = addMonths(start, months);
    const reached = now >= tierDate;
    const label = tierNames[index] ?? `Nível ${index + 1}`;

    return {
      nivel: index + 1,
      meses: months,
      label,
      data: formatDateTimePT(tierDate),
      iso: tierDate.toISOString(),
      atingido: reached,
      atual: currentIndex === index,
      relativo: reached ? `há ${formatDurationPT(tierDate)}` : `em ${formatDurationPT(now, tierDate)}`,
      texto: reached
        ? `${label}${currentIndex === index ? " (Atual)" : ""} — há ${formatDurationPT(tierDate)}`
        : `${label} — em ${formatDurationPT(now, tierDate)}`,
    };
  });
}

export { BOOST_TIER_NAMES, NITRO_TIER_NAMES, buildTierTimeline };
