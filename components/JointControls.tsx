"use client";

import { RotateCcw } from "lucide-react";

interface JointControlsProps {
  jointAngles: number[];
  onChange: (angles: number[]) => void;
  onReset: () => void;
}

export default function JointControls({ jointAngles, onChange, onReset }: JointControlsProps) {
  const updateAngle = (index: number, value: number) => {
    const next = [...jointAngles];
    next[index] = value;
    onChange(next);
  };

  return (
    <section className="rounded border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-100">Joint Controls</h2>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
          onClick={onReset}
          title="Reset all joint angles"
          type="button"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="space-y-3 p-3">
        {jointAngles.map((angle, index) => (
          <div key={index} className="grid grid-cols-[54px_1fr_70px] items-center gap-2 text-sm">
            <label className="text-slate-300">J{index + 1}</label>
            <input
              min={-180}
              max={180}
              step={1}
              type="range"
              value={angle}
              onChange={(event) => updateAngle(index, Number(event.target.value))}
            />
            <input
              className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100"
              type="number"
              value={Number(angle.toFixed(0))}
              min={-180}
              max={180}
              onChange={(event) => updateAngle(index, Number(event.target.value))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
