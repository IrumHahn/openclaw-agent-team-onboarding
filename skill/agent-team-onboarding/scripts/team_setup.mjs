#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_AGENTS = 4;
let activeRun = null;

function fail(message) {
  throw new Error(message);
}

function oneLine(value, label, maxLength = 500) {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > maxLength) fail(`${label} must be 1–${maxLength} characters`);
  return cleaned;
}

function id(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    fail(`${label} must begin with a lower-case letter and contain only lower-case letters, digits, or hyphens (2–40 characters)`);
  }
  return value;
}

function textList(value, label, min = 0, max = 20) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${label} must contain ${min}–${max} items`);
  }
  return value.map((item, index) => oneLine(item, `${label}[${index}]`));
}

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function normalizePlan(raw) {
  requiredObject(raw, 'plan');
  if (raw.version !== 1) fail('plan.version must be 1');
  const sourceTeam = requiredObject(raw.team, 'team');
  const team = {
    id: id(sourceTeam.id, 'team.id'),
    name: oneLine(sourceTeam.name, 'team.name'),
    organization: oneLine(sourceTeam.organization, 'team.organization'),
    product: oneLine(sourceTeam.product, 'team.product'),
    audience: oneLine(sourceTeam.audience, 'team.audience'),
    objective: oneLine(sourceTeam.objective, 'team.objective'),
    deadline: oneLine(sourceTeam.deadline, 'team.deadline'),
    successCriteria: textList(sourceTeam.successCriteria, 'team.successCriteria', 1),
    constraints: textList(sourceTeam.constraints, 'team.constraints', 0),
    tools: textList(sourceTeam.tools, 'team.tools', 0),
    userName: oneLine(sourceTeam.userName, 'team.userName'),
    language: oneLine(sourceTeam.language, 'team.language'),
    relationshipStyle: oneLine(sourceTeam.relationshipStyle, 'team.relationshipStyle'),
  };
  if (!Array.isArray(raw.agents) || raw.agents.length < 1 || raw.agents.length > MAX_AGENTS) {
    fail(`agents must contain 1–${MAX_AGENTS} new agents`);
  }
  const agents = raw.agents.map((source, index) => {
    const label = `agents[${index}]`;
    requiredObject(source, label);
    if (source.coordinator !== undefined && typeof source.coordinator !== 'boolean') fail(`${label}.coordinator must be boolean`);
    if (!Array.isArray(source.firstTasks) || source.firstTasks.length < 1 || source.firstTasks.length > 7) {
      fail(`${label}.firstTasks must contain 1–7 tasks`);
    }
    const firstTasks = source.firstTasks.map((task, taskIndex) => {
      requiredObject(task, `${label}.firstTasks[${taskIndex}]`);
      return {
        task: oneLine(task.task, `${label}.firstTasks[${taskIndex}].task`),
        why: oneLine(task.why, `${label}.firstTasks[${taskIndex}].why`),
        doneWhen: oneLine(task.doneWhen, `${label}.firstTasks[${taskIndex}].doneWhen`),
      };
    });
    const agent = {
      id: id(source.id, `${label}.id`),
      name: oneLine(source.name, `${label}.name`),
      emoji: oneLine(source.emoji, `${label}.emoji`, 16),
      archetype: oneLine(source.archetype, `${label}.archetype`),
      role: oneLine(source.role, `${label}.role`),
      mission: oneLine(source.mission, `${label}.mission`),
      whyNow: oneLine(source.whyNow, `${label}.whyNow`),
      addressUser: oneLine(source.addressUser, `${label}.addressUser`),
      traits: textList(source.traits, `${label}.traits`, 3, 3),
      counterTraits: textList(source.counterTraits, `${label}.counterTraits`, 3, 3),
      toneExamples: textList(source.toneExamples, `${label}.toneExamples`, 3, 3),
      responsibilities: textList(source.responsibilities, `${label}.responsibilities`, 1),
      outOfScope: textList(source.outOfScope, `${label}.outOfScope`, 1),
      deliverables: textList(source.deliverables, `${label}.deliverables`, 1),
      boundaries: textList(source.boundaries, `${label}.boundaries`, 1),
      failureProtocol: oneLine(source.failureProtocol, `${label}.failureProtocol`),
      firstTasks,
      coordinator: source.coordinator === true,
    };
    if (source.model !== undefined) agent.model = oneLine(source.model, `${label}.model`, 150);
    if (source.avatar !== undefined) {
      const avatar = oneLine(source.avatar, `${label}.avatar`, 1000);
      if (!/^https:\/\/[^\s]+$/i.test(avatar)) fail(`${label}.avatar must be an existing HTTPS URL; omit it for text-only identity`);
      agent.avatar = avatar;
    }
    return agent;
  });
  const ids = agents.map(agent => agent.id);
  if (new Set(ids).size !== ids.length) fail('agent IDs must be unique');
  const coordinators = agents.filter(agent => agent.coordinator);
  if (agents.length > 1 && coordinators.length !== 1) fail('multi-agent teams require exactly one coordinator');
  if (agents.length === 1 && coordinators.length > 1) fail('a team cannot have multiple coordinators');
  if (agents.length === 1) agents[0].coordinator = true;
  return { version: 1, team, agents };
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['preview', 'apply'].includes(mode)) fail('usage: team_setup.mjs preview|apply --plan <file> [--workspace-root <absolute-dir>] [--profile <name>] [--confirmed]');
  const options = { mode, confirmed: false };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--confirmed') {
      options.confirmed = true;
      continue;
    }
    if (!['--plan', '--workspace-root', '--profile'].includes(flag)) fail(`unknown option: ${flag}`);
    const value = rest[++index];
    if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
    options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!options.plan) fail('--plan is required');
  if (mode === 'apply' && !options.confirmed) fail('apply requires --confirmed after the user approved the exact preview');
  if (options.workspaceRoot && !path.isAbsolute(options.workspaceRoot)) fail('--workspace-root must be absolute');
  if (options.profile && !ID_PATTERN.test(options.profile)) fail('--profile must be a simple lower-case profile name');
  return options;
}

function cli(args, options) {
  const binary = process.env.OPENCLAW_BIN || 'openclaw';
  const prefix = options.profile ? ['--profile', options.profile] : [];
  try {
    return execFileSync(binary, [...prefix, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }).trim();
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim().slice(0, 600);
    fail(`openclaw ${args.slice(0, 2).join(' ')} failed: ${detail}`);
  }
}

function activeRoot(options) {
  if (options.workspaceRoot) return path.resolve(options.workspaceRoot);
  if (process.env.OPENCLAW_STATE_DIR && !options.profile) return path.join(path.resolve(process.env.OPENCLAW_STATE_DIR), 'workspaces');
  const configPath = cli(['config', 'file'], options);
  if (!path.isAbsolute(configPath)) fail('openclaw config file did not return an absolute path');
  return path.join(path.dirname(configPath), 'workspaces');
}

function configuredIds(options) {
  const agents = JSON.parse(cli(['agents', 'list', '--json'], options));
  if (!Array.isArray(agents)) fail('openclaw agents list returned an unexpected result');
  return new Set(agents.map(agent => agent.id));
}

function preflight(plan, options, root) {
  const teamRoot = path.join(root, plan.team.id);
  const existing = configuredIds(options);
  const collisions = plan.agents.filter(agent => existing.has(agent.id)).map(agent => agent.id);
  if (fs.existsSync(teamRoot)) collisions.push(`workspace: ${teamRoot}`);
  return { teamRoot, collisions };
}

const bullets = items => items.map(item => `- ${item}`).join('\n');

function teamMarkdown(plan) {
  const { team, agents } = plan;
  return `# ${team.name}\n\n## Purpose\n\n- Organization: ${team.organization}\n- Product/service: ${team.product}\n- Audience: ${team.audience}\n- First objective: ${team.objective}\n- Deadline: ${team.deadline}\n- Success criteria:\n${bullets(team.successCriteria)}\n- Constraints:\n${bullets(team.constraints.length ? team.constraints : ['None specified'])}\n- Existing tools:\n${bullets(team.tools.length ? team.tools : ['None specified'])}\n\n## Roster\n\n${agents.map(agent => `- ${agent.emoji} **${agent.name}** (${agent.id}) — ${agent.role}. ${agent.mission}`).join('\n')}\n\n## Working agreement\n\nThe coordinator owns the integrated plan and user-facing report. Specialists own bounded deliverables and return evidence. Do not confuse a proposed task with completed work. External sends, purchases, publishing, destructive changes, production changes, and recurring jobs require separate user authorization.\n`;
}

