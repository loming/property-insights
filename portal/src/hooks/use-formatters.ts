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
    }),
    [],
  );
}
