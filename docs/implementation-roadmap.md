# 구현 순서와 수용 실험

작성일은 2026-10-25이고 직접 읽은 저장소 기준은 `7f4fd84`예요. 이후 `5bb4054`와 probe 실행의 진행 보고는 아래에서 별도로 구분해요. 이 문서는 [검증 계획서](visual-regression-skill-plan.md) 19~23장의 G/P 작업을 실행 가능한 묶음으로 정리한 계획이에요. 새 기능이나 완료 판정을 추가하지 않아요.
결과 형식·집계·종료 코드의 세부 계약은 [구현 계약](implementation-contracts.md)을 함께 참고해요. 아래 변경 경로와 증거 경로는 구현할 위치를 제안한 것이며, 이미 존재하거나 실행됐다는 뜻은 아니에요.

## 기준 시점의 구현 상태

| 확인 시점·기준 | 확인한 범위 | 아직 확인하지 않은 범위 |
| --- | --- | --- |
| 2026-10-25 · `7f4fd84` | G-A2의 수동 `runner-probe.yml`이 추가됐어요 | workflow 추가만으로 runner나 앱 실행을 확인한 것은 아니에요 |
| 2026-10-25 · `5bb4054` 이후 작업 보고 | Claude가 probe 실행 `40168837659`·`40168945929`를 보고했어요 | 이 문서 작성자는 로그·artifact를 아직 검증하지 않았어요. 보고된 probe 결과 확인과 실제 앱 기동 검증은 별도예요 |
| 2026-10-25 · `655288c` | 예제의 격리·URL 처리·표식 검사를 보강했고 예제 테스트 44개 통과 기록이 있어요. 루트 테스트의 `--passWithNoTests`도 제거됐어요 | 이 결과는 G-B1 코어, 어댑터, 실제 기기, CI 검증의 통과가 아니에요 |
| 2026-10-25 · `a954a13` 소스 확인 | G-B1의 판정·픽셀 비교 코어가 커밋됐고 종료 코드 우선순위가 반영됐어요 | 이 문서 작성 중 코어 테스트를 재실행하지 않았어요. CLI·CI 연결의 완료 증거도 아니에요 |

후속 상태는 구현 커밋과 실행 증거를 함께 적어요. 테스트 파일이 생긴 것, 테스트가 통과한 것, 배포 패키지를 소비한 것, CI에서 실행한 것을 서로 다른 확인 결과로 남겨요.

## 작업 순서와 병렬 실행

첫 묶음은 코어 계약을 고정하고, 두 번째 묶음은 웹 흐름 하나를 끝까지 연결해요. 세 번째 묶음은 네이티브와 Figma·디자인 데이터 비교를 각각 검증한 뒤 연결해요. 웹 성공만으로 ①의 Figma 디자인 비교나 네이티브 지원을 완료했다고 표시하지 않아요.

| 시작 구간 | 주 작업 | 같은 시점에 진행할 독립 작업 |
| --- | --- | --- |
| 단계 A와 첫 묶음 시작 | G-A3, G-B1·B2·B6·B8·B11 | G-A2 runner 확인, G-B10 네이티브 mock spike, G-B9 Figma 가져오기 smoke를 시작해요 |
| 코어 입력·결과 계약 확보 | 두 번째 묶음의 G-B3·B7·C1·C2·C3 | 세 번째 묶음의 iOS·Android 세션·표식·메모리·폭 정렬을 검증해요 |
| 플랫폼별 촬영·데이터 주입 증거 확보 | G-C6·C7·C8·C9 통합 | G-C4·C5 승인 계약 테스트와 검토자 준비를 진행해요 |
| 승인 경로와 필수 환경 확보 | 단계 D 반복·결함·운영 비용 평가 | 파일럿 P-D1과 범용 예제 결과를 나눠 수집해요 |

