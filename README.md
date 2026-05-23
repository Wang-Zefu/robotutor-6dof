# RoboTutor 6DOF

RoboTutor 6DOF is an interactive teaching workbench for learning 6-axis robotic arm kinematics. It combines a real-time Three.js arm visualization, editable standard DH parameters, forward kinematics matrices, numerical inverse kinematics, practice targets, and a mock AI Tutor panel.

## Features

- 6DOF robotic arm scene with base, six joints, links, end effector, world axes, joint frames, and target pose marker.
- Joint sliders from -180 deg to 180 deg with real-time FK updates.
- Editable standard DH table using the transform chain:
  `RotZ(theta) * TransZ(d) * TransX(a) * RotX(alpha)`.
- FK output for `T01` to `T56`, `T06`, end-effector position, and roll/pitch/yaw.
- Numerical IK using damped least squares with:
  - Position Only mode.
  - Experimental Pose IK mode.
  - Iteration count, final error, final angles, and failure reason.
- Practice Mode with random reachable target generation, distance threshold detection, and Show Solution.
- AI Tutor Agent with mock fallback plus OpenAI-compatible and Anthropic-compatible server-side integrations.
- `/api/tutor` route accepts robot state and calls the configured tutor provider.

## Getting Started

```bash
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Next.js, usually:

```text
http://localhost:3000
```

PowerShell on this machine blocks `npm.ps1`, so use `npm.cmd` instead of `npm`.

## Validation

```bash
npm.cmd run typecheck
npm.cmd run build
```

## Project Structure

```text
app/page.tsx                 Main workbench
app/api/tutor/route.ts       Tutor API endpoint
components/RobotScene.tsx    3D arm, frames, links, target marker
components/JointControls.tsx Six joint sliders
components/DHTable.tsx       Editable standard DH table
components/FKPanel.tsx       FK matrices and pose readout
components/IKPanel.tsx       Target inputs and DLS solver controls
components/TutorPanel.tsx    Mock AI Tutor chat panel
components/PracticePanel.tsx Practice target workflow
lib/kinematics.ts            FK, Jacobian, DLS IK, pose math
lib/mockTutor.ts             Context-aware mock tutor fallback
lib/tutorAgent.ts            OpenAI-compatible and Anthropic-compatible provider adapter
types/robot.ts               Shared robot and solver types
```

## Agent Workflow

The Tutor panel calls `/api/tutor`. The route keeps all API keys server-side, builds a robotics teaching prompt from the current state, and then calls the configured provider. If the provider is not configured or fails, it returns the local mock tutor response so the demo still works offline.

The request payload contains:

- DH parameters.
- Joint angles.
- FK result.
- IK result.
- Target pose.
- User question.

It returns:

- Natural language explanation.
- Suggested next action.
- Optional formula explanation.
- Provider and model metadata.

## Tutor Agent Constraints

The tutor is constrained to behave as a robotics kinematics teaching agent, not a general chatbot. Its answers should:

- Explain the calculation process before the conclusion.
- Ground explanations in robot arm theory: coordinate frames, standard DH parameters, homogeneous transforms, `T01...T56`, `T06`, Jacobians, DLS IK, pose error, workspace limits, and singularities.
- Connect formulas to physical robot meaning, such as joint axes, link geometry, shoulder/elbow reach, wrist orientation, and end-effector pose.
- Use the current robot state from the UI and cite numeric values only when they are present in the payload.
- For FK questions, describe the transform chain `RotZ(theta) -> TransZ(d) -> TransX(a) -> RotX(alpha)` and how transforms multiply into `T06`.
- For IK questions, describe the objective function, error vector, numerical Jacobian, damping term, iteration behavior, convergence criteria, and likely failure causes.
- Redirect broad or off-topic questions back to the 6DOF robot kinematics context.
- Output formulas in renderable LaTeX: inline `$...$`, display `$$...$$`, and matrix environments such as `\begin{bmatrix}...\end{bmatrix}`.
- Avoid putting LaTeX formulas inside code fences, because the Tutor panel renders Markdown plus KaTeX.
- Do not impose a project-level word limit. For OpenAI-compatible providers, `max_tokens` is omitted unless `TUTOR_MAX_TOKENS` or `OPENAI_COMPATIBLE_MAX_TOKENS` is explicitly set.
- Provider-side context windows, output limits, billing limits, and latency still apply.

## Provider Configuration

Copy `.env.example` to `.env.local` and choose one provider.

### Mock Mode

```bash
TUTOR_PROVIDER=mock
```

### OpenAI-Compatible Mode

Use this for OpenAI, Kimi, Mimo, or any gateway that supports `POST /v1/chat/completions` with `Authorization: Bearer <key>`.

```bash
TUTOR_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_key
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
```

You can also use shared aliases:

```bash
TUTOR_API_KEY=your_key
TUTOR_BASE_URL=https://your-openai-compatible-host/v1
TUTOR_MODEL=your-model
# Optional. Leave unset to avoid app-side output capping for OpenAI-compatible providers.
TUTOR_MAX_TOKENS=
```

Kimi/Mimo aliases are also supported:

```bash
KIMI_API_KEY=your_key
KIMI_BASE_URL=https://your-kimi-compatible-host/v1
KIMI_MODEL=your-model

MIMO_API_KEY=your_key
MIMO_BASE_URL=https://your-mimo-compatible-host/v1
MIMO_MODEL=your-model
```

### Anthropic-Compatible Mode

Use this for Anthropic Claude or a gateway that supports `POST /v1/messages` with `x-api-key` and `anthropic-version` headers.

```bash
TUTOR_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_VERSION=2023-06-01
```

For Anthropic-compatible proxies, set `TUTOR_BASE_URL` or `ANTHROPIC_BASE_URL` to the proxy root, for example `https://your-host`.

Keep provider calls server-side only. Do not expose API keys in client components.
