const DAY_OF_WEEK_ALIASES: Record<string, string> = {
  SUN: "0",
  MON: "1",
  TUE: "2",
  WED: "3",
  THU: "4",
  FRI: "5",
  SAT: "6",
};

function normalizeCronExpression(cron: string): string {
  const parts = cron.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length !== 5) {
    return cron.trim();
  }

  const dayOfWeek = DAY_OF_WEEK_ALIASES[parts[4].toUpperCase()] ?? parts[4];
  return [...parts.slice(0, 4), dayOfWeek === "7" ? "0" : dayOfWeek].join(" ");
}

export function cronMatches(actual: string, expected: string): boolean {
  return normalizeCronExpression(actual) === normalizeCronExpression(expected);
}
