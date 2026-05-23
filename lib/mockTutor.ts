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

function distanceToTarget(input: TutorInput) {
  const [x, y, z] = input.fk.endEffectorPosition;
  const [tx, ty, tz] = input.targetPose.position;
  const dx = tx - x;
  const dy = ty - y;
  const dz = tz - z;

  return {
    current: [x, y, z],
    target: [tx, ty, tz],
    vector: [dx, dy, dz],
    distance: Math.sqrt(dx * dx + dy * dy + dz * dz)
  };
}

function stateLine(input: TutorInput) {
  const state = distanceToTarget(input);

  return `当前末端位置为 (${state.current.map((value) => formatNumber(value)).join(", ")}) m，目标位置为 (${state.target
    .map((value) => formatNumber(value))
    .join(", ")}) m，位置误差向量为 (${state.vector
    .map((value) => formatNumber(value))
    .join(", ")}) m，误差范数约 ${formatNumber(state.distance)} m。`;
}

function response(sections: {
  calculation: string;
  theory: string;
  robotMeaning: string;
  nextAction: string;
}) {
  return [
    `1. 计算路径 (Calculation path)\n${sections.calculation}`,
    `2. 理论要点 (Theory)\n${sections.theory}`,
    `3. 机器人含义 (Robot interpretation)\n${sections.robotMeaning}`,
    `4. 下一步操作 (Suggested next action)\n${sections.nextAction}`
  ].join("\n\n");
}

