"use client";

import type { DHParam } from "@/types/robot";

interface DHTableProps {
  dhParams: DHParam[];
  jointAngles: number[];
  onChange: (params: DHParam[]) => void;
}

type DHField = "a" | "alphaDeg" | "d" | "thetaOffsetDeg";

export default function DHTable({ dhParams, jointAngles, onChange }: DHTableProps) {
  const update = (index: number, field: DHField, value: number) => {
    const next = dhParams.map((param, paramIndex) =>
      paramIndex === index
        ? {
            ...param,
            [field]: value
          }
        : param
    );
    onChange(next);
  };

  return (
    <section className="rounded border border-slate-700 bg-slate-900">
      <div className="border-b border-slate-700 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-100">Standard DH Parameters</h2>
      </div>
      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Joint</th>
              <th className="px-2 py-2 text-left font-medium">a (m)</th>
              <th className="px-2 py-2 text-left font-medium">alpha deg</th>
              <th className="px-2 py-2 text-left font-medium">d (m)</th>
              <th className="px-2 py-2 text-left font-medium">offset deg</th>
              <th className="px-2 py-2 text-left font-medium">current theta</th>
            </tr>
          </thead>
          <tbody>
            {dhParams.map((param, index) => (
              <tr key={param.id} className="border-t border-slate-800">
                <td className="px-2 py-2 text-slate-300">{param.id}</td>
                {(["a", "alphaDeg", "d", "thetaOffsetDeg"] as DHField[]).map((field) => (
                  <td key={field} className="px-2 py-2">
                    <input
                      className="h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100"
                      type="number"
                      step={field === "a" || field === "d" ? 0.01 : 1}
                      value={param[field]}
                      onChange={(event) => update(index, field, Number(event.target.value))}
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-mono text-cyan-200">
                  {(jointAngles[index] + param.thetaOffsetDeg).toFixed(1)} deg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
        T = RotZ(theta) · TransZ(d) · TransX(a) · RotX(alpha)
      </div>
    </section>
  );
}
