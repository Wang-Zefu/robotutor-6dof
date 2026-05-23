import type {
  DHParam,
  EulerAngles,
  FKResult,
  IKOptions,
  IKResult,
  Matrix3,
  Matrix4,
  Pose,
  TargetPose,
  Vector3Tuple
} from "@/types/robot";

const IDENTITY_4: Matrix4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
];

export const defaultDHParams: DHParam[] = [
  { id: 1, a: 0, alphaDeg: 90, d: 0.4, thetaOffsetDeg: 0 },
  { id: 2, a: 0.3, alphaDeg: 0, d: 0, thetaOffsetDeg: 0 },
  { id: 3, a: 0.25, alphaDeg: 0, d: 0, thetaOffsetDeg: 0 },
  { id: 4, a: 0, alphaDeg: 90, d: 0.25, thetaOffsetDeg: 0 },
  { id: 5, a: 0, alphaDeg: -90, d: 0, thetaOffsetDeg: 0 },
  { id: 6, a: 0, alphaDeg: 0, d: 0.1, thetaOffsetDeg: 0 }
];

export function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

export function dhTransform(a: number, alpha: number, d: number, theta: number): Matrix4 {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1]
  ];
}

export function multiplyMatrix4(a: Matrix4, b: Matrix4): Matrix4 {
  const out: Matrix4 = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      for (let k = 0; k < 4; k += 1) {
        out[r][c] += a[r][k] * b[k][c];
      }
    }
  }
  return out;
}

function extractPosition(m: Matrix4): Vector3Tuple {
  return [m[0][3], m[1][3], m[2][3]];
}

function extractRotation(m: Matrix4): Matrix3 {
  return [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
    [m[2][0], m[2][1], m[2][2]]
  ];
}

