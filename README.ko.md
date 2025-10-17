# Claude Code History Viewer

Claude Code의 대화 기록(`~/.claude`)을 보기 편하게 탐색할 수 있는 크로스 플랫폼 데스크톱 앱입니다.

![Version](https://img.shields.io/badge/Version-1.1.3-blue.svg)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **베타 소프트웨어** - 불안정하거나 변경될 수 있습니다. 문제 발견 시 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)에 보고해주세요.

## 왜 만들었나

Claude Code는 대화 기록을 `~/.claude/projects/` 폴더에 JSONL 파일로 저장합니다. 이 파일들은 읽기 어렵고 검색도 불편해서, 제대로 된 인터페이스로 대화를 확인하고 사용량 통계도 볼 수 있는 앱을 만들었습니다.

## 스크린샷 및 데모

### 메인 인터페이스

프로젝트 탐색과 대화 내용 확인 - 코드 블록 구문 강조 포함

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### 사용량 분석 대시보드

활동 히트맵과 도구 사용 통계로 사용 패턴 파악

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### 상세 토큰 통계

프로젝트별 토큰 사용량과 세션 상세 분석

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### 데모

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## v1.1.3의 새로운 기능

**🔍 전체 검색 기능**:
- Cmd/Ctrl+F 단축키로 강력한 전체 텍스트 검색
- 인용구를 사용한 정확한 구문 검색 지원
- 검색 결과 강조 표시 및 메시지로 바로 이동
- 세션별로 그룹화된 검색 결과와 확장 가능한 미리보기

**🌍 크로스 플랫폼 지원**:
- macOS(유니버셜 바이너리), Windows, Linux에서 실행
- 플랫폼별 설치 프로그램(.dmg, .exe, .msi, .deb, .AppImage, .rpm)
- 다중 패키지 매니저 지원(npm, pnpm, yarn, bun)

**🌏 완전한 다국어 지원**:
- 6개 언어: 영어, 한국어, 일본어, 중국어(간체), 중국어(번체), 러시아어
- 시스템 로케일에서 자동 언어 감지
- 전체 UI 번역 완료

**🎨 향상된 UI/UX**:
- 개선된 라이트/다크 모드와 더 나은 메시지 버블 스타일링
- X 버튼과 ESC 키로 선택 해제
- 개선된 세션 제목 표시
- 통합 뷰 상태 아키텍처

**🔧 개발자 경험**:
- Playwright를 사용한 포괄적인 E2E 테스트 스위트
- GitHub Actions를 통한 자동화된 릴리스 워크플로우
- 향상된 문서화(CLAUDE.md 참조)
- 다중 플랫폼 빌드 스크립트

## 주요 기능

**대화 탐색**: 왼쪽에 트리 뷰, 오른쪽에 대화 내용이 표시됩니다. 라이트/다크 테마를 지원하는 깔끔하고 직관적인 인터페이스입니다.

**강력한 검색**: Cmd/Ctrl+F로 모든 대화를 검색할 수 있습니다. 인용구 지원, 매칭 하이라이트, 컨텍스트 내에서 메시지로 바로 이동 가능합니다. 검색 결과는 세션별로 그룹화되어 쉽게 탐색할 수 있습니다.

**사용량 분석**: 포괄적인 분석 대시보드 제공:
- 시간 경과에 따른 사용 패턴을 보여주는 활동 히트맵
- 프로젝트 및 세션별 토큰 사용 통계
- 도구 사용 분석 및 백분위수
- 세션 비교 지표

**보기 편한 인터페이스**:
- 다양한 테마의 구문 강조 코드 블록
- 적절하게 포맷된 diff 및 git 작업
- 접을 수 있는 섹션이 있는 읽기 쉬운 메시지 스레드
- 대용량 대화를 위한 가상 스크롤링으로 부드러운 성능

**도구 출력 시각화**: 전문화된 렌더러 제공:
- 구조화된 표시가 있는 웹 검색 결과
- Git 작업 및 워크플로우
- 스트리밍 지원 터미널 출력
- Diff 시각화가 있는 파일 편집
- 할 일 목록 변경 사항 및 업데이트

**크로스 플랫폼 및 다국어 지원**:
- macOS(유니버셜 바이너리), Windows, Linux에서 실행
- 6개 언어 완전 지원: 영어, 한국어, 일본어, 중국어(간체), 중국어(번체), 러시아어
- 자동 언어 감지

가상 스크롤링 및 페이지네이션으로 대용량 대화 기록을 효율적으로 처리하며, 안전한 자동 업데이트 시스템을 갖추고 있습니다.

## 설치

### 사전 빌드된 바이너리 다운로드

[Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases)에서 최신 버전을 받으세요.

**macOS**:
- `.dmg` 파일 다운로드
- 앱을 Applications 폴더로 드래그
- 유니버셜 바이너리는 Intel 및 Apple Silicon 모두 지원

**Windows**:
- `.exe` 설치 프로그램(NSIS) 또는 `.msi`(WiX) 다운로드
- 설치 프로그램 실행
- 필요 시 WebView2가 자동으로 설치됨

**Linux**:
- `.deb`(Debian/Ubuntu), `.AppImage`(범용), 또는 `.rpm`(Fedora/RHEL) 다운로드
- `.deb`: `sudo dpkg -i claude-code-history-viewer*.deb`
- `.AppImage`: `chmod +x *.AppImage && ./claude-code-history-viewer*.AppImage`
- `.rpm`: `sudo rpm -i claude-code-history-viewer*.rpm`

### 소스에서 빌드

**모든 플랫폼**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install  # 또는 npm install, yarn, bun
pnpm tauri:build  # 현재 플랫폼용 빌드
```

**플랫폼별 빌드**:
```bash
pnpm tauri:build:mac      # macOS 유니버셜 바이너리
pnpm tauri:build:windows  # Windows x86_64
pnpm tauri:build:linux    # Linux x86_64
```

**요구사항**:
- Node.js 18+
- 패키지 매니저: pnpm, npm, yarn, 또는 bun
- Rust 툴체인 (https://rustup.rs 에서 설치)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: WebKitGTK, 빌드 도구 및 기타 종속성(전체 목록은 CLAUDE.md 참조)
- **Windows**: WebView2 런타임(자동 설치)

## 사용법

### 기본 탐색
1. 앱 실행
2. `~/.claude`를 자동으로 스캔해서 대화 데이터를 찾습니다
3. 왼쪽 사이드바 트리에서 프로젝트 탐색
4. 세션을 클릭하면 메시지를 볼 수 있습니다
5. 상단 탭을 사용하여 다음 뷰 전환:
   - **Messages**: 전체 대화 읽기
   - **Analytics**: 활동 히트맵 및 패턴 보기
   - **Token Stats**: 토큰 사용량 분석

### 검색 기능
- **Cmd+F** (macOS) 또는 **Ctrl+F** (Windows/Linux)를 눌러 검색 열기
- 쿼리를 입력하고 Enter 누르기
- 정확한 구문에 따옴표 사용: `"에러 메시지"`
- 결과를 클릭하여 해당 메시지로 바로 이동
- 결과는 확장 가능한 미리보기가 있는 세션별로 그룹화됨

### 키보드 단축키
- **Cmd/Ctrl+F**: 검색 열기
- **ESC**: 선택 해제 또는 검색 닫기
- **세션 클릭**: 대화 로드
- **X 버튼**: 현재 선택 해제

### 테마 및 언어
- 테마는 자동으로 시스템 환경설정에 맞춰집니다(라이트/다크)
- 언어는 시스템 로케일에서 자동 감지됩니다
- 설정 메뉴(오른쪽 상단)에서 변경 가능

## 현재 제한사항

- **베타 소프트웨어** - 거친 부분과 가끔 버그가 있을 수 있습니다
- 대용량 대화 기록(10,000개 이상 메시지)은 초기 로딩에 시간이 걸릴 수 있습니다
- 읽기 전용 액세스 - 앱에서 대화를 편집하거나 삭제할 수 없습니다
- 아직 내보내기 기능이 없습니다(향후 릴리스 예정)

## 데이터 프라이버시

모든 처리가 로컬에서 이루어집니다. 서버로 데이터를 전송하지 않으며, `~/.claude` 디렉토리만 읽습니다.

## Claude 디렉토리 구조

다음 구조를 예상합니다:

```
~/.claude/
├── projects/          # 프로젝트 대화
│   └── [project-name]/
│       └── *.jsonl    # 대화 파일
├── ide/              # IDE 데이터
├── statsig/          # 분석 데이터
└── todos/            # 할 일 목록
```

## 문제 해결

**"Claude 데이터를 찾을 수 없음"**:
- Claude Code를 최소 한 번 사용하여 대화 기록이 생성되었는지 확인하세요
- 홈 폴더에 `~/.claude` 디렉토리가 있는지 확인하세요
- **macOS/Linux**: `ls ~/.claude`
- **Windows**: `C:\Users\<사용자이름>\.claude` 확인

**성능 문제**:
- 대용량 세션(1,000개 이상 메시지)은 가상 스크롤링으로 부드러운 성능 제공
- 로딩이 느리게 느껴진다면 먼저 작은 세션을 선택해보세요
- 필요 시 메모리를 확보하기 위해 다른 앱을 종료하세요

**검색이 작동하지 않음**:
- 쿼리를 입력하고 Enter를 눌렀는지 확인하세요
- 정확한 일치를 위해 따옴표로 묶인 구문을 시도하세요: `"특정 오류"`
- 검색 중인 세션에 텍스트가 포함되어 있는지 확인하세요

**플랫폼별 문제**:
- **Windows**: 앱이 시작되지 않으면 WebView2가 설치되어 있는지 확인하세요(일반적으로 자동 설치됨)
- **Linux**: webkit 관련 오류가 표시되면 WebKitGTK를 설치하세요: `sudo apt install libwebkit2gtk-4.1-dev`
- **macOS**: 보안 경고가 표시되면 앱을 마우스 오른쪽 버튼으로 클릭하고 "열기" 선택

**업데이트 문제**: 자동 업데이트가 실패하면 [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases)에서 최신 버전을 수동으로 다운로드하세요.

## 기여

기여를 환영합니다! 도움을 줄 수 있는 방법:

**버그 리포트**:
- [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)에 이슈 열기
- OS, 앱 버전 및 재현 단계 포함
- 스크린샷이나 오류 메시지가 도움이 됩니다

**기능 요청**:
- 중복을 피하기 위해 먼저 기존 이슈 확인
- 사용 사례 및 예상 동작 설명
- 구현 가능하다면 PR 제출 고려

**Pull Request**:
- 저장소를 포크하고 기능 브랜치 생성
- 기존 코드 스타일 준수(ESLint 구성됨)
- 가능한 경우 새 기능에 대한 테스트 추가
- 새 기능을 추가하거나 아키텍처를 변경하는 경우 CLAUDE.md 업데이트
- 제출 전 플랫폼에서 테스트

**개발 환경 설정**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:dev  # 핫 리로드가 있는 개발 서버 시작
```

자세한 아키텍처 문서, 개발 명령 및 구현 참고 사항은 [CLAUDE.md](CLAUDE.md)를 참조하세요.

**기여자**:
이 프로젝트에 기여해주신 모든 분들께 감사드립니다! 특별히 감사드립니다:
- 원래 컨셉 및 초기 개발
- 검색 UI 구현 및 개선
- E2E 테스팅 인프라
- 다중 플랫폼 지원 및 다국어 지원
- 그리고 모든 버그 리포터 및 기능 요청자

## 기술 스택

**코어**:
- **Tauri v2** - Rust 백엔드가 있는 경량 네이티브 셸(2-10MB 크기)
- **React 19** - 후크 및 함수형 컴포넌트가 있는 모던 프론트엔드
- **TypeScript** - 타입 안전 개발

**UI 및 스타일링**:
- **Tailwind CSS v4** - Claude 브랜드 색상이 있는 유틸리티 우선 스타일링
- **Radix UI** - 접근 가능하고 스타일이 없는 컴포넌트 프리미티브
- **Lucide React** - 아름다운 아이콘 라이브러리
- **Prism** - 코드 블록 구문 강조

**상태 및 데이터**:
- **Zustand** - 경량 상태 관리
- **i18next** - 6개 언어로 국제화
- **@tanstack/react-virtual** - 성능을 위한 가상 스크롤링

**빌드 및 도구**:
- **Vite** - 빠른 빌드 도구 및 개발 서버
- **Vitest** - 단위 테스팅 프레임워크
- **Playwright** - Tauri 앱을 위한 E2E 테스팅
- **ESLint** - 코드 린팅 및 품질

**플랫폼 기능**:
- **Tauri 플러그인**: Store, Dialog, Updater, OS, Process, HTTP
- **GitHub Actions** - 자동화된 다중 플랫폼 빌드 및 릴리스

## 라이선스

MIT 라이선스 - [LICENSE](LICENSE) 파일 참조.

---

**질문이나 문제 있으시면?** 설정과 어떤 문제가 발생했는지 자세히 적어서 [이슈를 등록](https://github.com/ndokutovich/claude-code-history-viewer/issues)해주세요.
