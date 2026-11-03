import { z } from "zod";

import { FEATURE_BY_NAME, FEATURES, type FeatureName } from "@/lib/features";

/**
 * What-if request bodies, checked by the portal's Route Handlers before market-api sees them, with the
 * model's own limits (lib/features.ts mirrors ml-api's).
 */

const FEATURE_NAMES = FEATURES.map((f) => f.name) as [FeatureName, ...FeatureName[]];

function featureNumber(name: FeatureName) {
  const feature = FEATURE_BY_NAME[name];
  let schema = z.number().min(feature.min).max(feature.max);
  if (feature.integer) {
    schema = schema.int();
  }
  if (feature.step === 0.5) {
    schema = schema.multipleOf(0.5);
  }
  return schema;
}

export const homeFeaturesSchema = z.strictObject({
  square_footage: featureNumber("square_footage"),
  bedrooms: featureNumber("bedrooms"),
  bathrooms: featureNumber("bathrooms"),
  year_built: featureNumber("year_built"),
  lot_size: featureNumber("lot_size"),
  distance_to_city_center: featureNumber("distance_to_city_center"),
  school_rating: featureNumber("school_rating"),
});

export const whatIfRequestSchema = z.strictObject({
  baseline: homeFeaturesSchema,
  changes: homeFeaturesSchema.partial(),
});

export const sensitivityRequestSchema = z
  .strictObject({
    baseline: homeFeaturesSchema,
    feature: z.enum(FEATURE_NAMES),
    from: z.number(),
    to: z.number(),
    steps: z.number().int().min(2).max(50),
  })
  .refine(
    ({ feature, from, to }) => {
      const { min, max } = FEATURE_BY_NAME[feature];
      return Math.min(from, to) >= min && Math.max(from, to) <= max;
    },
    { error: "from and to must be within the feature's allowed range", path: ["from"] },
  );
