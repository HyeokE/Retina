# G-A3(Vitest 버전 호환성 실측) 결과 보고

- 작업 위치: `/tmp/retina-vitest-compat/` (`v3/`, `v5/`는 `common/`에서 복사한 동일 프로젝트). Retina 레포는 수정하지 않음(읽기만: `package.json`).
- 실행 환경: macOS (Darwin 27.0.0), Node `v22.19.0`, npm `10.9.3`. Bun 미사용.
- 로그: `logs/<label>.log`, 명령·종료 코드 원본: `commands.log`, 직렬 실행 매트릭스: `logs/serial-matrix.txt`.

## 1. 설치된 정확한 버전

| 패키지 | v3 | v5 |
|---|---|---|
| vitest | 3.2.7 (`3.2.x` 최신, dist-tag `V3`) | 5.0.5 (dist-tag `latest`) |
| vite (전이) | 7.3.7 | 8.3.5 |
| @vitest/runner, @vitest/expect | 3.2.7 (별도 패키지) | 없음 (vitest 안에 번들됨) |
| typescript | 7.0.2 (Retina와 동일) | 7.0.2 |
| @types/node | 22.20.5 | 22.20.5 |
| @types/chai (전이) | 5.2.3 | 5.2.3 |
| 보조 확인용 | typescript 5.9.3 (`ts59/`, v3 타입 이슈 재현용) | 동일 |

engines: vitest 3.2.7 `^18 || ^20 || >=22`, vitest 5.0.5 `^22.12.0 || ^24.0.0 || >=26.0.0`.

## 2. 항목별 결과

| # | 항목 | v3.2.7 | v5.0.5 |
|---|---|---|---|
| 1 | `projects` + `--project web` | 동작. 키 `test.projects`. `--project web`/`ios`/전체 모두 기대대로. 레거시 `test.workspace`도 동작하지만 `DEPRECATED` 경고, 타입은 통과 | 동작. 키 `test.projects`. `test.workspace`는 런타임 Startup Error(`was removed in Vitest 4`, exit 1) + tsc TS2769 |
| 2 | 프로젝트 단위 직렬 실행 | **프로젝트 config의 `fileParallelism: false`, `maxWorkers: 1`은 경고 없이 무시됨**(둘 다 넣어도 a/b 파일이 약 700ms 겹침, 2회 재현). 직렬이 되는 방법: 프로젝트에 `poolOptions: { forks: { singleFork: true } }`(같은 PID에서 순차), 또는 루트 `test`에 `fileParallelism:false`/`maxWorkers:1`, 또는 CLI `--no-file-parallelism`/`--maxWorkers=1`(루트·CLI는 전 프로젝트에 적용) | 프로젝트 config의 `fileParallelism: false` 단독, `maxWorkers: 1` 단독, 둘 다 모두 직렬로 동작, 경고 없음. 루트·CLI도 동작. `poolOptions`는 `DEPRECATED ... removed in Vitest 4` 경고 후 **무시**(겹침) |
| 3 | `retry: 0`, `testTimeout`, `hookTimeout` | 모두 수용, 경고 없음. 300ms 설정에서 `Test timed out in 300ms.`, `Hook timed out in 300ms.` 발생. 실패 테스트 실행 횟수: retry 0 → 1회, retry 2 → 3회 | 동일하게 수용·적용(1회/3회, 동일 메시지). 훅 타임아웃 파일의 테스트는 두 버전 모두 `skipped`로 집계 |
| 4 | `globalSetup` + `provide`/`inject` | 동작. `export default async function setup(project: TestProject)`에서 `project.provide('serverPort', port)`, 테스트에서 `inject('serverPort')`, teardown은 반환 함수. 타입은 `declare module 'vitest' { interface ProvidedContext { serverPort: number } }`(알 수 없는 키는 거부됨). 종료 후 해당 포트 LISTEN 없음(`lsof` exit 1), globalSetup 프로세스 PID 종료(`kill -0` exit 1). `--project ios`만 돌리면 web의 globalSetup은 실행 안 됨 | 동일 API·동일 결과 |
| 5 | `task.meta` → 커스텀 리포터 | 테스트에서 `({ task }) => { task.meta.retina = {...} }`. 리포터에서 읽힘: `onTestCaseResult(testCase)` → `testCase.meta().retina`, `onTestModuleEnd(module)`, `onTestRunEnd(modules, errors, reason)`(→ `m.children.allTests()`의 `.meta()`), 레거시 `onTaskUpdate(packs)`(`pack[2].retina`), 레거시 `onFinished(files)`(`file.tasks[].meta`) 모두 값 확인 | `onTestCaseResult`, `onTestModuleEnd`, `onTestRunEnd`는 v3와 동일하게 동작. **`onFinished`는 호출되지 않음**(Reporter 타입에도 없음). `onTaskUpdate`는 런타임에 호출됐지만 Reporter 타입에 선언이 없음(비공식 취급 권장) |
| 6 | `expect.extend` + TS 타입 | 런타임 동작. 타입 인터페이스: `Matchers<T = any>`, `Assertion<T = any>`. 소스(.ts) 보강 기준 통과: `interface Assertion<T = any> extends M<T>` + `AsymmetricMatchersContaining`(A), `interface Matchers<T = any> extends M<T>`(B). v5 형식(C)은 TS2428 | 런타임 동작. 타입: `Matchers<R extends void \| Promise<void> = void \| Promise<void>, T = unknown>`, `Assertion<R, T>`. 통과하는 건 C 형식만(`interface Matchers<R extends void \| Promise<void> = void \| Promise<void>, T = unknown> extends M<R>`). A·B는 TS2428 |
| 7 | 0개 파일 매칭 시 종료 코드 | 필터 불일치·빈 include 모두 기본 **exit 1**(`No test files found, exiting with code 1`), `--passWithNoTests`는 **exit 0**. 존재하지 않는 `--project nope`는 Startup Error exit 1 | 동일(1 / 0 / 1). 메시지 문구만 다름 |

