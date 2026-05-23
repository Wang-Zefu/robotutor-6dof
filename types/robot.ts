export type Vector3Tuple = [number, number, number];
export type Matrix4 = number[][];
export type Matrix3 = number[][];

export interface DHParam {
  id: number;
  a: number;
  alphaDeg: number;
  d: number;
  thetaOffsetDeg: number;
}

export interface EulerAngles {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface Pose {
  position: Vector3Tuple;
  eulerDeg?: EulerAngles;
  rotationMatrix?: Matrix3;
}

export interface FKResult {
  localTransforms: Matrix4[];
  jointTransforms: Matrix4[];
  jointPositions: Vector3Tuple[];
  jointOrientations: Matrix3[];
  finalTransform: Matrix4;
  endEffectorPosition: Vector3Tuple;
  endEffectorEuler: EulerAngles;
  endEffectorRotation: Matrix3;
}

export interface IKOptions {
  maxIterations?: number;
  tolerance?: number;
  damping?: number;
  stepSize?: number;
  mode?: "position" | "pose";
}

export interface IKResult {
  success: boolean;
  reason: string;
  iterations: number;
  finalAngles: number[];
  finalError: number;
  errorHistory: number[];
  positionError: number;
  orientationError: number;
  status: "idle" | "running" | "success" | "failed";
}

export interface TargetPose {
  position: Vector3Tuple;
  eulerDeg: EulerAngles;
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}