export function generateMockTutorResponse(input: TutorInput) {
  const question = input.question.trim().toLowerCase();
  const summary = stateLine(input);

  if (question.includes("dh") || question.includes("参数")) {
    return response({
      calculation: `${summary} FK 计算会把每一行 DH 参数和当前关节角组合成局部变换 Ti(i+1)，再从 base 坐标系开始依次相乘。`,
      theory:
        "标准 DH 变换按 $RotZ(\\theta) \\rightarrow TransZ(d) \\rightarrow TransX(a) \\rightarrow RotX(\\alpha)$ 执行，也就是 $$T_i^{i+1}=R_z(\\theta_i)T_z(d_i)T_x(a_i)R_x(\\alpha_i).$$ 其中 $\\theta$ 描述关节绕本地 $Z$ 轴的旋转，$d$ 是沿 $Z$ 轴的偏移，$a$ 是沿 $X$ 轴的连杆长度，$\\alpha$ 是相邻 $Z$ 轴之间的扭转角。",
      robotMeaning:
        "在 6DOF 机械臂中，前几个关节通常决定末端能到哪里，腕部关节更多决定末端坐标系的方向。修改 a、d、alpha 会改变机器人结构本身；修改 theta 会改变当前姿态。",
      nextAction:
        "先固定 DH 表，只移动 joint 1 到 joint 3，观察 T06 第四列的位置变化；再移动 wrist joints，观察 roll/pitch/yaw 的变化。"
    });
  }

  if (question.includes("ik") || question.includes("收敛") || question.includes("失败")) {
    const ik = input.ik;
    return response({
      calculation: ik
        ? `${summary} 最近一次 IK 迭代 ${ik.iterations} 次，位置误差 ${formatNumber(
            ik.positionError
          )} m，姿态误差 ${formatNumber(ik.orientationError)}，状态为 ${ik.success ? "已收敛" : "未收敛"}。`
        : `${summary} 当前还没有运行 IK。IK 会从当前关节角出发，反复计算末端误差和雅可比矩阵，再更新 6 个关节角。`,
      theory:
        "数值 IK 的目标是让误差向量 $e$ 变小。Position Only 主要使用位置误差 $e_p=[dx,dy,dz]^T$；Pose IK 还会加入姿态误差 $e_R$。DLS 方法通常使用 $$\\Delta q = J^T\\left(JJ^T + \\lambda^2 I\\right)^{-1} e,$$ 其中 $\\lambda$ 是阻尼，用来降低奇异位形附近的过大关节更新。",
      robotMeaning:
        "如果目标超出工作空间、初始姿态离目标太远、shoulder/elbow 接近伸直、或 wrist 轴线接近重合，雅可比会出现弱方向，误差下降会变慢甚至停滞。Pose IK 还可能因为姿态约束过强而比 Position Only 更难收敛。",
      nextAction:
        "先切到 Position Only 求位置；如果仍失败，手动调整 joint 1 对准目标水平投影，再用 joint 2 和 joint 3 缩短位置误差后重新 Solve IK。"
    });
  }

  if (question.includes("奇异") || question.includes("singular")) {
    return response({
      calculation: `${summary} 判断奇异性时，要看当前关节角对应的雅可比矩阵是否失去有效方向，也就是某些末端运动方向无法由关节速度稳定地产生。`,
      theory:
        "雅可比 $J(q)$ 把关节速度 $\\dot q$ 映射到末端速度 $\\dot x$：$$\\dot x = J(q)\\dot q.$$ 奇异位形附近，$J$ 的某些方向接近线性相关，导致某些末端方向需要非常大的关节速度才能实现。DLS 通过阻尼项 $\\lambda^2 I$ 稳定求解，但会牺牲收敛速度和精度。",
      robotMeaning:
        "常见结构原因包括 shoulder/elbow 过度伸直导致可达方向变少，以及 wrist 关节轴线重合导致姿态自由度退化。此时 IK 可能表现为误差不降、关节角跳动或姿态误差难以消除。",
      nextAction:
        "把目标稍微移离完全伸直方向，或先调整 elbow 让机械臂保持弯曲，再重新求解 IK。"
    });
  }

  if (question.includes("t06") || question.includes("矩阵")) {
    return response({
      calculation: `${summary} T06 是从 base 坐标系到 end effector 坐标系的总变换，由 T01*T12*T23*T34*T45*T56 连乘得到。`,
      theory:
        "齐次变换矩阵左上 $3\\times3$ 是旋转矩阵 $R_{06}$，表示末端坐标系的 $x/y/z$ 轴在 base 坐标系中的方向；前三行第四列是位置 $p_{06}$：$$T_{06}=\\begin{bmatrix}R_{06} & p_{06}\\\\0\\ 0\\ 0 & 1\\end{bmatrix}.$$",
      robotMeaning:
        "T06 同时回答两个问题：末端在哪里，以及末端工具坐标系朝向哪里。位置 IK 主要匹配 p06；Pose IK 同时匹配 p06 和 R06。",
      nextAction:
        "在 FK 面板中先看 T06 第四列，再对照 3D 里的末端点；随后移动 wrist joints，观察 R06 变化而位置变化相对较小。"
    });
  }

  if (question.includes("position") || question.includes("pose") || question.includes("区别")) {
    return response({
      calculation: `${summary} Position IK 只最小化位置误差；Pose IK 会同时最小化位置误差和姿态误差。`,
      theory:
        "Position IK 的误差维度通常是 3，对应 $e_p=[dx,dy,dz]^T$。Pose IK 的误差维度通常是 6，可写成 $$e=\\begin{bmatrix}e_p\\\\w_R e_R\\end{bmatrix},$$ 包括 3 个位置误差和 3 个姿态误差。约束维度越高，越依赖关节冗余、初始值和雅可比条件数。",
      robotMeaning:
        "对 6DOF 机械臂来说，位置通常主要由 base、shoulder、elbow 决定，姿态主要由 wrist joints 调整。若腕部姿态无法满足目标方向，Pose IK 可能失败，即使末端点已经接近目标。",
      nextAction:
        "先用 Position Only 把末端点放到目标附近，再切换 Pose IK 微调 roll/pitch/yaw。"
    });
  }

  if (input.practiceMode) {
    return response({
      calculation: `${summary} 练习模式的核心计算是当前末端点与目标点之间的欧氏距离，距离低于阈值时判定完成。`,
      theory:
        "手动练习相当于用人的直觉做 IK：先减小大尺度位置误差，再处理小尺度姿态误差。这个过程对应数值 IK 中误差逐步下降的思想。",
      robotMeaning:
        "base joint 主要改变水平朝向，shoulder 和 elbow 主要改变半径与高度，wrist joints 主要影响末端方向。先调前 3 个关节通常更有效。",
      nextAction:
        "先让 base 指向目标，再调 shoulder/elbow 让末端高度和距离接近目标，最后用 Show Solution 对比数值 IK 的解。"
    });
  }

  return response({
    calculation: `${summary} 当前 FK 已经根据 DH 表和 6 个关节角计算出末端位姿；IK 则会反过来从目标位姿推关节角更新。`,
    theory:
      "FK 是确定性链式乘法：给定 q 和 DH 参数，唯一得到 T06。IK 是反问题：给定目标位姿，寻找一组 q 让当前 T06 接近目标，因此通常需要数值迭代、误差函数和雅可比矩阵。",
    robotMeaning:
      "对这个 Generic 6DOF Arm，前臂几何决定工作空间，腕部结构决定姿态调节能力。观察 FK/IK 时要同时看位置误差、姿态误差和关节构型。",
    nextAction:
      "选择一个具体问题，例如 T06、DH 参数、IK 失败或奇异位形，我会按计算步骤解释对应的机器人理论。"
  });
}
