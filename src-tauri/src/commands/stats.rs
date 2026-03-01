use crate::models::universal::UniversalMessage;
use crate::models::*;
use crate::utils::find_line_ranges;
use chrono::{DateTime, Datelike, Timelike, Utc};
use memmap2::Mmap;
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

// ============================================================================
// INTERNAL ENUMS AND STRUCTS (not public, local to stats.rs)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
enum StatsProvider {
    #[default]
    Claude,
    Codex,
    Gemini,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StatsMode {
    BillingTotal,
    ConversationOnly,
}

impl StatsMode {
    fn include_sidechain(self) -> bool {
        matches!(self, Self::BillingTotal)
    }
}

/// Paginated response for project token stats
#[derive(Debug, Clone, serde::Serialize)]
pub struct PaginatedTokenStats {
    pub items: Vec<SessionTokenStats>,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub has_more: bool,
}

// ---------------------------------------------------------------------------
// Lightweight struct for global stats: only the fields we actually need.
// Skips expensive fields like snapshot, data, hook_infos, etc.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GlobalStatsLogEntry {
    #[serde(rename = "type")]
    message_type: String,
    timestamp: Option<String>,
    #[serde(rename = "isSidechain")]
    is_sidechain: Option<bool>,
    message: Option<GlobalStatsMessageContent>,
    #[serde(rename = "toolUse")]
    tool_use: Option<GlobalStatsToolUse>,
    #[serde(rename = "toolUseResult")]
    tool_use_result: Option<GlobalStatsToolUseResult>,
}

#[derive(Debug, Deserialize)]
struct GlobalStatsMessageContent {
    #[allow(dead_code)]
    role: String,
    content: Option<serde_json::Value>,
    model: Option<String>,
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
struct GlobalStatsToolUse {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GlobalStatsToolUseResult {
    is_error: Option<bool>,
    usage: Option<serde_json::Value>,
    #[serde(rename = "totalTokens")]
    total_tokens: Option<u64>,
}

/// Intermediate stats collected from a single session file (for parallel processing)
#[derive(Default)]
struct SessionFileStats {
    total_messages: u32,
    total_tokens: u64,
    token_distribution: TokenDistribution,
    tool_usage: HashMap<String, (u32, u32)>, // (usage_count, success_count)
    daily_stats: HashMap<String, DailyStats>,
    activity_data: HashMap<(u8, u8), (u32, u64)>, // (hour, day) -> (count, tokens)
    model_usage: HashMap<String, (u32, u64, u64, u64, u64, u64)>, // model -> (msg_count, total, input, output, cache_create, cache_read)
    session_duration_minutes: u64,
    first_message: Option<DateTime<Utc>>,
    last_message: Option<DateTime<Utc>>,
    project_name: String,
    provider: StatsProvider,
}

/// Intermediate stats collected from a single session file (for project stats)
#[derive(Default)]
struct ProjectSessionFileStats {
    total_messages: u32,
    token_distribution: TokenDistribution,
    tool_usage: HashMap<String, (u32, u32)>,
    daily_stats: HashMap<String, DailyStats>,
    activity_data: HashMap<(u8, u8), (u32, u64)>,
    session_duration_minutes: u32,
    session_dates: HashSet<String>,
    #[allow(dead_code)]
    timestamps: Vec<DateTime<Utc>>,
}

/// Lightweight session stats for comparison (parallel processing)
#[derive(Clone)]
struct SessionComparisonStats {
    session_id: String,
    total_tokens: u64,
    message_count: usize,
    duration_seconds: i64,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn parse_stats_mode(stats_mode: Option<String>) -> StatsMode {
    match stats_mode.as_deref() {
        Some("conversation_only") => StatsMode::ConversationOnly,
        Some("billing_total") | None => StatsMode::BillingTotal,
        Some(raw) => {
            log::warn!("Unknown stats_mode '{raw}', defaulting to 'billing_total'");
            StatsMode::BillingTotal
        }
    }
}

fn stats_provider_id(provider: StatsProvider) -> &'static str {
    match provider {
        StatsProvider::Claude => "claude",
        StatsProvider::Codex => "codex",
        StatsProvider::Gemini => "gemini",
    }
}

fn is_core_message_type(message_type: &str) -> bool {
    matches!(message_type, "user" | "assistant" | "system")
}

fn is_conversation_message_type(message_type: &str) -> bool {
    matches!(message_type, "user" | "assistant")
}

fn is_non_message_noise_type(message_type: &str) -> bool {
    matches!(
        message_type,
        "progress" | "queue-operation" | "file-history-snapshot"
    )
}

fn token_usage_has_token_fields(usage: &TokenUsage) -> bool {
    usage.input_tokens.is_some()
        || usage.output_tokens.is_some()
        || usage.cache_creation_input_tokens.is_some()
        || usage.cache_read_input_tokens.is_some()
}

fn token_usage_totals(usage: &TokenUsage) -> (u64, u64, u64, u64, u64) {
    let input_tokens = u64::from(usage.input_tokens.unwrap_or(0));
    let output_tokens = u64::from(usage.output_tokens.unwrap_or(0));
    let cache_creation_tokens = u64::from(usage.cache_creation_input_tokens.unwrap_or(0));
    let cache_read_tokens = u64::from(usage.cache_read_input_tokens.unwrap_or(0));
    let total_tokens = input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens;
    (
        input_tokens,
        output_tokens,
        cache_creation_tokens,
        cache_read_tokens,
        total_tokens,
    )
}

fn should_include_stats_entry(
    message_type: &str,
    is_sidechain: Option<bool>,
    has_usage: bool,
    mode: StatsMode,
) -> bool {
    if message_type == "summary" {
        return false;
    }

    if !mode.include_sidechain() && is_sidechain.unwrap_or(false) {
        return false;
    }

    if matches!(mode, StatsMode::ConversationOnly) {
        return is_conversation_message_type(message_type);
    }

    if is_core_message_type(message_type) {
        return true;
    }

    if is_non_message_noise_type(message_type) {
        return has_usage;
    }

    has_usage
}

fn all_stats_providers() -> HashSet<StatsProvider> {
    [
        StatsProvider::Claude,
        StatsProvider::Codex,
        StatsProvider::Gemini,
    ]
    .into_iter()
    .collect()
}

fn parse_active_stats_providers(active_providers: Option<Vec<String>>) -> HashSet<StatsProvider> {
    let Some(raw_providers) = active_providers else {
        return all_stats_providers();
    };

    let mut unknown = Vec::new();
    let parsed: HashSet<StatsProvider> = raw_providers
        .into_iter()
        .filter_map(|provider| match provider.as_str() {
            "claude" => Some(StatsProvider::Claude),
            "codex" => Some(StatsProvider::Codex),
            "gemini" => Some(StatsProvider::Gemini),
            _ => {
                unknown.push(provider);
                None
            }
        })
        .collect();

    if !unknown.is_empty() {
        log::warn!(
            "Ignoring unknown providers in active_providers: {}",
            unknown.join(", ")
        );
    }

    parsed
}

#[allow(dead_code)] // Reserved for future Codex/Gemini global stats support
fn detect_project_provider(project_path: &str) -> StatsProvider {
    if project_path.starts_with("codex://") {
        StatsProvider::Codex
    } else if project_path.starts_with("gemini://") {
        StatsProvider::Gemini
    } else {
        StatsProvider::Claude
    }
}

fn detect_session_provider(session_path: &str) -> StatsProvider {
    if session_path.starts_with("gemini://") {
        return StatsProvider::Gemini;
    }

    let is_rollout = PathBuf::from(session_path)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.starts_with("rollout-")
                && std::path::Path::new(name)
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("jsonl"))
        });

    if is_rollout {
        StatsProvider::Codex
    } else {
        StatsProvider::Claude
    }
}

/// Parse a line using simd-json (requires mutable slice)
/// Returns None if parsing fails
#[inline]
fn parse_raw_log_entry_simd(line: &mut [u8]) -> Option<RawLogEntry> {
    simd_json::serde::from_slice(line).ok()
}

#[inline]
fn parse_global_stats_entry_simd(line: &mut [u8]) -> Option<GlobalStatsLogEntry> {
    simd_json::serde::from_slice(line).ok()
}

