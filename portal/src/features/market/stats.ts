/**
 * Round axis ticks inside [min, max]: about five, at a multiple of 1, 2, 2.5 or 5 times a power of ten
 * and never finer than `step` (a bedrooms axis has no 2.5).
 */
export function niceTicks(min: number, max: number, step = 0): number[] {
  if (!(max > min)) {
    return [min];
  }
  const raw = (max - min) / 6;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? 10 * power;
  const spacing = Math.max(nice, step);
  const ticks: number[] = [];
  for (let value = Math.ceil(min / spacing - 1e-9) * spacing; value <= max + 1e-9; value += spacing) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

/** Pearson's correlation of two equal-length series; null when it isn't defined (under 3 points, or flat). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) {
    return null;
  }
  const mean = (values: number[]) => values.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
