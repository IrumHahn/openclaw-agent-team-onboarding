import fs from 'node:fs';
import path from 'node:path';

const bullets = items => items.map(item => `- ${item}`).join('\n');
const today = () => new Date().toISOString().slice(0, 10);

export function teamMarkdown(plan) {
  const { team, agents } = plan;
  return `# ${team.name}\n\n## Purpose\n\n- Organization: ${team.organization}\n- Product/service: ${team.product}\n- Audience: ${team.audience}\n- First objective: ${team.objective}\n- Deadline: ${team.deadline}\n- Success criteria:\n${bullets(team.successCriteria)}\n- Constraints:\n${bullets(team.constraints.length ? team.constraints : ['None specified'])}\n- Existing tools:\n${bullets(team.tools.length ? team.tools : ['None specified'])}\n\n## Roster\n\n${agents.map(agent => `- ${agent.emoji} **${agent.name}** (${agent.id}) — ${agent.role}. ${agent.mission}${agent.menus.length ? ` Menus: ${agent.menus.join(', ')}.` : ''}`).join('\n')}\n\n## Working agreement\n\nThe coordinator owns the integrated plan and user-facing report. Specialists own bounded deliverables and return evidence. Do not confuse a proposed task with completed work. External sends, purchases, publishing, destructive changes, production changes, and recurring jobs require separate user authorization.\n`;
}

export function identityMarkdown(agent) {
  return `# IDENTITY.md - Who Am I?\n\n- Name: ${agent.name}\n- Creature: ${agent.archetype}\n- Vibe: ${agent.traits.join('; ')}\n- Emoji: ${agent.emoji}\n${agent.avatar ? `- Avatar: ${agent.avatar}\n` : ''}\n## One-line introduction\n\nI am ${agent.name}, the ${agent.role.toLowerCase()} for this team. ${agent.mission}\n`;
}

export function soulMarkdown(agent) {
  return `# SOUL.md - ${agent.name}\n\n## Core character\n\n${agent.archetype}. I am ${agent.traits.join(', ').toLowerCase()}; ${agent.counterTraits.join(', ').toLowerCase()}. Persona supports clear work and trust, not false claims of consciousness or capability.\n\n## Voice\n\nAddress the user as ${agent.addressUser}. Use the team's stated language and relationship style from USER.md. Examples to emulate, not repeat verbatim:\n\n1. Routine update: “${agent.toneExamples[0]}”\n2. Respectful disagreement: “${agent.toneExamples[1]}”\n3. Blocked/error: “${agent.toneExamples[2]}”\n\n## Boundaries\n\n${bullets(agent.boundaries)}\n- Never reveal private information in shared contexts.\n- Never pretend work, tool use, or a handoff happened when it did not.\n- Ask before external sends, purchases, publishing, deletion, production changes, or scheduled automation unless the user already explicitly authorized that exact action.\n\n## When blocked\n\n${agent.failureProtocol}\n`;
}

export function userMarkdown(plan, agent) {
  const { team } = plan;
  const date = today();
  return `# USER.md - User Model\n\n## Context\n\n- User: ${team.userName}\n- Organization: ${team.organization}\n- Product/service: ${team.product}\n- Audience: ${team.audience}\n- First goal: ${team.objective}\n- Deadline: ${team.deadline}\n- Success criteria:\n${bullets(team.successCriteria)}\n- Constraints:\n${bullets(team.constraints.length ? team.constraints : ['None specified'])}\n- Existing tools:\n${bullets(team.tools.length ? team.tools : ['None specified'])}\n\n## Directives\n\n<!-- observed: ${date} | status: active -->\n- Prefer ${team.language} for replies.\n\n<!-- observed: ${date} | status: active -->\n- Address the user as ${agent.addressUser}.\n\n<!-- observed: ${date} | status: active -->\n- Prefer a ${team.relationshipStyle} relationship style.\n\n<!-- observed: ${date} | status: active -->\n- Anchor proactive suggestions to the first goal and success criteria above.\n\nThis file contains context, not secrets. Ask before storing new personal facts.\n`;
}