export function eulerToRotationMatrix(euler: EulerAngles): Matrix3 {
  const roll = degToRad(euler.roll);
  const pitch = degToRad(euler.pitch);
  const yaw = degToRad(euler.yaw);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  return [
    [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
    [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
    [-sp, cp * sr, cp * cr]
  ];
}

export function rotationMatrixToEuler(matrix: Matrix3 | Matrix4): EulerAngles {
  const r = matrix.length === 4 ? extractRotation(matrix as Matrix4) : (matrix as Matrix3);
  const sy = Math.sqrt(r[0][0] * r[0][0] + r[1][0] * r[1][0]);
  const singular = sy < 1e-6;

  let roll: number;
  let pitch: number;
  let yaw: number;
  if (!singular) {
    roll = Math.atan2(r[2][1], r[2][2]);
    pitch = Math.atan2(-r[2][0], sy);
    yaw = Math.atan2(r[1][0], r[0][0]);
  } else {
    roll = Math.atan2(-r[1][2], r[1][1]);
    pitch = Math.atan2(-r[2][0], sy);
    yaw = 0;
  }

  return {
    roll: radToDeg(roll),
    pitch: radToDeg(pitch),
    yaw: radToDeg(yaw)
  };
}

export function forwardKinematicsDH(dhParams: DHParam[], jointAngles: number[]): FKResult {
  const localTransforms: Matrix4[] = [];
  const jointTransforms: Matrix4[] = [];
  const jointPositions: Vector3Tuple[] = [[0, 0, 0]];
  const jointOrientations: Matrix3[] = [extractRotation(IDENTITY_4)];
  let current = IDENTITY_4.map((row) => [...row]);

  dhParams.forEach((param, index) => {
    const theta = degToRad((jointAngles[index] ?? 0) + param.thetaOffsetDeg);
    const alpha = degToRad(param.alphaDeg);
    const local = dhTransform(param.a, alpha, param.d, theta);
    current = multiplyMatrix4(current, local);
    localTransforms.push(local);
    jointTransforms.push(current);
    jointPositions.push(extractPosition(current));
    jointOrientations.push(extractRotation(current));
  });

  const endEffectorRotation = extractRotation(current);
  return {
    localTransforms,
    jointTransforms,
    jointPositions,
    jointOrientations,
    finalTransform: current,
    endEffectorPosition: extractPosition(current),
    endEffectorEuler: rotationMatrixToEuler(endEffectorRotation),
    endEffectorRotation
  };
}

function transpose(matrix: number[][]) {
  return matrix[0].map((_, c) => matrix.map((row) => row[c]));
}

function multiplyMatrix(a: number[][], b: number[][]) {
  const out = Array.from({ length: a.length }, () => Array(b[0].length).fill(0));
  for (let r = 0; r < a.length; r += 1) {
    for (let c = 0; c < b[0].length; c += 1) {
      for (let k = 0; k < b.length; k += 1) {
        out[r][c] += a[r][k] * b[k][c];
      }
    }
  }
  return out;
}

function multiplyMatrixVector(matrix: number[][], vector: number[]) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function addDamping(matrix: number[][], damping: number) {
  return matrix.map((row, r) => row.map((value, c) => value + (r === c ? damping * damping : 0)));
}

function solveLinearSystem(a: number[][], b: number[]) {
  const n = a.length;
  const augmented = a.map((row, index) => [...row, b[index]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(augmented[r][col]) > Math.abs(augmented[pivot][col])) {
        pivot = r;
      }
    }
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];

    const pivotValue = augmented[col][col];
    if (Math.abs(pivotValue) < 1e-10) {
      throw new Error("Singular damped Jacobian system");
    }

    for (let c = col; c <= n; c += 1) {
      augmented[col][c] /= pivotValue;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = augmented[r][col];
      for (let c = col; c <= n; c += 1) {
        augmented[r][c] -= factor * augmented[col][c];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

function rotationTranspose(matrix: Matrix3): Matrix3 {
  return matrix[0].map((_, c) => matrix.map((row) => row[c])) as Matrix3;
}

function multiplyMatrix3(a: Matrix3, b: Matrix3): Matrix3 {
  const out: Matrix3 = Array.from({ length: 3 }, () => Array(3).fill(0)) as Matrix3;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
    }
  }
  return out;
}

function rotationErrorVector(current: Matrix3, target: Matrix3): Vector3Tuple {
  const r = multiplyMatrix3(target, rotationTranspose(current));
  return [
    0.5 * (r[2][1] - r[1][2]),
    0.5 * (r[0][2] - r[2][0]),
    0.5 * (r[1][0] - r[0][1])
  ];
}

function vectorNorm(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function subtractVector(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function poseError(currentPose: Pose, targetPose: Pose) {
  const positionVector = subtractVector(targetPose.position, currentPose.position);
  const currentRotation =
    currentPose.rotationMatrix ?? eulerToRotationMatrix(currentPose.eulerDeg ?? { roll: 0, pitch: 0, yaw: 0 });
  const targetRotation =
    targetPose.rotationMatrix ?? eulerToRotationMatrix(targetPose.eulerDeg ?? { roll: 0, pitch: 0, yaw: 0 });
  const orientationVector = rotationErrorVector(currentRotation, targetRotation);

  return {
    vector: [...positionVector, ...orientationVector],
    positionVector,
    orientationVector,
    positionError: vectorNorm(positionVector),
    orientationError: vectorNorm(orientationVector),
    totalError: vectorNorm([...positionVector, ...orientationVector])
  };
}

export function computeJacobianNumerical(
  dhParams: DHParam[],
  jointAngles: number[],
  mode: "position" | "pose" = "pose"
) {
  const epsDeg = 0.05;
  const epsRad = degToRad(epsDeg);
  const base = forwardKinematicsDH(dhParams, jointAngles);
  const rows = mode === "position" ? 3 : 6;
  const jacobian = Array.from({ length: rows }, () => Array(jointAngles.length).fill(0));

  for (let joint = 0; joint < jointAngles.length; joint += 1) {
    const perturbedAngles = [...jointAngles];
    perturbedAngles[joint] += epsDeg;
    const perturbed = forwardKinematicsDH(dhParams, perturbedAngles);
    const dp = subtractVector(perturbed.endEffectorPosition, base.endEffectorPosition);
    jacobian[0][joint] = dp[0] / epsRad;
    jacobian[1][joint] = dp[1] / epsRad;
    jacobian[2][joint] = dp[2] / epsRad;

    if (mode === "pose") {
      const dr = rotationErrorVector(base.endEffectorRotation, perturbed.endEffectorRotation);
      jacobian[3][joint] = dr[0] / epsRad;
      jacobian[4][joint] = dr[1] / epsRad;
      jacobian[5][joint] = dr[2] / epsRad;
    }
  }

  return jacobian;
}

function normalizeDeg(angle: number) {
  let value = angle;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function inverseKinematicsDLS(
  dhParams: DHParam[],
  initialAngles: number[],
  targetPose: TargetPose,
  options: IKOptions = {}
): IKResult {
  const maxIterations = options.maxIterations ?? 120;
  const tolerance = options.tolerance ?? 0.01;
  const damping = options.damping ?? 0.12;
  const stepSize = options.stepSize ?? 0.7;
  const mode = options.mode ?? "position";
  const orientationWeight = mode === "pose" ? 0.35 : 0;
  const errorHistory: number[] = [];
  let angles = [...initialAngles];
  let reason = "Reached maximum iterations.";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const fk = forwardKinematicsDH(dhParams, angles);
    const targetRotation = eulerToRotationMatrix(targetPose.eulerDeg);
    const err = poseError(
      {
        position: fk.endEffectorPosition,
        rotationMatrix: fk.endEffectorRotation
      },
      {
        position: targetPose.position,
        rotationMatrix: targetRotation
      }
    );

    const errorVector =
      mode === "position"
        ? [...err.positionVector]
        : [
            ...err.positionVector,
            err.orientationVector[0] * orientationWeight,
            err.orientationVector[1] * orientationWeight,
            err.orientationVector[2] * orientationWeight
          ];
    const errorNorm = vectorNorm(errorVector);
    errorHistory.push(errorNorm);

    if (err.positionError < tolerance && (mode === "position" || err.orientationError < tolerance * 6)) {
      return {
        success: true,
        reason: "Converged within tolerance.",
        iterations: iteration,
        finalAngles: angles.map(normalizeDeg),
        finalError: errorNorm,
        errorHistory,
        positionError: err.positionError,
        orientationError: err.orientationError,
        status: "success"
      };
    }

    try {
      let jacobian = computeJacobianNumerical(dhParams, angles, mode);
      if (mode === "pose") {
        jacobian = jacobian.map((row, index) => (index >= 3 ? row.map((value) => value * orientationWeight) : row));
      }
      const jt = transpose(jacobian);
      const jjt = multiplyMatrix(jacobian, jt);
      const damped = addDamping(jjt, damping);
      const y = solveLinearSystem(damped, errorVector);
      const delta = multiplyMatrixVector(jt, y);
      const maxStepRad = degToRad(12);
      angles = angles.map((angle, index) => {
        const limited = Math.max(-maxStepRad, Math.min(maxStepRad, delta[index] * stepSize));
        return normalizeDeg(angle + radToDeg(limited));
      });
    } catch {
      reason = "Jacobian system became singular or ill-conditioned.";
      break;
    }
  }

  const finalFk = forwardKinematicsDH(dhParams, angles);
  const finalErr = poseError(
    {
      position: finalFk.endEffectorPosition,
      rotationMatrix: finalFk.endEffectorRotation
    },
    {
      position: targetPose.position,
      rotationMatrix: eulerToRotationMatrix(targetPose.eulerDeg)
    }
  );
  const workspaceRadius = dhParams.reduce((sum, param) => sum + Math.abs(param.a) + Math.abs(param.d), 0);
  const targetRadius = vectorNorm(targetPose.position);

  if (targetRadius > workspaceRadius + 0.2) {
    reason = "Target is likely outside the workspace.";
  } else if (mode === "pose" && finalErr.positionError < tolerance * 3 && finalErr.orientationError > tolerance * 6) {
    reason = "Position is close, but the orientation constraint is too strong for this initial pose.";
  } else if (errorHistory.length > 8 && Math.abs(errorHistory[errorHistory.length - 1] - errorHistory.at(-8)!) < 1e-4) {
    reason = "Solver stalled, likely due to a poor initial pose or near-singular configuration.";
  }

  return {
    success: false,
    reason,
    iterations: errorHistory.length,
    finalAngles: angles.map(normalizeDeg),
    finalError: finalErr.totalError,
    errorHistory,
    positionError: finalErr.positionError,
    orientationError: finalErr.orientationError,
    status: "failed"
  };
}

export function formatNumber(value: number, digits = 3) {
  if (Math.abs(value) < 1e-9) {
    return "0.000";
  }
  return value.toFixed(digits);
}
