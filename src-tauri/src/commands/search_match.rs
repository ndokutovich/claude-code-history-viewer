//! Shared search primitives.
//!
//! - [`QueryMatcher`]: SIMD-accelerated, ASCII case-insensitive multi-term
//!   matcher built once per query and shared across parallel scans.
//! - [`top_k_by`]: O(n) partial selection (top-k) instead of O(n log n) full
//!   sort before truncation.
//! - [`take_matching`]: early-termination collector that stops scanning once
//!   `limit` matches have been gathered.
//! - Generation-based cache invalidation hooks ([`bump_search_generation`]).

use aho_corasick::AhoCorasick;
use std::cmp::Ordering;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

/// Case-insensitive (ASCII) multi-term matcher.
///
/// A haystack "matches" when **every** term/pattern is present somewhere in it
/// (logical AND across terms). Replaces repeated `.to_lowercase().contains()`
/// which allocates a fresh lowercased copy of every haystack on every probe.
///
/// Note: case-insensitivity is ASCII-only (the documented aho-corasick tradeoff);
/// it avoids per-haystack heap allocation at the cost of non-ASCII case folding.
pub struct QueryMatcher {
    ac: Option<AhoCorasick>,
    term_count: usize,
}

impl QueryMatcher {
    /// Build from a raw query string, splitting on whitespace into terms.
    pub fn from_query(query: &str) -> Self {
        let terms: Vec<&str> = query.split_whitespace().collect();
        Self::from_patterns(&terms)
    }

    /// Build from explicit patterns. Empty patterns are dropped; each remaining
    /// pattern must appear in the haystack for [`QueryMatcher::is_match`] to be true.
    pub fn from_patterns<S: AsRef<str>>(patterns: &[S]) -> Self {
        let cleaned: Vec<&str> = patterns
            .iter()
            .map(|p| p.as_ref())
            .filter(|p| !p.is_empty())
            .collect();

        if cleaned.is_empty() {
            return Self {
                ac: None,
                term_count: 0,
            };
        }

        // Default match kind is Standard, which supports overlapping iteration —
        // required so one term cannot "consume" the bytes of another.
        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .build(&cleaned)
            .ok();

        let term_count = if ac.is_some() { cleaned.len() } else { 0 };
        Self { ac, term_count }
    }

    /// True when the matcher has no usable terms (e.g. empty query).
    pub fn is_empty(&self) -> bool {
        self.term_count == 0
    }

    /// True when every term appears in `haystack`.
    pub fn is_match(&self, haystack: &str) -> bool {
        let Some(ac) = &self.ac else {
            return false;
        };

        if self.term_count == 1 {
            return ac.is_match(haystack);
        }

        let mut seen = vec![false; self.term_count];
        let mut remaining = self.term_count;
        for m in ac.find_overlapping_iter(haystack) {
            let pid = m.pattern().as_usize();
            if !seen[pid] {
                seen[pid] = true;
                remaining -= 1;
                if remaining == 0 {
                    return true;
                }
            }
        }
        remaining == 0
    }
}

/// Reduce `items` to its top `limit` entries by `cmp` using an O(n) partial
/// selection (`select_nth_unstable_by`) followed by sorting only the retained
/// slice. `cmp` should order the "best/first" result as [`Ordering::Less`].
///
/// This avoids the O(n log n) cost of fully sorting a large candidate set when
/// only the first `limit` are needed.
pub fn top_k_by<T, F>(mut items: Vec<T>, limit: usize, mut cmp: F) -> Vec<T>
where
    F: FnMut(&T, &T) -> Ordering,
{
    if limit == 0 {
        return Vec::new();
    }
    if items.len() > limit {
        items.select_nth_unstable_by(limit, &mut cmp);
        items.truncate(limit);
    }
    items.sort_unstable_by(&mut cmp);
    items
}

/// Collect items for which `pred` returns true, stopping as soon as `limit`
/// matches have been gathered (early termination — never scans the whole input
/// once the budget is filled). `limit == 0` yields an empty result.
pub fn take_matching<T, I, F>(items: I, limit: usize, mut pred: F) -> Vec<T>
where
    I: IntoIterator<Item = T>,
    F: FnMut(&T) -> bool,
{
    let mut out: Vec<T> = Vec::new();
    if limit == 0 {
        return out;
    }
    for item in items {
        if out.len() >= limit {
            break;
        }
        if pred(&item) {
            out.push(item);
        }
    }
    out
}

