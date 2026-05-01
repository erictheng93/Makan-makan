import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export function moneyCentsExpression(
  centsColumn: SQLWrapper,
  legacyAmountColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`COALESCE(${centsColumn}, CAST(round(${legacyAmountColumn} * 100) AS integer))`;
}

export function moneyAmountExpression(
  centsColumn: SQLWrapper,
  legacyAmountColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`${moneyCentsExpression(centsColumn, legacyAmountColumn)} / 100.0`;
}

export function sumMoneyAmount(
  centsColumn: SQLWrapper,
  legacyAmountColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`SUM(${moneyCentsExpression(centsColumn, legacyAmountColumn)}) / 100.0`;
}

export function avgMoneyAmount(
  centsColumn: SQLWrapper,
  legacyAmountColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`AVG(${moneyCentsExpression(centsColumn, legacyAmountColumn)}) / 100.0`;
}

export function avgAbsMoneyAmount(
  centsColumn: SQLWrapper,
  legacyAmountColumn: SQLWrapper,
): SQL<number> {
  return sql<number>`AVG(ABS(${moneyCentsExpression(centsColumn, legacyAmountColumn)})) / 100.0`;
}