G-B10은 코어 완성 전에도 예제 앱·mock 서버로 연결 가능성을 확인할 수 있어요. 웹 리포트가 끝날 때까지 네이티브 runner나 HTTP 접근 문제를 미루지 않아요. 세션·runner·기기 자원은 서로 간섭하지 않게 배정해요.

## 시작 전 결정과 입력

아래 번호는 검증 계획서 23.2의 번호예요. 권장값을 사용자 결정으로 승격하지 않고, 미결정이면 해당 작업의 제한 범위를 기록해요.

| 미결정 항목 | 시작 조건이 필요한 작업 | 미결정 상태의 진행 범위 |
| --- | --- | --- |
| #5 Vitest 지원 범위 | 첫 묶음 G-A3·B2 | 3.2.x·5의 호환표부터 만들어요. 결과 없이 peerDependency 지원 범위를 확정하지 않아요 |
| #8 이름·scope, #8b emit 전략 | 첫 묶음 G-B11, G-A4 | 게시 이름은 정하지 않고 로컬 tarball로 소비를 검증해요. emit은 Node 소비 산출물을 만들기 전에 정해요 |
| #11 workflow 접근, #12 secret 전달, #23 neutral check | 두 번째 묶음 G-B7·C1 | 고정 SHA의 접근·권한을 시험해요. neutral 선택 전에도 정보용 job과 validate gate는 분리해요 |
| #3 네이티브 CI 빈도, #4 메모리, #25 SDK·RN 범위 | 세 번째 묶음 G-B4·B5·C6 | 수동 probe·측정은 먼저 해요. 측정 전 임계값이나 모든 PR 실행 정책을 확정하지 않아요 |
| #18 Figma 권한, #20 매핑 확인 주체, #22 예제 프레임 | G-B9·C7·C8 | 가져오기·예제 디자인 비교에 필요한 참조를 확보해요. 파일럿 프레임으로 범용 예제 성공을 대신하지 않아요 |
| #19 데이터 주입, #17 노드 매칭, #21 backend 시딩 | G-B10·C8 | mock 연결 결과로 선택을 돕되 권장 경로를 확정하지 않아요. 미정 기능을 구현 범위에 몰래 넣지 않아요 |
| #14 검토자, #10 baseline 저장소, #16 디자인 임계값 | G-C4·C5와 단계 D | 검토자·승인 대상을 먼저 연결해요. 임계값이 없으면 `REVIEW_REQUIRED`를 유지해요 |

파일럿 계정·요구사항·격리는 P-A1~P-A6와 #1·#2·#13·#15·#24로 준비해요. Retina 코어·workflow에는 소비 프로젝트의 이름·경로·계정을 넣지 않고 config와 provider로 전달해요.

## 묶음 1: 코어·설정·Node 소비 경로

대상은 G-A3, G-B1·B2·B6·B8·B11이에요. 선행조건은 결과·검사 종류·필수 목록의 계약 초안과 #5·#8b의 검증 방식이에요. G-B1의 커밋과 시험 기록을 먼저 확인하고 같은 파일을 중복 구현하지 않아요.

| 항목 | 실행 계획 |
| --- | --- |
| 변경 파일 범위 | `packages/retina/src/{cli,config,domain/verdict,domain/compare,domain/run}`와 PNG 입출력을 맡는 infrastructure 코드·테스트, 패키지 manifest·emit 설정, 범용성 검사 스크립트를 다뤄요 |
| 구조 제한 | `cli → domain → infrastructure` 호출 방향을 지켜요. domain에는 프레임워크 import를 넣지 않고 배포 코드에는 Bun 전용 API를 넣지 않아요 |
| 산출물 | 결과 모델·상태 집계·원시 RGBA 비교와 차이 영역 계산, infrastructure의 PNG 처리, 최소 provider/config 로더, 종료 코드, Vitest 호환표, npm 설치용 tarball과 소비 기록을 남겨요 |
| 수용 테스트 | 상태 4종의 병합·순서 독립성, 필수 결과 누락, 테스트 0개, 원시 RGBA 동일·차이·크기 불일치, provider·환경 변수 누락을 검사해요. PNG 디코딩·파일 입출력은 infrastructure 테스트로 분리해요 |
| 배포 경로 확인 | 깨끗한 디렉터리에서 Bun 없이 Node `>=22.18.0`·npm으로 tarball을 설치해 CLI와 provider 로딩을 실행해요. workspace hoisting 없는 의존성 해석을 확인해요 |
| 증거 | 설치·실행 로그, Node/npm 버전, tarball 해시·파일 목록, JSON 결과, 종료 코드, 금지어·Bun API 검사 결과를 남겨요 |
| 중단 조건 | 실행 결과 없이 타입 검사만 통과하거나 hoisting이 없으면 로딩이 깨지면 다음 묶음의 통합 완료를 선언하지 않아요 |