### 6번 보충: 타입 보강을 패키지(.d.ts)로 배포했을 때

Retina가 헬퍼 패키지의 `.d.ts`에 보강을 넣어 배포하는 상황을 가짜 패키지(`node_modules/probe-matchers-*`)로 재현함.

| 시나리오 | v3.2.7 | v5.0.5 |
|---|---|---|
| matcher B 형식 `.d.ts`, `skipLibCheck: true` | 통과 | 통과 |
| matcher C 형식 `.d.ts`, `skipLibCheck: true` | 통과 | 통과 |
| (두 경우 모두) 인자 초과·없는 matcher는 `@ts-expect-error`로 거부 확인 → `any`가 아니라 실제로 타입이 붙음 | 확인 | 확인 |
| B 형식, `skipLibCheck: false` | 실패(아래 chai 이슈) | 실패 TS2428 |
| C 형식, `skipLibCheck: false` | 실패 TS2428 + chai 이슈 | 통과 |
| TaskMeta를 `declare module 'vitest'`로 보강 | **import 순서에 의존**: 보강 파일이 `vitest`보다 먼저 로드되면(`import type {} from './meta'`를 먼저 쓰거나 패키지로 배포) `retina does not exist on TaskMeta`. TS 7.0.2와 5.9.3 모두 재현. vitest가 `TaskMeta`를 `@vitest/runner`에서 re-export하기 때문으로 추정(추론) | 순서와 무관하게 동작 |
| TaskMeta를 `declare module '@vitest/runner'`로 보강 | 순서와 무관하게 동작 | TS2664(`module '@vitest/runner' cannot be found`) — 패키지가 없음 |
| v3 + TS 7.0.2, `skipLibCheck: false` | vitest 자체 타입과 `@types/chai` 5.2.3이 충돌(`Duplicate identifier 'containSubset'`). TS 5.9.3에서는 이 충돌 없음 | 해당 없음 |

## 3. 두 버전을 함께 지원하는 헬퍼에 필요한 코드 차이

