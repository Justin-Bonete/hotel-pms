'use client';

/** Small dependency-free SVG charts. Every bar and point has a text tooltip and the chart has a text label for screen readers. */

const W = 640;

function xLabels(labels: string[]): Array<{ i: number; text: string }> {
  if (labels.length === 0) return [];
  const idx = Array.from(new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1]));
  return idx.map((i) => ({ i, text: labels[i] ?? '' }));
}

export function BarChart({ labels, values, format, label, height = 170 }: { labels: string[]; values: number[]; format: (v: number) => string; label: string; height?: number }) {
  const n = values.length;
  const max = Math.max(...values, 1);
  const padX = 6, top = 10, bottom = 22;
  const innerH = height - top - bottom;
  const step = (W - padX * 2) / Math.max(n, 1);
  const barW = Math.max(step * 0.72, 1);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="h-auto w-full">
      <line x1={padX} x2={W - padX} y1={top + innerH} y2={top + innerH} stroke="#e2e8f0" />
      {values.map((v, i) => {
        const h = (v / max) * innerH;
        return (
          <rect key={i} x={padX + i * step + (step - barW) / 2} y={top + innerH - h} width={barW} height={Math.max(h, v > 0 ? 1 : 0)} rx={1.5} fill="#6366f1">
            <title>{`${labels[i]}: ${format(v)}`}</title>
          </rect>
        );
      })}
      {xLabels(labels).map(({ i, text }) => (
        <text key={i} x={padX + i * step + step / 2} y={height - 6} fontSize="11" fill="#64748b" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{text}</text>
      ))}
      <text x={W - padX} y={top + 2} fontSize="11" fill="#94a3b8" textAnchor="end">max {format(max)}</text>
    </svg>
  );
}

/** A percentage line (0 to max(100, highest value)). null points leave a gap instead of drawing a false zero. */
export function LineChart({ labels, values, label, height = 170 }: { labels: string[]; values: Array<number | null>; label: string; height?: number }) {
  const n = values.length;
  const max = Math.max(100, ...values.map((v) => v ?? 0));
  const padX = 8, top = 10, bottom = 22;
  const innerH = height - top - bottom;
  const x = (i: number) => padX + (n <= 1 ? (W - padX * 2) / 2 : (i / (n - 1)) * (W - padX * 2));
  const y = (v: number) => top + innerH - (v / max) * innerH;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="h-auto w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeDasharray={g === 0 ? undefined : '3 4'} />
          <text x={W - padX} y={y(g) - 3} fontSize="10" fill="#94a3b8" textAnchor="end">{g}%</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
      {n <= 62 && values.map((v, i) => v === null ? null : (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="#059669"><title>{`${labels[i]}: ${v}%`}</title></circle>
      ))}
      {xLabels(labels).map(({ i, text }) => (
        <text key={i} x={x(i)} y={height - 6} fontSize="11" fill="#64748b" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{text}</text>
      ))}
    </svg>
  );
}

/** Horizontal bars sorted by the caller, with the value at the end of each row. */
export function BarList({ rows, format, empty = 'Nothing in this period.' }: { rows: Array<{ label: string; value: number }>; format: (v: number) => string; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-3"><span className="truncate text-slate-700">{r.label}</span><span className="tabular-nums font-medium text-slate-900">{format(r.value)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
