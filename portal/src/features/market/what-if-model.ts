/** The what-if tool's baselines, changes and the sum behind a price change (M-3), apart from the markup. */
import type { HomeFeatures, MarketModelInfo, PropertyRow, SegmentMedian } from "@/lib/api/market";
import { ApiError } from "@/lib/api/problem";
import { FEATURES, type FeatureName } from "@/lib/features";
import { formatNumber, formatPrice } from "@/lib/format";

export type Baseline = {
  id: string;
  label: string;
  kind: "typical" | "listed";
  features: HomeFeatures;
  /** What a listed home actually sold for. */
  soldFor?: number;
};

/** Each feature's range among the homes in the data (the model's training data): the sliders' ends. */
export type FeatureRanges = Record<FeatureName, { min: number; max: number }>;

/** A slider's step per feature: fine enough to explore, coarse enough to keep model calls few. */
export const SLIDER_STEPS: Record<FeatureName, number> = {
  square_footage: 10,
  bedrooms: 1,
  bathrooms: 0.5,
  year_built: 1,
  lot_size: 50,
  distance_to_city_center: 0.1,
  school_rating: 0.1,
};

/** What one unit of each feature is, for "−$103 per sq ft". */
export const PER_UNIT: Record<FeatureName, string> = {
  square_footage: "sq ft",
  bedrooms: "bedroom",
  bathrooms: "bathroom",
  year_built: "year",
  lot_size: "sq ft of lot",
  distance_to_city_center: "mile",
  school_rating: "rating point",
};

function featuresOf(source: HomeFeatures): HomeFeatures {
  return Object.fromEntries(FEATURES.map((f) => [f.name, source[f.name]])) as HomeFeatures;
}

/** Each bedroom segment's median home first, then every home in the data. */
export function buildBaselines(medians: SegmentMedian[], homes: PropertyRow[]): Baseline[] {
  return [
    ...medians.map((m) => ({
      id: `typical-${m.features.bedrooms}`,
      label: `Typical ${m.segment} home (the median of ${m.count})`,
      kind: "typical" as const,
      features: featuresOf(m.features),
    })),
    ...homes.map((h) => ({
      id: `home-${h.id}`,
      label: `Home #${h.id}: ${formatNumber(h.square_footage)} sq ft, ${h.bedrooms} bed, sold for ${formatPrice(h.price)}`,
      kind: "listed" as const,
      features: featuresOf(h),
      soldFor: h.price,
    })),
  ];
}

/** The baseline a URL names, or the typical 3-bed home (the commonest), or the first. */
export function pickBaseline(baselines: Baseline[], id: string | string[] | undefined): Baseline | undefined {
  const wanted = Array.isArray(id) ? id[0] : id;
  return baselines.find((b) => b.id === wanted) ?? baselines.find((b) => b.id === "typical-3") ?? baselines[0];
}

/** The features a scenario changes from its baseline: what market-api is sent as `changes`. */
export function changesFrom(baseline: HomeFeatures, scenario: HomeFeatures): Partial<HomeFeatures> {
  return Object.fromEntries(
    FEATURES.filter((f) => Math.abs(scenario[f.name] - baseline[f.name]) > 1e-9).map((f) => [f.name, scenario[f.name]]),
  ) as Partial<HomeFeatures>;
}

export type Effect = { name: FeatureName; from: number; to: number; perUnit: number; effect: number };

/**
 * Each change times its coefficient. Both models are linear in the features, so these add up to the
 * predicted change: the clearest way to show why a price moved, and why it can move the "wrong" way.
 */
export function effectsOf(changes: Partial<HomeFeatures>, baseline: HomeFeatures, model: MarketModelInfo): Effect[] {
  return FEATURES.flatMap((f) => {
    const to = changes[f.name];
    const perUnit = model.coefficients.find((c) => c.feature === f.name)?.per_unit;
    if (to === undefined || perUnit === undefined) {
      return [];
    }
    const from = baseline[f.name];
    return [{ name: f.name, from, to, perUnit, effect: (to - from) * perUnit }];
  });
}

/** What to tell someone whose what-if call failed, by the problem's status. */
export function describeModelError(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return { title: "The model can't price this home", detail: error.problem.detail ?? "Try values closer to the baseline." };
    }
    if (error.status === 429) {
      return { title: "Too many requests at once", detail: "Wait a moment, then try again." };
    }
    if (error.status === 0 || error.status === 503) {
      return {
        title: "The model isn't answering right now",
        detail: "The dashboard and the data table don't need it and keep working. Try again in a moment.",
      };
    }
  }
  return { title: "The model gave no usable answer", detail: "Try again in a moment." };
}

/** Points for a sensitivity sweep: one per value a slider can take, up to 21. */
export function sweepSteps(name: FeatureName, range: { min: number; max: number }): number {
  return Math.max(2, Math.min(21, Math.round((range.max - range.min) / SLIDER_STEPS[name]) + 1));
}