1. **직렬 실행(가장 위험)**: v3에서 프로젝트 레벨 `fileParallelism`/`maxWorkers`는 경고 없이 무시돼 병렬로 돈다. 헬퍼는 버전 분기가 필요하다. 분기 기준으로 `import { version } from 'vitest/node'`이 두 버전 모두 동작한다(`3.2.7`/`5.0.5` 확인).
   - v5: `{ fileParallelism: false, maxWorkers: 1 }`
   - v3: `{ poolOptions: { forks: { singleFork: true } } }`(v3 기본 pool이 forks인 상태에서 검증함. `pool: 'threads'`를 명시한 경우는 미검증)
   - v5에 `poolOptions`를 넘기면 경고만 내고 무시하므로, 둘을 같이 넣는 방식으로는 대체할 수 없다.
2. **TaskMeta 타입**: 하나의 선언으로 두 버전을 모두 만족시킬 수 없다(v3는 `'@vitest/runner'`, v5는 `'vitest'`). 권장 shim: 배포 타입에 보강을 넣지 말고 `setRetinaMeta(task, value)` / `getRetinaMeta(testCase)` 같은 헬퍼 안에서 `task.meta`를 캐스팅해 쓴다. 대안은 버전별 타입 엔트리를 두 개 배포하는 것이다.
3. **Matcher 타입**: `.d.ts`에 v5 형식(C)을 배포하면 v5는 `skipLibCheck` 값과 무관하게 통과하고, v3는 `skipLibCheck: true`일 때 통과한다(TS7 + v3 조합은 chai 충돌 때문에 어차피 `skipLibCheck: true`가 필요). v3에서 C 형식의 반환 타입은 수신값 타입으로 매핑된다(일반적인 문장형 사용에서는 문제 없음, 체이닝은 미검증).
4. **리포터**: 공통 API만 사용한다. `onTestCaseResult(testCase)` + `testCase.meta()`, `onTestModuleEnd`, `onTestRunEnd(testModules, unhandledErrors, reason)`. `onFinished`(v5에서 미호출), `onTaskUpdate`(v5 타입에 없음)는 쓰지 않는다.
5. **config 키**: `test.projects`만 사용한다(`workspace`는 v5에서 Startup Error).
6. **기본 exclude 차이**: v3는 `dist`, `cypress`, 각종 `*.config.*` 등을 기본 제외하지만 v5는 `**/node_modules/**`, `**/.git/**`만 제외한다. 헬퍼 프로젝트 config에 `exclude`를 명시해야 버전 간 동작이 같아진다.
7. **내부 패키지 import 금지**: v5에는 `@vitest/runner`, `@vitest/expect`가 별도 패키지로 없다. 타입·런타임 모두 `vitest` 또는 `vitest/node`에서만 가져와야 한다.
8. **Node 하한**: v5는 Node `^22.12 || ^24 || >=26`이 필요하다(Retina engines `>=22.18.0`과는 맞음).

## 4. peerDependency 범위 권장

**권장: `"vitest": "^5.0.0"` (5 전용).** 엄격하게 실측 범위만 쓰려면 `^5.0.5`. 5.0.0~5.0.4는 실측하지 않았다.

이유:
- v3에서 가장 중요한 보장(프로젝트 단위 직렬 실행)이 Retina가 쓰는 옵션 이름으로는 **경고 없이 깨진다**. shim으로 해결할 수는 있지만, 소비자가 헬퍼를 거치지 않고 옵션을 직접 쓰면 조용히 병렬로 돈다.
- TaskMeta 타입 보강은 두 버전을 동시에 만족시키는 단일 선언이 없고, v3 쪽은 import 순서에 따라 깨진다.
- 파일럿 소비자도 Vitest 5로 이동할 계획이고, Retina 자체가 5.0.5를 쓴다.
- `>=3.2 <6`은 쓰지 않는 게 좋다. **Vitest 4.x는 전혀 실측하지 않았다.**