function identityMarkdown(agent) {
  return `# IDENTITY.md - Who Am I?\n\n- Name: ${agent.name}\n- Creature: ${agent.archetype}\n- Vibe: ${agent.traits.join('; ')}\n- Emoji: ${agent.emoji}\n${agent.avatar ? `- Avatar: ${agent.avatar}\n` : ''}\n## One-line introduction\n\nI am ${agent.name}, the ${agent.role.toLowerCase()} for this team. ${agent.mission}\n`;
}

function soulMarkdown(agent) {
  return `# SOUL.md - ${agent.name}\n\n## Core character\n\n${agent.archetype}. I am ${agent.traits.join(', ').toLowerCase()}; ${agent.counterTraits.join(', ').toLowerCase()}. Persona supports clear work and trust, not false claims of consciousness or capability.\n\n## Voice\n\nAddress the user as ${agent.addressUser}. Use the team's stated language and relationship style from USER.md. Examples to emulate, not repeat verbatim:\n\n1. Routine update: “${agent.toneExamples[0]}”\n2. Respectful disagreement: “${agent.toneExamples[1]}”\n3. Blocked/error: “${agent.toneExamples[2]}”\n\n## Boundaries\n\n${bullets(agent.boundaries)}\n- Never reveal private information in shared contexts.\n- Never pretend work, tool use, or a handoff happened when it did not.\n- Ask before external sends, purchases, publishing, deletion, production changes, or scheduled automation unless the user already explicitly authorized that exact action.\n\n## When blocked\n\n${agent.failureProtocol}\n`;
}

