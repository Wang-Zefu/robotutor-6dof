"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { FKResult, Matrix3, TargetPose, Vector3Tuple } from "@/types/robot";
import { eulerToRotationMatrix } from "@/lib/kinematics";

interface RobotSceneProps {
  fk: FKResult;
  targetPose: TargetPose;
}

function toVector3(position: Vector3Tuple) {
  return new THREE.Vector3(position[0], position[1], position[2]);
}

function Link({ from, to }: { from: Vector3Tuple; to: Vector3Tuple }) {
  const start = toVector3(from);
  const end = toVector3(to);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  if (length < 1e-6) {
    return null;
  }

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.025, 0.025, length, 24]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.45} roughness={0.35} />
    </mesh>
  );
}

function AxisLines({
  position,
  rotation,
  scale = 0.12
}: {
  position: Vector3Tuple;
  rotation: Matrix3;
  scale?: number;
}) {
  const origin = toVector3(position);
  const axes = [
    { color: "#ef4444", vector: new THREE.Vector3(rotation[0][0], rotation[1][0], rotation[2][0]) },
    { color: "#22c55e", vector: new THREE.Vector3(rotation[0][1], rotation[1][1], rotation[2][1]) },
    { color: "#38bdf8", vector: new THREE.Vector3(rotation[0][2], rotation[1][2], rotation[2][2]) }
  ];

  return (
    <>
      {axes.map((axis) => (
        <Line
          key={axis.color}
          points={[origin, origin.clone().add(axis.vector.normalize().multiplyScalar(scale))]}
          color={axis.color}
          lineWidth={2}
        />
      ))}
    </>
  );
}

function TargetMarker({ targetPose }: { targetPose: TargetPose }) {
  const rotation = eulerToRotationMatrix(targetPose.eulerDeg);

  return (
    <group>
      <mesh position={targetPose.position}>
        <sphereGeometry args={[0.04, 32, 32]} />
        <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.4} />
      </mesh>
      <AxisLines position={targetPose.position} rotation={rotation} scale={0.18} />
    </group>
  );
}

function RobotModel({ fk, targetPose }: RobotSceneProps) {
  const positions = fk.jointPositions;

  return (
    <>
      <mesh position={[0, 0, -0.025]}>
        <cylinderGeometry args={[0.16, 0.18, 0.05, 48]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.45} />
      </mesh>

      {positions.slice(0, -1).map((position, index) => (
        <Link key={`link-${index}`} from={position} to={positions[index + 1]} />
      ))}

      {positions.map((position, index) => (
        <group key={`joint-${index}`}>
          <mesh position={position}>
            <sphereGeometry args={[index === 0 ? 0.05 : 0.042, 32, 32]} />
            <meshStandardMaterial
              color={index === positions.length - 1 ? "#38bdf8" : "#2563eb"}
              emissive={index === positions.length - 1 ? "#083344" : "#172554"}
              emissiveIntensity={0.28}
              metalness={0.25}
            />
          </mesh>
          <AxisLines position={position} rotation={fk.jointOrientations[index]} scale={index === 0 ? 0.18 : 0.1} />
        </group>
      ))}

      <TargetMarker targetPose={targetPose} />
    </>
  );
}

export default function RobotScene({ fk, targetPose }: RobotSceneProps) {
  return (
    <div className="h-[560px] overflow-hidden rounded border border-slate-700 bg-slate-950 xl:h-[calc(100vh-210px)] xl:min-h-[520px] xl:max-h-[720px]">
      <Canvas camera={{ position: [1.25, -1.6, 1.15], fov: 45 }} shadows>
        <color attach="background" args={["#08111f"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, -3, 4]} intensity={1.2} castShadow />
        <pointLight position={[-1.5, 1, 1.5]} intensity={0.55} />
        <Grid
          args={[2.4, 2.4]}
          cellSize={0.1}
          cellThickness={0.6}
          cellColor="#334155"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#64748b"
          fadeDistance={4}
          fadeStrength={1}
          infiniteGrid
        />
        <Line points={[[-0.9, 0, 0], [0.9, 0, 0]]} color="#ef4444" lineWidth={1.5} />
        <Line points={[[0, -0.9, 0], [0, 0.9, 0]]} color="#22c55e" lineWidth={1.5} />
        <Line points={[[0, 0, 0], [0, 0, 0.9]]} color="#38bdf8" lineWidth={1.5} />
        <RobotModel fk={fk} targetPose={targetPose} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}
