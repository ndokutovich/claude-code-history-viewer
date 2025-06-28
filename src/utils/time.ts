// 헬퍼 함수들을 먼저 정의
export const formatTime = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return timestamp;
  }
};