G-B1의 `domain/compare`는 원시 RGBA를 비교하고 차이 영역을 계산해요. PNG 디코딩과 파일 입출력은 infrastructure가 맡아요. 단위 테스트 통과는 화면의 정확성 증명이 아니며, 실제 촬영의 재현성은 다음 묶음과 단계 D에서 확인해요.
루트 테스트의 `--passWithNoTests` 제거는 `655288c`에서 완료됐으므로 다시 구현하지 않아요. G-B6에서는 CLI에 빈 테스트 입력을 전달했을 때 비정상 종료하는지를 확인해요. npm 게시 이름이 정해지지 않아도 G-B11의 tarball 실험은 진행해요.
G-A3은 Vitest 3.2.x·5에서 `projects`, `task.meta`, `fileParallelism`, `maxWorkers`를 같은 최소 예제로 시험해요. G-B8은 `packages/`·`actions/`·`.github/`·`skills/`의 소비 프로젝트 이름·경로·환경 변수·URL·계정 잔존이 0건인지 확인해요.

## 묶음 2: 웹 흐름·CI·오프라인 리포트

대상은 G-B3·B7·C1·C2·C3이에요. 선행조건은 첫 묶음의 최소 실행 경로와 도메인 중립 예제의 초기화·준비 신호·빌드 식별이에요. 현재 예제의 표식 게이트와 SPA fallback은 커밋 기준으로 다시 확인하고 이미 된 작업을 반복 구현하지 않아요.

| 항목 | 실행 계획 |
| --- | --- |
| 변경 파일 범위 | `packages/adapter-web`, `packages/retina/src/infrastructure/{storage,report}`, `examples/web`의 config·시나리오, `actions/`, `.github/workflows/`를 다뤄요 |
| 산출물 | 폼 편집·저장·재진입의 한 흐름, 촬영 지점 3개, local·CI 결과, `result.json`, `report.html`과 상대 경로 이미지 묶음을 남겨요 |
| ① 수용 테스트 | merge-base와 head의 CSS 차이를 정보용 실행에서 검출하고 `REVIEW_REQUIRED`로 표시해요. 이것만으로 Figma 디자인 비교 완료를 선언하지 않아요 |
| ② 수용 테스트 | 저장 무효화·잘못된 값 유지·오류 응답 무시를 하나씩 주입해 해당 기능 assertion이 `FAIL`인지 확인해요 |
| 실행·리포트 테스트 | 캐시 없는 CI에서 A/A 3회를 확인하고 artifact를 내려받아 네트워크 없이 열어요. JSON과 HTML의 건수·상태·누락 사유와 이미지 링크가 일치해야 해요 |
| gate 테스트 | dev 종료 코드 `3`이 validate 결과를 바꾸지 않아야 해요. #23의 neutral 표시를 시험해도 dev의 원래 상태·종료 코드를 성공으로 바꾸지 않아요 |
| 증거 | 각 run의 commit·빌드·환경, 초기화 로그, PNG 3장, expected/actual/diff, HTML 오프라인 확인 기록, CI job별 결과를 남겨요 |
| 중단 조건 | 로딩 화면을 기준으로 통과하거나 수동 초기화가 필요하거나 HTML이 외부 요청 없이는 열리지 않으면 완료를 보류해요 |