function userMarkdown(plan, agent) {
  const { team } = plan;
  const date = new Date().toISOString().slice(0, 10);
  return `# USER.md - User Model\n\n## Context\n\n- User: ${team.userName}\n- Organization: ${team.organization}\n- Product/service: ${team.product}\n- Audience: ${team.audience}\n- First goal: ${team.objective}\n- Deadline: ${team.deadline}\n- Success criteria:\n${bullets(team.successCriteria)}\n- Constraints:\n${bullets(team.constraints.length ? team.constraints : ['None specified'])}\n- Existing tools:\n${bullets(team.tools.length ? team.tools : ['None specified'])}\n\n## Directives\n\n<!-- observed: ${date} | status: active -->\n- Prefer ${team.language} for replies.\n\n<!-- observed: ${date} | status: active -->\n- Address the user as ${agent.addressUser}.\n\n<!-- observed: ${date} | status: active -->\n- Prefer a ${team.relationshipStyle} relationship style.\n\n<!-- observed: ${date} | status: active -->\n- Anchor proactive suggestions to the first goal and success criteria above.\n\nThis file contains context, not secrets. Ask before storing new personal facts.\n`;
}

function agentsMarkdown(plan, agent) {
  const specialists = plan.agents.filter(item => !item.coordinator);
  const coordination = agent.coordinator && specialists.length
    ? `You coordinate ${specialists.map(item => `${item.name} (${item.id})`).join(', ')}. Delegate bounded work through available OpenClaw subagent tools when helpful; check the result before reporting it. Do not claim a handoff until the delegate actually accepted it.`
    : agent.coordinator
      ? 'You are the single agent for this team. Do not invent delegated teammates.'
      : `Return findings and artifacts to ${plan.agents.find(item => item.coordinator).name}; do not delegate onward.`;
  const taskLines = agent.firstTasks.map((item, index) => `${index + 1}. ${item.task}\n   - Why now: ${item.why}\n   - Done when: ${item.doneWhen}`).join('\n');
  return `# AGENTS.md - ${agent.name}'s operating contract\n\nAt session start, read SOUL.md, USER.md, and TEAM.md. Act within the first goal; propose work based on evidence, not a generic calendar.\n\n## Mission and scope\n\n${agent.mission}\n\nWhy this agent exists now: ${agent.whyNow}\n\nResponsibilities:\n${bullets(agent.responsibilities)}\n\nOut of scope:\n${bullets(agent.outOfScope)}\n\nExpected deliverables:\n${bullets(agent.deliverables)}\n\n## Teamwork\n\n${coordination}\n\n## Initial task proposals (not yet completed or scheduled)\n\n${taskLines}\n\n## Operating rules\n\n- Recommend the next useful internal action tied to the team's objective and measurable success criteria. State why it matters and what completion looks like.\n- Distinguish proposed, in progress, blocked, and completed work. Do not execute external or irreversible tasks merely because they appear above.\n- External messages, purchases, publishing, deletion, production changes, and recurring automation need the user's specific authorization.\n- If a tool, credential, or permission is missing, report the blocker and a safe next step; do not claim a behavioral instruction is a technical access restriction.\n`;
}

