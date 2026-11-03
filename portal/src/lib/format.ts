/**
 * Number formatting with a fixed locale: the server (Node in a container) and the browser must render
 * the same text, or hydration fails (doc 02, E5).
 */
const LOCALE = "en-US";

const price = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

export function formatPrice(value: number): string {
  return price.format(value);
}

export function formatNumber(value: number, fractionDigits?: number): string {
  if (fractionDigits === undefined) {
    return decimal.format(value);
  }
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
