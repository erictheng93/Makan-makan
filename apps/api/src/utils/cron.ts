const MONTH_ALIASES: Record<string, string> = {
  JAN: "1",
  FEB: "2",
  MAR: "3",
  APR: "4",
  MAY: "5",
  JUN: "6",
  JUL: "7",
  AUG: "8",
  SEP: "9",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const DAY_OF_WEEK_ALIASES: Record<string, string> = {
  SUN: "0",
  MON: "1",
  TUE: "2",
  WED: "3",
  THU: "4",
  FRI: "5",
  SAT: "6",
};

function normalizeCronPart(
  part: string,
  aliases: Record<string, string>,
  options: { normalizeSundaySeven?: boolean } = {},
): string {
  const normalized = part
    .toUpperCase()
    .split(",")
    .map((value) => aliases[value] ?? value);

  if (options.normalizeSundaySeven) {
    return normalized.map((value) => (value === "7" ? "0" : value)).join(",");
  }

  return normalized.join(",");
}

export function normalizeCronExpression(cron: string): string {
  const parts = cron.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length !== 5) {
    return cron.trim();
  }

  return [
    parts[0],
    parts[1],
    parts[2],
    normalizeCronPart(parts[3], MONTH_ALIASES),
    normalizeCronPart(parts[4], DAY_OF_WEEK_ALIASES, {
      normalizeSundaySeven: true,
    }),
  ].join(" ");
}

export function cronMatches(actual: string, expected: string): boolean {
  return normalizeCronExpression(actual) === normalizeCronExpression(expected);
}
