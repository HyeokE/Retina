# Retina 계획서 보강 메모 (2026-10-25)

대상은 `docs/visual-regression-skill-plan.md` 재작성본(13:47 기준, 259줄)이에요. 재작성본을 다른 세션이 편집 중이라 충돌을 피하려고 별도 파일로 작성했어요. 아래 항목은 재작성본의 구조에 맞춰 본문에 합칠 문구 초안이에요.

재작성본은 CI 초기 실행, CI 환경 baseline, 에이전트 대기 없는 CI 판정, artifact·timeout·secret 정책, 범위 축소(흐름 1개·환경 4개), Pairwise·HTML 리포트 보류를 이미 반영했어요. 이 부분은 다시 다루지 않아요.

## 1. 사실 정정 (5장 "Aside 의존성과 기존 조사 기록", 109·111행)

### 109행: Aside 조사 기록

이번 세션(2026-10-25 13:3x KST)에서 Aside CLI 1.26.1020.1855로 다시 실행해 확인했어요. 실행한 스크립트와 출력은 다음과 같아요.

```text
aside repl "const t1 = await openTab('https://example.com');
  const before = await t1.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  let err = null; try { await t1.setViewportSize({ width: 390, height: 844 }); } catch (e) { err = String(e); }
  const after = await t1.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  console.log(JSON.stringify({ before, after, err, hasEmulate: typeof t1.emulateMedia })); await closeTab(t1);"

{"before":[1440,900,2],"after":[1440,900,2],"err":"TypeError: not a function","hasEmulate":"undefined"}
```

`aside guide repl` 원문 기준 제약은 다음과 같아요. `import`/`require`는 사용할 수 없고 1회 120초로 제한돼요. one-shot CLI 세션은 종료 시 닫히고 사용자 쿠키·자격 증명 위에서 동작해요.

제안 문구:

> 2026-10-25 Aside CLI 1.26.1020.1855에서 `setViewportSize`는 `TypeError: not a function`, `emulateMedia`는 없음, 뷰포트·DPR은 사용자 창(측정 시 1440×900, DPR 2)을 따르는 것을 다시 확인했어요. 실행 명령과 출력은 `docs/plan-review-2026-10-25.md`에 남겼어요. Aside 버전이 바뀌면 같은 명령으로 다시 확인해요.

### 111행: 브라우저 규칙 예외

`~/.claude/rules/browser-aside.md`에 "예외: 자동화 테스트 엔진" 절을 추가했어요(사용자 선택: "헤드리스 브라우저 분리"). 테스트 코드가 Playwright 번들 Chromium을 headless로 실행하는 것은 허용하고, 사용자 Chrome(`channel: 'chrome'` 포함)·사용자 프로필·headed 창·Chrome MCP 도구는 계속 금지예요. 에이전트의 대화형 확인은 계속 Aside로 해요.

제안 문구(111행의 마지막 두 문장을 대체):

> 헤드리스 테스트 엔진은 브라우저 작업 규칙의 "자동화 테스트 엔진" 예외(2026-10-25 추가)를 따라요. 번들 Chromium을 headless로만 실행하고 사용자 Chrome·프로필·headed 창은 사용하지 않아요.

## 2. 새로 발견한 공백: baseline 승인 경로 (7장 169행, 8장 195행)

169행은 "PR 안에서 바뀐 목록을 그 PR의 유일한 정답으로 사용하지 않아요"라고 하고, 195행은 "승인 기준을 반영한 새 CI run이 통과해야" 한다고 해요. 그런데 **의도한 시각 변경이 있는 PR이 승인 기준을 얻는 경로가 정의돼 있지 않아요.** PR 안의 baseline 변경을 믿지 않으면 그 PR은 영원히 `REVIEW_REQUIRED`예요.

제안 문구:

> baseline·필수 목록·정책 파일은 전용 디렉터리(예: `.retina/baselines/`, `.retina/policy/`)에 두고 CODEOWNERS로 검토자를 지정해요. PR이 이 파일을 바꾸면 CI는 지정 검토자의 승인 여부를 CI 공급자 API로 확인해요. 승인이 없으면 바뀐 baseline으로 비교한 결과를 `REVIEW_REQUIRED`로 남기고, 승인 후 다시 실행한 run만 gate를 통과해요. 승인 기록에는 이미지 해시를 연결해 승인 뒤 이미지가 바뀌면 다시 검토해요.

## 3. 보강 제안

### 3-1. 대상 프로젝트가 제공할 테스트 계약 (5장 뒤 또는 3장 파일럿 범위)

20행은 "프로젝트 수정이 필요할 수 있어요"라고만 해요. 도입 전 점검표로 쓸 수 있게 목록을 명시해요.

