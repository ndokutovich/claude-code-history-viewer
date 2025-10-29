# Claude Code History Viewer

Claude Code, Cursor IDE, Codex CLI, Gemini AI Studio의 대화 기록을 보기 편하게 탐색할 수 있는 크로스 플랫폼 데스크톱 앱입니다.

![Version](https://img.shields.io/github/v/release/ndokutovich/claude-code-history-viewer?label=Version&color=blue)
![Downloads](https://img.shields.io/github/downloads/ndokutovich/claude-code-history-viewer/total?label=Downloads&color=brightgreen)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **베타 소프트웨어** - 불안정하거나 변경될 수 있습니다. 문제 발견 시 [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)에 보고해주세요.

## 왜 만들었나

Claude Code, Cursor IDE, Codex CLI, Gemini AI Studio는 대화 기록을 다양한 형식(JSONL 파일, SQLite 데이터베이스)으로 저장합니다. 이 파일들은 읽기 어렵고 검색도 불편해서, 모든 AI 코딩 도우미의 대화를 한곳에서 확인하고, 사용량 통계를 보고, 세션을 재개할 수 있는 통합 인터페이스를 만들었습니다.

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

## v1.7.0의 새로운 기능

**🤖 다중 프로바이더 지원**:
- **Codex CLI 통합**: `~/.codex/sessions/`의 Codex 대화 기록 탐색 및 검색
- **Gemini AI Studio 지원**: `~/.gemini/conversations/`의 Gemini 대화 확인
- 4개의 AI 코딩 도우미를 위한 통합 인터페이스: Claude Code, Cursor IDE, Codex CLI, Gemini AI Studio
- 쉬운 식별을 위한 프로바이더 아이콘 및 배지
- 설치된 모든 AI 도구 자동 감지

**🔄 세션 재개**:
- 네이티브 도구(Claude Code, Cursor, Codex, Gemini)에서 직접 대화 재개
- 올바른 컨텍스트로 정확한 도구를 실행하는 프로바이더 인식 재개 명령
- 자동 작업 디렉토리 감지 및 복원
- Gemini의 `/chat resume` 워크플로우를 위한 대화형 명령 지원
- 모든 프로젝트에서 올바른 CWD로 세션 시작

**🔧 세션 관리 도구**:
- **세션 복구 유틸리티**: Claude Code에서 재개할 수 없는 문제 있는 세션 복구
- **메시지 범위 추출**: 특정 메시지 범위에서 새 세션 생성
- 재개 가능한 세션을 표시하는 세션 상태 지표
- 세션 복구 전 백업 생성

**📊 향상된 세션 정보**:
- 세션 헤더에 Git 브랜치 및 커밋 표시 (사용 가능한 경우)
- Claude가 작업 중이던 브랜치를 보여주는 리포지토리 컨텍스트
- 세션 메타데이터 및 도구 출력에서 git 정보 추출
- 브랜치(📍) 및 커밋(🔖) 아이콘이 있는 시각적 지표

**🔄 개선된 탐색**:
- 앱을 재시작하지 않고 세션 목록을 다시 로드하는 새로고침 버튼
- 새로고침 시 상태 보존 (확장된 프로젝트, 선택된 세션)
- 모든 프로바이더의 세션을 한 번에 새로고침하는 "모두 새로고침"
- 사용자 피드백을 위한 로딩 표시기 및 토스트 알림

---

## v1.6.0의 새로운 기능

**📁 파일 활동 추적**:
- 모든 프로젝트에서 Claude/Cursor AI 세션이 접근한 파일 탐색
- 작업 유형(읽기, 편집, 생성, 삭제), 파일 확장자, 날짜 범위로 필터링
- 히스토리의 특정 시점에서 파일 내용 스냅샷 확인
- 파일이 접근된 세션 및 메시지로 직접 이동
- 파일 뷰어 모달에서 "파일 열기" 및 "폴더 열기" 버튼으로 다운로드
- Claude Code와 Cursor IDE 양쪽의 파일을 보여주는 다중 소스 통합

**✍️ 세션 생성 및 프로젝트 관리**:
- 앱에서 직접 새로운 Claude Code 프로젝트 생성
- 사용자 정의 메시지와 컨텍스트로 새 대화 세션 시작
- 기존 세션에 프로그래밍 방식으로 메시지 추가
- 다중 소스 세션 쓰기를 지원하는 프로바이더 인식 아키텍처
- 메시지 작성기 및 컨텍스트 선택기가 있는 세션 빌더 UI

**📤 고급 내보내기 기능**:
- Markdown, HTML, DOCX 형식으로 대화 내보내기
- 구문 강조가 있는 포맷/원시 내보내기 모드
- HTML 내보내기에서 라이트/다크 테마 지원
- 내보내기에 파일 첨부 포함
- 전체 대화 내보내기를 위한 "모두 로드" 버튼 (페이지네이션 적용)
- bash 명령 히스토리 추출을 위한 명령 전용 내보내기 모드
- 내보내기 알림에 "파일 열기" 및 "폴더 열기" 버튼

**🔍 향상된 메시지 필터링 및 뷰**:
- 명령만 보기: bash 명령을 히스토리 로그로 추출
- 원시 메시지 뷰: 기본 JSONL 데이터 구조 표시
- Bash 전용 필터: 도구 사용 분석
- 메시지만 필터: 도구 출력 없이 텍스트 중심 읽기
- 도구 사용 필터: AI 작업 디버깅
- 선택 불가능한 줄 번호가 있는 명령 히스토리 뷰

**🔌 Cursor IDE 지원** (v1.5.0부터):
- Claude Code와 Cursor IDE를 모두 지원하는 다중 프로바이더 아키텍처
- Cursor의 SQLite 대화 데이터베이스 자동 감지
- 프로바이더 독립적인 데이터 처리를 위한 범용 메시지 형식
- Claude Code와 Cursor 대화 간 원활한 전환
- 효율적인 파일/데이터베이스 파싱을 위한 Rust 백엔드 어댑터

**🔍 전체 검색 기능** (v1.5.0부터):
- Cmd/Ctrl+F 단축키로 강력한 전체 텍스트 검색
- 인용구를 사용한 정확한 구문 검색 지원
- 검색 결과 강조 표시 및 메시지로 바로 이동
- 세션별로 그룹화된 검색 결과와 확장 가능한 미리보기

**🌏 완전한 다국어 지원**:
- 6개 언어: 영어, 한국어, 일본어, 중국어(간체), 중국어(번체), 러시아어
- 시스템 로케일에서 자동 언어 감지
- 모든 새 기능을 포함한 전체 UI 번역

**🌍 크로스 플랫폼 지원**:
- macOS(유니버셜 바이너리), Windows, Linux에서 실행
- 플랫폼별 설치 프로그램(.dmg, .exe, .msi, .deb, .AppImage, .rpm)
- 다중 패키지 매니저 지원(npm, pnpm, yarn, bun)

**⚡ 성능 및 개발자 경험**:
- 비용이 많이 드는 컴포넌트에 대한 React.memo() 최적화
- 불필요한 재렌더링 방지를 위한 useCallback 훅
- Playwright를 사용한 포괄적인 E2E 테스트 스위트
- GitHub Actions를 통한 자동화된 릴리스 워크플로우
- 다중 플랫폼 빌드 스크립트

## 주요 기능

**대화 탐색**: 왼쪽에 트리 뷰, 오른쪽에 대화 내용이 표시됩니다. 라이트/다크 테마를 지원하는 깔끔하고 직관적인 인터페이스입니다.

**파일 변경 추적**: 새로운 파일 뷰에서 모든 프로젝트의 Claude/Cursor가 접근한 모든 파일을 표시합니다. 작업 유형, 확장자, 날짜로 필터링하고, 파일 내용 스냅샷을 보고, 각 파일이 수정된 정확한 세션으로 이동할 수 있습니다.

**세션 생성 및 관리**: 앱에서 직접 새로운 Claude Code 프로젝트와 대화 세션을 시작합니다. 사용자 정의 메시지를 작성하고, 컨텍스트를 선택하고, 기존 세션에 추가할 수 있습니다.

**대화 내보내기**: 구문 강조, 첨부 파일, 사용자 정의 테마로 Markdown, HTML 또는 DOCX 형식으로 대화를 저장합니다. 전체 히스토리 또는 필터링된 뷰를 내보냅니다(bash 히스토리 추출을 위한 명령 전용 모드 포함).

**강력한 검색**: Cmd/Ctrl+F로 모든 대화를 검색할 수 있습니다. 인용구 지원, 매칭 하이라이트, 컨텍스트 내에서 메시지로 바로 이동 가능합니다. 검색 결과는 세션별로 그룹화되어 쉽게 탐색할 수 있습니다.

**고급 필터링**: 다양한 사용 사례를 위한 여러 뷰 모드:
- 명령만: bash 명령 히스토리를 로그로 추출
- 원시 메시지 뷰: 기본 JSONL 데이터 구조 표시
- Bash/도구 사용 필터: 특정 AI 작업에 집중
- 메시지만: 도구 출력 없이 텍스트 중심 읽기

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
- 줄 번호가 있는 명령 히스토리 뷰

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
2. `~/.claude` 및 Cursor 데이터 폴더를 자동으로 스캔해서 대화 데이터를 찾습니다
3. 왼쪽 사이드바 트리에서 프로젝트 탐색
4. 세션을 클릭하면 메시지를 볼 수 있습니다
5. 상단 탭을 사용하여 다음 뷰 전환:
   - **Messages**: 전체 대화 읽기
   - **Files**: AI 세션이 접근한 모든 파일 탐색
   - **Analytics**: 활동 히트맵 및 패턴 보기
   - **Token Stats**: 토큰 사용량 분석

### 파일 활동 추적
- **Files** 탭으로 전환하여 AI 세션이 접근한 모든 파일 확인
- 필터링 기준:
  - **작업 유형**: 읽기, 편집, 생성, 삭제
  - **파일 확장자**: .ts, .js, .py, .md 등
  - **날짜 범위**: 특정 기간의 파일 찾기
- **보기**를 클릭하여 파일 내용 스냅샷 확인
- **세션으로 이동**을 클릭하여 파일이 수정된 정확한 대화 확인
- **다운로드**를 사용하여 파일 내용을 로컬에 저장
- **모든 프로젝트**를 클릭하여 모든 소스(Claude Code + Cursor)의 파일 통합

### 대화 내보내기
- 메시지 뷰 우측 상단의 **Export** 버튼 클릭
- 형식 선택: **Markdown**, **HTML**, 또는 **DOCX**
- 다양한 세부 수준을 위해 **포맷/원시** 모드 토글
- **첨부 파일 포함**을 활성화하여 파일 내용 포함
- HTML 내보내기를 위해 **라이트/다크** 테마 선택
- **명령만** 필터 + 내보내기를 사용하여 bash 명령 히스토리 추출
- **모두 로드**를 클릭하여 전체 대화 내보내기 (현재 필터 적용)

### 세션 생성
- 헤더의 **Session Builder** 버튼 (⊕ 아이콘) 클릭
- 소스 선택 (Claude Code 또는 Cursor - 쓰기 가능한 경우)
- 기존 프로젝트 선택 또는 새 프로젝트 생성
- 선택적 컨텍스트 파일로 메시지 작성
- 생성 전 세션 구조 미리보기
- 생성 후 세션이 앱에서 즉시 사용 가능

### 검색 기능
- **Cmd+F** (macOS) 또는 **Ctrl+F** (Windows/Linux)를 눌러 검색 열기
- 쿼리를 입력하고 Enter 누르기
- 정확한 구문에 따옴표 사용: `"에러 메시지"`
- 결과를 클릭하여 해당 메시지로 바로 이동
- 결과는 확장 가능한 미리보기가 있는 세션별로 그룹화됨

### 메시지 필터링
- **Bash만**: bash 도구 사용이 있는 메시지만 표시
- **도구 사용만**: AI 도구 작업에 집중
- **메시지만**: 도구 출력 숨기고 텍스트만 표시
- **명령만**: bash 명령을 히스토리 로그로 추출 (내보내기에 유용)

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
