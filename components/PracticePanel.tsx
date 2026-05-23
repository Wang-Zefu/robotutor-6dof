"use client";

import { GraduationCap, Lightbulb, Wand2 } from "lucide-react";
import type { DHParam, FKResult, TargetPose } from "@/types/robot";
import { formatNumber, inverseKinematicsDLS } from "@/lib/kinematics";

interface PracticePanelProps {
  enabled: boolean;
  fk: FKResult;
  dhParams: DHParam[];
  jointAngles: number[];
  targetPose: TargetPose;
  onToggle: (enabled: boolean) => void;
  onNewTarget: () => void;
  onApplySolution: (angles: number[]) => void;
}

export default function PracticePanel({
  enabled,
  fk,
  dhParams,
  jointAngles,
  targetPose,
  onToggle,
  onNewTarget,
  onApplySolution
}: PracticePanelProps) {
  const dx = targetPose.position[0] - fk.endEffectorPosition[0];
  const dy = targetPose.position[1] - fk.endEffectorPosition[1];
  const dz = targetPose.position[2] - fk.endEffectorPosition[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const complete = enabled && distance < 0.025;

  const showSolution = () => {
    const result = inverseKinematicsDLS(dhParams, jointAngles, targetPose, {
      mode: "position",
      tolerance: 0.008,
      maxIterations: 150
    });
    onApplySolution(result.finalAngles);
  };

  return (
    <section className="rounded border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-emerald-300" />
          <h2 className="text-sm font-semibold text-slate-100">Practice Mode</h2>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-4 w-4"
          />
          Active
        </label>
      </div>
      <div className="space-y-3 p-3 text-sm">
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="mb-1 text-xs text-slate-500">Distance error</div>
          <div className={`font-mono text-lg ${complete ? "text-emerald-300" : "text-slate-100"}`}>
            {formatNumber(distance)} m
          </div>
          {complete ? <div className="mt-1 text-xs text-emerald-300">Complete: error is below 2.5 cm.</div> : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewTarget}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Wand2 size={15} /> New Target
          </button>
          <button
            type="button"
            onClick={showSolution}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            <Lightbulb size={15} /> Show Solution
          </button>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">
          优先调整 base joint 改变水平方向；shoulder 和 elbow 主要影响末端距离与高度；wrist joints
          主要影响姿态，位置接近后再微调。
        </div>
      </div>
    </section>
  );
}