| 항목 | 웹 | 앱 | 수준 | 없을 때 |
| --- | --- | --- | --- | --- |
| 안정 식별자 | `data-testid` | `testID`(OS별 노출 속성은 단계 B에서 확인해요) | 구조 검사·영역 비교에 필수예요 | 해당 검사를 `INCONCLUSIVE`로 표시해요 |
| 준비 완료 신호 | 화면별 ready 표식(예: `data-retina-ready`) | 같은 의미의 식별자 요소 | 필수 | 촬영하지 않고 `INCONCLUSIVE`로 표시해요 |
| fixture setup/reset | 테스트 전용 seed·API | 테스트 빌드의 초기화 딥링크·API | 상태 변경 흐름에 필수예요 | 자동 실행을 지원하는 것이 아니에요 |
| 빌드 식별자 | 메타 태그·응답 헤더로 커밋·빌드 ID를 노출해요 | native 빌드 ID + JS bundle·update ID를 노출해요 | 회귀에 필수예요 | 회귀를 `INCONCLUSIVE`로 표시해요 |
| 진입 경로 | URL | 테스트용 딥링크 scheme | 필수 | 이동 동작을 테스트 코드로 작성해요 |
| 시간·랜덤·네트워크 고정 | 테스트 모드 플래그, mock | 같음 | 권장 | 마스크가 늘어나요. 불안정하면 `INCONCLUSIVE`로 표시해요 |
| 개발 오버레이 차단 | 오류 오버레이를 비활성화해요 | dev menu·LogBox를 비활성화해요 | 권장 | 오버레이 감지 시 `INCONCLUSIVE`로 표시해요 |

테스트 모드 코드와 초기화 API는 빌드 플래그로 분리해 production 빌드에 포함되지 않게 해요.

### 3-2. ①의 CI 실행 방식 (2장 표 "실행" 행, 6장)

31행은 ①을 "준비된 개발 서버·설치 앱에서 짧게 실행"으로만 정의해 CI에서 ①을 실행하는 방식이 비어 있어요.

> CI에서 ①은 PR의 merge-base와 head를 같은 job에서 각각 빌드·촬영해 비교해요. 같은 runner에서 찍으므로 환경 차이가 없고, 승인 baseline이 없는 화면도 PR이 만든 시각 차이를 보여 줄 수 있어요. 이 비교는 ①의 진단 결과이며 ②의 gate 판정을 대신하지 않아요.

### 3-3. ①에서 네이티브 변경 전 기준 확보 비용 (5장 "네이티브 실행의 한계")

> 네이티브 앱의 변경 전 기준은 변경 종류에 따라 확보해요. JS·asset만 바뀌었다면 같은 설치 바이너리에 변경 전 커밋의 bundle을 로드해 촬영하고, 기준과 후보의 bundle 모드를 맞춰요. 네이티브 코드·네이티브 의존성·config plugin이 바뀌었다면 바이너리를 다시 빌드해야 해서 ①의 시간 목표(250행, 2분)를 넘어요. 이때는 승인 baseline이 있을 때만 회귀를 실행하고 없으면 미지원으로 표시해요. 판단이 불확실하면 네이티브 변경으로 취급해요.

### 3-4. ①에서 사용자가 차이를 수락하는 경로 (8장 191·195행)

로컬 ① 루프에서 의도한 변경이 매번 `REVIEW_REQUIRED` → baseline 승인 → 재실행을 거치면 개발 중 확인으로 쓰기 어려워요.

> ①의 변경 전 임시 기준은 저장하지 않으므로, 기대 속성·구조 규칙을 충족하고 에이전트가 나머지 차이를 설명한 뒤 **사용자가 이번 실행에서 차이를 직접 수락**하면 해당 케이스를 `PASS`로 기록하고 `acceptance: { by: "user", diffHash }`를 남겨요. 에이전트는 스스로 수락할 수 없고, 이 수락은 해당 ① 실행에만 유효해요. 승인 baseline 갱신이나 ②·CI gate 통과로 이어지지 않아요.

### 3-5. 검토 결과 형식과 종료 코드 (8장 193·195행)

193행은 "검토 결과는 원본 run·이미지·정책 해시에 연결"한다고 하지만 형식이 없어요.

```json
{
  "runId": "2026-10-25T13-40-00Z-a1b2",
  "caseId": "profile-form/web-mobile/after-save",
  "requirementIds": ["profile-persist"],
  "policyHash": "sha256:…",
  "imageHashes": { "expected": "sha256:…", "actual": "sha256:…", "diff": "sha256:…" },
  "verdict": "FAIL",
  "observations": [
    { "fact": "저장 버튼이 폼 오른쪽 경계를 12px 벗어남", "evidence": "diff 영역 #2" }
  ],
  "reviewer": "agent",
  "acceptance": null,
  "reviewedAt": "2026-10-25T13:52:10Z"
}
```

