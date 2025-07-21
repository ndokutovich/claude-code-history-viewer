// 업데이트 설정 타입 정의
export interface UpdateSettings {
  // 자동 체크 활성화 여부 (체크까지는 자동, 모달도 자동 표시)
  autoCheck: boolean;
  
  // 체크 주기
  checkInterval: 'startup' | 'daily' | 'weekly' | 'never';
  
  // 건너뛴 버전들
  skippedVersions: string[];
  
  // 마지막 연기 시간
  lastPostponedAt?: number;
  
  // 연기 주기 (시간 단위)
  postponeInterval: number; // 기본 24시간
  
  // 첫 실행 여부 (사용자에게 안내했는지)
  hasSeenIntroduction: boolean;
  
  // 오프라인 시 체크 비활성화
  respectOfflineStatus: boolean;
  
  // 중요 업데이트는 강제 표시
  allowCriticalUpdates: boolean;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoCheck: true, // 기본적으로 자동 체크 활성화
  checkInterval: 'startup',
  skippedVersions: [],
  postponeInterval: 24 * 60 * 60 * 1000, // 24시간
  hasSeenIntroduction: false,
  respectOfflineStatus: true,
  allowCriticalUpdates: true, // 중요 업데이트는 항상 표시
};