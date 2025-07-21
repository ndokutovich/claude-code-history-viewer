
pub fn extract_project_name(raw_project_name: &str) -> String {
    if raw_project_name.starts_with('-') {
        let parts: Vec<&str> = raw_project_name.splitn(4, '-').collect();
        if parts.len() == 4 {
            parts[3].to_string()
        } else {
            raw_project_name.to_string()
        }
    } else {
        raw_project_name.to_string()
    }
}

/// 파일 크기로 메시지 수 추정 (더 정확한 계산)
pub fn estimate_message_count_from_size(file_size: u64) -> usize {
    // 평균적으로 JSON 메시지는 800-1200 바이트
    // 작은 파일은 최소 1개 메시지로 처리
    ((file_size as f64 / 1000.0).ceil() as usize).max(1)
}