fn apply_usage_fields_from_value(usage_obj: &serde_json::Value, usage: &mut TokenUsage) {
    if let Some(input) = usage_obj
        .get("input_tokens")
        .and_then(serde_json::Value::as_u64)
    {
        usage.input_tokens = Some(input as u32);
    }
    if let Some(output) = usage_obj
        .get("output_tokens")
        .and_then(serde_json::Value::as_u64)
    {
        usage.output_tokens = Some(output as u32);
    }
    if let Some(cache_creation) = usage_obj
        .get("cache_creation_input_tokens")
        .and_then(serde_json::Value::as_u64)
    {
        usage.cache_creation_input_tokens = Some(cache_creation as u32);
    }
    if let Some(cache_read) = usage_obj
        .get("cache_read_input_tokens")
        .and_then(serde_json::Value::as_u64)
    {
        usage.cache_read_input_tokens = Some(cache_read as u32);
    }
    if let Some(tier) = usage_obj
        .get("service_tier")
        .and_then(serde_json::Value::as_str)
    {
        usage.service_tier = Some(tier.to_string());
    }
}

fn extract_token_usage(message: &ClaudeMessage) -> TokenUsage {
    if let Some(usage) = &message.usage {
        return usage.clone();
    }

    let mut usage = TokenUsage {
        input_tokens: None,
        output_tokens: None,
        cache_creation_input_tokens: None,
        cache_read_input_tokens: None,
        service_tier: None,
    };

    if let Some(content) = &message.content {
        if content.is_object() {
            if let Some(usage_obj) = content.get("usage") {
                apply_usage_fields_from_value(usage_obj, &mut usage);
            }
        }
    }

    if let Some(tool_result) = &message.tool_use_result {
        if let Some(usage_obj) = tool_result.get("usage") {
            apply_usage_fields_from_value(usage_obj, &mut usage);
        }

        if let Some(total_tokens) = tool_result
            .get("totalTokens")
            .and_then(serde_json::Value::as_u64)
        {
            if usage.input_tokens.is_none() && usage.output_tokens.is_none() {
                if message.message_type == "assistant" {
                    usage.output_tokens = Some(total_tokens as u32);
                } else {
                    usage.input_tokens = Some(total_tokens as u32);
                }
            }
        }
    }

    usage
}

/// Extract token usage from the lightweight global stats entry
fn extract_token_usage_from_global_entry(entry: &GlobalStatsLogEntry) -> TokenUsage {
    // 1. From message.usage (most common for assistant messages)
    if let Some(msg) = &entry.message {
        if let Some(usage) = &msg.usage {
            return usage.clone();
        }

        if let Some(content) = &msg.content {
            if content.is_object() {
                if let Some(usage_obj) = content.get("usage") {
                    let mut usage = TokenUsage {
                        input_tokens: None,
                        output_tokens: None,
                        cache_creation_input_tokens: None,
                        cache_read_input_tokens: None,
                        service_tier: None,
                    };
                    apply_usage_fields_from_value(usage_obj, &mut usage);
                    if token_usage_has_token_fields(&usage) {
                        return usage;
                    }
                }
            }
        }
    }

    let mut usage = TokenUsage {
        input_tokens: None,
        output_tokens: None,
        cache_creation_input_tokens: None,
        cache_read_input_tokens: None,
        service_tier: None,
    };

    // 2. From tool_use_result.usage
    if let Some(tur) = &entry.tool_use_result {
        if let Some(usage_obj) = &tur.usage {
            apply_usage_fields_from_value(usage_obj, &mut usage);
        }

        // 3. From tool_use_result.totalTokens fallback
        if usage.input_tokens.is_none() && usage.output_tokens.is_none() {
            if let Some(total) = tur.total_tokens {
                if entry.message_type == "assistant" {
                    usage.output_tokens = Some(total as u32);
                } else {
                    usage.input_tokens = Some(total as u32);
                }
            }
        }
    }

    usage
}

