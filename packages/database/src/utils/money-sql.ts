import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export function moneyCentsExpression(centsColumn: SQLWrapper): SQL<number> {
  return sql<number>`COALESCE(${centsColumn}, 0)`;
}

export function moneyAmountExpression(centsColumn: SQLWrapper): SQL<number> {
  return sql<number>`${moneyCentsExpression(centsColumn)} / 100.0`;
}

export function sumMoneyAmount(centsColumn: SQLWrapper): SQL<number> {
  return sql<number>`SUM(${moneyCentsExpression(centsColumn)}) / 100.0`;
}

export function avgMoneyAmount(centsColumn: SQLWrapper): SQL<number> {
  return sql<number>`AVG(${moneyCentsExpression(centsColumn)}) / 100.0`;
}

export function avgAbsMoneyAmount(centsColumn: SQLWrapper): SQL<number> {
  return sql<number>`AVG(ABS(${moneyCentsExpression(centsColumn)})) / 100.0`;
}
