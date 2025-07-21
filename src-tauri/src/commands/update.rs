use serde::{Deserialize, Serialize};
use tauri::command;
use regex::Regex;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum UpdatePriority {
    Critical,
    Recommended,
    Optional,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum UpdateType {
    Hotfix,
    Feature,
    Patch,
    Major,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateMessage {
    pub title: String,
    pub description: String,
    pub features: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateMetadata {
    pub priority: UpdatePriority,
    pub r#type: UpdateType,
    pub force_update: bool,
    pub minimum_version: Option<String>,
    pub deadline: Option<String>,
    pub message: UpdateMessage,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: Option<String>,
    pub current_version: String,
    pub download_url: Option<String>,
    pub release_url: Option<String>,
    pub metadata: Option<UpdateMetadata>,
    pub is_forced: bool,
    pub days_until_deadline: Option<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub html_url: String,
    pub published_at: String,
    pub body: String,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10)) // 30초 → 10초로 단축
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 오류: {}", e))?;

    // 재시도 로직 (최대 2회 시도로 단축)
    let mut last_error = String::new();
    for attempt in 1..=2 {
        match fetch_release_info(&client).await {
            Ok(release) => {
                return process_release_info(current_version, release);
            }
            Err(e) => {
                last_error = e;
                if attempt < 2 {
                    // 재시도 전 짧은 대기 (500ms)
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    Err(format!("2번 시도 후 실패: {}", last_error))
}

pub async fn fetch_release_info(client: &reqwest::Client) -> Result<GitHubRelease, String> {
    let response = client
        .get("https://api.github.com/repos/jhlee0409/claude-code-history-viewer/releases/latest")
        .header("User-Agent", "Claude-Code-History-Viewer")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("네트워크 오류: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("릴리즈 정보를 가져올 수 없습니다 (HTTP {}): {}", status, error_text));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("응답 해석 오류: {}", e))?;

    Ok(release)
}

fn process_release_info(current_version: &str, release: GitHubRelease) -> Result<UpdateInfo, String> {
    let latest_version = release.tag_name.trim_start_matches('v');
    let has_update = version_is_newer(current_version, latest_version);

    let metadata = parse_metadata_from_body(&release.body);
    let is_forced = metadata.as_ref()
        .map(|m| m.force_update)
        .unwrap_or(false);

    let days_until_deadline = metadata.as_ref()
        .and_then(|m| m.deadline.as_ref())
        .and_then(|deadline| calculate_days_until_deadline(deadline).ok());

    // 최소 버전 체크
    let meets_minimum_version = metadata.as_ref()
        .and_then(|m| m.minimum_version.as_ref())
        .map(|min_ver| version_is_newer_or_equal(current_version, min_ver))
        .unwrap_or(true);

    let final_is_forced = is_forced && meets_minimum_version;

    // DMG 다운로드 URL 찾기 (macOS)
    let dmg_asset = release.assets.iter()
        .find(|asset| asset.name.ends_with(".dmg"));

    Ok(UpdateInfo {
        has_update,
        latest_version: Some(latest_version.to_string()),
        current_version: current_version.to_string(),
        download_url: dmg_asset.map(|asset| asset.browser_download_url.clone()),
        release_url: Some(release.html_url),
        metadata,
        is_forced: final_is_forced,
        days_until_deadline,
    })
}

pub fn parse_metadata_from_body(body: &str) -> Option<UpdateMetadata> {
    let re = Regex::new(r"<!-- UPDATE_METADATA\s*\n(.*?)\n-->");

    if let Ok(regex) = re {
        if let Some(captures) = regex.captures(body) {
            let json_str = captures.get(1)?.as_str();
            serde_json::from_str(json_str).ok()
        } else {
            None
        }
    } else {
        None
    }
}

fn calculate_days_until_deadline(deadline: &str) -> Result<i64, String> {
    let deadline_dt = DateTime::parse_from_rfc3339(deadline)
        .map_err(|e| format!("날짜 형식 오류: {}", e))?;
    let now = Utc::now();
    let duration = deadline_dt.signed_duration_since(now);

    Ok(duration.num_days())
}

pub fn version_is_newer(current: &str, latest: &str) -> bool {
    // 간단한 버전 비교 (semantic versioning)
    let current_parts: Vec<u32> = current.split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let latest_parts: Vec<u32> = latest.split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    for i in 0..std::cmp::max(current_parts.len(), latest_parts.len()) {
        let current_part = current_parts.get(i).unwrap_or(&0);
        let latest_part = latest_parts.get(i).unwrap_or(&0);

        if latest_part > current_part {
            return true;
        } else if latest_part < current_part {
            return false;
        }
    }

    false
}

fn version_is_newer_or_equal(current: &str, minimum: &str) -> bool {
    let current_parts: Vec<u32> = current.split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let minimum_parts: Vec<u32> = minimum.split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    for i in 0..std::cmp::max(current_parts.len(), minimum_parts.len()) {
        let current_part = current_parts.get(i).unwrap_or(&0);
        let minimum_part = minimum_parts.get(i).unwrap_or(&0);

        if current_part > minimum_part {
            return true;
        } else if current_part < minimum_part {
            return false;
        }
    }

    true // 같은 버전도 조건을 만족
}