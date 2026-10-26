# 승인된 계획 JSON

스크립트는 UTF-8 JSON 객체 하나를 받는다. 문자열은 마크다운이 아닌 평문. 비밀값·자격증명 금지(스크립트가 토큰/비밀번호 패턴을 발견하면 거부한다). ID는 소문자·숫자·하이픈, 영문자로 시작. `team.id`는 새 팀 폴더 이름이고, 에이전트 ID는 대상 OpenClaw 프로필 안에서 아직 없어야 한다. **예외: 총괄 ID가 기본 에이전트 ID(`main`)이면 새로 만들지 않고 main을 총괄로 채택한다** — 이것이 기본 경로다.

```json
{
  "version": 1,
  "team": {
    "id": "sample-team",
    "name": "Sample Team",
    "organization": "작은 교육 사업",
    "product": "온라인 워크숍",
    "audience": "초보 사업자",
    "objective": "첫 워크숍 런칭",
    "deadline": "미정",
    "successCriteria": ["검토된 워크숍 개요가 준비됨"],
    "constraints": ["기존 도구 사용", "승인 없이 외부 발송 금지"],
    "tools": ["OpenClaw"],
    "userName": "대표님",
    "language": "한국어",
    "relationshipStyle": "따뜻하고 직설적인 동료"
  },
  "agents": [
    {
      "id": "main",
      "name": "미라",
      "emoji": "🧭",
      "archetype": "차분한 원정 가이드",
      "role": "총괄",
      "mission": "워크숍 목표를 검토된 계획으로 바꾸고 전문가를 조율",
      "whyNow": "탐색과 초안을 한 사람이 맞춰야 한다",
      "addressUser": "대표님",
      "traits": ["명확함", "호기심", "믿음직함"],
      "counterTraits": ["군림하지 않음", "두루뭉술하지 않음", "과신하지 않음"],
      "toneExamples": [
        "보고: 개요 초안이 검토 준비됐습니다.",
        "반대: 첫 워크숍은 더 작게 가길 권합니다. 이유는 ...",
        "막힘: 대상이 불분명합니다. X를 확인했고 Y가 필요합니다."
      ],
      "responsibilities": ["첫 주 계획 책임", "전문가 산출물 검토"],
      "outOfScope": ["승인 없이 워크숍 게시"],
      "deliverables": ["검토된 첫 주 계획"],
      "boundaries": ["외부 메시지·운영 변경 전에 물어보기"],
      "failureProtocol": "근거를 확인하고 안전하면 1회 재시도, 그다음 막힌 점과 복구안을 보고.",
      "firstTasks": [
        { "task": "한 장짜리 워크숍 브리프 작성", "why": "첫 목표에 팀을 맞춘다", "doneWhen": "대표님이 대상·약속·개요를 검토할 수 있다" }
      ],
      "menus": ["tasks", "agents"],
      "coordinator": true
    }
  ]
}
```

## 필드 규칙

- **총괄 = 기본 에이전트.** 총괄의 `id`는 `openclaw agents list --json`에서 `isDefault: true`인 에이전트 ID(보통 `main`). 이름 없는 main이 있는데 총괄을 새 ID로 만들면 preview가 `collisions`로 막는다(사용자가 main을 따로 두겠다고 명시했을 때만 `--keep-default`). main에 이미 이름이 있으면 경고만 낸다.
- **`name`은 화면 표기, `id`는 내부 식별자.** `team.language`가 한국어면 `name`에 한글이 있어야 한다(`{"id": "nova", "name": "노바"}`). 스크립트가 설정 `agents.entries.<id>.name`에도 이 이름을 넣어 화면 카드에 ID 대신 이름이 보이게 한다.
- `archetype`은 화면 카드에 이름 아래 보이는 성격 한 줄(60자 이내). "아바타 이미지 없음"·"미정" 같은 메모를 넣으면 거부한다.
- 다중 에이전트 팀은 `"coordinator": true`가 **정확히 하나**. 나머지는 `false` 또는 생략. 1인 팀은 생략 가능(자동으로 총괄).
- `traits`·`counterTraits`·`toneExamples`는 각각 정확히 3개. `firstTasks`는 1~7개.
- `menus`(선택): 이 에이전트가 담당할 대시보드 메뉴 키 배열. 비워도 된다. `dashboard-builder`가 읽는다.
- `model`(선택): 설치된 OpenClaw 모델 ID.
- `avatar`(선택): 다음 중 하나 — `https://` URL, `data:image/...;base64,` URI, 또는 `--avatar-root <dir>` 아래 **이미 존재하는** 이미지의 상대경로. 스크립트는 이미지를 생성하지 않는다. 존재하지 않는 로컬 파일을 가리키면 거부한다.

## 산출물

- 새 전문가 워크스페이스마다 `IDENTITY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, `TEAM.md`
- 채택한 main 워크스페이스: `IDENTITY.md`·`SOUL.md`·`TEAM.md`는 기존 파일을 `*.bak-onboarding-<시각>`으로 보관 후 새로 씀. `AGENTS.md`·`USER.md`는 `<!-- agent-team-onboarding:start -->` ~ `end` 구역만 추가/교체. **`my-work-map.md`, HIA 블록(`<!-- HIA:START -->`), 그 밖의 파일은 건드리지 않는다.**
- 설정: 모든 계획 에이전트의 `agents.entries.<id>.name` = 화면 이름, 2명 이상이면 `subagents.allowAgents`. 패치 파일 `<teamRoot>/config.patch.json`
- `<teamRoot>/team.json` — 대시보드 빌더용 기계 명세(`version`, `team`, `agents[{id,name,emoji,role,mission,coordinator,menus,firstTasks}]`)
- `--project-root`를 주면 `<project-root>/team.md` — HIA 조직도(한국어). 기존 파일은 `team.md.bak-<시각>`으로 보관.
- `<teamRoot>/.provision-log.json` — 이 도구가 만든 에이전트 기록(resume/rollback 근거)
- 채널 바인딩, 크론, 기본 에이전트 지정, main 이외의 기존 에이전트는 **바꾸지 않는다**. main 이외의 기존 에이전트를 재사용하려면 제안서에만 적고 이 JSON의 `agents`에는 넣지 않는다.
- rollback: 새로 만든 에이전트만 삭제. 채택한 main은 지우지 않고 보관 파일·원래 이름·위임 설정을 복원하고 관리 구역만 뺀다(HIA 블록 보존).

## 명령

```bash
node <skill-dir>/scripts/team_setup.mjs preview  --plan <plan.json> [--profile <name>] [--workspace-root <abs>] [--project-root <abs>] [--avatar-root <abs>]
node <skill-dir>/scripts/team_setup.mjs apply    --plan <plan.json> --confirmed [같은 옵션] [--resume] [--delegation-mode <mode>] [--keep-default]
node <skill-dir>/scripts/team_setup.mjs status   --plan <plan.json> [--profile] [--workspace-root]
node <skill-dir>/scripts/team_setup.mjs rollback --plan <plan.json> --confirmed [--profile] [--workspace-root]
```

종료코드: `0` 성공 · `1` 검증/실행 오류(stderr에 JSON: `created`, `failedAgent`) · `2` 에이전트는 생성됐으나 이름·위임 설정을 수동으로 해야 함(stdout `delegation.manualSteps`).

`--delegation-mode`는 설치된 OpenClaw가 `subagents.delegationMode`를 지원할 때만 쓴다. 기본은 `allowAgents`만 설정한다.
