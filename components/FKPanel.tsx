"use client";

import { Sigma } from "lucide-react";
import type { FKResult, Matrix4 } from "@/types/robot";
import { formatNumber } from "@/lib/kinematics";

function MatrixView({ matrix, label }: { matrix: Matrix4; label: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-2">
      <div className="mb-1 font-mono text-xs text-cyan-200">{label}</div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-1 font-mono text-[11px] leading-5 text-slate-300">
        {matrix.flat().map((value, index) => (
          <span key={index} className="text-right">
            {formatNumber(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FKPanel({ fk }: { fk: FKResult }) {
  const position = fk.endEffectorPosition;
  const euler = fk.endEffectorEuler;

  return (
    <section className="rounded border border-slate-700 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <Sigma size={16} className="text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">FK Result</h2>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {["x", "y", "z"].map((axis, index) => (
            <div key={axis} className="rounded border border-slate-800 bg-slate-950 p-2">
              <div className="text-slate-500">{axis}</div>
              <div className="font-mono text-sm text-slate-100">{formatNumber(position[index])} m</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(["roll", "pitch", "yaw"] as const).map((axis) => (
            <div key={axis} className="rounded border border-slate-800 bg-slate-950 p-2">
              <div className="text-slate-500">{axis}</div>
              <div className="font-mono text-sm text-slate-100">{formatNumber(euler[axis], 2)} deg</div>
            </div>
          ))}
        </div>
        <MatrixView matrix={fk.finalTransform} label="T06" />
        <div className="grid gap-2">
          {fk.localTransforms.map((matrix, index) => (
            <MatrixView key={index} matrix={matrix} label={`T${index}${index + 1}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
