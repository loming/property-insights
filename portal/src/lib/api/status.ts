import "server-only";

import { getEstimatorHealth } from "./estimator";
import { getMarketHealth } from "./market";

export type Status = "up" | "down" | "unknown";

export type ServiceStatus = { estimator: Status; market: Status; model: Status };

/**
 * Both backends' health in parallel, for the home page. The portal has no ml-api URL: the model's status
 * comes from estimator-api's health. A failed check reads as "down" instead of failing the page.
 */
export async function getServiceStatus(): Promise<ServiceStatus> {
  const [estimator, market] = await Promise.allSettled([getEstimatorHealth(), getMarketHealth()]);
  return {
    estimator: estimator.status === "fulfilled" && estimator.value.database === "up" ? "up" : "down",
    market: market.status === "fulfilled" && market.value.status === "UP" ? "up" : "down",
    model: estimator.status === "fulfilled" ? (estimator.value.ml_api === "up" ? "up" : "down") : "unknown",
  };
}
