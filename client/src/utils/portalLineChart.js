/**
 * Shared SVG line + area chart math (matches clerk dashboard velocity chart).
 * Used by supplier revenue and can replace inline clerk helpers over time.
 */
export const PORTAL_LINE_PAD_X = 8;
export const PORTAL_LINE_Y_TOP = 6;
export const PORTAL_LINE_Y_BOTTOM = 28;
export const PORTAL_LINE_Y_SPAN = PORTAL_LINE_Y_BOTTOM - PORTAL_LINE_Y_TOP;
export const PORTAL_LINE_VB_H = 32;

export function niceCeilAxisMax(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const f = x / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}

function niceTickStep(axisMax, maxTicks = 5) {
  if (axisMax <= 0) return 1;
  const rough = Math.ceil(axisMax / maxTicks);
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const r = rough / pow10;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return nice * pow10;
}

/** Y positions for horizontal grid lines (value → svg y). */
export function buildNumericAxisTicks(axisMax, yBottom, valueSpan) {
  const max = Math.max(1, Number(axisMax) || 1);
  const step = niceTickStep(max, 5);
  const values = [];
  for (let v = 0; v < max; v += step) values.push(v);
  if (values.length === 0 || values[values.length - 1] !== max) values.push(max);
  return values.map((value) => ({
    value,
    y: yBottom - (value / max) * valueSpan,
  }));
}

export function linearPathFromPoints(points) {
  if (points.length < 2) return '';
  const xAt = (p) => p.x ?? p.plotX;
  const yAt = (p) => p.y;
  let d = `M ${xAt(points[0])} ${yAt(points[0])}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${xAt(points[i])} ${yAt(points[i])}`;
  }
  return d;
}

/**
 * @param {Array<{ label: string } & Record<string, unknown>>} bars
 * @param {(bar: object) => number} getValue
 */
export function buildPortalLineCurve(bars, getValue) {
  const list = Array.isArray(bars) && bars.length ? bars : [];
  const chartMax = Math.max(0, ...list.map((b) => Number(getValue(b) || 0)));
  const axisMax = niceCeilAxisMax(Math.max(1, chartMax));
  const n = list.length;
  if (!n) {
    return {
      curveData: [],
      linePath: '',
      areaPath: '',
      axisMax: 1,
      yTicks: buildNumericAxisTicks(1, PORTAL_LINE_Y_BOTTOM, PORTAL_LINE_Y_SPAN),
    };
  }
  const denom = n > 1 ? n - 1 : 1;
  const innerW = Math.max(0.0001, 100 - PORTAL_LINE_PAD_X * 2);
  const curveData = list.map((b, i) => {
    const v = Number(getValue(b) || 0);
    const norm = axisMax > 0 ? v / axisMax : 0;
    const plotX = PORTAL_LINE_PAD_X + (n > 1 ? (i / denom) * innerW : innerW / 2);
    const pctX = plotX;
    return {
      plotX,
      pctX,
      y: PORTAL_LINE_Y_BOTTOM - norm * PORTAL_LINE_Y_SPAN,
      label: b.label,
      value: v,
    };
  });
  const linePath = linearPathFromPoints(curveData);
  let areaPath = '';
  if (curveData.length >= 2) {
    const firstX = curveData[0].plotX;
    const lastX = curveData[curveData.length - 1].plotX;
    areaPath = `${linearPathFromPoints(curveData)} L ${lastX} ${PORTAL_LINE_Y_BOTTOM} L ${firstX} ${PORTAL_LINE_Y_BOTTOM} Z`;
  } else if (curveData.length === 1) {
    const p = curveData[0];
    const w = 0.8;
    areaPath = `M ${p.plotX - w} ${PORTAL_LINE_Y_BOTTOM} L ${p.plotX - w} ${p.y} L ${p.plotX + w} ${p.y} L ${p.plotX + w} ${PORTAL_LINE_Y_BOTTOM} Z`;
  }
  const yTicks = buildNumericAxisTicks(axisMax, PORTAL_LINE_Y_BOTTOM, PORTAL_LINE_Y_SPAN);
  return { curveData, linePath, areaPath, axisMax, yTicks };
}