웹 단독 실행은 웹 선택 실행으로 보고해요. CI job 취소·artifact 업로드 실패·리포트 생성 실패는 누락 원인을 남기고 전체 성공으로 숨기지 않아요.
파일럿 연결은 P-B1·B2·B8, P-C2와 이어져요. 예제와 파일럿의 fixture·기준·계정은 섞지 않고 mock 결과를 테스트 backend 통합 결과로 승격하지 않아요.

## 묶음 3: 네이티브·Figma·디자인 데이터

대상은 G-B4·B5·B9·B10·B12·C6·C7·C8·C9예요. 최종 통합은 앞 묶음의 계약을 사용하지만, runner·mock·Figma 가져오기 실험은 첫 묶음과 함께 시작해요. 플랫폼과 디자인 비교의 실패 원인을 독립적으로 기록해요.

| 검증 축 | 선행조건·변경 파일 범위 | 산출물·수용 테스트·중단 조건 |
| --- | --- | --- |
| iOS | G-A2 결과, Simulator artifact·UDID가 필요해요. `packages/adapter-native/src/{shared,ios}`와 예제 소비 설정을 다뤄요 | UDID 미지정·중복 세션을 거부하고 testID·ready 표식 노출을 확인해요. 소유 프로세스 잔존이 있거나 다른 기기로 이동하면 중단해요 |
| Android | 가속 가능한 runner와 APK, 메모리 측정이 필요해요. `packages/adapter-native/src/{shared,android}`를 다뤄요 | mock 응답 표시, 표식 조회, 메모리 가드, OOM·ANR 기록을 확인해요. 가드 실패나 다른 기기 간섭이 있으면 중단해요 |
| mock 데이터 주입 | G-B10·P-B7에서 base URL·호스트 주소·HTTP 허용 조건을 확인해요. `infrastructure/mock-server`와 소비 provider를 다뤄요 | 두 플랫폼에서 합성 값이 보이고 mock 요청 로그가 맞아야 해요. release의 평문 HTTP 차단도 기록하고 실패를 임의의 운영 API로 우회하지 않아요 |
| Figma 참조 | #18·#22의 접근 가능한 참조가 필요해요. `infrastructure/figma`를 다뤄요 | PNG·노드 트리·버전과 캐시 key를 기록해요. rate limit·가져오기 실패는 원인을 남기고 토큰이 결과에 남으면 중단해요 |
| 디자인 데이터 | #20의 매핑 확인과 schema 훅이 필요해요. `domain/design-data`, 웹·네이티브 데이터 provider와 예제 fixture를 다뤄요 | 인벤토리→매핑 확인→fixture→schema→콘텐츠 검사 순서를 확인해요. 틀린 값은 픽셀 비교보다 먼저 드러나고 schema 위반은 미완료여야 해요 |
| 폭 정렬·디자인 비교 | G-B12의 pt·dp 폭과 참조 버전이 필요해요. `domain/compare`, 플랫폼 정렬, `infrastructure/report`를 다뤄요 | 일치율·마스크 비율·`transforms`·차이 목록을 표시해요. 조용한 리샘플링이나 임계값 없는 자동 통과는 허용하지 않아요 |
| 범용 예제·리포트 열기 | `examples/expo`와 소비 설정, CLI·`report.open` 연결을 다뤄요 | Retina 코드 변경 없이 같은 generic path로 실행해요. 로컬 설정대로 열리고 CI에서는 열리지 않아야 해요 |

