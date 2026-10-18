# jev-mem

[English](README.md)

## 왜 만들었나

에이전트는 이미 했던 일을 다시 한다. 이전 세션 기록을 불러오면 막을 수 있지만, 불러오는 과정에 비용이 숨어 있다.

- **토큰을 너무 많이 쓴다.** 작성자 환경에서 claude-mem은 세션을 열 때마다 이전 기록 약 30K 토큰을 넣었다.
- **시작 전에 컨텍스트 윈도우가 줄어든다.** 200K 모델이면 첫 프롬프트 전에 15~30%를 쓰고 들어간다. 1M 윈도우에서도 같은 양이 세션마다 반복된다.
- **빠르지만 정확하지 않다.** claude-mem은 AI 없이(벡터 일치만으로) 기록을 찾는다. 빠르지만 관련 있는 기록과 단어만 겹치는 기록을 구분하지 못해, 토큰 대부분이 필요 없는 기록에 쓰인다. 가장 큰 문제였다.
- **설정만으로는 부족하다.** claude-mem 옵션으로 개수를 줄일 수는 있지만, 고정된 숫자로는 이번 프롬프트에 어떤 기록이 필요한지 정할 수 없다.

jev-mem은 빠른 검색을 1차로 두고, AI 판단자인 JEV가 정말 관련 있는 기록을 고르게 한다. 맞는 기록 하나만 넣고, 맞는 게 없으면 아무것도 넣지 않는다. Claude Code, Codex, Antigravity에서 같은 방식으로 동작한다.

