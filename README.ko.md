# Claude Code History Viewer

Claude Code의 대화 기록(`~/.claude`)을 보기 편하게 탐색할 수 있는 데스크톱 앱입니다.

![Version](https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg)
![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

> ⚠️ **베타 소프트웨어** - 불안정하거나 변경될 수 있습니다

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

## 주요 기능

**대화 탐색**: 왼쪽에 프로젝트 트리, 오른쪽에 대화 내용이 표시됩니다.

**검색 및 필터링**: 전체 대화 기록에서 특정 대화나 메시지를 찾을 수 있습니다.

**사용량 분석**: 어떤 프로젝트를 가장 많이 사용하는지, 시간대별 토큰 사용량, 활동 패턴 등을 확인할 수 있습니다. Claude Code 사용 습관을 파악하는 데 유용합니다.

**보기 편한 인터페이스**: 코드 블록 구문 강조, diff 포맷팅, 읽기 편한 메시지 스레드 등으로 JSONL 원본보다 훨씬 보기 좋습니다.

**도구 출력 시각화**: 웹 검색 결과, git 작업, 터미널 출력 등이 읽기 편한 형태로 표시됩니다.

대용량 대화 기록도 끊김 없이 처리하고, 새로운 대화가 추가되면 자동으로 새로고침됩니다.

## 설치

### 다운로드

[Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases)에서 최신 버전을 받으세요.

### 직접 빌드

```bash
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:build
```

**필요한 것**: Node.js 18+, pnpm, Rust 툴체인, Xcode Command Line Tools (macOS)

## 사용법

1. 앱 실행
2. `~/.claude`를 자동으로 스캔해서 대화 데이터를 찾습니다
3. 왼쪽 사이드바에서 프로젝트 탐색
4. 세션을 클릭하면 메시지를 볼 수 있습니다
5. 분석 탭에서 사용량 통계 확인

## 현재 제한사항

- **macOS만 지원** (Windows/Linux 지원 예정)
- **베타 소프트웨어** - 아직 거친 부분이 있을 수 있습니다
- 대용량 대화 기록(수천 개 메시지)은 초기 로딩이 느릴 수 있습니다
- 자동 업데이트 시스템은 아직 테스트 중입니다

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

**"Claude 데이터를 찾을 수 없음"**: Claude Code를 사용해서 대화 기록이 있는지 확인하세요. `~/.claude`가 존재하는지도 확인해보세요.

**성능 문제**: 대화 기록이 매우 큰 경우 다른 앱들을 종료해보세요. 현재는 모든 데이터를 메모리에 로드합니다.

**업데이트 문제**: 베타 자동 업데이터가 불안정할 수 있습니다. 문제 시 수동으로 다운로드하세요.

## 기여

Pull Request 환영합니다. 사이드 프로젝트라 응답이 늦을 수 있습니다.

## 기술 스택

Tauri (Rust + React)로 제작. UI는 Tailwind CSS와 Radix 컴포넌트 사용.

## 라이선스

MIT 라이선스 - [LICENSE](LICENSE) 파일 참조.

---

**질문이나 문제 있으시면?** 설정과 어떤 문제가 발생했는지 자세히 적어서 [이슈를 등록](https://github.com/jhlee0409/claude-code-history-viewer/issues)해주세요.