G-C6에서 코어 변경이 필요하면 원인을 범용 결함과 파일럿 특화 침투로 구분해요. 후자라면 범용성 수용 기준을 통과한 것이 아니에요. SDK·RN 조합별 결과도 #25에 연결해요.
증거에는 기기 UDID·OS·빌드·bundle·폭·밀도, 세션 잠금, 시작·종료 프로세스, 최대 RSS, mock 로그, Figma 버전, 매핑 확인, 콘텐츠 결과와 이미지를 포함해요. 비밀 값은 넣지 않아요.
파일럿 작업은 P-B3~P-B7·P-B9와 P-C1·C5·C6이에요. 소비 프로젝트 변경은 해당 저장소에서 맡고 Retina 범용 경로에 파일럿 설정을 복사하지 않아요.

## 승인 경로와 반복 평가

G-C4·C5는 `review.json`·원본 run·정책·이미지 해시를 연결해요. 해시 불일치는 exit `2`, 미승인은 `3`, 승인 후 새 run의 필수 검사 통과는 `0`인지 시험해요. 승인 뒤 이미지가 바뀌면 다시 `3`이어야 해요.
변경 범위는 `domain/review`, 검토 저장·CLI, 승인 확인 workflow와 시험 PR이에요. P-C3의 소비 측 CODEOWNERS와 연결하고, 에이전트가 사용자 수락을 대신 생성하지 않아요. 원본 자동 결과는 보존해요.
승인 조회 권한·검토자·해시 연결이 없으면 CI 검사와 사후 검토를 별도 결과로 제공하고 통합 gate 완료는 보류해요. 로컬 ① 수락은 `gateEligible: false`이며 ② 승인으로 재사용하지 않아요.

단계 D는 G-D1과 P-D1을 연결해 profile별 동일 빌드 30회를 최소 3개 새 runner 실행에 나눠 확인해요. 4개 profile·촬영 지점 3개라면 기본 현재 이미지가 360장이에요. 최초 실패·재시도·추가 촬영도 따로 남겨요.
정렬·노이즈 측정으로 #16 임계값을 제안하고 실제 사용자 결정 전에는 기본값을 확정하지 않아요. 30회 성공은 제품 품질 보장이 아니라 그 조건에서의 관측 결과예요.
P-C4의 강제 종료·초기화, 계정 격리, 잔존 프로세스, 로컬 메모리 부하도 반복 평가에 포함해요. 불안정·비용 기준을 넘으면 단계 E의 필수 gate 도입과 환경 확대를 보류해요.

## 수용 실험과 증거 경로

아래 `E-*`는 G/P를 대체하는 작업 번호가 아니라 이 문서의 실험 식별자예요. 경로 기준은 구현 계약과 같은 `.retina/runs/<runId>/attempt-<n>/experiments/`예요. 실행 manifest에 실험 ID·관련 G/P·profile·빌드·정책 해시를 연결해요.
E-01~E-20의 실제 결과는 아직 미실행이에요. 각 `E-*/evidence.json`에는 `command`, `expected`, `actual`, `commit` 필드를 남겨요. 실행 전 `actual`은 `not-run`으로 표시하고, 실행 후 관찰한 상태·종료 코드·산출물 경로를 기록해요. 명령의 비밀 값은 제거하고 기대 결과를 실제 결과로 복사하지 않아요.
상태 집계 순서는 `FAIL > INCONCLUSIVE > REVIEW_REQUIRED > PASS`예요. 종료 코드는 별도로 계산하며 실행 오류 flag가 있으면 `2`를 우선하는 계약을 제안해요. 오류가 없으면 `FAIL`은 `1`, 미완료·검토 필요만 있으면 `3`, 모두 통과면 `0`이에요.
따라서 결함과 실행 오류가 섞인 경우 상태 `FAIL`과 exit `2`가 함께 나올 수 있어요. 아래 예상 결과는 해당 결함만 주입했을 때 기준이며, 세부 분류는 구현 계약에서 맞춰요.

