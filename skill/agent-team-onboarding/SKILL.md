---
name: agent-team-onboarding
description: Interview a new OpenClaw user about their organization, first goal, constraints, success criteria, and preferred agent personalities; recommend the smallest useful team, create approved agents, connect their delegation, and propose goal-linked first tasks. Use when someone asks which agents to make, wants a Paperclip-like team setup, asks to start an AI agent team, or says 에이전트 팀 만들어줘 / 어떤 에이전트를 만들어야 해.
---

# Agent Team Onboarding

This skill creates a **goal-led, personalized OpenClaw team**. It is not the fixed four-agent preset. Follow the phases in order. A chat interview can be resumed; do not restart answered questions.

## 1. Check the host and existing team

1. Read `references/interview.md` and `references/plan-schema.md` from this skill directory.
2. Run `openclaw --version`, `openclaw agents list --json`, and `openclaw config file`. If the CLI or agent-management access is unavailable, explain the blocker and stop before claiming a team was created.
3. Check for existing agents that already cover the goal. Recommend reuse where practical. Never overwrite or delete an existing agent, workspace, channel binding, or config entry.

**Done when:** the OpenClaw installation, current roster, and a place for a draft plan are known.

## 2. Run the interview

Ask these four questions in the user's language, preferably as four short cards or numbered prompts. Accept a single combined reply; do not force four separate turns.

1. What does the organization do? Products/services and customers/users?
2. What is the **first** goal or problem, and what is the current state?
3. What are the deadline, budget, existing tools, collaborators, and hard constraints? “Undecided” is valid.
4. What observable deliverable, number, or state would make the first effort successful?

Then ask the **persona/immersion** questions in `references/interview.md`. Offer “surprise me” and “skip” so style questions do not block useful setup. Ask at most one targeted follow-up per missing *decision-critical* item. Never request passwords, API keys, or private tokens in the interview.

Save the cards in a private draft file under the current agent workspace (for example `team-onboarding-drafts/<team-slug>.json`). Use `node <skill-dir>/scripts/interview_draft.mjs start --file <draft.json>` once, then `update --file <draft.json> --card <id> --answer <text>` for each answer. On a later turn, use `show --file <draft.json>` and ask only unanswered questions. `start` refuses to overwrite an existing draft. Do not place drafts in a public/shared channel or repository.

**Done when:** the mission, first goal, success test, constraints, and desired relationship/tone are explicit or marked undecided.

## 3. Design and preview the team

Use `references/recommendation-rules.md` to choose the **fewest** distinct roles (normally 1–4). If there are 2+ new agents, identify exactly one coordinator and at least one specialist. Each proposed agent must have a non-overlapping responsibility, a reason tied to the first goal, a deliverable, a first task, a success test, and a distinctive but work-compatible persona. Personality is not permission: do not imply that a friendly persona can send messages or spend money autonomously.

Show the user a reviewable proposal **before creation**:

- Team mission, first success criterion, and current constraints.
- For every agent: name, role, personality/visual motif, **why this agent is needed now**, scope, first deliverable, and first suggested task.
- Which existing agents are reused, if any; what new agents/workspaces will be added; what will *not* be changed.
- Approval boundaries. External messages, purchases, publishing, deletions, production changes, and schedules remain off until separately authorized.

Invite edits to role count, names, style, or tasks. Ask for one explicit confirmation of this concrete proposal before provisioning. A request to draft a plan is not approval to create agents. If the user already explicitly approved a concrete proposal in this session, do not ask again.

**Done when:** the user has reviewed and approved the exact team to be created.

## 4. Build a machine-readable plan

Write the approved plan as JSON at a local path chosen for this run, using `references/plan-schema.md`. Do not include credentials. For each agent, include three positive and three contrasting traits, three tone examples, boundaries, failure behavior, and goal-linked initial tasks. If visuals were skipped, use a distinct emoji and a one-line visual motif; do not fabricate an avatar image.

Run:

```bash
node <skill-dir>/scripts/team_setup.mjs preview --plan <plan.json>
```

For a named OpenClaw profile, add `--profile <name>`. If the user chose a particular location, add `--workspace-root <absolute-parent-dir>`; otherwise the helper uses the active OpenClaw state directory. Resolve and fix every collision or validation error before applying. Summarize the preview in human language, including exact new agent IDs and workspace location.

**Done when:** preview succeeds, matches the approved proposal, and reports no collision.

## 5. Create and verify

Run only after approval:

```bash
node <skill-dir>/scripts/team_setup.mjs apply --plan <plan.json> --confirmed
```

Pass the same `--profile` and `--workspace-root` options used for preview. The helper writes `IDENTITY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, and `TEAM.md` in **new** workspaces, registers agents with `openclaw agents add`, sets their identities, and wires coordinator-to-specialist delegation. It does not bind chat channels, start recurring jobs, send external messages, or change the system/default agent.

Check `openclaw agents list --json`, the generated files, and `openclaw config get agents.entries.<coordinator-id>.subagents --json` (for 2+ agents). If any step fails, report which agents were created and the exact unfinished step. Do not silently delete partial work or rerun over it.

**Done when:** every approved agent exists, its persona files are intact, and delegation matches the roster.

## 6. Hand off a useful first week

Present a concise goal-linked 7-day starter plan from the `firstTasks` in the approved plan: owner, why now, deliverable, and done condition. Offer one safe first internal task for the coordinator. Distinguish **proposed** work from completed work; do not claim agents are operating until a real task has run. Explain that the coordinator can be opened in OpenClaw's Agents UI and that chat-channel routing must be set up separately if desired.

**Done when:** the user knows who was created, why, where to find them, what to assign first, and what still requires authorization.

## Important boundaries

- Use the local CLI for provisioning, never a hard-coded path or account. This skill is portable across OpenClaw installations that support `agents add`, `set-identity`, and config patching.
- The helper's written boundaries are **agent instructions**, not a host security sandbox. Do not claim tool access has been technically restricted. Check the host's actual policy before granting sensitive tools.
- If the user asks only for a plan, stop after phase 3. If the host is older or differs, adapt the commands only after inspecting its help; do not edit config blindly.
- `--confirmed` is a mechanical guard, not a substitute for the user's approval.