/// Track tool usage from the lightweight global stats entry
fn track_tool_usage_from_global_entry(
    entry: &GlobalStatsLogEntry,
    tool_usage: &mut HashMap<String, (u32, u32)>,
) {
    // From assistant content array
    if entry.message_type == "assistant" {
        if let Some(msg) = &entry.message {
            if let Some(content) = &msg.content {
                if let Some(arr) = content.as_array() {
                    for item in arr {
                        if item.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                let e = tool_usage.entry(name.to_string()).or_insert((0, 0));
                                e.0 += 1;
                                let is_error = item
                                    .get("is_error")
                                    .and_then(serde_json::Value::as_bool)
                                    .unwrap_or(false);
                                if !is_error {
                                    e.1 += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // From explicit tool_use field
    if let Some(tu) = &entry.tool_use {
        if let Some(name) = &tu.name {
            let e = tool_usage.entry(name.clone()).or_insert((0, 0));
            e.0 += 1;
            if let Some(tur) = &entry.tool_use_result {
                let is_error = tur.is_error.unwrap_or(false);
                if !is_error {
                    e.1 += 1;
                }
            }
        }
    }
}

fn track_tool_usage(message: &ClaudeMessage, tool_usage: &mut HashMap<String, (u32, u32)>) {
    // Tool usage from assistant content
    if message.message_type == "assistant" {
        if let Some(content) = &message.content {
            if let Some(content_array) = content.as_array() {
                for item in content_array {
                    if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                        if item_type == "tool_use" {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                let tool_entry =
                                    tool_usage.entry(name.to_string()).or_insert((0, 0));
                                tool_entry.0 += 1;
                                let is_error = item
                                    .get("is_error")
                                    .and_then(serde_json::Value::as_bool)
                                    .unwrap_or(false);
                                if !is_error {
                                    tool_entry.1 += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Tool usage from explicit tool_use field
    if let Some(tool_use) = &message.tool_use {
        if let Some(name) = tool_use.get("name").and_then(|v| v.as_str()) {
            let tool_entry = tool_usage.entry(name.to_string()).or_insert((0, 0));
            tool_entry.0 += 1;
            if let Some(result) = &message.tool_use_result {
                let is_error = result
                    .get("is_error")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(false);
                if !is_error {
                    tool_entry.1 += 1;
                }
            }
        }
    }
}

fn parse_date_limit(date_str: Option<String>, label: &str) -> Option<DateTime<Utc>> {
    let raw = date_str?;
    match DateTime::parse_from_rfc3339(&raw) {
        Ok(dt) => Some(dt.with_timezone(&Utc)),
        Err(e) => {
            log::warn!("Invalid RFC3339 {label} '{raw}': {e}");
            None
        }
    }
}

fn parse_timestamp_utc(timestamp: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(timestamp)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}

fn is_within_date_limits(
    timestamp: Option<DateTime<Utc>>,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> bool {
    if s_limit.is_none() && e_limit.is_none() {
        return true;
    }

    let Some(ts) = timestamp else {
        return false;
    };

    let after_start = s_limit.map(|s| ts >= *s).unwrap_or(true);
    let before_end = e_limit.map(|e| ts <= *e).unwrap_or(true);
    after_start && before_end
}

fn calculate_session_active_minutes(timestamps: &mut [DateTime<Utc>]) -> u32 {
    const SESSION_BREAK_THRESHOLD_MINUTES: i64 = 120;

    if timestamps.is_empty() {
        return 0;
    }

    if timestamps.len() == 1 {
        return 1;
    }

    timestamps.sort();
    let mut current_period_start = timestamps[0];
    let mut session_total_minutes = 0u32;

    for i in 0..timestamps.len() - 1 {
        let current = timestamps[i];
        let next = timestamps[i + 1];
        let gap_minutes = (next - current).num_minutes();

        if gap_minutes > SESSION_BREAK_THRESHOLD_MINUTES {
            let period_duration = (current - current_period_start).num_minutes();
            session_total_minutes += period_duration.max(1) as u32;
            current_period_start = next;
        }
    }

    let last = timestamps[timestamps.len() - 1];
    let final_period = (last - current_period_start).num_minutes();
    session_total_minutes + final_period.max(1) as u32
}

/// Calculate active session duration from sorted timestamps (for SessionFileStats)
fn calculate_session_duration(
    session_timestamps: &mut [DateTime<Utc>],
    stats: &mut SessionFileStats,
) {
    const SESSION_BREAK_THRESHOLD_MINUTES: i64 = 120;

    if session_timestamps.len() >= 2 {
        session_timestamps.sort_unstable();
        let mut current_period_start = session_timestamps[0];
        let mut total_active_minutes = 0u64;

        for i in 0..session_timestamps.len() - 1 {
            let current = session_timestamps[i];
            let next = session_timestamps[i + 1];
            let gap_minutes = (next - current).num_minutes();

            if gap_minutes > SESSION_BREAK_THRESHOLD_MINUTES {
                let period_duration = (current - current_period_start).num_minutes();
                total_active_minutes += period_duration.max(1) as u64;
                current_period_start = next;
            }
        }

        let last_timestamp = session_timestamps[session_timestamps.len() - 1];
        let final_period = (last_timestamp - current_period_start).num_minutes();
        total_active_minutes += final_period.max(1) as u64;

        stats.session_duration_minutes = total_active_minutes;
    } else if session_timestamps.len() == 1 {
        stats.session_duration_minutes = 1;
    }
}

fn build_tool_usage_stats(tool_usage: HashMap<String, (u32, u32)>) -> Vec<ToolUsageStats> {
    let mut tools = tool_usage
        .into_iter()
        .map(|(name, (usage, success))| ToolUsageStats {
            tool_name: name,
            usage_count: usage,
            success_rate: if usage > 0 {
                (success as f32 / usage as f32) * 100.0
            } else {
                0.0
            },
            avg_execution_time: None,
        })
        .collect::<Vec<_>>();

    tools.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));
    tools
}

#[allow(dead_code)] // Reserved for future Codex/Gemini global stats support
fn resolve_provider_project_name(_provider: StatsProvider, project_path: &str) -> String {
    PathBuf::from(project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

// ============================================================================
// PROCESSING FUNCTIONS
// ============================================================================

/// Process a single session file using lightweight deserialization for global stats.
/// Only parses fields needed for stats (timestamp, usage, model, tool names).
#[allow(unsafe_code)] // Required for mmap performance optimization
fn process_session_file_for_global_stats(
    session_path: &PathBuf,
    mode: StatsMode,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> Option<SessionFileStats> {
    let file = fs::File::open(session_path).ok()?;

    // SAFETY: We're only reading the file, and the file handle is kept open
    // for the duration of the mmap's lifetime. Session files are append-only.
    let mmap = unsafe { Mmap::map(&file) }.ok()?;

    let project_name = session_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut stats = SessionFileStats {
        project_name,
        provider: StatsProvider::Claude,
        ..Default::default()
    };

    let mut session_timestamps: Vec<DateTime<Utc>> = Vec::new();

    // Use SIMD-accelerated line detection
    let line_ranges = find_line_ranges(&mmap);

    for (start, end) in line_ranges {
        let mut line_bytes = mmap[start..end].to_vec();

        let Some(entry) = parse_global_stats_entry_simd(&mut line_bytes) else {
            continue;
        };

        let usage = extract_token_usage_from_global_entry(&entry);
        let has_usage = token_usage_has_token_fields(&usage);

        if !should_include_stats_entry(&entry.message_type, entry.is_sidechain, has_usage, mode) {
            continue;
        }

        // Date-range filtering
        let has_date_filter = s_limit.is_some() || e_limit.is_some();
        let parsed_timestamp = entry.timestamp.as_ref().and_then(|ts_str| {
            DateTime::parse_from_rfc3339(ts_str)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        if has_date_filter && !is_within_date_limits(parsed_timestamp, s_limit, e_limit) {
            continue;
        }

        stats.total_messages = stats.total_messages.saturating_add(1);
        let (input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, tokens) =
            token_usage_totals(&usage);

        stats.total_tokens += tokens;
        stats.token_distribution.input += input_tokens;
        stats.token_distribution.output += output_tokens;
        stats.token_distribution.cache_creation += cache_creation_tokens;
        stats.token_distribution.cache_read += cache_read_tokens;

        if let Some(msg) = &entry.message {
            if let Some(model_name) = &msg.model {
                let model_entry = stats
                    .model_usage
                    .entry(model_name.clone())
                    .or_insert((0, 0, 0, 0, 0, 0));
                model_entry.0 += 1;
                model_entry.1 += tokens;
                model_entry.2 += input_tokens;
                model_entry.3 += output_tokens;
                model_entry.4 += cache_creation_tokens;
                model_entry.5 += cache_read_tokens;
            }
        }

        let Some(timestamp) = parsed_timestamp else {
            track_tool_usage_from_global_entry(&entry, &mut stats.tool_usage);
            continue;
        };

        session_timestamps.push(timestamp);

        // Track first/last message
        if stats
            .first_message
            .map_or(true, |current| timestamp < current)
        {
            stats.first_message = Some(timestamp);
        }
        if stats
            .last_message
            .map_or(true, |current| timestamp > current)
        {
            stats.last_message = Some(timestamp);
        }

        let hour = timestamp.hour() as u8;
        let day = timestamp.weekday().num_days_from_sunday() as u8;

        // Activity data
        let activity_entry = stats.activity_data.entry((hour, day)).or_insert((0, 0));
        activity_entry.0 += 1;
        activity_entry.1 += tokens;

        // Daily stats
        let date = timestamp.format("%Y-%m-%d").to_string();
        let daily_entry = stats
            .daily_stats
            .entry(date.clone())
            .or_insert_with(|| DailyStats {
                date,
                ..Default::default()
            });
        daily_entry.total_tokens += tokens;
        daily_entry.input_tokens += input_tokens;
        daily_entry.output_tokens += output_tokens;
        daily_entry.message_count += 1;

        // Track tool usage
        track_tool_usage_from_global_entry(&entry, &mut stats.tool_usage);
    }

    // Calculate session duration
    calculate_session_duration(&mut session_timestamps, &mut stats);

    Some(stats)
}

/// Process a single session file for project stats
#[allow(unsafe_code)] // Required for mmap performance optimization
fn process_session_file_for_project_stats(
    session_path: &PathBuf,
    mode: StatsMode,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> Option<ProjectSessionFileStats> {
    let file = fs::File::open(session_path).ok()?;

    // SAFETY: We're only reading the file, and the file handle is kept open
    // for the duration of the mmap's lifetime. Session files are append-only.
    let mmap = unsafe { Mmap::map(&file) }.ok()?;

    let mut stats = ProjectSessionFileStats::default();
    let mut session_timestamps: Vec<DateTime<Utc>> = Vec::new();

    // Use SIMD-accelerated line detection
    let line_ranges = find_line_ranges(&mmap);

    for (start, end) in line_ranges {
        // simd-json requires mutable slice
        let mut line_bytes = mmap[start..end].to_vec();

        if let Some(log_entry) = parse_raw_log_entry_simd(&mut line_bytes) {
            if let Ok(message) = ClaudeMessage::try_from(log_entry) {
                let usage = extract_token_usage(&message);
                let has_usage = token_usage_has_token_fields(&usage);
                if !should_include_stats_entry(
                    &message.message_type,
                    message.is_sidechain,
                    has_usage,
                    mode,
                ) {
                    continue;
                }

                // Per-message date filtering
                let parsed_ts = parse_timestamp_utc(&message.timestamp);
                if !is_within_date_limits(parsed_ts, s_limit, e_limit) {
                    continue;
                }

                stats.total_messages += 1;
                let (input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, tokens) =
                    token_usage_totals(&usage);

                stats.token_distribution.input += input_tokens;
                stats.token_distribution.output += output_tokens;
                stats.token_distribution.cache_creation += cache_creation_tokens;
                stats.token_distribution.cache_read += cache_read_tokens;

                if let Some(timestamp) = parsed_ts {
                    session_timestamps.push(timestamp);

                    let hour = timestamp.hour() as u8;
                    let day = timestamp.weekday().num_days_from_sunday() as u8;

                    let activity_entry = stats.activity_data.entry((hour, day)).or_insert((0, 0));
                    activity_entry.0 += 1;
                    activity_entry.1 += tokens;

                    let date = timestamp.format("%Y-%m-%d").to_string();
                    stats.session_dates.insert(date.clone());

                    let daily_entry =
                        stats
                            .daily_stats
                            .entry(date.clone())
                            .or_insert_with(|| DailyStats {
                                date,
                                ..Default::default()
                            });
                    daily_entry.total_tokens += tokens;
                    daily_entry.input_tokens += input_tokens;
                    daily_entry.output_tokens += output_tokens;
                    daily_entry.message_count += 1;
                }

                // Track tool usage
                track_tool_usage(&message, &mut stats.tool_usage);
            }
        }
    }

    if stats.total_messages == 0 {
        return None;
    }

    // Calculate session duration
    stats.session_duration_minutes = calculate_session_active_minutes(&mut session_timestamps);
    stats.timestamps = session_timestamps;

    Some(stats)
}

/// Process a single session file for comparison stats (lightweight)
#[allow(unsafe_code)] // Required for mmap performance optimization
fn process_session_file_for_comparison(
    session_path: &PathBuf,
    mode: StatsMode,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> Option<SessionComparisonStats> {
    let file = fs::File::open(session_path).ok()?;

    // SAFETY: We're only reading the file, and the file handle is kept open
    // for the duration of the mmap's lifetime. Session files are append-only.
    let mmap = unsafe { Mmap::map(&file) }.ok()?;

    let mut session_id: Option<String> = None;
    let mut total_tokens: u64 = 0;
    let mut message_count: usize = 0;
    let mut first_time: Option<DateTime<Utc>> = None;
    let mut last_time: Option<DateTime<Utc>> = None;

    // Use SIMD-accelerated line detection
    let line_ranges = find_line_ranges(&mmap);

    for (start, end) in line_ranges {
        // simd-json requires mutable slice
        let mut line_bytes = mmap[start..end].to_vec();

        if let Some(log_entry) = parse_raw_log_entry_simd(&mut line_bytes) {
            if let Ok(message) = ClaudeMessage::try_from(log_entry) {
                let usage = extract_token_usage(&message);
                let has_usage = token_usage_has_token_fields(&usage);
                if !should_include_stats_entry(
                    &message.message_type,
                    message.is_sidechain,
                    has_usage,
                    mode,
                ) {
                    continue;
                }

                // Per-message date filtering
                let parsed_ts = parse_timestamp_utc(&message.timestamp);
                if !is_within_date_limits(parsed_ts, s_limit, e_limit) {
                    continue;
                }

                if session_id.is_none() {
                    session_id = Some(message.session_id.clone());
                }

                message_count += 1;

                total_tokens += u64::from(usage.input_tokens.unwrap_or(0))
                    + u64::from(usage.output_tokens.unwrap_or(0))
                    + u64::from(usage.cache_creation_input_tokens.unwrap_or(0))
                    + u64::from(usage.cache_read_input_tokens.unwrap_or(0));

                if let Some(timestamp) = parsed_ts {
                    if first_time
                        .as_ref()
                        .map_or(true, |current| timestamp < *current)
                    {
                        first_time = Some(timestamp);
                    }
                    if last_time
                        .as_ref()
                        .map_or(true, |current| timestamp > *current)
                    {
                        last_time = Some(timestamp);
                    }
                }
            }
        }
    }

    let duration_seconds = match (first_time.as_ref(), last_time.as_ref()) {
        (Some(first), Some(last)) => (*last - *first).num_seconds(),
        _ => 0,
    };

    Some(SessionComparisonStats {
        session_id: session_id?,
        total_tokens,
        message_count,
        duration_seconds,
    })
}

/// Synchronous version of session token stats extraction for parallel processing
#[allow(unsafe_code)] // Required for mmap performance optimization
fn extract_session_token_stats_sync(
    session_path: &PathBuf,
    mode: StatsMode,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> Option<SessionTokenStats> {
    let file = fs::File::open(session_path).ok()?;

    // SAFETY: We're only reading the file, and the file handle is kept open
    // for the duration of the mmap's lifetime. Session files are append-only.
    let mmap = unsafe { Mmap::map(&file) }.ok()?;

    let project_name = session_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut session_id: Option<String> = None;
    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;
    let mut first_time: Option<String> = None;
    let mut last_time: Option<String> = None;
    let mut summary: Option<String> = None;
    let mut tool_usage: HashMap<String, (u32, u32)> = HashMap::new();
    let mut included_message_count = 0usize;

    // Use SIMD-accelerated line detection
    let line_ranges = find_line_ranges(&mmap);

    for (start, end) in line_ranges {
        // simd-json requires mutable slice
        let mut line_bytes = mmap[start..end].to_vec();

        if let Some(log_entry) = parse_raw_log_entry_simd(&mut line_bytes) {
            // Check for summary message type before converting
            if log_entry.message_type == "summary" {
                if let Some(s) = &log_entry.summary {
                    summary = Some(s.clone());
                }
            }

            if let Ok(message) = ClaudeMessage::try_from(log_entry) {
                let parsed_timestamp = parse_timestamp_utc(&message.timestamp);
                if !is_within_date_limits(parsed_timestamp, s_limit, e_limit) {
                    continue;
                }

                let usage = extract_token_usage(&message);
                let has_usage = token_usage_has_token_fields(&usage);
                if !should_include_stats_entry(
                    &message.message_type,
                    message.is_sidechain,
                    has_usage,
                    mode,
                ) {
                    continue;
                }

                if session_id.is_none() {
                    session_id = Some(message.session_id.clone());
                }

                included_message_count += 1;

                total_input_tokens += u64::from(usage.input_tokens.unwrap_or(0));
                total_output_tokens += u64::from(usage.output_tokens.unwrap_or(0));
                total_cache_creation_tokens +=
                    u64::from(usage.cache_creation_input_tokens.unwrap_or(0));
                total_cache_read_tokens += u64::from(usage.cache_read_input_tokens.unwrap_or(0));

                if let Some(ts) = parsed_timestamp {
                    let should_set_first = first_time
                        .as_ref()
                        .and_then(|raw| parse_timestamp_utc(raw))
                        .map_or(true, |current| ts < current);
                    if should_set_first {
                        first_time = Some(message.timestamp.clone());
                    }

                    let should_set_last = last_time
                        .as_ref()
                        .and_then(|raw| parse_timestamp_utc(raw))
                        .map_or(true, |current| ts > current);
                    if should_set_last {
                        last_time = Some(message.timestamp.clone());
                    }
                }

                // Track tool usage
                track_tool_usage(&message, &mut tool_usage);
            }
        }
    }

    let session_id = session_id?;
    if included_message_count == 0 {
        return None;
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;

    Some(SessionTokenStats {
        session_id,
        project_name,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_tokens,
        message_count: included_message_count,
        first_message_time: first_time.unwrap_or_else(|| "unknown".to_string()),
        last_message_time: last_time.unwrap_or_else(|| "unknown".to_string()),
        summary,
        most_used_tools: build_tool_usage_stats(tool_usage),
    })
}

#[allow(dead_code)] // Reserved for future Codex/Gemini provider stats
fn build_session_token_stats_from_messages(
    session_id: String,
    project_name: String,
    summary: Option<String>,
    messages: &[ClaudeMessage],
    mode: StatsMode,
    s_limit: Option<&DateTime<Utc>>,
    e_limit: Option<&DateTime<Utc>>,
) -> Option<SessionTokenStats> {
    if messages.is_empty() {
        return None;
    }

    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;
    let mut tool_usage: HashMap<String, (u32, u32)> = HashMap::new();

    let mut first_time_raw: Option<String> = None;
    let mut last_time_raw: Option<String> = None;
    let mut first_time: Option<DateTime<Utc>> = None;
    let mut last_time: Option<DateTime<Utc>> = None;
    let mut included_message_count = 0usize;

    for message in messages {
        let parsed_timestamp = parse_timestamp_utc(&message.timestamp);
        if !is_within_date_limits(parsed_timestamp, s_limit, e_limit) {
            continue;
        }

        let usage = extract_token_usage(message);
        let has_usage = token_usage_has_token_fields(&usage);
        if !should_include_stats_entry(&message.message_type, message.is_sidechain, has_usage, mode)
        {
            continue;
        }

        included_message_count += 1;
        total_input_tokens += u64::from(usage.input_tokens.unwrap_or(0));
        total_output_tokens += u64::from(usage.output_tokens.unwrap_or(0));
        total_cache_creation_tokens += u64::from(usage.cache_creation_input_tokens.unwrap_or(0));
        total_cache_read_tokens += u64::from(usage.cache_read_input_tokens.unwrap_or(0));

        if let Some(ts) = parsed_timestamp {
            if first_time.map_or(true, |current| ts < current) {
                first_time = Some(ts);
                first_time_raw = Some(message.timestamp.clone());
            }
            if last_time.map_or(true, |current| ts > current) {
                last_time = Some(ts);
                last_time_raw = Some(message.timestamp.clone());
            }
        }

        track_tool_usage(message, &mut tool_usage);
    }

    if included_message_count == 0 {
        return None;
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;

    Some(SessionTokenStats {
        session_id,
        project_name,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_tokens,
        message_count: included_message_count,
        first_message_time: first_time_raw.unwrap_or_else(|| "unknown".to_string()),
        last_message_time: last_time_raw.unwrap_or_else(|| "unknown".to_string()),
        summary,
        most_used_tools: build_tool_usage_stats(tool_usage),
    })
}

// ============================================================================
// UNIVERSAL ANALYTICS (for both Claude Code and Cursor)
// ============================================================================

/// Extract token usage from UniversalMessage
fn extract_universal_token_usage(message: &UniversalMessage) -> (u64, u64, u64, u64) {
    if let Some(tokens) = &message.tokens {
        let input = if tokens.input_tokens >= 0 {
            tokens.input_tokens as u64
        } else {
            0
        };
        let output = if tokens.output_tokens >= 0 {
            tokens.output_tokens as u64
        } else {
            0
        };
        let cache_creation = tokens.cache_creation_tokens.unwrap_or(0).max(0) as u64;
        let cache_read = tokens.cache_read_tokens.unwrap_or(0).max(0) as u64;
        (input, output, cache_creation, cache_read)
    } else {
        (0, 0, 0, 0)
    }
}

/// Load UniversalMessages for a session based on provider
async fn load_universal_session_messages(
    provider_id: &str,
    source_path: &str,
    session_id: &str,
) -> Result<Vec<UniversalMessage>, String> {
    match provider_id {
        "claude-code" => {
            // For Claude Code, source_path is the JSONL file path
            // load_session_messages now returns UniversalMessage
            use crate::commands::session::load_session_messages;
            load_session_messages(source_path.to_string()).await
        }
        "cursor" => {
            // For Cursor, we need to construct the encoded path format that load_cursor_messages expects
            // Format: <full_db_path>#session=<session_id>#timestamp=<timestamp>
            // source_path is the Cursor base path, we need to append the global DB path
            use crate::commands::cursor::load_cursor_messages;
            use std::path::PathBuf;

            // Build the full path to the global database
            let cursor_base = PathBuf::from(source_path);
            let global_db = cursor_base
                .join("User")
                .join("globalStorage")
                .join("state.vscdb");

            // Build the encoded path with session ID
            // We'll use a placeholder timestamp since load_cursor_messages extracts from the global DB anyway
            let encoded_path = format!(
                "{}#session={}#timestamp=unknown",
                global_db.to_string_lossy(),
                session_id
            );

            load_cursor_messages(source_path.to_string(), encoded_path).await
        }
        _ => Err(format!(
            "STATS_UNKNOWN_PROVIDER: Unknown provider: {}",
            provider_id
        )),
    }
}

/// Get all session IDs for a project based on provider
async fn get_project_session_ids(
    provider_id: &str,
    source_path: &str,
    project_id: &str,
) -> Result<Vec<String>, String> {
    match provider_id {
        "claude-code" => {
            // For Claude Code, scan JSONL files in project directory
            // Not implemented yet
            Err("Claude Code universal analytics not yet implemented".to_string())
        }
        "cursor" => {
            // For Cursor, load sessions from workspace
            use crate::commands::cursor::load_cursor_sessions;
            let sessions =
                load_cursor_sessions(source_path.to_string(), Some(project_id.to_string())).await?;
            Ok(sessions.into_iter().map(|s| s.id).collect())
        }
        _ => Err(format!(
            "STATS_UNKNOWN_PROVIDER: Unknown provider: {}",
            provider_id
        )),
    }
}

// ============================================================================
// TAURI COMMANDS - CLAUDE-SPECIFIC (rewritten with date/mode/pagination)
// ============================================================================

#[tauri::command]
pub async fn get_session_token_stats(
    session_path: String,
    start_date: Option<String>,
    end_date: Option<String>,
    stats_mode: Option<String>,
) -> Result<SessionTokenStats, String> {
    let start = std::time::Instant::now();
    let mode = parse_stats_mode(stats_mode);
    let _provider = detect_session_provider(&session_path);
    let s_limit = parse_date_limit(start_date, "start_date");
    let e_limit = parse_date_limit(end_date, "end_date");

    // Validate absolute path
    if !std::path::Path::new(&session_path).is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: session_path must be absolute".to_string());
    }

    let session_path_buf = PathBuf::from(&session_path);
    let stats = extract_session_token_stats_sync(
        &session_path_buf,
        mode,
        s_limit.as_ref(),
        e_limit.as_ref(),
    )
    .ok_or_else(|| "STATS_NO_MESSAGES: No valid messages found in session".to_string())?;

    if !is_within_date_limits(
        parse_timestamp_utc(&stats.last_message_time),
        s_limit.as_ref(),
        e_limit.as_ref(),
    ) {
        return Err("STATS_NO_MESSAGES: No valid messages found in session".to_string());
    }

    let total_time = start.elapsed();

    log::debug!(
        "get_session_token_stats: {} messages, total={}ms",
        stats.message_count,
        total_time.as_millis()
    );

    Ok(stats)
}

#[tauri::command]
pub async fn get_project_token_stats(
    project_path: String,
    offset: Option<usize>,
    limit: Option<usize>,
    start_date: Option<String>,
    end_date: Option<String>,
    stats_mode: Option<String>,
) -> Result<PaginatedTokenStats, String> {
    let mode = parse_stats_mode(stats_mode);

    if project_path.trim().is_empty() {
        return Err("project_path is required".to_string());
    }
    let project_path_buf = PathBuf::from(&project_path);
    if !project_path_buf.is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: project_path must be absolute".to_string());
    }

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(20);

    // Collect all session files
    let session_files: Vec<PathBuf> = WalkDir::new(&project_path)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        .map(|e| e.path().to_path_buf())
        .collect();

    // Parse date limits before parallel processing
    let s_limit = parse_date_limit(start_date, "start_date");
    let e_limit = parse_date_limit(end_date, "end_date");

    // Process all sessions in parallel with per-message date filtering
    let all_stats: Vec<SessionTokenStats> = session_files
        .par_iter()
        .filter_map(|path| {
            extract_session_token_stats_sync(path, mode, s_limit.as_ref(), e_limit.as_ref())
        })
        .collect();

    let total_count = all_stats.len();

    // Sort by total tokens (descending)
    let mut all_stats = all_stats;
    all_stats.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    // Apply pagination
    let paginated_items: Vec<SessionTokenStats> =
        all_stats.into_iter().skip(offset).take(limit).collect();

    let has_more = offset + paginated_items.len() < total_count;

    log::debug!(
        "get_project_token_stats: {} sessions ({} after pagination)",
        total_count,
        paginated_items.len(),
    );

    Ok(PaginatedTokenStats {
        items: paginated_items,
        total_count,
        offset,
        limit,
        has_more,
    })
}

#[tauri::command]
pub async fn get_project_stats_summary(
    project_path: String,
    start_date: Option<String>,
    end_date: Option<String>,
    stats_mode: Option<String>,
) -> Result<ProjectStatsSummary, String> {
    let mode = parse_stats_mode(stats_mode);

    if project_path.trim().is_empty() {
        return Err("project_path is required".to_string());
    }
    let project_path_buf = PathBuf::from(&project_path);
    if !project_path_buf.is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: project_path must be absolute".to_string());
    }

    let start = std::time::Instant::now();
    let project_name = PathBuf::from(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let s_limit = parse_date_limit(start_date, "start_date");
    let e_limit = parse_date_limit(end_date, "end_date");

    // Phase 1: Collect all session files
    let session_files: Vec<PathBuf> = WalkDir::new(&project_path)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        .map(|e| e.path().to_path_buf())
        .collect();
    let scan_time = start.elapsed();

    // Phase 2: Process all session files in parallel with per-message date filtering
    let file_stats: Vec<ProjectSessionFileStats> = session_files
        .par_iter()
        .filter_map(|path| {
            process_session_file_for_project_stats(path, mode, s_limit.as_ref(), e_limit.as_ref())
        })
        .collect();
    let process_time = start.elapsed();

    // Phase 3: Aggregate results
    let mut summary = ProjectStatsSummary {
        project_name,
        total_sessions: file_stats.len(),
        ..Default::default()
    };

    let mut session_durations: Vec<u32> = Vec::new();
    let mut tool_usage_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut daily_stats_map: HashMap<String, DailyStats> = HashMap::new();
    let mut activity_map: HashMap<(u8, u8), (u32, u64)> = HashMap::new();
    let mut session_count_by_date: HashMap<String, usize> = HashMap::new();

    for stats in file_stats {
        summary.total_messages += stats.total_messages as usize;

        // Aggregate token distribution
        summary.token_distribution.input += stats.token_distribution.input;
        summary.token_distribution.output += stats.token_distribution.output;
        summary.token_distribution.cache_creation += stats.token_distribution.cache_creation;
        summary.token_distribution.cache_read += stats.token_distribution.cache_read;

        // Aggregate tool usage
        for (name, (usage, success)) in stats.tool_usage {
            let entry = tool_usage_map.entry(name).or_insert((0, 0));
            entry.0 += usage;
            entry.1 += success;
        }

        // Aggregate daily stats
        for (date, daily) in stats.daily_stats {
            let entry = daily_stats_map
                .entry(date.clone())
                .or_insert_with(|| DailyStats {
                    date,
                    ..Default::default()
                });
            entry.total_tokens += daily.total_tokens;
            entry.input_tokens += daily.input_tokens;
            entry.output_tokens += daily.output_tokens;
            entry.message_count += daily.message_count;
        }

        // Aggregate activity data
        for ((hour, day), (count, tokens)) in stats.activity_data {
            let entry = activity_map.entry((hour, day)).or_insert((0, 0));
            entry.0 += count;
            entry.1 += tokens;
        }

        // Aggregate per-day session counts
        for date in stats.session_dates {
            *session_count_by_date.entry(date).or_insert(0) += 1;
        }

        // Collect session duration
        if stats.session_duration_minutes > 0 {
            session_durations.push(stats.session_duration_minutes);
        }
    }

    // Phase 4: Finalize daily stats
    for (date, daily_stat) in &mut daily_stats_map {
        daily_stat.session_count = session_count_by_date.get(date).copied().unwrap_or(0);
        daily_stat.active_hours = if daily_stat.message_count > 0 {
            (daily_stat.message_count / 10).clamp(1, 24)
        } else {
            0
        };
    }

    summary.most_used_tools = build_tool_usage_stats(tool_usage_map);

    summary.daily_stats = daily_stats_map.into_values().collect();
    summary.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    summary.activity_heatmap = activity_map
        .into_iter()
        .map(|((hour, day), (count, tokens))| ActivityHeatmap {
            hour,
            day,
            activity_count: count,
            tokens_used: tokens,
        })
        .collect();

    summary.total_tokens = summary.token_distribution.input
        + summary.token_distribution.output
        + summary.token_distribution.cache_creation
        + summary.token_distribution.cache_read;
    summary.avg_tokens_per_session = if summary.total_sessions > 0 {
        summary.total_tokens / summary.total_sessions as u64
    } else {
        0
    };
    summary.total_session_duration = session_durations.iter().sum::<u32>();
    summary.avg_session_duration = if session_durations.is_empty() {
        0
    } else {
        summary.total_session_duration / session_durations.len() as u32
    };

    summary.most_active_hour = summary
        .activity_heatmap
        .iter()
        .max_by_key(|a| a.activity_count)
        .map_or(0, |a| a.hour);

    let total_time = start.elapsed();
    log::debug!(
        "get_project_stats_summary: {} sessions, scan={}ms, process={}ms, total={}ms",
        summary.total_sessions,
        scan_time.as_millis(),
        process_time.as_millis(),
        total_time.as_millis()
    );

    Ok(summary)
}

#[tauri::command]
pub async fn get_session_comparison(
    session_id: String,
    project_path: String,
    start_date: Option<String>,
    end_date: Option<String>,
    stats_mode: Option<String>,
) -> Result<SessionComparison, String> {
    let mode = parse_stats_mode(stats_mode);
    let start = std::time::Instant::now();
    let s_limit = parse_date_limit(start_date, "start_date");
    let e_limit = parse_date_limit(end_date, "end_date");

    // Phase 1: Collect all session files
    let session_files: Vec<PathBuf> = WalkDir::new(&project_path)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        .map(|e| e.path().to_path_buf())
        .collect();
    let scan_time = start.elapsed();

    // Phase 2: Process all session files in parallel with per-message date filtering
    let all_sessions: Vec<SessionComparisonStats> = session_files
        .par_iter()
        .filter_map(|path| {
            process_session_file_for_comparison(path, mode, s_limit.as_ref(), e_limit.as_ref())
        })
        .collect();
    let process_time = start.elapsed();

    let target_session = all_sessions
        .iter()
        .find(|s| s.session_id == session_id)
        .ok_or("Session not found in project")?;

    let total_project_tokens: u64 = all_sessions.iter().map(|s| s.total_tokens).sum();
    let total_project_messages: usize = all_sessions.iter().map(|s| s.message_count).sum();

    let percentage_of_project_tokens = if total_project_tokens > 0 {
        (target_session.total_tokens as f32 / total_project_tokens as f32) * 100.0
    } else {
        0.0
    };

    let percentage_of_project_messages = if total_project_messages > 0 {
        (target_session.message_count as f32 / total_project_messages as f32) * 100.0
    } else {
        0.0
    };

    // Sort by tokens to find rank
    let mut sessions_by_tokens = all_sessions.clone();
    sessions_by_tokens.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    let rank_by_tokens = sessions_by_tokens
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0)
        + 1;

    // Sort by duration to find rank
    let mut sessions_by_duration = all_sessions.clone();
    sessions_by_duration.sort_by(|a, b| b.duration_seconds.cmp(&a.duration_seconds));

    let rank_by_duration = sessions_by_duration
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0)
        + 1;

    let avg_tokens = if all_sessions.is_empty() {
        0
    } else {
        total_project_tokens / all_sessions.len() as u64
    };
    let is_above_average = target_session.total_tokens > avg_tokens;
    let total_time = start.elapsed();

    log::debug!(
        "get_session_comparison: {} sessions, scan={}ms, process={}ms, total={}ms",
        all_sessions.len(),
        scan_time.as_millis(),
        process_time.as_millis(),
        total_time.as_millis()
    );

    Ok(SessionComparison {
        session_id,
        percentage_of_project_tokens,
        percentage_of_project_messages,
        rank_by_tokens,
        rank_by_duration,
        is_above_average,
    })
}

// ============================================================================
// NEW COMMAND: GLOBAL STATS SUMMARY
// ============================================================================

#[tauri::command]
pub async fn get_global_stats_summary(
    claude_path: String,
    active_providers: Option<Vec<String>>,
    stats_mode: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<GlobalStatsSummary, String> {
    let mode = parse_stats_mode(stats_mode);
    let providers_to_include = parse_active_stats_providers(active_providers);
    let s_limit = parse_date_limit(start_date, "global start_date");
    let e_limit = parse_date_limit(end_date, "global end_date");
    let projects_path = PathBuf::from(&claude_path).join("projects");

    // Phase 1: Collect all session files and their project names
    let mut session_files: Vec<PathBuf> = Vec::new();
    let mut project_names: HashSet<String> = HashSet::new();

    if providers_to_include.contains(&StatsProvider::Claude) && projects_path.exists() {
        match fs::read_dir(&projects_path) {
            Ok(entries) => {
                for project_entry in entries {
                    let project_entry = match project_entry {
                        Ok(entry) => entry,
                        Err(e) => {
                            log::warn!("Skipping unreadable Claude project entry: {e}");
                            continue;
                        }
                    };
                    let project_path = project_entry.path();

                    if !project_path.is_dir() {
                        continue;
                    }

                    let project_name = project_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    project_names.insert(format!("claude:{project_name}"));

                    for entry in WalkDir::new(&project_path)
                        .into_iter()
                        .filter_map(std::result::Result::ok)
                        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
                    {
                        session_files.push(entry.path().to_path_buf());
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read Claude projects directory: {e}");
            }
        }
    }

    // Phase 2: Process all Claude session files in parallel
    let s_ref = s_limit.as_ref();
    let e_ref = e_limit.as_ref();
    let file_stats: Vec<SessionFileStats> = session_files
        .par_iter()
        .filter_map(|path| process_session_file_for_global_stats(path, mode, s_ref, e_ref))
        .collect();

    // NOTE: Codex and Gemini providers are not yet supported for global stats
    // because their command functions are async Tauri commands that require Tauri state.
    // To add them later, we would need synchronous provider functions or a different approach.
    if providers_to_include.contains(&StatsProvider::Codex) {
        log::debug!("Codex provider global stats not yet supported in fork; skipping");
    }
    if providers_to_include.contains(&StatsProvider::Gemini) {
        log::debug!("Gemini provider global stats not yet supported in fork; skipping");
    }

    // When date filtering is active, exclude sessions that ended up with zero messages
    let mut file_stats = file_stats;
    if s_ref.is_some() || e_ref.is_some() {
        file_stats.retain(|s| s.total_messages > 0);
    }

    let active_project_keys: HashSet<String> = file_stats
        .iter()
        .map(|stats| {
            format!(
                "{}:{}",
                stats_provider_id(stats.provider),
                stats.project_name
            )
        })
        .collect();

    // Phase 3: Aggregate results
    let mut summary = GlobalStatsSummary {
        total_projects: active_project_keys.len() as u32,
        total_sessions: file_stats.len() as u32,
        ..Default::default()
    };

    let mut tool_usage_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut daily_stats_map: HashMap<String, DailyStats> = HashMap::new();
    let mut activity_map: HashMap<(u8, u8), (u32, u64)> = HashMap::new();
    let mut model_usage_map: HashMap<String, (u32, u64, u64, u64, u64, u64)> = HashMap::new();
    let mut project_stats_map: HashMap<String, (u32, u32, u64)> = HashMap::new();
    let mut provider_stats_map: HashMap<StatsProvider, (u32, u32, u64)> = HashMap::new();
    let mut provider_projects_map: HashMap<StatsProvider, HashSet<String>> = HashMap::new();
    let mut global_first_message: Option<DateTime<Utc>> = None;
    let mut global_last_message: Option<DateTime<Utc>> = None;

    for stats in file_stats {
        let provider = stats.provider;
        let project_name = stats.project_name.clone();

        summary.total_messages += stats.total_messages;
        summary.total_tokens += stats.total_tokens;
        summary.total_session_duration_minutes += stats.session_duration_minutes;

        // Aggregate token distribution
        summary.token_distribution.input += stats.token_distribution.input;
        summary.token_distribution.output += stats.token_distribution.output;
        summary.token_distribution.cache_creation += stats.token_distribution.cache_creation;
        summary.token_distribution.cache_read += stats.token_distribution.cache_read;

        // Aggregate tool usage
        for (name, (usage, success)) in stats.tool_usage {
            let entry = tool_usage_map.entry(name).or_insert((0, 0));
            entry.0 += usage;
            entry.1 += success;
        }

        // Aggregate daily stats
        for (date, daily) in stats.daily_stats {
            let entry = daily_stats_map
                .entry(date.clone())
                .or_insert_with(|| DailyStats {
                    date,
                    ..Default::default()
                });
            entry.total_tokens += daily.total_tokens;
            entry.input_tokens += daily.input_tokens;
            entry.output_tokens += daily.output_tokens;
            entry.message_count += daily.message_count;
        }

        // Aggregate activity data
        for ((hour, day), (count, tokens)) in stats.activity_data {
            let entry = activity_map.entry((hour, day)).or_insert((0, 0));
            entry.0 += count;
            entry.1 += tokens;
        }

        // Aggregate model usage
        for (model, (msg_count, total, input, output, cache_create, cache_read)) in
            stats.model_usage
        {
            let entry = model_usage_map.entry(model).or_insert((0, 0, 0, 0, 0, 0));
            entry.0 += msg_count;
            entry.1 += total;
            entry.2 += input;
            entry.3 += output;
            entry.4 += cache_create;
            entry.5 += cache_read;
        }

        // Aggregate provider stats
        let provider_entry = provider_stats_map.entry(provider).or_insert((0, 0, 0));
        provider_entry.0 += 1; // sessions
        provider_entry.1 += stats.total_messages; // messages
        provider_entry.2 += stats.total_tokens; // tokens

        provider_projects_map
            .entry(provider)
            .or_default()
            .insert(project_name.clone());

        // Aggregate project stats
        let project_entry = project_stats_map.entry(project_name).or_insert((0, 0, 0));
        project_entry.0 += 1; // sessions
        project_entry.1 += stats.total_messages; // messages
        project_entry.2 += stats.total_tokens; // tokens

        // Track global first/last message
        if let Some(first) = stats.first_message {
            if global_first_message.is_none() || first < global_first_message.unwrap() {
                global_first_message = Some(first);
            }
        }
        if let Some(last) = stats.last_message {
            if global_last_message.is_none() || last > global_last_message.unwrap() {
                global_last_message = Some(last);
            }
        }
    }

    // Phase 4: Build final summary structures
    summary.most_used_tools = build_tool_usage_stats(tool_usage_map);

    summary.provider_distribution = provider_stats_map
        .into_iter()
        .map(
            |(provider, (sessions, messages, tokens))| ProviderUsageStats {
                provider_id: stats_provider_id(provider).to_string(),
                projects: provider_projects_map
                    .get(&provider)
                    .map(|projects| projects.len() as u32)
                    .unwrap_or(0),
                sessions,
                messages,
                tokens,
            },
        )
        .collect();
    summary
        .provider_distribution
        .sort_by(|a, b| b.tokens.cmp(&a.tokens));

    summary.model_distribution = model_usage_map
        .into_iter()
        .map(
            |(
                model_name,
                (
                    message_count,
                    token_count,
                    input_tokens,
                    output_tokens,
                    cache_creation_tokens,
                    cache_read_tokens,
                ),
            )| ModelStats {
                model_name,
                message_count,
                token_count,
                input_tokens,
                output_tokens,
                cache_creation_tokens,
                cache_read_tokens,
            },
        )
        .collect();
    summary
        .model_distribution
        .sort_by(|a, b| b.token_count.cmp(&a.token_count));

    summary.top_projects = project_stats_map
        .into_iter()
        .map(
            |(project_name, (sessions, messages, tokens))| ProjectRanking {
                project_name,
                sessions,
                messages,
                tokens,
            },
        )
        .collect();
    summary.top_projects.sort_by(|a, b| b.tokens.cmp(&a.tokens));
    summary.top_projects.truncate(10);

    summary.daily_stats = daily_stats_map.into_values().collect();
    summary.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    summary.activity_heatmap = activity_map
        .into_iter()
        .map(|((hour, day), (count, tokens))| ActivityHeatmap {
            hour,
            day,
            activity_count: count,
            tokens_used: tokens,
        })
        .collect();

    if let (Some(first), Some(last)) = (global_first_message, global_last_message) {
        summary.date_range.first_message = Some(first.to_rfc3339());
        summary.date_range.last_message = Some(last.to_rfc3339());
        summary.date_range.days_span = (last - first).num_days() as u32;
    }

    Ok(summary)
}

// ============================================================================
// UNIVERSAL STATS COMMANDS (fork-only, kept as-is)
// ============================================================================

#[tauri::command]
pub async fn get_universal_session_token_stats(
    provider_id: String,
    source_path: String,
    session_id: String,
) -> Result<SessionTokenStats, String> {
    // Validate absolute path
    if !std::path::Path::new(&source_path).is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: source_path must be absolute".to_string());
    }

    let messages = load_universal_session_messages(&provider_id, &source_path, &session_id).await?;

    if messages.is_empty() {
        return Err("STATS_NO_MESSAGES: No valid messages found in session".to_string());
    }

    // Extract project name from first message's project_id
    let project_name = messages
        .first()
        .map(|m| m.project_id.clone())
        .unwrap_or_else(|| "unknown".to_string());

    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_cache_creation_tokens = 0u64;
    let mut total_cache_read_tokens = 0u64;

    let mut first_time: Option<String> = None;
    let mut last_time: Option<String> = None;

    println!(
        "  📊 Aggregating token stats from {} messages:",
        messages.len()
    );
    let mut _messages_with_tokens = 0;

    for message in &messages {
        let (input, output, cache_creation, cache_read) = extract_universal_token_usage(message);

        if input > 0 || output > 0 {
            _messages_with_tokens += 1;
            println!(
                "    Message {} has tokens: input={}, output={}",
                message.id, input, output
            );
        }

        total_input_tokens += input;
        total_output_tokens += output;
        total_cache_creation_tokens += cache_creation;
        total_cache_read_tokens += cache_read;

        if first_time.is_none() || message.timestamp < first_time.as_ref().unwrap().clone() {
            first_time = Some(message.timestamp.clone());
        }
        if last_time.is_none() || message.timestamp > last_time.as_ref().unwrap().clone() {
            last_time = Some(message.timestamp.clone());
        }
    }

    let total_tokens = total_input_tokens
        + total_output_tokens
        + total_cache_creation_tokens
        + total_cache_read_tokens;

    println!(
        "  📈 Token stats summary: {} total tokens from {} messages",
        total_tokens,
        messages.len()
    );

    Ok(SessionTokenStats {
        session_id,
        project_name,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_tokens,
        message_count: messages.len(),
        first_message_time: first_time.unwrap_or_else(|| "unknown".to_string()),
        last_message_time: last_time.unwrap_or_else(|| "unknown".to_string()),
        summary: None,
        most_used_tools: Vec::new(),
    })
}

#[tauri::command]
pub async fn get_universal_project_token_stats(
    provider_id: String,
    source_path: String,
    project_id: String,
) -> Result<Vec<SessionTokenStats>, String> {
    // Validate absolute path
    if !std::path::Path::new(&source_path).is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: source_path must be absolute".to_string());
    }

    let session_ids = get_project_session_ids(&provider_id, &source_path, &project_id).await?;

    let mut session_stats = Vec::new();

    for session_id in session_ids {
        match get_universal_session_token_stats(
            provider_id.clone(),
            source_path.clone(),
            session_id,
        )
        .await
        {
            Ok(stats) => session_stats.push(stats),
            Err(e) => {
                // Log error but continue with other sessions
                eprintln!("Failed to get stats for session: {}", e);
                continue;
            }
        }
    }

    // Sort by total tokens (descending)
    session_stats.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    Ok(session_stats)
}

#[tauri::command]
pub async fn get_universal_project_stats_summary(
    provider_id: String,
    source_path: String,
    project_id: String,
) -> Result<ProjectStatsSummary, String> {
    // Validate absolute path
    if !std::path::Path::new(&source_path).is_absolute() {
        return Err("STATS_INVALID_ARGUMENT: source_path must be absolute".to_string());
    }

    let project_name = project_id.clone();
    let session_ids = get_project_session_ids(&provider_id, &source_path, &project_id).await?;

    let mut summary = ProjectStatsSummary {
        project_name,
        total_sessions: session_ids.len(),
        ..Default::default()
    };

    let mut session_durations: Vec<u32> = Vec::new();
    let mut tool_usage_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut daily_stats_map: HashMap<String, DailyStats> = HashMap::new();
    let mut activity_map: HashMap<(u8, u8), (u32, u64)> = HashMap::new();
    let mut session_dates: HashSet<String> = HashSet::new();

    for session_id in session_ids {
        let messages =
            match load_universal_session_messages(&provider_id, &source_path, &session_id).await {
                Ok(msgs) => msgs,
                Err(_) => continue, // Skip sessions that fail to load
            };

        if messages.is_empty() {
            continue;
        }

        let mut session_start: Option<DateTime<Utc>> = None;
        let mut session_end: Option<DateTime<Utc>> = None;
        let mut session_has_messages = false;

        for message in &messages {
            summary.total_messages += 1;
            session_has_messages = true;

            if let Ok(timestamp) = DateTime::parse_from_rfc3339(&message.timestamp) {
                let timestamp = timestamp.with_timezone(&Utc);

                if session_start.is_none() || timestamp < session_start.unwrap() {
                    session_start = Some(timestamp);
                }
                if session_end.is_none() || timestamp > session_end.unwrap() {
                    session_end = Some(timestamp);
                }

                let hour = timestamp.hour() as u8;
                let day = timestamp.weekday().num_days_from_sunday() as u8;
                let (input, output, cache_creation, cache_read) =
                    extract_universal_token_usage(message);
                let tokens = input + output + cache_creation + cache_read;

                let activity_entry = activity_map.entry((hour, day)).or_insert((0, 0));
                activity_entry.0 += 1;
                activity_entry.1 += tokens;

                let date = timestamp.format("%Y-%m-%d").to_string();
                session_dates.insert(date.clone());

                let daily_entry =
                    daily_stats_map
                        .entry(date.clone())
                        .or_insert_with(|| DailyStats {
                            date,
                            ..Default::default()
                        });

                daily_entry.total_tokens += tokens;
                daily_entry.input_tokens += input;
                daily_entry.output_tokens += output;
                daily_entry.message_count += 1;

                summary.token_distribution.input += input;
                summary.token_distribution.output += output;
                summary.token_distribution.cache_creation += cache_creation;
                summary.token_distribution.cache_read += cache_read;
            }

            // Extract tool usage from UniversalMessage
            if let Some(ref tool_calls) = message.tool_calls {
                for tool_call in tool_calls {
                    let tool_entry = tool_usage_map
                        .entry(tool_call.name.clone())
                        .or_insert((0, 0));
                    tool_entry.0 += 1;
                    // For now, assume all tool calls succeed
                    tool_entry.1 += 1;
                }
            }
        }

        if let (Some(start), Some(end)) = (session_start, session_end) {
            let duration = (end - start).num_minutes() as u32;
            session_durations.push(duration);
        }

        if session_has_messages {
            if let Some(start) = session_start {
                let date = start.format("%Y-%m-%d").to_string();
                session_dates.insert(date);
            }
        }
    }

    for (date, daily_stat) in daily_stats_map.iter_mut() {
        daily_stat.session_count = session_dates.iter().filter(|&d| d == date).count();
        daily_stat.active_hours = if daily_stat.message_count > 0 {
            (daily_stat.message_count / 10).clamp(1, 24)
        } else {
            0
        };
    }

    summary.most_used_tools = build_tool_usage_stats(tool_usage_map);

    summary.daily_stats = daily_stats_map.into_values().collect();
    summary.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    summary.activity_heatmap = activity_map
        .into_iter()
        .map(|((hour, day), (count, tokens))| ActivityHeatmap {
            hour,
            day,
            activity_count: count,
            tokens_used: tokens,
        })
        .collect();

    summary.total_tokens = summary.token_distribution.input
        + summary.token_distribution.output
        + summary.token_distribution.cache_creation
        + summary.token_distribution.cache_read;
    summary.avg_tokens_per_session = if summary.total_sessions > 0 {
        summary.total_tokens / summary.total_sessions as u64
    } else {
        0
    };
    summary.total_session_duration = session_durations.iter().sum::<u32>();
    summary.avg_session_duration = if !session_durations.is_empty() {
        summary.total_session_duration / session_durations.len() as u32
    } else {
        0
    };

    summary.most_active_hour = summary
        .activity_heatmap
        .iter()
        .max_by_key(|a| a.activity_count)
        .map(|a| a.hour)
        .unwrap_or(0);

    Ok(summary)
}

#[tauri::command]
pub async fn get_universal_session_comparison(
    provider_id: String,
    source_path: String,
    session_id: String,
    project_id: String,
) -> Result<SessionComparison, String> {
    let all_sessions =
        get_universal_project_token_stats(provider_id.clone(), source_path.clone(), project_id)
            .await?;

    let target_session = all_sessions
        .iter()
        .find(|s| s.session_id == session_id)
        .ok_or("Session not found in project")?;

    let total_project_tokens: u64 = all_sessions.iter().map(|s| s.total_tokens).sum();
    let total_project_messages: usize = all_sessions.iter().map(|s| s.message_count).sum();

    let percentage_of_project_tokens = if total_project_tokens > 0 {
        (target_session.total_tokens as f32 / total_project_tokens as f32) * 100.0
    } else {
        0.0
    };

    let percentage_of_project_messages = if total_project_messages > 0 {
        (target_session.message_count as f32 / total_project_messages as f32) * 100.0
    } else {
        0.0
    };

    let rank_by_tokens = all_sessions
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0)
        + 1;

    let mut sessions_by_duration = all_sessions.clone();
    sessions_by_duration.sort_by(|a, b| {
        let a_duration = chrono::DateTime::parse_from_rfc3339(&a.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&a.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        let b_duration = chrono::DateTime::parse_from_rfc3339(&b.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&b.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        b_duration.cmp(&a_duration)
    });

    let rank_by_duration = sessions_by_duration
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0)
        + 1;

    let avg_tokens = if !all_sessions.is_empty() {
        total_project_tokens / all_sessions.len() as u64
    } else {
        0
    };
    let is_above_average = target_session.total_tokens > avg_tokens;

    Ok(SessionComparison {
        session_id,
        percentage_of_project_tokens,
        percentage_of_project_messages,
        rank_by_tokens,
        rank_by_duration,
        is_above_average,
    })
}

// ============================================================================
// TryFrom<RawLogEntry> for ClaudeMessage (fork's version, kept as-is)
// ============================================================================

impl TryFrom<RawLogEntry> for ClaudeMessage {
    type Error = String;

    fn try_from(log_entry: RawLogEntry) -> Result<Self, Self::Error> {
        if log_entry.message_type == "summary" {
            return Err("Summary entries should be handled separately".to_string());
        }
        if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
            return Err("Missing session_id and timestamp".to_string());
        }

        let (role, message_id, model, stop_reason, usage) = if let Some(ref msg) = log_entry.message
        {
            (
                Some(msg.role.clone()),
                msg.id.clone(),
                msg.model.clone(),
                msg.stop_reason.clone(),
                msg.usage.clone(),
            )
        } else {
            (None, None, None, None, None)
        };

        Ok(ClaudeMessage {
            uuid: log_entry
                .uuid
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            parent_uuid: log_entry.parent_uuid,
            session_id: log_entry
                .session_id
                .unwrap_or_else(|| "unknown-session".to_string()),
            timestamp: log_entry
                .timestamp
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
            message_type: log_entry.message_type.clone(),
            content: log_entry.message.map(|m| m.content),
            tool_use: log_entry.tool_use,
            tool_use_result: log_entry.tool_use_result,
            is_sidechain: log_entry.is_sidechain,
            usage,
            role,
            message_id,
            model,
            stop_reason,
            project_path: None,
        })
    }
}
