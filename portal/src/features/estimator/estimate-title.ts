import type { Estimate } from "@/lib/api/estimator";
import { formatNumber } from "@/lib/format";

/** The estimate's label, or a short description of the home when it has none. */
export function estimateTitle(estimate: Pick<Estimate, "label" | "features">): string {
  if (estimate.label) {
    return estimate.label;
  }
  const { square_footage: area, bedrooms } = estimate.features;
  return `${formatNumber(area)} sq ft, ${formatNumber(bedrooms)} bed home`;
}

/** "1,550 sq ft · 3 bed · 2 bath · built 1997". */
export function homeSummary(features: Estimate["features"]): string {
  return [
    `${formatNumber(features.square_footage)} sq ft`,
    `${formatNumber(features.bedrooms)} bed`,
    `${formatNumber(features.bathrooms)} bath`,
    `built ${features.year_built}`,
  ].join(" · ");
}
