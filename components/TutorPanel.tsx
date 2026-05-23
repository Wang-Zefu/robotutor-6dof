"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { DHParam, FKResult, IKResult, TargetPose, TutorMessage } from "@/types/robot";

interface TutorPanelProps {
  dhParams: DHParam[];
  jointAngles: number[];
  fk: FKResult;
  ikResult: IKResult | null;
  targetPose: TargetPose;
  practiceMode: boolean;
}

interface TutorApiResponse {
  explanation: string;
  suggestedNextAction: string;
  formulaExplanation?: string;
  provider: string;
  model: string;
  fallback: boolean;
  finishReason?: string;
  truncated?: boolean;
}

interface ChatMessage extends TutorMessage {
  meta?: {
    suggestedNextAction: string;
    provider: string;
    model: string;
    fallback: boolean;
    finishReason?: string;
    truncated?: boolean;
  };
}

const starters = [
  "什么是 DH 参数？",
  "为什么 IK 没有收敛？",
  "这个姿态为什么接近奇异？",
  "T06 矩阵每一项是什么意思？",
  "Position IK 和 Pose IK 有什么区别？"
];

function countUnescaped(text: string, token: "$" | "$$") {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (token === "$$" && text[index] === "$" && text[index + 1] === "$" && text[index - 1] !== "\\") {
      count += 1;
      index += 1;
    } else if (
      token === "$" &&
      text[index] === "$" &&
      text[index + 1] !== "$" &&
      text[index - 1] !== "$" &&
      text[index - 1] !== "\\"
    ) {
      count += 1;
    }
  }
  return count;
}

function closeDanglingMath(markdown: string) {
  let safe = markdown.trim();
  if (countUnescaped(safe, "$$") % 2 !== 0) {
    safe += "\n$$";
  }
  if (countUnescaped(safe, "$") % 2 !== 0) {
    safe += "$";
  }
  return safe;
}

function TutorMessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return <div className="whitespace-pre-line">{message.content}</div>;
  }

  const source = message.meta
    ? message.meta.fallback
      ? `mock fallback: ${message.meta.model}`
      : `${message.meta.provider}: ${message.meta.model}`
    : null;

  return (
    <>
      <div className="tutor-markdown text-sm leading-6">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {closeDanglingMath(message.content)}
        </ReactMarkdown>
      </div>
      {message.meta ? (
        <div className="mt-3 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-400">
          <div>
            <span className="font-semibold text-slate-300">Next action:</span> {message.meta.suggestedNextAction}
          </div>
          <div>
            <span className="font-semibold text-slate-300">Provider:</span> {source}
            {message.meta.finishReason ? ` · finish: ${message.meta.finishReason}` : ""}
          </div>
          {message.meta.truncated ? (
            <div className="text-amber-300">
              The model hit its token limit. Ask for a shorter derivation or increase TUTOR_MAX_TOKENS.
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default function TutorPanel({
  dhParams,
  jointAngles,
  fk,
  ikResult,
  targetPose,
  practiceMode
}: TutorPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "我会根据当前 DH 参数、关节角、FK 结果、IK 状态和目标位姿进行讲解。配置 TUTOR_PROVIDER 后会调用真实模型；未配置时自动使用本地 mock tutor。"
    }
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setQuestion("");
    setIsLoading(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: trimmed,
          dhParams,
          jointAngles,
          fk,
          ik: ikResult,
          targetPose,
          practiceMode
        })
      });

      if (!response.ok) {
        throw new Error(`Tutor API returned HTTP ${response.status}`);
      }

      const result = (await response.json()) as TutorApiResponse;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.explanation,
          meta: {
            suggestedNextAction: result.suggestedNextAction,
            provider: result.provider,
            model: result.model,
            fallback: result.fallback,
            finishReason: result.finishReason,
            truncated: result.truncated
          }
        }
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tutor error.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Tutor API 调用失败：${message}\n\n请检查服务端环境变量，或临时把 TUTOR_PROVIDER 设置为 mock。`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex min-h-[420px] flex-col rounded border border-slate-700 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <Bot size={16} className="text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">AI Tutor Agent</h2>
      </div>
      <div className="thin-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`rounded border p-2 text-sm leading-6 ${
              message.role === "assistant"
                ? "border-slate-700 bg-slate-950 text-slate-200"
                : "border-cyan-900 bg-cyan-950/30 text-cyan-100"
            }`}
          >
            <TutorMessageContent message={message} />
          </div>
        ))}
        {isLoading ? (
          <div className="rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-400">
            Tutor is thinking...
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {starters.map((starter) => (
            <button
              type="button"
              key={starter}
              disabled={isLoading}
              onClick={() => ask(starter)}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={question}
            placeholder="Ask about FK, IK, DH, singularities..."
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ask(question);
              }
            }}
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={() => ask(question)}
            className="inline-flex h-10 w-10 items-center justify-center rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send question"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