파일럿 소비자가 마이그레이션 전에 써야 한다면 차선책은 `"^3.2.0 || ^5.0.0"`(4.x 제외)이다. 이 경우 필요한 adapter shim은 다음과 같다.
- (a) 버전 분기 직렬 설정 헬퍼(`version` 기준으로 `singleFork` 또는 `fileParallelism`/`maxWorkers`)
- (b) TaskMeta 접근을 헬퍼 함수로 감싸고 배포 타입에서 보강 제거
- (c) matcher는 C 형식 `.d.ts`로 배포하고 v3 소비자에게 `skipLibCheck: true` 안내
- (d) `exclude` 명시
- (e) 리포터는 공통 훅만 사용
- 3.2.0~3.2.6은 실측하지 않았다(3.2.7만 실측).

## 5. 검증하지 못한 것(unverified)

- Vitest 4.x 전체, 3.2.0~3.2.6, 5.0.0~5.0.4
- v3에서 `pool: 'threads'` + `poolOptions.threads.singleThread`, v3 `maxWorkers`를 프로젝트에 둔 상태에서 `pool` 변경
- 루트 레벨 직렬 설정이 프로젝트 사이(web↔ios)까지 직렬화하는지
- watch 모드, browser 모드, coverage
- v3 TaskMeta 순서 의존성의 정확한 원인(re-export 보강 제약이라는 건 추정)
- TS 5.9.3은 일부 v3 시나리오에서만 실행함(TaskMeta 순서 이슈, chai 충돌 여부, B 형식 소스 보강 통과)
- Linux/CI 환경(모든 실측은 macOS 로컬)

## 6. 실행한 명령과 종료 코드

`run.sh <label> <dir> <cmd...>`는 `set -o pipefail` 하에서 `(cd <dir> && <cmd>)`를 실행하고, 출력은 `logs/<label>.log`, 종료 코드는 `commands.log`에 남긴다. 아래는 `commands.log` 원문이다(경로 기준: `/tmp/retina-vitest-compat`).

