---
name: agent-team-onboarding
description: 사용자의 조직·첫 목표·제약·성공 기준을 인터뷰해 필요한 최소 에이전트 팀을 제안하고, 승인 후 OpenClaw 에이전트를 생성·연결하고 첫 과제를 제안한다. "에이전트 팀 만들어줘", "어떤 에이전트를 만들어야 해", "팀 구성해줘", "직원 뽑아줘" 또는 "help me set up an agent team", "which OpenClaw agents should I create" 같은 요청에 사용. 이미 있는 에이전트를 지우거나 고치는 용도가 아님.
---

# Agent Team Onboarding — 목표에 맞는 최소 팀 만들기

이 스킬은 **정해진 4인 프리셋을 찍어내는 도구가 아니다.** 사용자의 첫 목표에서 거꾸로 필요한 역할을 고르고, 사용자가 승인한 팀만 만든다. 아래 6단계를 순서대로 따른다. 중간에 끊긴 대화는 저장된 초안에서 이어 간다 — 이미 답한 질문을 다시 묻지 않는다.

사용자에게는 **사용자의 언어**(한국어 수강생이면 한국어)로 말한다. 이 문서의 명령은 그대로 쓰되, 설명은 쉬운 말로 바꿔 전달한다.

## 0. 먼저 알아둘 것 (에이전트용)

- 이 스킬 폴더 안의 `references/`와 `scripts/`만 있으면 동작한다. 저장소의 `tests/`·`docs/`는 필요 없다.
- 스크립트는 OpenClaw CLI(`openclaw`)를 호출한다. 다른 경로에 설치돼 있으면 `OPENCLAW_BIN` 환경변수로 지정한다.
- **만들지 않은 것을 만들었다고 말하지 않는다.** 모든 생성 결과는 `openclaw agents list --json`으로 확인한 뒤 보고한다.
- 비밀번호·API 키·토큰은 인터뷰 답, 계획 JSON, 어떤 산출물에도 넣지 않는다. 스크립트가 발견하면 거부한다.

## 1. 환경과 기존 팀 확인

1. `references/interview.md`, `references/recommendation-rules.md`, `references/plan-schema.md`를 읽는다.
2. 실행: `openclaw --version`, `openclaw agents list --json`, `openclaw config file`.
   - CLI가 없거나 에이전트 관리 권한이 없으면 **여기서 멈추고** 막힌 이유와 해결 방법(설치 확인, 게이트웨이 실행 여부)을 알려준다. 팀을 만들었다고 말하지 않는다.
3. 이미 있는 에이전트가 목표를 일부 맡을 수 있으면 **재사용을 먼저 제안**한다. 기존 에이전트·워크스페이스·채널 연결·설정은 절대 덮어쓰거나 지우지 않는다.
4. 실행학교 수강생 환경이면 워크스페이스에 `my-work-map.md`(업무 지도)가 있는지 확인하고, 있으면 읽어 둔다.

**완료 기준:** OpenClaw 버전, 현재 에이전트 목록, 초안 저장 위치를 안다.

## 2. 인터뷰 (4장 필수 + 3장 선택)

`references/interview.md`의 카드를 **4장을 한 번에** 보여주고 답을 받는다. 한 번에 다 답해도 되고, 나눠 답해도 된다. 네 번 왕복을 강요하지 않는다. "미정"은 유효한 답이다. 결정에 꼭 필요한 항목이 비었을 때만 1회 추가 질문한다.

초안 저장(비공개, 현재 에이전트 워크스페이스 안):

```bash
node <skill-dir>/scripts/interview_draft.mjs start --file <workspace>/team-onboarding-drafts/<team-slug>.json
# 답을 파일로 저장한 뒤 (한글·따옴표·줄바꿈 안전)
node <skill-dir>/scripts/interview_draft.mjs update --file <draft.json> --card organization --answer-file <answer.txt>
# 짧은 답은 인자로도 가능
node <skill-dir>/scripts/interview_draft.mjs update --file <draft.json> --card success --answer "검토된 체크리스트 1개"
# 이어서 할 때
node <skill-dir>/scripts/interview_draft.mjs show --file <draft.json>
```

`start`는 기존 초안을 덮어쓰지 않는다. 초안을 공개 채널·저장소에 두지 않는다. 선택 카드(관계·성격·외형)는 "추천해줘"·"건너뛰기"를 허용한다.

**완료 기준:** 조직, 첫 목표, 성공 기준, 제약, 원하는 관계·말투가 적혀 있거나 "미정"으로 표시돼 있다.

## 3. 팀 설계와 미리보기

`references/recommendation-rules.md`로 **가장 적은 역할**(보통 1~4명)을 고른다. 새 에이전트가 2명 이상이면 총괄 1명 + 전문가. 각 에이전트는 겹치지 않는 책임, 첫 목표와 연결된 이유, 산출물, 첫 과제, 성공 확인 방법, 구별되는 성격을 가진다. **성격은 권한이 아니다** — 친근한 성격이 메시지 발송·결제를 스스로 할 수 있다고 암시하지 않는다.

생성 전에 사용자에게 **검토용 제안서**를 보여준다:

- 팀 사명, 첫 성공 기준, 제약
- 에이전트마다: 이름 · 역할 · 성격/이모지 · **왜 지금 필요한가** · 범위 · 첫 산출물 · 첫 과제 · (실행학교) 담당할 대시보드 메뉴 후보
- 재사용하는 기존 에이전트 / 새로 만드는 것 / 바꾸지 않는 것
- 승인 경계: 외부 메시지·구매·게시·삭제·운영 변경·예약 실행은 별도 승인 전까지 꺼짐

