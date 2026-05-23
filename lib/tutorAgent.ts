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
    "You are RoboTutor, a precise robotics teaching agent for a 6DOF arm kinematics demo.",
    "Explain standard DH parameters, homogeneous transforms, FK, numerical IK, singularities, and practical solving strategy.",
    "Use the robot state supplied by the user. Do not invent measurements.",
    "Be concise, concrete, and educational. Prefer Chinese when the user asks in Chinese.",
    "When IK fails, name likely causes and suggest one next action.",
    "Use plain text. Avoid markdown tables unless necessary."
  ].join("\n");
}

function userPrompt(payload: TutorPayload) {
  return [
    "Current robot state JSON:",
    JSON.stringify(compactPayload(payload), null, 2),
    "",
    `Student question: ${payload.question || "Give an overview of the current FK/IK state."}`,
    "",
    "Return an explanation and one suggested next action."
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
    fallback: Boolean(reason)
  };
}

async function callOpenAICompatible(payload: TutorPayload): Promise<TutorAgentResponse> {
  const apiKey = env(["TUTOR_API_KEY", "OPENAI_COMPATIBLE_API_KEY", "OPENAI_API_KEY", "KIMI_API_KEY", "MIMO_API_KEY"]);
  const baseUrl =
    env(["TUTOR_BASE_URL", "OPENAI_COMPATIBLE_BASE_URL", "OPENAI_BASE_URL", "KIMI_BASE_URL", "MIMO_BASE_URL"]) ??
    DEFAULT_OPENAI_BASE_URL;
  const model =
    env(["TUTOR_MODEL", "OPENAI_COMPATIBLE_MODEL", "OPENAI_MODEL", "KIMI_MODEL", "MIMO_MODEL"]) ?? "gpt-4o-mini";

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
      max_tokens: 900,
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  const explanation = data.choices?.[0]?.message?.content?.trim();
  if (!explanation) {
    throw new Error("OpenAI-compatible response did not include choices[0].message.content.");
  }

  return {
    explanation,
    suggestedNextAction: "Use the tutor guidance, adjust the joint controls or target pose, then rerun FK/IK.",
    formulaExplanation: "Standard DH: T = RotZ(theta) * TransZ(d) * TransX(a) * RotX(alpha).",
    provider: "openai-compatible",
    model,
    fallback: false
  };
}

async function callAnthropic(payload: TutorPayload): Promise<TutorAgentResponse> {
  const apiKey = env(["TUTOR_API_KEY", "ANTHROPIC_API_KEY"]);
  const baseUrl = env(["TUTOR_BASE_URL", "ANTHROPIC_BASE_URL"]) ?? DEFAULT_ANTHROPIC_BASE_URL;
  const model = env(["TUTOR_MODEL", "ANTHROPIC_MODEL"]) ?? "claude-sonnet-4-5";
  const version = env(["ANTHROPIC_VERSION"]) ?? "2023-06-01";

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
      max_tokens: 900,
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
    fallback: false
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
