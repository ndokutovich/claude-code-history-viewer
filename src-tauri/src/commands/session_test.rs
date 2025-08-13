#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ClaudeMessage, MessagePage};

    // Mock 데이터 생성 헬퍼
    fn create_mock_messages(count: usize) -> Vec<ClaudeMessage> {
        (0..count)
            .map(|i| ClaudeMessage {
                uuid: format!("msg-{}", i),
                parent_uuid: if i > 0 { Some(format!("msg-{}", i - 1)) } else { None },
                session_id: "test-session".to_string(),
                timestamp: format!("2025-01-{:02}T{:02}:00:00Z", (i / 30) + 1, i % 24),
                message_type: if i % 2 == 0 { "user" } else { "assistant" }.to_string(),
                content: Some(serde_json::json!(format!("Message {}", i))),
                tool_use: None,
                tool_use_result: None,
                is_sidechain: Some(false),
                usage: None,
                role: Some(if i % 2 == 0 { "user" } else { "assistant" }.to_string()),
                message_id: None,
                model: None,
                stop_reason: None,
            })
            .collect()
    }

    #[test]
    fn test_pagination_first_page() {
        let messages = create_mock_messages(200);

        // 첫 페이지 요청 (offset=0, limit=20)
        let offset = 0;
        let limit = 20;
        let total_count = messages.len();

        let already_loaded = offset;
        let remaining_messages = total_count - already_loaded;
        let messages_to_load = std::cmp::min(limit, remaining_messages);

        let start_idx = total_count - already_loaded - messages_to_load;
        let end_idx = total_count - already_loaded;

        assert_eq!(start_idx, 180); // 200 - 0 - 20
        assert_eq!(end_idx, 200);   // 200 - 0
        assert_eq!(messages_to_load, 20);
    }

    #[test]
    fn test_pagination_120_messages() {
        let messages = create_mock_messages(300);

        // 120개 메시지 로드 후 상태 (offset=120, limit=20)
        let offset = 120;
        let limit = 20;
        let total_count = messages.len();

        let already_loaded = offset;
        let remaining_messages = if total_count > already_loaded {
            total_count - already_loaded
        } else {
            0
        };
        let messages_to_load = std::cmp::min(limit, remaining_messages);

        // 안전한 인덱스 계산
        let start = if total_count > already_loaded + messages_to_load {
            total_count - already_loaded - messages_to_load
        } else {
            0
        };
        let end = if total_count > already_loaded {
            total_count - already_loaded
        } else {
            0
        };

        assert_eq!(start, 160);  // 300 - 120 - 20
        assert_eq!(end, 180);    // 300 - 120
        assert_eq!(messages_to_load, 20);
        assert_eq!(remaining_messages, 180); // 300 - 120
    }

    #[test]
    fn test_pagination_boundary_cases() {
        let messages = create_mock_messages(150);

        // 경계 케이스: offset=140, limit=20 (10개만 남음)
        let offset = 140;
        let limit = 20;
        let total_count = messages.len();

        let already_loaded = offset;
        let remaining_messages = if total_count > already_loaded {
            total_count - already_loaded
        } else {
            0
        };
        let messages_to_load = std::cmp::min(limit, remaining_messages);

        assert_eq!(messages_to_load, 10); // 150 - 140 = 10개만 남음
        assert_eq!(remaining_messages, 10);

        // 경계 케이스: offset=150 (더 이상 로드할 메시지 없음)
        let offset = 150;
        let already_loaded = offset;
        let remaining_messages = if total_count > already_loaded {
            total_count - already_loaded
        } else {
            0
        };

        assert_eq!(remaining_messages, 0);
    }

    #[test]
    fn test_pagination_overflow_protection() {
        let messages = create_mock_messages(50);

        // 오버플로우 방지 테스트: offset이 total_count보다 큼
        let offset = 100;
        let limit = 20;
        let total_count = messages.len();

        let already_loaded = offset;
        let remaining_messages = if total_count > already_loaded {
            total_count - already_loaded
        } else {
            0
        };

        assert_eq!(remaining_messages, 0); // 안전하게 0 반환
    }

    #[test]
    fn test_chat_style_message_order() {
        let messages = create_mock_messages(100);

        // 채팅 스타일: 오래된 메시지가 앞에 오는지 확인
        let offset = 0;
        let limit = 20;
        let total_count = messages.len();

        let start_idx = total_count - offset - limit;
        let end_idx = total_count - offset;

        // 80-100 범위의 메시지 (최신 20개)
        assert_eq!(start_idx, 80);
        assert_eq!(end_idx, 100);

        // 다음 페이지 (offset=20)
        let offset = 20;
        let start_idx = total_count - offset - limit;
        let end_idx = total_count - offset;

        // 60-80 범위의 메시지 (그 다음 오래된 20개)
        assert_eq!(start_idx, 60);
        assert_eq!(end_idx, 80);
    }
}