function writeNew(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

function apply(plan, options, teamRoot) {
  const created = [];
  activeRun = { teamRoot, created };
  fs.mkdirSync(path.dirname(teamRoot), { recursive: true });
  fs.mkdirSync(teamRoot);
  writeNew(path.join(teamRoot, 'TEAM.md'), teamMarkdown(plan));
  for (const agent of plan.agents) {
    const workspace = path.join(teamRoot, agent.id);
    fs.mkdirSync(workspace);
    writeNew(path.join(workspace, 'IDENTITY.md'), identityMarkdown(agent));
    writeNew(path.join(workspace, 'SOUL.md'), soulMarkdown(agent));
    writeNew(path.join(workspace, 'USER.md'), userMarkdown(plan, agent));
    writeNew(path.join(workspace, 'AGENTS.md'), agentsMarkdown(plan, agent));
    writeNew(path.join(workspace, 'TEAM.md'), teamMarkdown(plan));
    const args = ['agents', 'add', agent.id, '--workspace', workspace, '--non-interactive', '--json'];
    if (agent.model) args.push('--model', agent.model);
    const added = JSON.parse(cli(args, options));
    if (added.agentId !== agent.id || path.resolve(added.workspace) !== workspace) fail(`unexpected creation result for ${agent.id}`);
    created.push(agent.id);
    const identityArgs = ['agents', 'set-identity', '--agent', agent.id, '--name', agent.name, '--emoji', agent.emoji, '--theme', agent.archetype, '--json'];
    if (agent.avatar) identityArgs.push('--avatar', agent.avatar);
    cli(identityArgs, options);
  }
  if (plan.agents.length > 1) {
    const coordinator = plan.agents.find(agent => agent.coordinator);
    const specialists = plan.agents.filter(agent => !agent.coordinator);
    const entries = {
      [coordinator.id]: { subagents: { allowAgents: specialists.map(agent => agent.id), delegationMode: 'prefer' } },
    };
    for (const specialist of specialists) entries[specialist.id] = { subagents: { allowAgents: [] } };
    const patchPath = path.join(teamRoot, 'delegation.patch.json');
    writeNew(patchPath, `${JSON.stringify({ agents: { entries } }, null, 2)}\n`);
    cli(['config', 'patch', '--file', patchPath, '--dry-run'], options);
    cli(['config', 'patch', '--file', patchPath], options);
  }
  activeRun = null;
  return { created, teamRoot, coordinatorId: plan.agents.find(agent => agent.coordinator).id };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = normalizePlan(JSON.parse(fs.readFileSync(path.resolve(options.plan), 'utf8')));
  const root = activeRoot(options);
  const { teamRoot, collisions } = preflight(plan, options, root);
  const summary = {
    ok: collisions.length === 0,
    mode: options.mode,
    team: plan.team.name,
    teamRoot,
    coordinatorId: plan.agents.find(agent => agent.coordinator).id,
    agents: plan.agents.map(agent => ({ id: agent.id, name: agent.name, role: agent.role, whyNow: agent.whyNow, firstTask: agent.firstTasks[0] })),
    collisions,
  };
  if (options.mode === 'preview') {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (collisions.length) process.exitCode = 1;
    return;
  }
  if (collisions.length) fail(`preflight collisions: ${collisions.join(', ')}`);
  const result = apply(plan, options, teamRoot);
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'apply', ...result }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, ...(activeRun || {}) })}\n`);
  process.exitCode = 1;
}
