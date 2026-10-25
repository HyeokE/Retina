# 저장소 구조

현재는 폴더와 역할만 정한 단계예요. 빈 폴더는 `.gitkeep`으로 Git에 남겨요. 실행 코드, 설치 가능한 `SKILL.md`, 패키지 설정, Vitest 설정과 CI workflow는 아직 없어요.

처음에는 단일 패키지로 시작해요. 두 검증 모드와 플랫폼별 실행 코드는 구분하되, 별도 배포 패키지나 공통 어댑터 인터페이스는 실제 구현에서 필요를 확인한 뒤 정해요.

```text
retina/
├── README.md
├── AGENTS.md
├── skills/
│   └── retina/
├── src/
│   ├── cli/
│   ├── modes/
│   │   ├── visual-check/
│   │   └── project-validation/
│   ├── platforms/
│   │   ├── web/
│   │   ├── ios/
│   │   └── android/
│   ├── comparison/
│   ├── results/
│   └── report/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── examples/
│   └── pilot/
├── ci/
└── docs/
    └── assets/
```

## 폴더별 역할

| 경로 | 역할 |
| --- | --- |
| `skills/retina/` | 에이전트가 두 검증 모드를 선택하고 실행 결과를 해석하는 스킬 지침을 둬요. 실행 엔진을 이곳에 복제하지 않아요. |
| `src/cli/` | 로컬과 CI에서 사용할 명령 진입점, 입력 처리와 종료 코드 처리를 둬요. |
| `src/modes/visual-check/` | 개발 중 선택한 화면·상태를 시각적으로 검증하는 실행 흐름을 둬요. |
| `src/modes/project-validation/` | 고정 빌드에서 등록된 필수 시나리오·환경을 검증하는 실행 흐름을 둬요. |
| `src/platforms/web/` | 웹 실행 환경의 준비·조작·촬영·정리 코드를 둬요. |
| `src/platforms/ios/` | iOS Simulator의 앱 설치·조작·촬영·정리 코드를 둬요. |
| `src/platforms/android/` | Android Emulator의 앱 설치·조작·촬영·정리 코드를 둬요. |
| `src/comparison/` | 기준 이미지와 후보 이미지의 비교 코드를 둬요. |
| `src/results/` | 검사 결과 형식, 필수 결과 집계, 판정과 JSON 저장 코드를 둬요. |
| `src/report/` | 집계된 결과로 정적 HTML과 필요한 리포트 자산을 생성하는 코드를 둬요. |
| `tests/unit/` | 비교·집계·리포트 생성 등 Retina 자체 코드의 Vitest 테스트를 둬요. |
| `tests/integration/` | Retina의 모드·플랫폼 실행·결과 저장을 연결해 확인하는 테스트를 둬요. |
| `tests/fixtures/` | Retina 자체 테스트에서 쓸 고정 이미지·결과 데이터·최소 입력을 둬요. |
| `examples/pilot/` | 첫 대상 프로젝트에 적용할 검증 시나리오·설정 예제를 둬요. 대상 프로젝트는 아직 미정이에요. |
| `ci/` | CI 환경 준비와 실행·산출물 수집을 돕는 코드를 둬요. 공급자별 workflow 위치는 CI 공급자를 정한 뒤 추가해요. |
| `docs/` | 설계, 구현 계획, 실험 절차와 작업 기록을 둬요. `assets/`에는 문서용 이미지를 둬요. |

## 결과 파일과 기준 이미지

실행 중 생성하는 `result.json`, `report.html`, 이미지와 로그는 저장소 루트의 `artifacts/` 아래에 모을 예정이에요. `artifacts/`는 Git에서 제외하고 CI에서는 실행 결과 파일 묶음으로 보관해요. 지금은 생성 코드와 출력 폴더를 만들지 않아요.

승인된 기준 이미지는 실행 결과와 수명이 달라요. 대상 프로젝트의 기준 이미지·정책은 해당 프로젝트에서 관리하고, Retina 자체 테스트용 고정 이미지만 `tests/fixtures/`에 둬요. 기준 승인과 버전 관리 조건은 [검증 계획서](visual-regression-skill-plan.md)의 기준 이미지 절을 따라요.

## 구성 범위

두 검증 모드는 플랫폼 실행 코드와 비교·집계·리포트 코드를 함께 사용하도록 구성할 예정이에요. `src/report/`는 판정을 새로 내리지 않고 `src/results/`가 집계한 결과를 표시해요. CI도 같은 실행 코드를 호출해요.

이번 구조에는 패키지 설치, 도구 버전 선정, 실행 가능한 테스트, CI 연결과 정적 HTML 구현을 포함하지 않아요. 기능 범위와 진행 조건은 [검증 계획서](visual-regression-skill-plan.md)에서 관리해요.
