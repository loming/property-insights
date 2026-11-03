import { StatTile } from "@/components/stat-tile";
import type { ModelInfo } from "@/lib/api/estimator";
import { formatFeatureValue } from "@/lib/features";
import { formatNumber, formatPrice } from "@/lib/format";

/** The served model at a glance: what it is, how accurate it is, and the ranges it was trained on. */
export function ModelSummary({ model }: { model: ModelInfo }) {
  const cv = model.metrics.cv;
  return (
    <section aria-labelledby="model-heading" className="space-y-4">
      <h2 id="model-heading" className="font-heading text-lg font-semibold">
        The model behind the estimates
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Model"
          value={model.model_type === "ridge" ? "Ridge" : "Linear regression"}
          hint={model.model_version}
        />
        <StatTile label="Typical error (CV MAE)" value={formatPrice(cv.mae.mean)} hint="Cross-validated, 5-fold × 20" />
        <StatTile label="CV RMSE" value={formatPrice(cv.rmse.mean)} />
        <StatTile label="CV R²" value={formatNumber(cv.r2.mean, 3)} hint={`${model.training_rows} training homes`} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">The model&apos;s input features and the range each was trained on</caption>
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Feature
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Unit
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Training range
              </th>
            </tr>
          </thead>
          <tbody>
            {model.features.map((f) => (
              <tr key={f.name} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {f.label}
                </th>
                <td className="px-3 py-2 text-muted-foreground">{f.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatFeatureValue(f.name, f.training_min)} – {formatFeatureValue(f.name, f.training_max)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
