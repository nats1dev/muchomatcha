import Decimal from "decimal.js";
import { d, money } from "@/lib/decimal";

export type SaleLineInput = {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  discount?: Decimal.Value;
};

/** Prices exclude tax. Tax is applied after discount on the net line. */
export function calculateSaleTotals(
  lines: SaleLineInput[],
  taxRatePercent: Decimal.Value,
  globalDiscount: Decimal.Value = 0,
) {
  let subtotal = d(0);
  let lineDiscountTotal = d(0);

  const computed = lines.map((line) => {
    const qty = d(line.quantity);
    const price = d(line.unitPrice);
    const discount = d(line.discount ?? 0);
    const gross = qty.mul(price);
    const net = money(gross.minus(discount));
    if (net.lt(0)) {
      throw new Error("El descuento no puede superar el subtotal de la línea");
    }
    subtotal = subtotal.plus(gross);
    lineDiscountTotal = lineDiscountTotal.plus(discount);
    return { ...line, lineNet: net, lineGross: money(gross), discount: money(discount) };
  });

  const discountTotal = money(lineDiscountTotal.plus(d(globalDiscount)));
  const netBeforeTax = money(subtotal.minus(discountTotal));
  if (netBeforeTax.lt(0)) {
    throw new Error("El descuento total no puede superar el subtotal");
  }
  const taxTotal = money(netBeforeTax.mul(d(taxRatePercent).div(100)));
  const total = money(netBeforeTax.plus(taxTotal));

  const linesWithTax = computed.map((line) => {
    const share = netBeforeTax.eq(0)
      ? d(0)
      : line.lineNet.div(netBeforeTax);
    const lineTax = money(taxTotal.mul(share));
    const lineTotal = money(line.lineNet.plus(lineTax));
    return {
      quantity: d(line.quantity),
      unitPrice: money(line.unitPrice),
      discount: line.discount,
      tax: lineTax,
      lineTotal,
      netBeforeTax: line.lineNet,
    };
  });

  return {
    subtotal: money(subtotal),
    discountTotal,
    taxTotal,
    total,
    netBeforeTax,
    lines: linesWithTax,
  };
}