| ID | 관련 G/P | fixture·주입 결함 | profile | 예상 상태 / exit | 증거 경로 |
| --- | --- | --- | --- | --- | --- |
| E-01 | G-B1·B6 | 순서가 다른 상태 4종과 실행 오류 혼합 | core | `FAIL` / `2` | `E-01/aggregate.json`, `exit.txt` |
| E-02 | G-B1·B6 | 테스트 0개 입력 | core | `INCONCLUSIVE` / `2` | `E-02/result.json`, `exit.txt` |
| E-03 | G-B2 | provider 또는 필수 환경 변수 누락 | core | `INCONCLUSIVE` / `2` | `E-03/result.json`, `redacted.log` |
| E-04 | G-A3·B11 | Bun·workspace 의존성이 없는 tarball 소비 | node-npm | `PASS` / `0` | `E-04/install.log`, `versions.json`, `tarball.sha256` |
| E-05 | G-B3 | 같은 빌드 A/A 3회·production 표식 검사 | web | `PASS` / `0` | `E-05/repeat.json`, `images/`, `marker-check.log` |
| E-06 | G-C1·B7 | merge-base 대비 CSS 변경 | web-dev | `REVIEW_REQUIRED` / `3` | `E-06/result.json`, `diff.png`, `jobs.json` |
| E-07 | G-C2 / P-C2 | 저장 무효화·잘못된 값 유지·오류 무시 각각 | web-validate | `FAIL` / `1` | `E-07/assertions.json`, `requests.log` |
| E-08 | G-C3 | 외부 네트워크 차단 후 HTML 열기 | report | 정상은 `PASS` / `0` | `E-08/offline-check.md`, `report.html`, `assets/` |
| E-09 | G-B7·C3 | 필수 job 취소·이미지 누락·HTML 생성 오류 각각 | ci-report | `INCONCLUSIVE` / `2` | `E-09/result.json`, `missing.json`, `logs/` |
| E-10 | G-B4 | UDID 미지정·세션 중복 요청 각각 | ios | `INCONCLUSIVE` / `2` | `E-10/session.log`, `devices.json`, `processes.json` |
| E-11 | G-B5 / P-B6 | 메모리 기준을 현재 여유보다 높게 설정 | android | `INCONCLUSIVE` / `3` | `E-11/memory.json`, `adb-before.txt`, `adb-after.txt` |
| E-12 | G-B10 / P-B7 | 합성 mock 값·release HTTP 접근 조건 | ios·android | 연결 성공 `PASS` / `0`, 준비 실패 `INCONCLUSIVE` / `2` | `E-12/mock.log`, `screen.png`, `build.json` |
| E-13 | G-B12 | 프레임 폭과 맞출 수 없는 기기 설정 | native-design | `INCONCLUSIVE` / `3` 또는 낮은 신뢰·검토 필요 / `3` | `E-13/transforms.json`, `fingerprint.json` |
| E-14 | G-B9·C7 | Figma 버전 변경·참조 가져오기 오류 각각 | design | 오래된 fixture `INCONCLUSIVE` / `3`, API 실행 오류는 `2` | `E-14/versions.json`, `result.json`, `redacted.log` |
| E-15 | G-C7·G-D1 | 간격·색·누락·무관 프레임, 임계값 미설정 | design | `REVIEW_REQUIRED` / `3`; 명시 규칙 위반은 `FAIL` / `1` | `E-15/result.json`, `diff.png`, `transforms.json` |
| E-16 | G-C8 / P-C5 | 틀린 fixture 값·schema 위반 각각 | design-data | 콘텐츠 불일치 `REVIEW_REQUIRED` / `3`, 명시한 기능 assertion 위반은 `FAIL` / `1`, schema 미완료 `INCONCLUSIVE` / `3` | `E-16/content.json`, `schema.json`, `events.json` |
| E-17 | G-C6·B8 | 승인 baseline·필수 정책을 준비하고 필수 목록을 고정한 두 번째 예제 | expo-generic | `PASS` / `0` | `E-17/result.json`, `changed-files.txt`, `neutral-check.log` |
| E-18 | G-C9 | 로컬 open 설정·CI open 금지 | local·ci | `PASS` / `0` | `E-18/open-events.json`, `ui-check.md` |
| E-19 | G-C4·C5 / P-C3 | 해시 불일치·미승인·승인·승인 뒤 변경 | review | 순서대로 거부 / `2`, 검토 필요 / `3`, 통과 / `0`, 검토 필요 / `3` | `E-19/review.json`, `approval.json`, `runs.json` |
| E-20 | G-D1 / P-D1 | 같은 빌드 30회·3개 이상 새 runner | 각 필수 profile | 정상은 전부 `PASS` / `0` | `E-20/repeats.json`, `first-failures/`, `timings.json` |

