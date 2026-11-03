import { z } from "zod";

import { FEATURE_BY_NAME, type Feature } from "@/lib/features";

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** One feature's rules, with messages that say what to enter rather than what went wrong. */
function featureField(feature: Feature) {
  const name = feature.label.toLowerCase();
  let field = z.number({
    error: (issue) => (issue.input === undefined || Number.isNaN(issue.input) ? `Enter the ${name}` : `Enter a number`),
  });
  if (feature.integer) {
    field = field.int({ error: `Enter a whole number` });
  }
  if (feature.step === 0.5) {
    field = field.multipleOf(0.5, { error: `Use steps of 0.5, such as 2 or 2.5` });
  }
  const unit = feature.unit ? ` ${feature.unit}` : "";
  return field
    .min(feature.min, { error: `Enter at least ${plain.format(feature.min)}${unit}` })
    .max(feature.max, { error: `Enter at most ${plain.format(feature.max)}${unit}` });
}

/**
 * The estimate form's schema, shared by the client form and the Server Action (TR-3b), so both apply
 * exactly the same rules. Field paths (features.bathrooms) match estimator-api's error fields.
 */
export const estimateSchema = z.object({
  label: z
    .string()
    .trim()
    .max(80, { error: "Keep the label to 80 characters" })
    .regex(/^[^\r\n\t]*$/, { error: "Keep the label to one line" })
    .optional()
    .transform((value) => (value ? value : undefined)),
  features: z.object({
    square_footage: featureField(FEATURE_BY_NAME.square_footage),
    bedrooms: featureField(FEATURE_BY_NAME.bedrooms),
    bathrooms: featureField(FEATURE_BY_NAME.bathrooms),
    year_built: featureField(FEATURE_BY_NAME.year_built),
    lot_size: featureField(FEATURE_BY_NAME.lot_size),
    distance_to_city_center: featureField(FEATURE_BY_NAME.distance_to_city_center),
    school_rating: featureField(FEATURE_BY_NAME.school_rating),
  }),
});

export type EstimateInput = z.input<typeof estimateSchema>;
export type EstimateValues = z.output<typeof estimateSchema>;
