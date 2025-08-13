// 실제 앱에서 페이지네이션 안전성을 검증하는 유틸리티

export interface PaginationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalMessages: number;
    uniqueMessages: number;
    duplicates: number;
    missingSequences: number[];
  };
}

export class PaginationValidator {
  private messages: Array<{ uuid: string; timestamp: string; type: string }> =
    [];

  addMessages(
    newMessages: Array<{ uuid: string; timestamp: string; type: string }>
  ) {
    this.messages.push(...newMessages);
  }

  validate(): PaginationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. UUID 중복 검사
    const uuids = this.messages.map((m) => m.uuid);
    const uniqueUuids = new Set(uuids);
    const duplicates = uuids.length - uniqueUuids.size;

    if (duplicates > 0) {
      errors.push(`Found ${duplicates} duplicate messages`);
    }

    // 2. 타임스탬프 순서 검사 (채팅 스타일: 오래된 것이 앞에)
    let timestampErrors = 0;
    for (let i = 1; i < this.messages.length; i++) {
      const prev = new Date(this.messages[i - 1].timestamp);
      const curr = new Date(this.messages[i].timestamp);

      if (prev > curr) {
        timestampErrors++;
      }
    }

    if (timestampErrors > this.messages.length * 0.1) {
      // 10% 이상 순서 오류
      warnings.push(
        `Timestamp ordering issues: ${timestampErrors} out of order messages`
      );
    }

    // 3. 메시지 타입 분포 검사
    const types = this.messages.map((m) => m.type);
    const userCount = types.filter((t) => t === "user").length;
    const assistantCount = types.filter((t) => t === "assistant").length;

    if (userCount === 0 && assistantCount > 0) {
      warnings.push("No user messages found - might indicate loading issue");
    }

    // 4. UUID 패턴 검사 (잘못된 UUID 형식)
    const invalidUuids = uuids.filter(
      (uuid) =>
        !uuid || uuid === "unknown-session" || uuid.startsWith("fallback-")
    );

    if (invalidUuids.length > 0) {
      warnings.push(
        `Found ${invalidUuids.length} messages with invalid/generated UUIDs`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalMessages: this.messages.length,
        uniqueMessages: uniqueUuids.size,
        duplicates,
        missingSequences: [], // 구현 필요시 추가
      },
    };
  }

  // 실시간 검증용
  static validateMessageBatch(
    existingMessages: Array<{ uuid: string; timestamp: string; type: string }>,
    newMessages: Array<{ uuid: string; timestamp: string; type: string }>
  ): {
    hasDuplicates: boolean;
    duplicateCount: number;
    newUniqueCount: number;
  } {
    const existingUuids = new Set(existingMessages.map((m) => m.uuid));
    const duplicates = newMessages.filter((m) => existingUuids.has(m.uuid));
    const uniqueNew = newMessages.filter((m) => !existingUuids.has(m.uuid));

    return {
      hasDuplicates: duplicates.length > 0,
      duplicateCount: duplicates.length,
      newUniqueCount: uniqueNew.length,
    };
  }

  reset() {
    this.messages = [];
  }
}