E-17의 `0`은 위 선행조건과 필수 검사 전체를 충족한 경우예요. 최초 baseline이 없으면 `REVIEW_REQUIRED` / `3`을 기록하고 bootstrap 단계로 분리해요. `0`을 만들기 위해 필수 검사를 제외하지 않아요.
E-09와 G-B6은 실제 Vitest assertion 실패 → CLI `1`, hook·test timeout → 실행 오류 `2`가 CI artifact와 `finalize`까지 전달되는지도 확인해요. 가짜 집계 결과만으로 이 연결을 완료 처리하지 않아요.

증거 업로드가 실패하면 로컬 로그가 있다는 이유로 CI 증거 확보를 완료 처리하지 않아요. Figma 토큰·빌드 자격 증명 검사는 G-B9와 P-B9에서 실제 결과물 전체를 대상으로 수행하고 값은 기록하지 않아요.

## 시간 상한과 측정 경계

단계 B는 최대 5개발일, 단계 C는 추가 최대 10개발일이라는 기존 상한을 유지해요. 세 묶음과 범용·파일럿 작업의 합계에 적용하며, 병렬 작업마다 상한을 새로 부여하지 않아요. 기간이 지나면 막힌 조건·증거·다음 선택을 기록하고 자동 연장하지 않아요.
자동 검사 목표는 준비된 빌드에서 ① 단일 profile 2분 이내, ② 최소 행렬 15분 이내예요. 측정 시작·종료는 준비 완료부터 검사·판정 산출까지로 기록하고, 빌드·설치·다운로드·기기 준비·runner 대기는 별도 구간으로 남겨요.
디자인 fixture 생성·매핑 확인과 AI·사람 검토도 자동 검사 시간에 합쳐 숨기지 않고 따로 재요. 전체 elapsed는 요청부터 필수 산출물 업로드·정리 종료까지 측정하고, 이후 검토 대기·승인 후 재실행 시간도 별도 연결해요.
CI의 빌드 30분·테스트 20분 상한은 제안값이에요. profile별 p50·p95, cold/warm, 최초 실패율, 최대 RSS, Figma 호출 수, fixture·baseline·매핑 유지 시간을 함께 기록해요.

## 다음 착수 작업 3개

1. G-A2의 최신 probe 실행 `40168837659`·`40168945929`와 `5bb4054`의 로그·artifact를 검토해 보고된 결과를 확인해요. 이어서 실제 앱 기동과 G-B10의 iOS·Android mock 응답 표시를 시험하고 runner·빌드·HTTP 차단 조건을 기록해요.
2. G-B1의 `a954a13`과 결과 계약을 맞춘 뒤 E-01~E-04를 구현해요. G-A3 호환표와 #8b emit 선택을 연결해 Bun 없는 Node·npm tarball 소비까지 확인해요.
3. `examples/web`의 한 흐름에 필요한 config·provider·촬영 지점을 작성해 G-B3·B7·C1~C3를 연결해요. 동시에 #18·#20·#22 입력을 확보해 G-B9를 시작하고, Figma 준비가 늦으면 그 축만 미완료로 남겨요.
