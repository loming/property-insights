import type { SegmentBy } from "@/lib/api/market";

/** The ways market-api can split the market (M-1), in the order the chart offers them. */
export const SEGMENTATIONS: readonly { by: SegmentBy; label: string }[] = [
  { by: "bedrooms", label: "Bedrooms" },
  { by: "bathrooms", label: "Bathrooms" },
  { by: "decade", label: "Decade built" },
  { by: "school_band", label: "School rating" },
  { by: "distance_band", label: "Distance to city centre" },
];

export function parseSegmentBy(raw: string | string[] | undefined): SegmentBy {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SEGMENTATIONS.find((s) => s.by === value)?.by ?? "bedrooms";
}
