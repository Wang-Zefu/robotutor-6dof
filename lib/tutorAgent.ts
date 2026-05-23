import type { DHParam, FKResult, IKResult, TargetPose } from "@/types/robot";
import { generateMockTutorResponse } from "@/lib/mockTutor";

export type TutorProvider = "mock" | "openai-compatible" | "anthropic";

export interface TutorPayload {
  question: string;
  dhParams: DHParam[];
  jointAngles: number[];
  fk: FKResult;
  ik?: IKResult | null;
  ikResult?: IKResult | null;
  targetPose: TargetPose;
  practiceMode?: boolean;
}

export interface TutorAgentResponse {
  explanation: string;
  suggestedNextAction: string;
  formulaExplanation?: string;
  provider: TutorProvider;
  model: string;
  fallback: boolean;
  finishReason?: string;
  truncated?: boolean;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

function env(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function envNumber(names: string[], fallback: number) {
  const value = env(names);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeProvider(value?: string): TutorProvider {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "anthropic" || normalized === "anthropic-compatible" || normalized === "claude") {
    return "anthropic";
  }
  if (
    normalized === "openai" ||
    normalized === "openai-compatible" ||
    normalized === "openai_compatible" ||
    normalized === "kimi" ||
    normalized === "mimo"
  ) {
    return "openai-compatible";
  }
  return "mock";
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function compactPayload(payload: TutorPayload) {
  return {
    question: payload.question,
    practiceMode: payload.practiceMode ?? false,
    jointAnglesDeg: payload.jointAngles,
    dhParams: payload.dhParams,
    endEffector: {
      position: payload.fk.endEffectorPosition,
      eulerDeg: payload.fk.endEffectorEuler,
      t06: payload.fk.finalTransform
    },
    targetPose: payload.targetPose,
    ik: payload.ik ?? payload.ikResult ?? null
  };
}

function systemPrompt() {
  return [
    "You are RoboTutor, a robotics kinematics theory tutor embedded in a 6DOF arm teaching workbench.",
    "Your answers must stay centered on robot arms, coordinate frames, standard DH parameters, homogeneous transforms, FK, IK, Jacobians, pose error, singularities, and numerical solving strategy.",
    "Prefer explaining the computation process over giving only conclusions. Walk through what is being computed, which formula is used, what each term means physically, and how the result changes the robot.",
    "For FK questions, explain the DH step sequence RotZ(theta) -> TransZ(d) -> TransX(a) -> RotX(alpha), the multiplication chain T01...T56 -> T06, and how T06 encodes end-effector position and orientation.",
    "For IK questions, explain the objective function, position/orientation error, numerical Jacobian, damped least squares update, convergence tolerance, and why initial pose, workspace limits, or singularities can affect the result.",
    "For singularity or error questions, connect the symptom to robot structure: aligned joint axes, stretched shoulder/elbow configurations, wrist-axis alignment, weak Jacobian directions, damping, and over-constrained pose targets.",
    "Use the robot state supplied by the user. Cite provided numeric values when useful, but do not invent measurements.",
    "If the user asks a broad or non-robotics question, answer only the part relevant to this 6DOF kinematics workbench and redirect to the robot model.",
    "Prefer Chinese when the user asks in Chinese. Use concise teaching language, but include formulas and frame/axis interpretation when relevant.",
    "All mathematical formulas must be renderable LaTeX. Use inline math with $...$ and block math with $$...$$.",
    "For matrices and vectors, use LaTeX environments such as \\begin{bmatrix} ... \\end{bmatrix}. Do not put LaTeX formulas inside code fences.",
    "Prefer standard robotics notation such as $T_{06}$, $R_{06}$, $p_{06}$, $J(q)$, $\\Delta q$, $e_p$, $e_R$, and $\\lambda^2 I$.",
    "When explaining DLS IK, write the update formula as $$\\Delta q = J^T\\left(JJ^T + \\lambda^2 I\\right)^{-1} e$$ when relevant.",
    "Always close every inline math delimiter $...$ and every display math delimiter $$...$$ before ending the answer.",
    "Keep the answer complete and compact. Do not start a formula if there is not enough space to finish it.",
    "Use plain text with short sections. Avoid markdown tables unless they materially clarify a matrix or parameter comparison."
  ].join("\n");
}

function userPrompt(payload: TutorPayload) {
  return [
    "Current robot state JSON:",
    JSON.stringify(compactPayload(payload), null, 2),
    "",
    `Student question: ${payload.question || "Give an overview of the current FK/IK state."}`,
    "",
    "Answer as a robotics kinematics tutor.",
    "Use this response shape when possible:",
    "1. Calculation path: what FK/IK quantity is computed and from which state values.",
    "2. Theory: the relevant DH, transform, Jacobian, DLS, error, or singularity concept.",
    "3. Robot interpretation: what the result means for this 6DOF arm's joints, links, frames, or end effector.",
    "4. Suggested next action: one concrete operation the learner can try in the workbench.",
    "Use LaTeX delimiters for formulas so the UI can render them: inline $...$ and display $$...$$.",
    "Limit the response to roughly 500-800 Chinese characters unless the student explicitly asks for a longer derivation."
  ].join("\n");
}

function fallbackResponse(payload: TutorPayload, reason?: string): TutorAgentResponse {
  const explanation = generateMockTutorResponse({
    ...payload,
    ik: payload.ik ?? payload.ikResult ?? null
  });

  return {
    explanation: reason ? `${explanation}\n\nProvider fallback: ${reason}` : explanation,
    suggestedNextAction: "Adjust base/shoulder/elbow first, then rerun IK if the error remains large.",
    formulaExplanation: "Standard DH: T = RotZ(theta) * TransZ(d) * TransX(a) * RotX(alpha).",
    provider: "mock",
    model: "mock-tutor",
    fallback: Boolean(reason),
    finishReason: reason ? "fallback" : "stop",
    truncated: false
  };
}

async function callOpenAICompatible(payload: TutorPayload): Promise<TutorAgentResponse> {
  const apiKey = env(["TUTOR_API_KEY", "OPENAI_COMPATIBLE_API_KEY", "OPENAI_API_KEY", "KIMI_API_KEY", "MIMO_API_KEY"]);
  const baseUrl =
    env(["TUTOR_BASE_URL", "OPENAI_COMPATIBLE_BASE_URL", "OPENAI_BASE_URL", "KIMI_BASE_URL", "MIMO_BASE_URL"]) ??
    DEFAULT_OPENAI_BASE_URL;
  const model =
    env(["TUTOR_MODEL", "OPENAI_COMPATIBLE_MODEL", "OPENAI_MODEL", "KIMI_MODEL", "MIMO_MODEL"]) ?? "gpt-4o-mini";
  const maxTokens = envNumber(["TUTOR_MAX_TOKENS", "OPENAI_COMPATIBLE_MAX_TOKENS"], 1800);

  if (!apiKey) {
    throw new Error("Missing OPENAI-compatible API key. Set TUTOR_API_KEY or OPENAI_COMPATIBLE_API_KEY.");
  }

  const response = await fetch(joinUrl(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(payload) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  const choice = data.choices?.[0];
  const explanation = choice?.message?.content?.trim();
  if (!explanation) {
    throw new Error("OpenAI-compatible response did not include choices[0].message.content.");
  }

  const finishReason = choice?.finish_reason ?? "unknown";
  return {
    explanation,
    suggestedNextAction: "Use the tutor guidance, adjust the joint controls or target pose, then rerun FK/IK.",
    formulaExplanation: "Standard DH: T = RotZ(theta) * TransZ(d) * TransX(a) * RotX(alpha).",
    provider: "openai-compatible",
    model,
    fallback: false,
    finishReason,
    truncated: finishReason === "length"
  };
}

async function callAnthropic(payload: TutorPayload): Promise<TutorAgentResponse> {
  const apiKey = env(["TUTOR_API_KEY", "ANTHROPIC_API_KEY"]);
  const baseUrl = env(["TUTOR_BASE_URL", "ANTHROPIC_BASE_URL"]) ?? DEFAULT_ANTHROPIC_BASE_URL;
  const model = env(["TUTOR_MODEL", "ANTHROPIC_MODEL"]) ?? "claude-sonnet-4-5";
  const version = env(["ANTHROPIC_VERSION"]) ?? "2023-06-01";
  const maxTokens = envNumber(["TUTOR_MAX_TOKENS", "ANTHROPIC_MAX_TOKENS"], 1800);

  if (!apiKey) {
    throw new Error("Missing Anthropic API key. Set TUTOR_API_KEY or ANTHROPIC_API_KEY.");
  }

  const response = await fetch(joinUrl(baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": version
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.25,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(payload) }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
  };
  const explanation = data.content
    ?.filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!explanation) {
    throw new Error("Anthropic response did not include text content.");
  }

  return {
    explanation,
    suggestedNextAction: "Use the tutor guidance, adjust the joint controls or target pose, then rerun FK/IK.",
    formulaExplanation: "Standard DH: T = RotZ(theta) * TransZ(d) * TransX(a) * RotX(alpha).",
    provider: "anthropic",
    model,
    fallback: false,
    finishReason: data.stop_reason ?? "unknown",
    truncated: data.stop_reason === "max_tokens"
  };
}

export async function runTutorAgent(payload: TutorPayload): Promise<TutorAgentResponse> {
  const provider = normalizeProvider(process.env.TUTOR_PROVIDER);

  try {
    if (provider === "openai-compatible") {
      return await callOpenAICompatible(payload);
    }
    if (provider === "anthropic") {
      return await callAnthropic(payload);
    }
    return fallbackResponse(payload);
  } catch (error) {
    return fallbackResponse(payload, error instanceof Error ? error.message : "Unknown provider error.");
  }
}