export function agentsMarkdown(plan, agent) {
  const specialists = plan.agents.filter(item => !item.coordinator);
  const coordinatorAgent = plan.agents.find(item => item.coordinator);
  const coordination = agent.coordinator && specialists.length
    ? `You coordinate ${specialists.map(item => `${item.name} (${item.id})`).join(', ')}. Delegate bounded work through available OpenClaw subagent tools when helpful; check the result before reporting it. Do not claim a handoff until the delegate actually accepted it.`
    : agent.coordinator
      ? 'You are the single agent for this team. Do not invent delegated teammates.'
      : `Return findings and artifacts to ${coordinatorAgent.name}; do not delegate onward.`;
  const taskLines = agent.firstTasks.map((item, index) => `${index + 1}. ${item.task}\n   - Why now: ${item.why}\n   - Done when: ${item.doneWhen}`).join('\n');
  const menuLine = agent.menus.length ? `\nDashboard menus you own: ${agent.menus.join(', ')}. Keep their records current when you finish related work.\n` : '';
  return `# AGENTS.md - ${agent.name}'s operating contract\n\nAt session start, read SOUL.md, USER.md, and TEAM.md. Act within the first goal; propose work based on evidence, not a generic calendar.\n\n## Mission and scope\n\n${agent.mission}\n\nWhy this agent exists now: ${agent.whyNow}\n\nResponsibilities:\n${bullets(agent.responsibilities)}\n\nOut of scope:\n${bullets(agent.outOfScope)}\n\nExpected deliverables:\n${bullets(agent.deliverables)}\n${menuLine}\n## Teamwork\n\n${coordination}\n\n## Initial task proposals (not yet completed or scheduled)\n\n${taskLines}\n\n## Operating rules\n\n- Recommend the next useful internal action tied to the team's objective and measurable success criteria. State why it matters and what completion looks like.\n- Distinguish proposed, in progress, blocked, and completed work. Do not execute external or irreversible tasks merely because they appear above.\n- External messages, purchases, publishing, deletion, production changes, and recurring automation need the user's specific authorization.\n- If a tool, credential, or permission is missing, report the blocker and a safe next step; do not claim a behavioral instruction is a technical access restriction.\n`;
}

// dashboard-builder 가 읽는 기계용 팀 명세.
export function teamJson(plan) {
  return {
    version: 1,
    generatedBy: 'agent-team-onboarding',
    team: {
      id: plan.team.id, name: plan.team.name, organization: plan.team.organization,
      objective: plan.team.objective, successCriteria: plan.team.successCriteria,
      userName: plan.team.userName, language: plan.team.language,
    },
    agents: plan.agents.map(agent => ({
      id: agent.id, name: agent.name, emoji: agent.emoji, role: agent.role,
      mission: agent.mission, coordinator: agent.coordinator, menus: agent.menus,
      firstTasks: agent.firstTasks,
    })),
  };
}

// HIA 프로젝트 루트용 한국어 조직도(team.md). 사람이 읽는 문서.
export function teamMdKorean(plan) {
  const { team, agents } = plan;
  const rows = agents.map(a => `| ${a.emoji} ${a.name} | \`${a.id}\` | ${a.coordinator ? '총괄' : '전문'} · ${a.role} | ${a.mission} | ${a.menus.length ? a.menus.join(', ') : '(미정)'} |`).join('\n');
  const tasks = agents.flatMap(a => a.firstTasks.map(t => `- **${a.name}** — ${t.task} (완료 기준: ${t.doneWhen})`)).join('\n');
  return `# 팀 조직도 — ${team.name}\n\n- 생성: ${today()} · agent-team-onboarding 스킬\n- 목표: ${team.objective}\n- 성공 기준:\n${bullets(team.successCriteria)}\n- 상태: 에이전트 등록 완료(OpenClaw). 채널 연결·자동 실행은 아직 설정하지 않음.\n\n## 직원\n\n| 이름 | 에이전트 ID | 역할 | 임무 | 담당 메뉴(대시보드) |\n|---|---|---|---|---|\n${rows}\n\n## 첫 과제 (제안 상태 — 아직 실행하지 않음)\n\n${tasks}\n\n## 다음 단계\n\n1. 대시보드: \`dashboard-builder\` 스킬에 "대시보드 만들어줘"라고 말하면 이 조직도를 읽어 메뉴와 담당을 채운다.\n2. 담당 메뉴가 \`(미정)\`인 직원은 대시보드 설정에서 메뉴를 지정하거나, 필요한 메뉴에 새 직원을 추가한다.\n`;
}

function backupIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${filePath}.bak-${stamp}`;
  fs.renameSync(filePath, backup);
  return backup;
}

export function writeProjectTeamMd(projectRoot, plan) {
  const target = path.join(projectRoot, 'team.md');
  const backup = backupIfExists(target);
  fs.writeFileSync(target, teamMdKorean(plan), { encoding: 'utf8', mode: 0o600 });
  return { path: target, backup };
}