역할 수·이름·말투·과제 수정을 권한다. **"계획 세워줘"는 생성 승인이 아니다.** 이 구체적 제안서에 대한 명시적 확인 한 번을 받는다. 이미 이 대화에서 승인했다면 다시 묻지 않는다.

**완료 기준:** 사용자가 정확히 이 팀을 만들라고 승인했다.

## 4. 기계용 계획 JSON 만들기

승인된 제안을 `references/plan-schema.md` 형식으로 JSON 파일에 쓴다(이번 실행용 로컬 경로). 비밀값 금지. 에이전트마다 긍정 특성 3·대비 특성 3·말투 예시 3·경계·실패 시 행동·첫 과제를 넣는다. 외형을 건너뛰었으면 이모지와 한 줄 모티프만 쓰고 아바타 이미지를 지어내지 않는다.

```bash
node <skill-dir>/scripts/team_setup.mjs preview --plan <plan.json>
```

옵션: 프로필이 있으면 `--profile <name>`, 저장 위치를 정했으면 `--workspace-root <절대경로>`, 실행학교라면 `--project-root <HIA 프로젝트 루트>`(여기에 `team.md` 조직도를 쓴다), 아바타 파일을 쓰면 `--avatar-root <디렉터리>`.

충돌·검증 오류를 전부 해결한 뒤 진행한다. 미리보기 결과(새 에이전트 ID, 워크스페이스 위치)를 쉬운 말로 요약한다.

**완료 기준:** preview가 성공하고 승인된 제안과 일치하며 충돌이 없다.

## 5. 생성과 검증

승인 후에만:

```bash
node <skill-dir>/scripts/team_setup.mjs apply --plan <plan.json> --confirmed [--profile ...] [--workspace-root ...] [--project-root ...]
```

스크립트가 하는 일: 새 워크스페이스에 `IDENTITY.md`·`SOUL.md`·`USER.md`·`AGENTS.md`·`TEAM.md` 작성 → `openclaw agents add` → `set-identity` → 총괄→전문가 위임 허용 목록 설정 → `team.json`(대시보드용)·`team.md`(HIA 조직도) 저장. 채널 연결·예약 실행·외부 발송·기본 에이전트 변경은 하지 않는다.

위임 설정은 설치된 OpenClaw 버전에 따라 `config patch` → `config set` → **수동 안내** 순으로 시도한다. 종료코드 2와 함께 `delegation.manualSteps`가 나오면 에이전트는 만들어진 것이고 위임 설정만 사람이 해야 한다 — 그 단계를 그대로 사용자에게 전달한다.

검증: `openclaw agents list --json`, 생성된 파일, 총괄의 `subagents.allowAgents`(2명 이상일 때). 어떤 단계가 실패하면 **어떤 에이전트까지 만들어졌고 어디서 멈췄는지** 정확히 보고한다. 이어서 하려면:

```bash
node <skill-dir>/scripts/team_setup.mjs status --plan <plan.json>          # 무엇이 만들어졌는지
node <skill-dir>/scripts/team_setup.mjs apply --plan <plan.json> --confirmed --resume   # 남은 것만
node <skill-dir>/scripts/team_setup.mjs rollback --plan <plan.json> --confirmed         # 이 도구가 만든 것만 제거
```

부분 결과를 말없이 지우거나 그 위에 다시 실행하지 않는다.

**완료 기준:** 승인된 에이전트가 모두 존재하고, 페르소나 파일이 온전하며, 위임이 명단과 일치하거나 수동 단계가 전달됐다.

## 6. 첫 주 넘겨주기

승인된 계획의 `firstTasks`로 7일 시작 계획을 짧게 제시한다: 담당 · 왜 지금 · 산출물 · 완료 조건. 총괄에게 맡길 안전한 내부 과제 1개를 권한다. **제안한 일과 끝난 일을 구분**한다 — 실제 과제가 돌기 전에는 에이전트가 일하고 있다고 말하지 않는다. 총괄은 OpenClaw 에이전트 화면에서 열 수 있고, 채팅 채널 연결은 따로 해야 한다고 알려준다.

실행학교 수강생이면 마지막에: "조직도는 `team.md`에 저장했습니다. 다음은 **dashboard-builder** 스킬에 '대시보드 만들어줘'라고 말하면 이 팀이 보이는 내 AI 오피스를 만듭니다."

**완료 기준:** 사용자가 누가 왜 만들어졌는지, 어디서 찾는지, 무엇을 먼저 시킬지, 무엇이 아직 승인 필요인지 안다.

## 지켜야 할 경계

- 프로비저닝은 로컬 CLI로만. 경로·계정을 하드코딩하지 않는다.
- 생성된 파일의 경계 문구는 **에이전트 지침**이지 호스트 보안 샌드박스가 아니다. 도구 접근이 기술적으로 제한됐다고 말하지 않는다.
- 사용자가 계획만 원하면 3단계에서 멈춘다. OpenClaw 버전이 다르면 `--help`를 확인한 뒤에만 명령을 바꾼다. 설정 파일을 추측으로 고치지 않는다.
- `--confirmed`는 기계적 안전장치일 뿐, 사용자의 승인을 대신하지 않는다.
