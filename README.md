# Agent Team Onboarding for OpenClaw

A portable, interview-led skill that recommends the smallest useful agent team, creates approved personas, wires delegation, and proposes first tasks.

조직·첫 목표·제약·성공 기준을 인터뷰하고, 필요한 최소 에이전트 팀을 제안한 뒤 승인된 팀을 OpenClaw에 생성하는 범용 스킬입니다.

## Install from GitHub

```bash
git clone https://github.com/IrumHahn/openclaw-agent-team-onboarding.git
openclaw skills install ./openclaw-agent-team-onboarding --global
openclaw skills info agent-team-onboarding
```

Alternatively, download the `agent-team-onboarding.skill` file from [Releases](https://github.com/IrumHahn/openclaw-agent-team-onboarding/releases), then follow the ZIP instructions below.

## Install on another OpenClaw

Copy or extract this directory so that `SKILL.md` is at its root. Then run:

```bash
openclaw skills install /absolute/path/to/agent-team-onboarding --global
openclaw skills info agent-team-onboarding
```

`openclaw skills install` takes a **directory**, not a `.skill`/ZIP file. If you received `agent-team-onboarding.skill`, unzip it first; the archive contains an `agent-team-onboarding/` directory:

```bash
unzip agent-team-onboarding.skill -d ./openclaw-skills
openclaw skills install ./openclaw-skills/agent-team-onboarding --global
```

You can also install to one agent by omitting `--global` and passing `--agent <id>`.

Start in chat with “Help me set up an agent team” or “Which OpenClaw agents should I create?” The skill first interviews you, previews the proposal, and only then creates agents after your confirmation.

Interview answers can be resumed from a private draft JSON in the active agent workspace. Text/emoji personas are created immediately; avatar art requires a separate image-generation step if requested.

Requirements: OpenClaw with `agents add`, `agents set-identity`, `config patch`, and Node.js 18+. No npm dependencies. The skill does not configure credentials, channels, schedules, or host-level tool restrictions.

For a named OpenClaw profile, the provisioning helper accepts `--profile <name>`. The helper defaults to a new `workspaces/<team-id>/` directory under `OPENCLAW_STATE_DIR` (when set) or beside the active config file; override with `--workspace-root <absolute-parent-dir>`.
