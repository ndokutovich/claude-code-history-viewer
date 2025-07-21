# 테스트 가이드

## 🧪 테스트 설정 완료

Vitest와 Testing Library를 사용한 종합 테스트 환경이 구축되었습니다.

### 📦 설치된 테스트 도구

- **Vitest**: 빠른 단위 테스트 러너
- **@testing-library/react**: React 컴포넌트 테스트
- **@testing-library/jest-dom**: DOM 매처
- **jsdom**: 브라우저 환경 시뮬레이션

### 🚀 테스트 실행 명령어

```bash
# 대화형 테스트 (개발 중)
pnpm test

# 원샷 테스트 실행
pnpm test:run

# UI 모드로 테스트 실행
pnpm test:ui
```

### 📁 작성된 테스트

#### 1. `updateCache.test.ts` - 캐시 유틸리티 테스트
- ✅ 캐시 저장/조회 로직
- ✅ 만료 시간 검증 (30분)
- ✅ 버전 불일치 처리
- ✅ 에러 핸들링
- ✅ localStorage 모킹

#### 2. `useGitHubUpdater.test.ts` - 업데이트 훅 테스트
- ✅ 초기 상태 검증
- ✅ 캐시 사용 로직
- ✅ GitHub API 호출
- ✅ 에러 처리
- ✅ 강제 체크 기능
- ✅ Tauri 모듈 모킹

### 🔧 테스트 설정 파일

- `vite.config.ts`: Vitest 설정 추가
- `src/test/setup.ts`: 전역 테스트 설정
- `package.json`: 테스트 스크립트 추가

### 🎯 테스트 커버리지 포함 영역

1. **업데이트 캐싱 로직** - 30분 캐시 지속시간, 버전 검증
2. **GitHub API 통신** - 타임아웃, 에러 처리, 재시도
3. **상태 관리** - React Hook 상태 변화
4. **Tauri 통합** - 모킹을 통한 안전한 테스트

### 📊 테스트 실행 결과 예시

```bash
pnpm test:run

✓ src/utils/__tests__/updateCache.test.ts (12)
✓ src/hooks/__tests__/useGitHubUpdater.test.ts (8)

Test Files  2 passed (2)
Tests       20 passed (20)
```

### 🔍 추가 테스트 가능 영역

- **UpdateManager 컴포넌트** - 모달 표시 로직
- **GitHubUpdateModal** - UI 상호작용
- **업데이트 다운로드/설치** - 프로그레스 상태
- **다국어 처리** - i18n 텍스트
- **에러 상황** - 네트워크 끊김, 권한 오류

모든 테스트는 Tauri 환경과 독립적으로 실행되며, 실제 GitHub API 호출 없이 안전하게 테스트할 수 있습니다.