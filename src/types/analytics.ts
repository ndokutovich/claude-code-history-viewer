/**
 * Analytics 관련 타입 정의
 * 가독성과 예측 가능성을 위한 명확한 타입 구조
 */

import type { ProjectStatsSummary, SessionComparison } from './index';

/**
 * App-wide view types (unified view state)
 * This is the single source of truth for what the user is currently viewing
 */
export type AppView = 'messages' | 'tokenStats' | 'analytics' | 'search';

/**
 * @deprecated Use AppView instead. Kept for backward compatibility during migration.
 */
export type AnalyticsView = 'messages' | 'tokenStats' | 'analytics';
export type AnalyticsViewType = AnalyticsView;

/**
 * Analytics 상태 인터페이스
 * - 높은 응집도: 관련된 상태들을 하나로 묶음
 * - 낮은 결합도: 각 상태는 독립적으로 관리 가능
 */
export interface AnalyticsState {
  // 현재 활성 뷰
  currentView: AnalyticsView;
  
  // 데이터 상태
  projectSummary: ProjectStatsSummary | null;
  sessionComparison: SessionComparison | null;
  
  // 로딩 상태
  isLoadingProjectSummary: boolean;
  isLoadingSessionComparison: boolean;
  
  // 에러 상태
  projectSummaryError: string | null;
  sessionComparisonError: string | null;
}

/**
 * Analytics 액션 인터페이스
 * 단일 책임 원칙을 따라 각 액션은 하나의 역할만 수행
 */
export interface AnalyticsActions {
  // 뷰 변경
  setCurrentView: (view: AnalyticsView) => void;
  
  // 데이터 설정
  setProjectSummary: (summary: ProjectStatsSummary | null) => void;
  setSessionComparison: (comparison: SessionComparison | null) => void;
  
  // 로딩 상태 관리
  setLoadingProjectSummary: (loading: boolean) => void;
  setLoadingSessionComparison: (loading: boolean) => void;
  
  // 에러 상태 관리
  setProjectSummaryError: (error: string | null) => void;
  setSessionComparisonError: (error: string | null) => void;
  
  // 복합 액션 (비즈니스 로직)
  switchToMessages: () => void;
  switchToTokenStats: () => void;
  switchToAnalytics: () => void;
  
  // 초기화
  resetAnalytics: () => void;
  clearErrors: () => void;
}

/**
 * Analytics 초기 상태
 */
export const initialAnalyticsState: AnalyticsState = {
  currentView: 'messages',
  projectSummary: null,
  sessionComparison: null,
  isLoadingProjectSummary: false,
  isLoadingSessionComparison: false,
  projectSummaryError: null,
  sessionComparisonError: null,
};

/**
 * Analytics Hook 리턴 타입
 * 컴포넌트에서 필요한 최소한의 인터페이스만 노출
 */
export interface UseAnalyticsReturn {
  // 상태 (읽기 전용)
  readonly state: AnalyticsState;
  
  // 액션 (예측 가능한 이름)
  readonly actions: {
    switchToMessages: () => void;
    switchToTokenStats: () => Promise<void>;
    switchToAnalytics: () => Promise<void>;
    refreshAnalytics: () => Promise<void>;
    clearAll: () => void;
  };
  
  // 계산된 값들
  readonly computed: {
    isTokenStatsView: boolean;
    isAnalyticsView: boolean;
    isMessagesView: boolean;
    hasAnyError: boolean;
    isAnyLoading: boolean;
  };
}

/**
 * Analytics 컨텍스트 타입
 * 프로젝트와 세션 정보를 담는 컨텍스트
 */
export interface AnalyticsContext {
  selectedProject: {
    name: string;
    path: string;
  } | null;
  selectedSession: {
    session_id: string;
    file_path: string;
  } | null;
}