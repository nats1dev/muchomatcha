export type NumberFormatStyle = "US" | "EU";

export type NumberDisplaySettings = {
  numberFormat: NumberFormatStyle;
  moneyDecimals: number;
  costDecimals: number;
  quantityDecimals: number;
};

export const DEFAULT_NUMBER_SETTINGS: NumberDisplaySettings = {
  numberFormat: "US",
  moneyDecimals: 2,
  costDecimals: 4,
  quantityDecimals: 3,
};

function finite(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function locale(settings: NumberDisplaySettings) {
  return settings.numberFormat === "EU" ? "de-DE" : "en-US";
}

export function formatNumber(
  value: number | string,
  decimals: number,
  settings: NumberDisplaySettings = DEFAULT_NUMBER_SETTINGS,
  minimumFractionDigits = decimals,
) {
  return new Intl.NumberFormat(locale(settings), {
    minimumFractionDigits,
    maximumFractionDigits: decimals,
  }).format(finite(value));
}

export function formatDisplayMoney(
  value: number | string,
  currency = "GTQ",
  settings: NumberDisplaySettings = DEFAULT_NUMBER_SETTINGS,
) {
  return new Intl.NumberFormat(locale(settings), {
    style: "currency",
    currency,
    minimumFractionDigits: settings.moneyDecimals,
    maximumFractionDigits: settings.moneyDecimals,
  }).format(finite(value));
}

export function formatDisplayCost(
  value: number | string,
  currency = "GTQ",
  settings: NumberDisplaySettings = DEFAULT_NUMBER_SETTINGS,
) {
  return new Intl.NumberFormat(locale(settings), {
    style: "currency",
    currency,
    minimumFractionDigits: settings.costDecimals,
    maximumFractionDigits: settings.costDecimals,
  }).format(finite(value));
}

export function formatDisplayQuantity(
  value: number | string,
  settings: NumberDisplaySettings = DEFAULT_NUMBER_SETTINGS,
  unitDecimals?: number,
) {
  const decimals = unitDecimals ?? settings.quantityDecimals;
  return formatNumber(value, decimals, settings, 0);
}

/** Parse a localized number. Group separators must appear in groups of three. */
export function parseLocalizedNumber(
  input: string,
  style: NumberFormatStyle,
): number | null {
  const value = input.trim();
  if (!value) return null;
  const group = style === "US" ? "," : ".";
  const decimal = style === "US" ? "." : ",";
  const escapedGroup = group === "." ? "\\." : group;
  const escapedDecimal = decimal === "." ? "\\." : decimal;
  const pattern = new RegExp(
    `^[+-]?(?:\\d{1,3}(?:${escapedGroup}\\d{3})+|\\d+)(?:${escapedDecimal}\\d+)?$`,
  );
  if (!pattern.test(value)) return null;
  const normalized = value.split(group).join("").replace(decimal, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function canonicalLocalizedNumber(input: string, style: NumberFormatStyle) {
  const parsed = parseLocalizedNumber(input, style);
  return parsed === null ? null : String(parsed);
}
