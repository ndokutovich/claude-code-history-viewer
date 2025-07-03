# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg" alt="Version 1.0.0-beta.3" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6.1%20+%20React%2019.1.0-blue.svg" alt="Built with Tauri 2.6.1 and React 19.1.0" />
  <img src="https://img.shields.io/badge/Platform-macOS-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Languages-Multi--lingual-blueviolet.svg" alt="Multi-lingual UI" />
</p>

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

`~/.claude` 디렉토리에 저장된 Claude Code 대화 기록을 탐색하고 분석할 수 있는 데스크톱 애플리케이션입니다.

> ⚠️ **베타 알림**: 이 애플리케이션은 현재 베타 단계입니다. 기능과 API가 변경될 수 있습니다.

## 기능

### 핵심 기능

- 📁 **프로젝트 및 세션 탐색** - 모든 Claude Code 프로젝트와 대화 세션을 탐색
- 🎨 **구문 강조** - react-syntax-highlighter를 사용하여 코드 블록을 아름답게 강조 표시
- 🌲 **트리 뷰 탐색** - 확장 가능한 트리 구조로 직관적인 프로젝트/세션 계층 구조
- ⚡ **빠른 성능** - 효율적인 파일 파싱과 검색을 위한 Rust 백엔드
- 🖥️ **macOS 네이티브** - macOS용 Tauri로 구축된 최적화된 데스크톱 애플리케이션

### 분석 및 통계

- 📊 **종합 분석 대시보드** - 상호작용 차트가 포함된 상세한 사용량 분석 보기
- 📈 **토큰 사용량 통계** - 프로젝트 및 세션별 토큰 사용량을 성장률과 함께 추적
- 🔥 **활동 히트맵** - 시간에 따른 상호작용 패턴 시각화
- 📊 **세션 비교** - 다양한 세션 간 메트릭 비교
- 📉 **도구 사용량 분석** - 가장 자주 사용되는 도구 확인

### 고급 기능

- 🔄 **자동 업데이트 시스템** - 우선순위 레벨(중요, 권장, 선택)에 따른 자동 업데이트 확인
- 💭 **Thinking 콘텐츠 표시** - Claude의 추론 과정을 포맷된 블록으로 보기
- 📃 **효율적인 메시지 로딩** - 페이지네이션으로 대용량 대화 기록 처리
- 🔄 **세션 새로고침** - 재시작 없이 세션을 새로고침하여 새 메시지 확인
- 📝 **세션 요약** - 빠른 세션 개요를 위한 AI 생성 요약

### 콘텐츠 렌더링

- 🖼️ **이미지 지원** - 대화에 포함된 이미지 보기
- 📝 **향상된 Diff 뷰어** - 개선된 라인별 파일 변경 비교
- 🚀 **풍부한 도구 결과** - 다양한 도구 출력의 아름다운 렌더링 (웹 검색, git 워크플로우, 터미널 스트림 등)

## 설치

### 미리 빌드된 바이너리 다운로드

[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases) 페이지를 방문하여 플랫폼에 맞는 최신 버전을 다운로드하세요.

### 소스에서 빌드

#### 필수 조건

- [Node.js](https://nodejs.org/) (v18 이상)
- [pnpm](https://pnpm.io/) 패키지 매니저 (v8+)
- [Rust](https://www.rust-lang.org/) 툴체인 (최신 안정 버전)
- **macOS**: Xcode Command Line Tools

#### 빌드

```bash
# 저장소 클론
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer

# 의존성 설치
pnpm install

# 개발 모드에서 실행
pnpm tauri:dev

# 프로덕션용 빌드
pnpm tauri:build
```

빌드된 애플리케이션은 `src-tauri/target/release/bundle/`에 있습니다.

## 사용법

1. 애플리케이션 실행
2. 앱이 자동으로 `~/.claude` 디렉토리에서 대화 기록을 스캔합니다
3. 왼쪽 사이드바를 사용하여 프로젝트와 세션을 탐색합니다
4. 세션을 클릭하여 메시지를 확인합니다
5. 분석 대시보드를 보고 사용 패턴을 이해합니다
6. 자동 업데이트 시스템을 통해 업데이트를 확인합니다

## 기여

기여를 환영합니다! Pull Request를 제출해 주세요.

## Claude 디렉토리 구조

앱은 다음에서 대화 데이터를 읽습니다:

```text
~/.claude/
├── projects/          # 프로젝트별 대화 데이터
│   └── [project-name]/
│       └── *.jsonl    # 대화 메시지가 포함된 JSONL 파일
├── ide/              # IDE 관련 데이터
├── statsig/          # 통계/분석 데이터
└── todos/            # 할 일 목록 데이터
```

## 문제 해결

### 일반적인 문제

**앱이 Claude 데이터를 찾을 수 없는 경우**

- Claude Code가 설치되어 있고 대화 기록이 있는지 확인하세요
- `~/.claude` 디렉토리가 존재하고 프로젝트 데이터가 포함되어 있는지 확인하세요

**대용량 기록으로 인한 성능 문제**

- 앱은 긴 메시지 목록에 가상화를 사용합니다
- 성능이 저하되면 오래된 대화를 아카이브하는 것을 고려하세요

## 개인정보 보호

이 애플리케이션은 완전히 로컬에서 실행되며 외부 서버로 데이터를 전송하지 않습니다. 모든 대화 데이터는 사용자의 컴퓨터에 남아있습니다.

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기술 스택

- [Tauri](https://tauri.app/) + React + TypeScript로 구축
- UI: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## 지원

문제가 발생하면 자세한 정보와 함께 [이슈를 생성](https://github.com/jhlee0409/claude-code-history-viewer/issues)해 주세요.

---