```
v3-install	(cd v3 && npm install --save-dev --save-exact --no-audit --no-fund vitest@3.2.7 typescript@7.0.2 @types/node@22.20.5)	exit=0
v5-install	(cd v5 && npm install --save-dev --save-exact --no-audit --no-fund vitest@5.0.5 typescript@7.0.2 @types/node@22.20.5)	exit=0
v3-tsc-none	(cd v3 && npx tsc --noEmit -p tsconfig.none.json)	exit=1
v3-tsc-A-vitest	(cd v3 && npx tsc --noEmit -p tsconfig.A-vitest.json)	exit=0
v3-tsc-B-vitest	(cd v3 && npx tsc --noEmit -p tsconfig.B-vitest.json)	exit=0
v3-tsc-C-vitest	(cd v3 && npx tsc --noEmit -p tsconfig.C-vitest.json)	exit=1
v3-tsc-A-runner	(cd v3 && npx tsc --noEmit -p tsconfig.A-runner.json)	exit=0
v3-tsc-B-runner	(cd v3 && npx tsc --noEmit -p tsconfig.B-runner.json)	exit=0
v3-tsc-C-runner	(cd v3 && npx tsc --noEmit -p tsconfig.C-runner.json)	exit=1
v3-tsc-workspace-key	(cd v3 && npx tsc --noEmit -p tsconfig.workspace-key.json)	exit=0
v5-tsc-none	(cd v5 && npx tsc --noEmit -p tsconfig.none.json)	exit=1
v5-tsc-A-vitest	(cd v5 && npx tsc --noEmit -p tsconfig.A-vitest.json)	exit=1
v5-tsc-B-vitest	(cd v5 && npx tsc --noEmit -p tsconfig.B-vitest.json)	exit=1
v5-tsc-C-vitest	(cd v5 && npx tsc --noEmit -p tsconfig.C-vitest.json)	exit=0
v5-tsc-A-runner	(cd v5 && npx tsc --noEmit -p tsconfig.A-runner.json)	exit=1
v5-tsc-B-runner	(cd v5 && npx tsc --noEmit -p tsconfig.B-runner.json)	exit=1
v5-tsc-C-runner	(cd v5 && npx tsc --noEmit -p tsconfig.C-runner.json)	exit=1
v5-tsc-workspace-key	(cd v5 && npx tsc --noEmit -p tsconfig.workspace-key.json)	exit=0
v3-tsc-workspace-key-noignore	(cd v3 && npx tsc --noEmit -p tsconfig.workspace-key.json)	exit=0
v5-tsc-workspace-key-noignore	(cd v5 && npx tsc --noEmit -p tsconfig.workspace-key.json)	exit=1
v3-run-web-both	(cd v3 && env SERIAL_MODE=both npx vitest run --project web)	exit=0
post-check	(v3) lsof -nP -iTCP:60016 -sTCP:LISTEN ; kill -0 45036	see report
v5-run-web-both	(cd v5 && env SERIAL_MODE=both npx vitest run --project web)	exit=0
post-check	(v5) lsof -nP -iTCP:60018 -sTCP:LISTEN ; kill -0 45138	see report
v3-serial-none	(cd v3 && env SERIAL_MODE=none npx vitest run --project web serial)	exit=0
v3-serial-fileParallelism	(cd v3 && env SERIAL_MODE=fileParallelism npx vitest run --project web serial)	exit=0
v3-serial-maxWorkers	(cd v3 && env SERIAL_MODE=maxWorkers npx vitest run --project web serial)	exit=0
v3-serial-both	(cd v3 && env SERIAL_MODE=both npx vitest run --project web serial)	exit=0
v3-serial-both-repeat	(cd v3 && env SERIAL_MODE=both npx vitest run --project web serial)	exit=0
v3-serial-root-both	(cd v3 && env SERIAL_MODE=both ROOT_SERIAL=1 npx vitest run --project web serial)	exit=0
v3-serial-singleFork	(cd v3 && env SERIAL_MODE=none SINGLE_FORK=1 npx vitest run --project web serial)	exit=0
v3-serial-cli-no-file-parallelism	(cd v3 && env SERIAL_MODE=none npx vitest run --project web serial --no-file-parallelism)	exit=0
v3-serial-cli-maxWorkers1	(cd v3 && env SERIAL_MODE=none npx vitest run --project web serial --maxWorkers=1)	exit=0
v5-serial-none	(cd v5 && env SERIAL_MODE=none npx vitest run --project web serial)	exit=0
v5-serial-fileParallelism	(cd v5 && env SERIAL_MODE=fileParallelism npx vitest run --project web serial)	exit=0
v5-serial-maxWorkers	(cd v5 && env SERIAL_MODE=maxWorkers npx vitest run --project web serial)	exit=0
v5-serial-both	(cd v5 && env SERIAL_MODE=both npx vitest run --project web serial)	exit=0
v5-serial-both-repeat	(cd v5 && env SERIAL_MODE=both npx vitest run --project web serial)	exit=0
v5-serial-root-both	(cd v5 && env SERIAL_MODE=both ROOT_SERIAL=1 npx vitest run --project web serial)	exit=0
v5-serial-singleFork	(cd v5 && env SERIAL_MODE=none SINGLE_FORK=1 npx vitest run --project web serial)	exit=0
v5-serial-cli-no-file-parallelism	(cd v5 && env SERIAL_MODE=none npx vitest run --project web serial --no-file-parallelism)	exit=0
v5-serial-cli-maxWorkers1	(cd v5 && env SERIAL_MODE=none npx vitest run --project web serial --maxWorkers=1)	exit=0
v3-timeouts-retry0	(cd v3 && env RETRY=0 npx vitest run --config vitest.timeouts.config.ts)	exit=1
v3-timeouts-retry2	(cd v3 && env RETRY=2 npx vitest run --config vitest.timeouts.config.ts)	exit=1
v5-timeouts-retry0	(cd v5 && env RETRY=0 npx vitest run --config vitest.timeouts.config.ts)	exit=1
v5-timeouts-retry2	(cd v5 && env RETRY=2 npx vitest run --config vitest.timeouts.config.ts)	exit=1
v3-run-all	(cd v3 && npx vitest run)	exit=0
v3-run-ios	(cd v3 && npx vitest run --project ios)	exit=0
v3-run-workspace-key	(cd v3 && npx vitest run --config vitest.workspace-key.config.ts --project web)	exit=0
v3-nomatch-filter	(cd v3 && npx vitest run --project web zzz_nomatch)	exit=1
v3-nomatch-filter-pass	(cd v3 && npx vitest run --project web zzz_nomatch --passWithNoTests)	exit=0
v3-nomatch-empty	(cd v3 && npx vitest run --config vitest.empty.config.ts)	exit=1
v3-nomatch-empty-pass	(cd v3 && npx vitest run --config vitest.empty.config.ts --passWithNoTests)	exit=0
v3-unknown-project	(cd v3 && npx vitest run --project nope)	exit=1
v5-run-all	(cd v5 && npx vitest run)	exit=0
v5-run-ios	(cd v5 && npx vitest run --project ios)	exit=0
v5-run-workspace-key	(cd v5 && npx vitest run --config vitest.workspace-key.config.ts --project web)	exit=1
v5-nomatch-filter	(cd v5 && npx vitest run --project web zzz_nomatch)	exit=1
v5-nomatch-filter-pass	(cd v5 && npx vitest run --project web zzz_nomatch --passWithNoTests)	exit=0
v5-nomatch-empty	(cd v5 && npx vitest run --config vitest.empty.config.ts)	exit=1
v5-nomatch-empty-pass	(cd v5 && npx vitest run --config vitest.empty.config.ts --passWithNoTests)	exit=0
v5-unknown-project	(cd v5 && npx vitest run --project nope)	exit=1
v3-run-ios-globalsetup-check	(cd v3 && npx vitest run --project ios)	exit=0
v5-run-ios-globalsetup-check	(cd v5 && npx vitest run --project ios)	exit=0
v3-tsc-shipped-B-skipLibCheck-true	(cd v3/probe && npx tsc --noEmit -p tsconfig.B-slc-true.json)	exit=1
v3-tsc-shipped-B-skipLibCheck-false	(cd v3/probe && npx tsc --noEmit -p tsconfig.B-slc-false.json)	exit=1
v3-tsc-shipped-C-skipLibCheck-true	(cd v3/probe && npx tsc --noEmit -p tsconfig.C-slc-true.json)	exit=1
v3-tsc-shipped-C-skipLibCheck-false	(cd v3/probe && npx tsc --noEmit -p tsconfig.C-slc-false.json)	exit=1
v5-tsc-shipped-B-skipLibCheck-true	(cd v5/probe && npx tsc --noEmit -p tsconfig.B-slc-true.json)	exit=0
v5-tsc-shipped-B-skipLibCheck-false	(cd v5/probe && npx tsc --noEmit -p tsconfig.B-slc-false.json)	exit=1
v5-tsc-shipped-C-skipLibCheck-true	(cd v5/probe && npx tsc --noEmit -p tsconfig.C-slc-true.json)	exit=0
v5-tsc-shipped-C-skipLibCheck-false	(cd v5/probe && npx tsc --noEmit -p tsconfig.C-slc-false.json)	exit=0
v3-tsc-local-copy-of-shipped	(cd v3/probe && npx tsc --noEmit -p tsconfig.local.json)	exit=1
v3-tsc-dbg1	(cd v3 && npx tsc --noEmit -p tsconfig.dbg1.json)	exit=0
v3-tsc-dbg2	(cd v3 && npx tsc --noEmit -p tsconfig.dbg2.json)	exit=1
v3-tsc-dbg3	(cd v3 && npx tsc --noEmit -p tsconfig.dbg3.json)	exit=0
v3-tsc-dbg4	(cd v3 && npx tsc --noEmit -p tsconfig.dbg4.json)	exit=0
v3-tsc-dbg5	(cd v3/probe && npx tsc --noEmit -p tsconfig.dbg5.json)	exit=1
v3-tsc-dbg6	(cd v3/probe && npx tsc --noEmit -p tsconfig.dbg6.json)	exit=0
v3-tsc-dbg7	(cd v3/probe && npx tsc --noEmit -p tsconfig.dbg7.json)	exit=0
v3-tsc-dbg8	(cd v3/probe && npx tsc --noEmit -p tsconfig.dbg8.json)	exit=0
ts59-install	(cd ts59 && npm install --save-exact --no-audit --no-fund typescript@5.9.3)	exit=0
v3-tsc59-dbg5	(cd v3/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.dbg5.json)	exit=2
v3-tsc59-dbg8	(cd v3/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.dbg8.json)	exit=0
v3-tsc59-shipped-B-skipLibCheck-true	(cd v3/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.B-slc-true.json)	exit=2
v5-tsc59-shipped-B-skipLibCheck-true	(cd v5/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.B-slc-true.json)	exit=0
v3-tsc59-shipped-C-skipLibCheck-true	(cd v3/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.C-slc-true.json)	exit=2
v5-tsc59-shipped-C-skipLibCheck-true	(cd v5/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.C-slc-true.json)	exit=0
v3-tsc-dbg9	(cd v3/probe && npx tsc --noEmit -p tsconfig.dbg9.json)	exit=0
v3-tsc-shipped-matchers-only-B	(cd v3/probe && npx tsc --noEmit -p tsconfig.only-B.json)	exit=0
v3-tsc-shipped-matchers-only-C	(cd v3/probe && npx tsc --noEmit -p tsconfig.only-C.json)	exit=0
v5-tsc-shipped-matchers-only-B	(cd v5/probe && npx tsc --noEmit -p tsconfig.only-B.json)	exit=0
v5-tsc-shipped-matchers-only-C	(cd v5/probe && npx tsc --noEmit -p tsconfig.only-C.json)	exit=0
v3-tsc-provided-import-first	(cd v3/probe && npx tsc --noEmit -p tsconfig.provided.json)	exit=0
v5-tsc-provided-import-first	(cd v5/probe && npx tsc --noEmit -p tsconfig.provided.json)	exit=0
post-check	pgrep -fl retina-vitest-compat (no leftover processes)	exit=1
v3-tsc59-shipped-B-skipLibCheck-false	(cd v3/probe && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.B-slc-false.json)	exit=2
v3-tsc59-none	(cd v3 && /tmp/retina-vitest-compat/ts59/node_modules/.bin/tsc --noEmit -p tsconfig.B-vitest.json)	exit=0
```

