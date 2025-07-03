
use std::collections::HashMap;
use std::time::SystemTime;
use std::path::Path;

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

/// 파일 메타데이터 캐시 구조체
#[derive(Clone, Debug)]
pub struct FileMetadata {
    pub message_count: usize,
    pub last_modified: SystemTime,
    pub file_size: u64,
}

/// 간단한 파일 메타데이터 캐시
pub struct FileCache {
    cache: HashMap<String, FileMetadata>,
}

impl FileCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    /// 캐시에서 메타데이터 가져오기 (수정시간 확인)
    pub fn get(&self, file_path: &str, current_modified: SystemTime) -> Option<&FileMetadata> {
        self.cache.get(file_path).and_then(|metadata| {
            if metadata.last_modified == current_modified {
                Some(metadata)
            } else {
                None
            }
        })
    }

    /// 캐시에 메타데이터 저장
    pub fn set(&mut self, file_path: String, metadata: FileMetadata) {
        self.cache.insert(file_path, metadata);
    }
}

/// 파일 크기로 메시지 수 추정 (더 정확한 계산)
pub fn estimate_message_count_from_size(file_size: u64) -> usize {
    // 평균적으로 JSON 메시지는 800-1200 바이트
    // 작은 파일은 최소 1개 메시지로 처리
    ((file_size as f64 / 1000.0).ceil() as usize).max(1)
}

/// 빠른 라인 카운팅 (첫 1000라인만 샘플링)
pub fn fast_line_count(file_path: &Path) -> std::io::Result<usize> {
    use std::fs::File;
    use std::io::{BufRead, BufReader};
    
    let file = File::open(file_path)?;
    let reader = BufReader::new(file);
    
    let mut count = 0;
    for line_result in reader.lines() {
        line_result?; // 라인 읽기 에러 체크
        count += 1;
        
        // 1000라인 이상이면 크기로 추정
        if count >= 1000 {
            let metadata = std::fs::metadata(file_path)?;
            let estimated_total = (metadata.len() as f64 / 1000.0 * count as f64) as usize;
            return Ok(estimated_total);
        }
    }
    
    Ok(count)
}
