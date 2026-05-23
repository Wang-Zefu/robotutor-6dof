"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Cpu, Ruler } from "lucide-react";
import DHTable from "@/components/DHTable";
import FKPanel from "@/components/FKPanel";
import IKPanel from "@/components/IKPanel";
import JointControls from "@/components/JointControls";
import PracticePanel from "@/components/PracticePanel";
import TutorPanel from "@/components/TutorPanel";
import {
  defaultDHParams,
  formatNumber,
  forwardKinematicsDH,
  inverseKinematicsDLS,
  poseError
} from "@/lib/kinematics";
import type { DHParam, IKResult, TargetPose } from "@/types/robot";

const zeroAngles = [0, 0, 0, 0, 0, 0];

const RobotScene = dynamic(() => import("@/components/RobotScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded border border-slate-700 bg-slate-950 text-sm text-slate-400 xl:h-[calc(100vh-210px)] xl:min-h-[520px] xl:max-h-[720px]">
      Loading 3D scene...
    </div>
  )
});

function makeReachableTarget(dhParams: DHParam[]): TargetPose {
  const seedAngles = Array.from({ length: 6 }, () => Math.round(Math.random() * 220 - 110));
  const fk = forwardKinematicsDH(dhParams, seedAngles);
  return {
    position: fk.endEffectorPosition.map((value) => Number(value.toFixed(3))) as [number, number, number],
    eulerDeg: {
      roll: Number(fk.endEffectorEuler.roll.toFixed(1)),
      pitch: Number(fk.endEffectorEuler.pitch.toFixed(1)),
      yaw: Number(fk.endEffectorEuler.yaw.toFixed(1))
    }
  };
}

export default function Home() {
  const [jointAngles, setJointAngles] = useState<number[]>([0, -35, 55, 0, 35, 0]);
  const [dhParams, setDhParams] = useState<DHParam[]>(defaultDHParams);
  const [targetPose, setTargetPose] = useState<TargetPose>({
    position: [0.32, 0.18, 0.52],
    eulerDeg: { roll: 0, pitch: 30, yaw: 25 }
  });
  const [ikMode, setIkMode] = useState<"position" | "pose">("position");
  const [ikResult, setIkResult] = useState<IKResult | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);

  const fk = useMemo(() => forwardKinematicsDH(dhParams, jointAngles), [dhParams, jointAngles]);
  const error = useMemo(
    () =>
      poseError(
        { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorRotation },
        { position: targetPose.position, eulerDeg: targetPose.eulerDeg }
      ),
    [fk, targetPose]
  );

  const randomTarget = () => {
    const target = makeReachableTarget(dhParams);
    setTargetPose(target);
    setIkResult(null);
  };

  const togglePractice = (enabled: boolean) => {
    setPracticeMode(enabled);
    if (enabled) {
      randomTarget();
    }
  };

  const applyAngles = (angles: number[]) => {
    setJointAngles(angles.map((angle) => Math.max(-180, Math.min(180, Number(angle.toFixed(2))))));
  };

  const quickSolve = () => {
    const result = inverseKinematicsDLS(dhParams, jointAngles, targetPose, {
      mode: ikMode,
      tolerance: 0.008,
      maxIterations: ikMode === "pose" ? 180 : 120
    });
    setIkResult(result);
    if (result.success) {
      applyAngles(result.finalAngles);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal text-slate-50">RoboTutor 6DOF</h1>
            <p className="text-sm text-slate-400">6 自由度机械臂 FK / IK 可视化教学工作台</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
              <div className="flex items-center gap-1 text-slate-500">
                <Ruler size={13} /> position error
              </div>
              <div className="font-mono text-cyan-200">{formatNumber(error.positionError)} m</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
              <div className="flex items-center gap-1 text-slate-500">
                <Activity size={13} /> orientation error
              </div>
              <div className="font-mono text-amber-200">{formatNumber(error.orientationError)}</div>
            </div>
            <button
              type="button"
              onClick={quickSolve}
              className="inline-flex items-center justify-center gap-2 rounded border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-cyan-100 hover:bg-cyan-900"
            >
              <Cpu size={14} /> Quick Solve
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(520px,1fr)_430px_430px]">
        <section className="min-h-[620px]">
          <RobotScene fk={fk} targetPose={targetPose} />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <div className="text-xs text-slate-500">End effector</div>
              <div className="font-mono text-slate-100">
                ({fk.endEffectorPosition.map((value) => formatNumber(value)).join(", ")})
              </div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <div className="text-xs text-slate-500">RPY deg</div>
              <div className="font-mono text-slate-100">
                {formatNumber(fk.endEffectorEuler.roll, 1)}, {formatNumber(fk.endEffectorEuler.pitch, 1)},{" "}
                {formatNumber(fk.endEffectorEuler.yaw, 1)}
              </div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <div className="text-xs text-slate-500">Target</div>
              <div className="font-mono text-amber-200">
                ({targetPose.position.map((value) => formatNumber(value)).join(", ")})
              </div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3">
              <div className="text-xs text-slate-500">Solver mode</div>
              <div className="font-mono text-cyan-200">{ikMode === "position" ? "Position Only" : "Pose IK"}</div>
            </div>
          </div>
        </section>

        <section className="thin-scrollbar space-y-4 overflow-y-auto xl:max-h-[calc(100vh-104px)]">
          <JointControls
            jointAngles={jointAngles}
            onChange={(next) => {
              setJointAngles(next);
              setIkResult(null);
            }}
            onReset={() => {
              setJointAngles([...zeroAngles]);
              setIkResult(null);
            }}
          />
          <DHTable dhParams={dhParams} jointAngles={jointAngles} onChange={setDhParams} />
          <IKPanel
            dhParams={dhParams}
            jointAngles={jointAngles}
            targetPose={targetPose}
            ikResult={ikResult}
            mode={ikMode}
            onTargetChange={(target) => {
              setTargetPose(target);
              setIkResult(null);
            }}
            onModeChange={setIkMode}
            onIKResult={setIkResult}
            onApply={applyAngles}
            onRandomTarget={randomTarget}
          />
        </section>

        <section className="thin-scrollbar space-y-4 overflow-y-auto xl:max-h-[calc(100vh-104px)]">
          <FKPanel fk={fk} />
          <PracticePanel
            enabled={practiceMode}
            fk={fk}
            dhParams={dhParams}
            jointAngles={jointAngles}
            targetPose={targetPose}
            onToggle={togglePractice}
            onNewTarget={randomTarget}
            onApplySolution={applyAngles}
          />
          <TutorPanel
            dhParams={dhParams}
            jointAngles={jointAngles}
            fk={fk}
            ikResult={ikResult}
            targetPose={targetPose}
            practiceMode={practiceMode}
          />
        </section>
      </div>
    </main>
  );
}