- 해시가 대상 run의 산출물과 다르면 검토를 거부해요.
- 합칠 때는 자동 결과와 검토 결과 중 더 나쁜 쪽을 따라요(`FAIL` > `INCONCLUSIVE` > `REVIEW_REQUIRED` > `PASS`).
- CLI 종료 코드는 다음과 같이 제안해요. `0`은 필수 결과가 모두 `PASS`일 때, `1`은 `FAIL`이 있을 때, `2`는 실행 오류(설정 오류·기기 미부팅·테스트 0개)가 있을 때, `3`은 `REVIEW_REQUIRED`·`INCONCLUSIVE`만 있을 때 사용해요. CI에서는 `0`만 성공으로 처리하고 `3`은 job summary에서 "검토 필요"로 구분해 보여 줘요.

### 3-6. 기기 고정 절차 후보 (5장 117행)

117행은 safe area·권한창·키보드를 "어댑터 검증 항목"으로만 적었어요. 단계 B에서 확인할 구체 절차 후보예요.

| 항목 | iOS Simulator | Android Emulator |
| --- | --- | --- |
| 상태바 | `xcrun simctl status_bar <device> override`로 시간·배터리·신호를 고정해요 | SystemUI demo mode로 시계·아이콘을 고정해요 |
| 테마 | `xcrun simctl ui <device> appearance light\|dark` | `adb shell cmd uimode night yes\|no` |
| 글꼴 배율 | `xcrun simctl ui <device> content_size <category>` | `adb shell settings put system font_scale <value>` |
| 애니메이션 | 앱 테스트 모드에서 비활성화하고 모션 감소 설정을 검토해요 | `window_animation_scale`·`transition_animation_scale`·`animator_duration_scale`을 0으로 설정해요 |
| 권한 창 | 케이스별로 사전 허용해요. 권한 창이 검증 대상이면 자동 허용을 꺼요 | 같음 |

### 3-7. Vitest 실행 설정 (5장 101~105행, 8장 197행)

197행의 재시도 0회에 더해 다음을 명시해요.

> 각 플랫폼 project는 기기·브라우저 하나당 worker 1개로 실행해요(`fileParallelism: false`, `maxWorkers: 1`). 앱 실행과 촬영 반복을 고려해 `testTimeout`·`hookTimeout`을 단위 테스트보다 크게 잡고, 값은 단계 B에서 측정해 정해요. Appium 서버·기기 부팅·웹 서버 시작은 `globalSetup`에서 처리하고 teardown에서 정리해요. 케이스별 Retina 상태는 Vitest `task.meta`에 기록해 집계 함수가 읽어요.

### 3-8. 미결정 사항 추가 (11장)

재작성본은 스킬 패키징 이야기를 모두 뺐어요. 다음 두 가지를 미결정 목록에 추가해요.

- 패키지·스킬 이름은 `retina`를 권장해요(이전 임시 이름 `visual-regression`).
- 배포 대상 호스트는 Claude Code 플러그인을 우선 권장하고 Codex 표시 정보도 유지해요.

## 4. 앱 검증의 메모리 사용 (사용자 지적, 2026-10-25)

### 이전에 겪은 일 (SkinSeoulFront 작업 기록 기준)

- 2026-08-26 사용자 지시 "안드로 검증하지 말아주라 메모리 너무 많이 먹어" 이후, 로컬 검증에서는 Android 에뮬레이터를 띄우지 않고 Android는 CI(ubuntu runner)로 미뤄요. 개발 Mac에는 이미 worktree별 Metro 여러 개, iOS 시뮬레이터, Appium/WebDriverAgent가 동시에 돌고 있어요.
- 2026-09-02 SSD-6221(Android targetSdk 36 대응)에서는 호스트 여유 메모리가 약 1.5 GB뿐이라 AVD(RAM 4 GB)를 `-memory 2048`로 줄여 부팅했어요. 에뮬레이터 `/data` 여유 공간도 약 750 MB라 4-ABI debug APK(353 MB) 설치가 실패했고, arm64 단일 ABI(127 MB)로 다시 패키징해야 했어요.
- 이미 떠 있는 다른 에뮬레이터·시뮬레이터로 테스트가 조용히 옮겨간 적이 있어요. 그래서 Appium은 `appium:udid`로 기기를 고정해요.
- 개발 Mac 사양은 RAM 36 GB예요. 확인 시점의 시스템 여유 메모리는 39%, 누적 pageouts는 267,788회예요.

### 메모리를 먹는 구성 요소

