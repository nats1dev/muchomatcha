import Decimal from "decimal.js";
import { d, money } from "@/lib/decimal";

export function calculateExpectedCash(params: {
  openingAmount: Decimal.Value;
  confirmedCashSales: Decimal.Value;
  voidedCashSales: Decimal.Value;
  incomes: Decimal.Value;
  withdrawals: Decimal.Value;
  cashExpenses: Decimal.Value;
}) {
  return money(
    d(params.openingAmount)
      .plus(d(params.confirmedCashSales))
      .minus(d(params.voidedCashSales))
      .plus(d(params.incomes))
      .minus(d(params.withdrawals))
      .minus(d(params.cashExpenses)),
  );
}

export function calculateCashDifference(
  counted: Decimal.Value,
  expected: Decimal.Value,
) {
  return money(d(counted).minus(d(expected)));
}
