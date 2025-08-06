export const clamp = (v: number, min = 0, max = 24) => Math.max(min, Math.min(max, v));
export const snapQuarter = (v: number) => Math.round(v * 4) / 4;
export const quarters = (min = 0, max = 24) => {
  const arr: number[] = [];
  for (let q = min * 4; q <= max * 4; q++) arr.push(q / 4);
  return arr; // 0, 0.25, ... 24
};
export const isQuarter = (v: number) =>
  Number.isFinite(v) && v >= 0 && v <= 24 && Math.round(v * 4) === v * 4;