/// Monotonic generation counter for search-result caches. Any change that could
/// affect search output (e.g. a session file write) should call
/// [`bump_search_generation`]; cached entries tagged with an older generation
/// are treated as stale.
static SEARCH_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Invalidate all cached search results by advancing the generation counter.
pub fn bump_search_generation() {
    SEARCH_GENERATION.fetch_add(1, AtomicOrdering::Relaxed);
}

/// Current search-cache generation.
pub fn current_search_generation() -> u64 {
    SEARCH_GENERATION.load(AtomicOrdering::Relaxed)
}

/// Hash arbitrary key components into a stable `u64` cache key.
pub fn cache_key<H: Hash>(parts: &H) -> u64 {
    let mut hasher = DefaultHasher::new();
    parts.hash(&mut hasher);
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matcher_is_case_insensitive() {
        let m = QueryMatcher::from_query("Error");
        assert!(m.is_match("a fatal ERROR occurred"));
        assert!(m.is_match("lowercase error here"));
        assert!(m.is_match("MiXeD eRrOr"));
        assert!(!m.is_match("no problems at all"));
    }

    #[test]
    fn matcher_single_term_substring() {
        let m = QueryMatcher::from_query("config");
        assert!(m.is_match("reconfiguration"));
        assert!(!m.is_match("conf"));
    }

    #[test]
    fn matcher_multi_term_requires_all_present_any_order() {
        let m = QueryMatcher::from_query("foo bar");
        assert!(m.is_match("bar then foo")); // order independent
        assert!(m.is_match("FOO and BAR")); // case independent
        assert!(!m.is_match("only foo here")); // missing "bar"
        assert!(!m.is_match("only bar here")); // missing "foo"
    }

    #[test]
    fn matcher_overlapping_terms_not_consumed() {
        // "ab" and "bc" overlap on the shared 'b'. Standard non-overlapping
        // iteration could miss one; overlapping iteration must find both.
        let m = QueryMatcher::from_query("ab bc");
        assert!(m.is_match("xabcx"));
    }

    #[test]
    fn matcher_from_patterns_phrase_and_words() {
        // A quoted phrase stays contiguous; separate words are AND-ed.
        let m = QueryMatcher::from_patterns(&["hello world".to_string(), "rust".to_string()]);
        assert!(m.is_match("say hello world in rust"));
        assert!(!m.is_match("hello rust world")); // phrase not contiguous
    }

    #[test]
    fn matcher_empty_query_is_empty() {
        let m = QueryMatcher::from_query("   ");
        assert!(m.is_empty());
        assert!(!m.is_match("anything"));
    }

    #[test]
    fn top_k_selects_and_orders() {
        // Descending: largest first.
        let v = vec![3, 1, 4, 1, 5, 9, 2, 6];
        let top3 = top_k_by(v, 3, |a, b| b.cmp(a));
        assert_eq!(top3, vec![9, 6, 5]);
    }

    #[test]
    fn top_k_limit_larger_than_input_sorts_all() {
        let v = vec![2, 3, 1];
        let out = top_k_by(v, 10, |a, b| b.cmp(a));
        assert_eq!(out, vec![3, 2, 1]);
    }

    #[test]
    fn top_k_zero_limit_is_empty() {
        let v = vec![1, 2, 3];
        assert!(top_k_by(v, 0, |a, b| a.cmp(b)).is_empty());
    }

    #[test]
    fn take_matching_stops_at_limit() {
        // Input has 5 matches but limit is 2; only the first 2 are collected
        // and iteration stops early (proven by the side-effect counter).
        let mut scanned = 0usize;
        let items = vec![1, 2, 3, 4, 5, 6, 7, 8];
        let out = take_matching(items, 2, |n| {
            scanned += 1;
            *n % 2 == 0 // matches 2,4,6,8
        });
        assert_eq!(out, vec![2, 4]);
        // Stopped after reaching the 2nd match (at value 4 → 4 items scanned),
        // not the whole 8-item input.
        assert_eq!(scanned, 4);
    }

    #[test]
    fn take_matching_zero_limit_scans_nothing() {
        let mut scanned = 0usize;
        let out = take_matching(vec![1, 2, 3], 0, |_| {
            scanned += 1;
            true
        });
        assert!(out.is_empty());
        assert_eq!(scanned, 0);
    }

    #[test]
    fn generation_bump_changes_value() {
        let before = current_search_generation();
        bump_search_generation();
        assert!(current_search_generation() > before);
    }

    #[test]
    fn cache_key_is_stable_and_distinct() {
        let a = cache_key(&("query", &Some(vec!["claude".to_string()]), 100usize));
        let b = cache_key(&("query", &Some(vec!["claude".to_string()]), 100usize));
        let c = cache_key(&("query", &Some(vec!["codex".to_string()]), 100usize));
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
