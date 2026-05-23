import type { DHParam, FKResult, IKResult, TargetPose } from "@/types/robot";
import { formatNumber } from "@/lib/kinematics";

interface TutorInput {
  question: string;
  dhParams: DHParam[];
  jointAngles: number[];
  fk: FKResult;
  ik?: IKResult | null;
  targetPose: TargetPose;
  practiceMode?: boolean;
}

function baseSummary(input: TutorInput) {
  const [x, y, z] = input.fk.endEffectorPosition;
  const target = input.targetPose.position;
  const dx = target[0] - x;
  const dy = target[1] - y;
  const dz = target[2] - z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return `当前末端位置为 (${formatNumber(x)}, ${formatNumber(y)}, ${formatNumber(z)}) m，目标位置为 (${formatNumber(
    target[0]
  )}, ${formatNumber(target[1])}, ${formatNumber(target[2])}) m，位置误差约 ${formatNumber(distance)} m。`;
}

export function generateMockTutorResponse(input: TutorInput) {
  const question = input.question.trim().toLowerCase();
  const summary = baseSummary(input);

  if (question.includes("dh") || question.includes("参数")) {
    return `${summary}\n\nDH 参数把相邻关节坐标系之间的几何关系拆成四步：绕 Z 轴转 theta，沿 Z 轴平移 d，沿 X 轴平移 a，再绕 X 轴转 alpha。本项目使用标准 DH，表格中的 current theta 来自关节滑块加 theta offset。修改 a、alpha、d 会直接改变每一段连杆的几何布局。`;
  }

  if (question.includes("ik") || question.includes("收敛") || question.includes("失败")) {
    const ik = input.ik;
    if (!ik) {
      return `${summary}\n\n还没有运行 IK。建议先使用 Position Only 模式求解位置，再尝试 Pose IK。数值 IK 对初始关节角敏感，如果目标太远、姿态约束太强或机械臂接近奇异位形，误差可能下降很慢。`;
    }
    return `${summary}\n\n最近一次 IK 状态：${ik.success ? "已收敛" : "未收敛"}，迭代 ${ik.iterations} 次，位置误差 ${formatNumber(
      ik.positionError
    )} m。原因：${ik.reason}。如果失败，优先检查目标是否超出工作空间，然后把模式切到 Position Only，或先把 shoulder/elbow 调到更接近目标距离的位置。`;
  }

  if (question.includes("奇异") || question.includes("singular")) {
    return `${summary}\n\n奇异位形通常发生在多个关节轴线重合或某些自由度无法独立改变末端运动时。教学判断可以看两点：关节 2/3 接近完全伸直会让位置雅可比退化，腕部关节轴线接近重合会让姿态控制不稳定。DLS 通过阻尼项降低奇异附近的大步跳变，但也会让收敛变慢。`;
  }

  if (question.includes("t06") || question.includes("矩阵")) {
    return `${summary}\n\nT06 是 base 坐标系到末端坐标系的齐次变换。左上 3x3 是末端方向，前三行第四列是末端位置，最后一行保持 [0, 0, 0, 1]。它由 T01 到 T56 连乘得到，因此任一 DH 参数或关节角变化都会传递到最终位姿。`;
  }

  if (question.includes("position") || question.includes("pose") || question.includes("区别")) {
    return `${summary}\n\nPosition IK 只让末端点靠近目标位置，通常更容易收敛。Pose IK 同时要求位置和 roll/pitch/yaw 接近目标，约束更多，所以在 6DOF 结构、初始姿态或目标姿态不合适时更容易失败。第一版 Pose IK 使用数值姿态误差，适合教学观察，不等同于工业解析 IK。`;
  }

  if (input.practiceMode) {
    return `${summary}\n\n练习建议：先调整 base joint 让机械臂朝向目标水平投影，再用 shoulder 和 elbow 改变半径与高度。接近目标后，再用 wrist joints 微调末端方向。`;
  }

  return `${summary}\n\n可以从 FK 路径理解当前状态：每个关节角改变一个局部 Z 轴旋转，DH 表定义了相邻坐标系的固定几何偏移。若要快速靠近目标，先调 joint 1 控制方位，再调 joint 2 和 joint 3 控制主要距离。`;
}