방금 입력한 프롬프트에 관련 있다고 [JEV](https://docs.typesafe.ai)가 판단한
[claude-mem](https://github.com/thedotmack/claude-mem) 기록만 주입한다.

claude-mem 기본 프롬프트 주입(`CLAUDE_MEM_SEMANTIC_INJECT`)은 관련성 하한 없이 벡터 상위 결과를
매번 넣는다. 새 일을 시작하는 프롬프트에도 단어만 겹치는 기록 5개가 들어간다. 이 플러그인은
claude-mem 벡터 검색을 1차로 쓰고, JEV를 최종 판단자로 붙인다.

1. `UserPromptSubmit` 때 로컬 claude-mem 워커에서 벡터 상위 5개를 받는다.
2. 프롬프트와 기록 5개를 JEV에 한 번에 보낸다. 기록마다 예/아니오 질문 하나.
3. 예 확률이 가장 높은 기록을 기준값 이상일 때만 넣는다. 기준을 넘는 기록이 없으면 아무것도 넣지 않는다.

측정 (2026-10-18, 한 대, claude-mem 14.0.1): 프롬프트당 약 0.5초.

| 프롬프트 | claude-mem 기본 | jev-mem |
| --- | --- | --- |
| 예전 claude-mem 설정 변경 질문 | 5개 | 1개 (JEV 0.85) |
| 관련 없는 블로그 글 시작 | 무관한 5개 | 없음 (최고 0.05) |
| 스크린샷 번역 요청 | 무관한 5개 | 없음 (최고 0.28) |

세 프롬프트는 예시이고 벤치마크가 아니다. JEV는 관련성을 판단하고 사실 여부는 판단하지 않는다.
주제는 맞지만 낡은 기록이 뽑힐 수 있다.

## AI 시대의 두 지표

AI 시대의 일은 두 지표로 잰다.

1. **리드타임**: 신호에서 운영 반영까지 걸린 시간.
2. **사람 개입**: 그 결과를 얻으려고 사람이 직접 입력한 프롬프트 수.

jev-mem은 이미 모든 세션을 읽어 기억 기록을 고른다. 그래서 이 두 통계를 모으기에도 알맞은 자리다.

`jev-mem human-count`는 한 주제와 관련된 모든 세션에서 사람이 직접 입력한 프롬프트를 센다. Claude, Codex, Antigravity 세션을 모두 본다.

- 포함: 턴이 끝나기 전에 입력해 둔 메시지도 센다.
- 제외: 훅이 넣은 글, 시스템 안내, 도구 결과는 세지 않는다.
- 관련 세션 고르기: 키워드로 후보를 거른 뒤, JEV가 세션마다 그 주제에 속하는지 판정한다.
- 개인정보: 프롬프트 원문은 `--show`를 줄 때만 출력한다.

```sh
jev-mem human-count --topic "<프로젝트>" --since 2026-10-18T00:00:00+05:30 \
  --keywords "<별칭>,<별칭>" --json --out human-interventions.json
```

필요할 때만 실행한다. 예: 대시보드의 새로고침 버튼. 주기적으로 돌리지 않는다.

리드타임 측정은 아직 만들지 않았다.

## 지원 런타임

Claude만이 아니다. 같은 코어를 런타임별 작은 어댑터가 감싼다. 평소 쓰던 CLI를 그대로 쓰면 훅이 알아서 돈다.

| 런타임 | 훅 파일 | 이벤트 | 명령 |
| --- | --- | --- | --- |
| Claude Code (`glm-claude` 포함) | `~/.claude/settings.json` | `UserPromptSubmit` | `node <repo>/scripts/hook.mjs --runtime claude` |
| Codex CLI | `~/.codex/hooks.json` | `UserPromptSubmit` | `node <repo>/scripts/hook.mjs --runtime codex` |
| Antigravity CLI (`agy`) | `~/.gemini/config/hooks.json` | `PreInvocation` | `node <repo>/scripts/hook.mjs --runtime agy` |

턴마다 한 줄이 보인다. 예: `[jev-mem] Found 5 notes. Added the best 1 (#374, 81% match) (0.6s).`
jev-router와 함께 쓰면 `[Jev] routed ...` 줄 바로 다음에 나온다.

## 설치 순서

[jev-router](https://github.com/must-lioncho/jev-router-effort)를 먼저 설치하고 이 플러그인을 설치한다.
jev-router가 만든 키 파일(`~/.jev-router.env`)을 그대로 쓴다.

순서가 라우팅 토큰을 늘리지 않는 이유: jev-router는 프록시다. Claude Code는 요청을 보내기 전에
`UserPromptSubmit` 훅을 모두 실행하므로, 프록시 라우팅은 항상 이 플러그인 다음에 일어난다.
훅 출력은 `<system-reminder>` 블록으로 들어가고, jev-router는 모델을 고르기 전에 이 블록을 지운다.
그래서 주입된 기록은 라우팅 판단을 키우거나 바꾸지 않고, 답하는 모델에게만 간다.

```bash
# 훅 등록 (런타임별 어댑터. 지금은 Claude, 다음은 Codex·Gemini)
# ~/.claude/settings.json 의 hooks.UserPromptSubmit 에 jev-router 다음으로 추가:
# node /path/to/jev-mem/scripts/hook.mjs --runtime claude
# Claude 전용 대안: claude plugin install jev-mem@jev-mem
echo "JEV_API_KEY=..." > ~/.jev-router.env      # jev-router 설정했으면 생략
node bin/jev-mem.mjs setup --apply      # claude-mem 자체 주입 끔. 백업 남기고 다른 키 보존
node bin/jev-mem.mjs doctor
```

## 설정

`~/.jev-mem/settings.json`. 주요 값:

- `mode`: `top1`(기본, 1등 하나) 또는 `all`(기준 넘는 것 전부, `maxInject`까지)
- `minProbability`: 기본 0.7. 올리면 덜 넣는다.
- `candidates`: JEV가 판단할 벡터 후보 수. 기본 5.
- `format`: `narrative`(본문) 또는 `index`(한 줄 + id)

전체 표는 [README.md](README.md#settings).

## 조정

`node bin/jev-mem.mjs try "프롬프트"` 로 후보별 벡터 순위와 JEV 확률, 실제 주입 내용을 본다.
실제 프롬프트마다 `~/.jev-mem/decisions.jsonl` 에 후보 id·확률·주입 여부·지연이 남는다.
프롬프트 원문은 기본으로 저장하지 않는다.

## 실패 시

키 없음, 워커 꺼짐, JEV 오류, 시간 초과, 20자 미만 프롬프트: 모두 아무것도 넣지 않고 프롬프트를 막지 않는다.

## 라이선스

MIT. claude-mem 코드를 포함하지 않고 로컬 HTTP API만 호출한다. claude-mem은 Apache-2.0, © Alex Newman.
Anthropic, claude-mem 프로젝트, TypeSafe와 제휴하지 않았다. "Claude"는 Anthropic 상표다. 이름은 호환 대상을 밝히는 용도로만 쓴다.