참고: 라벨 `v3-tsc59-none`은 실제로는 `tsconfig.B-vitest.json`을 TS 5.9.3으로 실행한 것이다(라벨 오기, exit 0).

`run.sh`를 거치지 않은 명령:

| 명령 | 종료 코드 |
|---|---|
| `node -v; npm -v; ...; ls /tmp/retina-vitest-compat` | 1 (디렉터리가 아직 없어서 `ls`가 실패. 정상) |
| `npm view vitest@3.2 version`, `npm view vitest@5.0.5 version`, `npm view vitest dist-tags` | 0 |
| `npm view typescript dist-tags`, `npm view @types/node@22 version`, `npm view vitest@5.0.5 engines peerDependencies`, `npm view vitest@3.2.7 engines`, `npm view typescript@5.9 version` | 0 |
| `lsof -nP -iTCP:60016 -sTCP:LISTEN` (v3 서버 포트, 실행 후) | 1 (LISTEN 없음) |
| `kill -0 45036` (v3 globalSetup PID, 실행 후) | 1 (프로세스 없음) |
| `lsof -nP -iTCP:60018 -sTCP:LISTEN` (v5) | 1 (LISTEN 없음) |
| `kill -0 45138` (v5) | 1 (프로세스 없음) |
| `node overlap.mjs <v>/artifacts/serial-log.jsonl` (직렬 실행 18회마다) | 개별 exit 미기록, 18회 모두 JSON 출력 정상 |
| `node --input-type=module -e "import('vitest/node')..."` (v3, v5) | 0 (`3.2.7`, `5.0.5` 출력) |
| `pgrep -fl retina-vitest-compat` (마지막 잔여 프로세스 확인) | 1 (잔여 프로세스 없음) |
| 그 밖의 `grep`/`sed`/`awk`/`cat`/`ls`로 `node_modules` 타입 정의와 로그 확인 | 읽기 전용. 일부는 마지막 grep이 0건이라 exit 1 |
| 파일 생성용 heredoc/`cp`/`sed -i` (temp 디렉터리 안에서만) | 0. 첫 tsconfig 생성은 zsh 단어 분리 때문에 파일명이 잘못 만들어져 bash로 다시 생성함 |

