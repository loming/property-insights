"use client";

import { useMemo } from "react";

import { formatNumber, formatPrice } from "@/lib/format";

/** Price and number formatting with a fixed locale, so server and browser output match (doc 02, E5). */
export function useFormatters() {
  return useMemo(
    () => ({
      price: formatPrice,
      number: formatNumber,
      /** "$251k": short enough for chart axes. */
      shortPrice: (value: number) => `$${formatNumber(Math.round(value / 1000))}k`,
      /** "+$2.5k" / "−$6.4k": signed, for contributions and deltas. */
      signedPrice: (value: number) => {
        const sign = value > 0 ? "+" : value < 0 ? "−" : "";
        const abs = Math.abs(value);
        return abs >= 1000 ? `${sign}$${formatNumber(abs / 1000, 1)}k` : `${sign}${formatPrice(abs)}`;
      },
      /** "+$7,024" / "−$38,594": signed and exact, where the figures must add up. */
      signedExactPrice: (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPrice(Math.abs(value))}`,
      /** "+2.81%" / "−15.9%", with a true minus sign to match the prices. */
      signedPercent: (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}%`,
    }),
    [],
  );
}
