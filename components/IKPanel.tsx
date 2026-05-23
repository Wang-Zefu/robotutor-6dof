"use client";

import { BadgeCheck, Play, Shuffle, Target, Upload } from "lucide-react";
import type { DHParam, IKResult, TargetPose } from "@/types/robot";
import { formatNumber, inverseKinematicsDLS } from "@/lib/kinematics";

interface IKPanelProps {
  dhParams: DHParam[];
  jointAngles: number[];
  targetPose: TargetPose;
  ikResult: IKResult | null;
  mode: "position" | "pose";
  onTargetChange: (target: TargetPose) => void;
  onModeChange: (mode: "position" | "pose") => void;
  onIKResult: (result: IKResult) => void;
  onApply: (angles: number[]) => void;
  onRandomTarget: () => void;
}

function NumberField({
  label,
  value,
  step,
  onChange
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-right font-mono text-slate-100"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function IKPanel({
  dhParams,
  jointAngles,
  targetPose,
  ikResult,
  mode,
  onTargetChange,
  onModeChange,
  onIKResult,
  onApply,
  onRandomTarget
}: IKPanelProps) {
  const solve = () => {
    const result = inverseKinematicsDLS(dhParams, jointAngles, targetPose, {
      mode,
      maxIterations: mode === "pose" ? 180 : 120,
      tolerance: 0.008,
      damping: mode === "pose" ? 0.16 : 0.1,
      stepSize: 0.75
    });
    onIKResult(result);
  };

  const updatePosition = (index: number, value: number) => {
    const next = [...targetPose.position] as [number, number, number];
    next[index] = value;
    onTargetChange({ ...targetPose, position: next });
  };

  const updateEuler = (key: "roll" | "pitch" | "yaw", value: number) => {
    onTargetChange({
      ...targetPose,
      eulerDeg: {
        ...targetPose.eulerDeg,
        [key]: value
      }
    });
  };

  return (
    <section className="rounded border border-slate-700 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <Target size={16} className="text-amber-300" />
        <h2 className="text-sm font-semibold text-slate-100">IK Solver</h2>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2 rounded border border-slate-800 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => onModeChange("position")}
            className={`rounded px-2 py-1.5 text-xs ${
              mode === "position" ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Position Only
          </button>
          <button
            type="button"
            onClick={() => onModeChange("pose")}
            className={`rounded px-2 py-1.5 text-xs ${
              mode === "pose" ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Pose IK Experimental
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["x", "y", "z"].map((axis, index) => (
            <NumberField
              key={axis}
              label={`${axis} m`}
              value={targetPose.position[index]}
              step={0.01}
              onChange={(value) => updatePosition(index, value)}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["roll", "pitch", "yaw"] as const).map((axis) => (
            <NumberField
              key={axis}
              label={`${axis} deg`}
              value={targetPose.eulerDeg[axis]}
              step={1}
              onChange={(value) => updateEuler(axis, value)}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={solve}
            className="inline-flex items-center justify-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
          >
            <Play size={15} /> Solve IK
          </button>
          <button
            type="button"
            onClick={onRandomTarget}
            className="inline-flex items-center justify-center gap-2 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Shuffle size={15} /> Random Target
          </button>
          <button
            type="button"
            disabled={!ikResult}
            onClick={() => ikResult && onApply(ikResult.finalAngles)}
            className="inline-flex items-center justify-center gap-2 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={15} /> Apply Solution
          </button>
          <button
            type="button"
            onClick={() => onApply([0, 0, 0, 0, 0, 0])}
            className="inline-flex items-center justify-center gap-2 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <BadgeCheck size={15} /> Reset Pose
          </button>
        </div>

        {ikResult ? (
          <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs">
            <div className={`mb-2 font-medium ${ikResult.success ? "text-emerald-300" : "text-amber-300"}`}>
              {ikResult.success ? "Converged" : "Not converged"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <span>Iterations</span>
              <span className="text-right font-mono">{ikResult.iterations}</span>
              <span>Current error</span>
              <span className="text-right font-mono">{formatNumber(ikResult.finalError)}</span>
              <span>Position error</span>
              <span className="text-right font-mono">{formatNumber(ikResult.positionError)} m</span>
              <span>Orientation error</span>
              <span className="text-right font-mono">{formatNumber(ikResult.orientationError)}</span>
            </div>
            <div className="mt-2 text-slate-400">{ikResult.reason}</div>
            <div className="mt-2 break-words font-mono text-[11px] text-cyan-200">
              [{ikResult.finalAngles.map((angle) => formatNumber(angle, 1)).join(", ")}] deg
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