kill 명령은 쓰지 않았다(`kill -0`은 존재 여부 확인용). 시작한 프로세스는 모두 vitest foreground 실행이며 스스로 종료됐다.

## 부록: 직렬 실행 매트릭스 원본 (`logs/serial-matrix.txt`)

```text
v3 none exit=0 {"overlap":true,"gapMs":-701,"pids":[48824,48823],"pools":["2","1"]} WARN:[]
v3 fileParallelism exit=0 {"overlap":true,"gapMs":-697,"pids":[48907,48908],"pools":["1","2"]} WARN:[]
v3 maxWorkers exit=0 {"overlap":true,"gapMs":-700,"pids":[49067,49066],"pools":["2","1"]} WARN:[]
v3 both exit=0 {"overlap":true,"gapMs":-701,"pids":[49172,49171],"pools":["2","1"]} WARN:[]
v3 both-repeat exit=0 {"overlap":true,"gapMs":-701,"pids":[49279,49278],"pools":["2","1"]} WARN:[]
v3 root-both exit=0 {"overlap":false,"gapMs":187,"pids":[49373,49387],"pools":["1","1"]} WARN:[]
v3 singleFork exit=0 {"overlap":false,"gapMs":42,"pids":[49445,49445],"pools":["1","1"]} WARN:[]
v3 cli-no-file-parallelism exit=0 {"overlap":false,"gapMs":197,"pids":[49577,49590],"pools":["1","1"]} WARN:[]
v3 cli-maxWorkers1 exit=0 {"overlap":false,"gapMs":214,"pids":[49663,49677],"pools":["1","1"]} WARN:[]
v5 none exit=0 {"overlap":true,"gapMs":-702,"pids":[50025,50024],"pools":["2","1"]} WARN:[]
v5 fileParallelism exit=0 {"overlap":false,"gapMs":200,"pids":[50093,50114],"pools":["1","1"]} WARN:[]
v5 maxWorkers exit=0 {"overlap":false,"gapMs":98,"pids":[50183,50202],"pools":["1","1"]} WARN:[]
v5 both exit=0 {"overlap":false,"gapMs":110,"pids":[50259,50271],"pools":["1","1"]} WARN:[]
v5 both-repeat exit=0 {"overlap":false,"gapMs":143,"pids":[50335,50349],"pools":["1","1"]} WARN:[]
v5 root-both exit=0 {"overlap":false,"gapMs":92,"pids":[50430,50451],"pools":["1","1"]} WARN:[]
v5 singleFork exit=0 {"overlap":true,"gapMs":-701,"pids":[50523,50524],"pools":["1","2"]} WARN:[ DEPRECATED  `test.poolOptions` was removed in Vitest 4. All previous `poolOptions` are now top-level options. Please, refer to the migration guide: https://v4.vitest.dev/guide/migration#pool-rework  DEPRECATED  `test.poolOptions` was removed in Vitest 4. All previous `poolOptions` are now top-level options. Please, refer to the migration guide: https://v4.vitest.dev/guide/migration#pool-rework ]
v5 cli-no-file-parallelism exit=0 {"overlap":false,"gapMs":135,"pids":[50582,50603],"pools":["1","1"]} WARN:[]
v5 cli-maxWorkers1 exit=0 {"overlap":false,"gapMs":97,"pids":[50906,50949],"pools":["1","1"]} WARN:[]
```