| 구성 요소 | 언제 뜨나요 | 줄이는 방법 |
| --- | --- | --- |
| Android Emulator(qemu + 게스트 RAM) | Android 케이스 | 로컬에서는 띄우지 않아요. CI에서 AVD RAM·heap을 runner 사양에 맞춰 고정해요 |
| iOS Simulator | iOS 케이스 | Retina 전용 기기 1대만 부팅하고 Retina가 부팅한 기기만 종료해요 |
| Xcode·Gradle 빌드 | 앱 빌드 | 로컬에서는 이미 설치된 빌드나 CI artifact를 재사용하고 빌드 job과 테스트 job을 분리해요 |
| WebDriverAgent 빌드·실행 | iOS Appium 세션 | 미리 빌드한 WDA를 재사용해 세션마다 xcodebuild를 띄우지 않아요 |
| Metro | 개발 빌드·① | 내 worktree의 Metro인지 확인해 재사용하거나 빈 포트에 하나만 띄우고 종료해요. CI ②는 bundle 내장 artifact로 Metro를 생략해요 |
| Appium 서버·Vitest worker | 모든 앱 케이스 | 서버 1개, 기기당 worker 1개 |

### 계획에 넣을 문구

> **로컬 실행 profile과 CI 실행 profile을 나눠요.** 로컬 기본 profile은 웹 + iOS Simulator이고 Android는 CI에서만 실행해요. 로컬 결과는 "웹·iOS 선택 실행"으로 보고하고, Android는 미실행이 아니라 "CI에서 확인 예정"으로 표시해요. 로컬 통과를 세 플랫폼 통과로 보고하지 않아요.

> **기기는 한 번에 하나만 띄워요.** 로컬에서는 플랫폼을 직렬로 실행하고, 앞 플랫폼의 기기·드라이버·Metro를 정리한 뒤 다음 플랫폼을 시작해요. Retina는 자기가 시작한 프로세스만 정리해요. 다른 worktree의 Metro나 사용자가 띄운 시뮬레이터는 종료하지 않고, 사용할 기기를 `udid`로 고정해 그쪽으로 새지 않게 해요.

> **시작 전에 메모리를 점검해요.** 기기를 부팅하기 전에 호스트 여유 메모리와 메모리 압박 수준을 기록해요. 기준 미만이면 부팅하지 않고, 해당 케이스를 사유("호스트 메모리 부족")와 함께 `INCONCLUSIVE`로 남겨요. 기준 값은 단계 B에서 측정해 정해요.

> **로컬에서는 앱을 빌드하지 않는 경로를 기본으로 해요.** 로컬 ①은 이미 설치된 개발 빌드와 내 worktree의 Metro를 사용해요. ②와 CI는 빌드 job이 만든 artifact를 테스트 job이 설치해요. WebDriverAgent도 미리 빌드한 것을 재사용해요.

> **메모리를 비용 지표로 측정해요.** run마다 시뮬레이터·에뮬레이터·Metro·Appium·빌드 프로세스의 최대 RSS와 시작·종료 시점의 여유 메모리를 메타데이터에 기록해요. 10장 운영 비용 지표에 "최대 메모리"를 추가해요.

### 수용 실험 추가 제안

| 실험 | 판정 기준 제안 |
| --- | --- |
| 개발 Mac에서 다른 worktree의 Metro 2개와 iOS 시뮬레이터 1개가 떠 있는 상태로 로컬 profile 실행 | 메모리 압박이 critical에 도달하지 않아야 해요. 실행 후 Retina가 시작한 프로세스는 잔존 0개여야 해요. 다른 Metro·기기는 그대로 유지해요 |
| 메모리 기준 미만 상태로 실행 | 기기를 부팅하지 않고 `INCONCLUSIVE`(호스트 메모리 부족)로 표시해요. 거짓 `PASS`는 0건이어야 해요 |
| CI runner에서 Android 실행 | 에뮬레이터 RAM·heap 설정과 최대 RSS를 기록해요. OOM·ANR이 나면 `INCONCLUSIVE` 사유로 남겨요 |
| 강제 종료 후 재실행 | 이전 run의 시뮬레이터·Appium·WDA·Metro 잔존 프로세스를 감지해 정리하거나 소유권이 불명확하면 정리하지 않고 경고해요 |

### 재사용 후보

SkinSeoulFront의 `apps/mobile-e2e`(webdriverio 기반 Appium 시나리오 스위트, 2026-08-27 로컬 7/7)에는 실측 사고에서 나온 하네스 방어 5건이 있어요. 다른 worktree Metro 자동 접속, 로드 중 재접속에 따른 SIGABRT, 키보드 제출 시 WDA 종료, 제스처 흡수, 동시 세션 상호 파괴가 그 다섯 가지예요. 파일럿 프로젝트를 SkinSeoulFront로 정한다면 Retina 앱 어댑터는 이 하네스를 먼저 재사용할 수 있는지 검토해요.
