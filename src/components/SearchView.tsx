import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { useTranslation } from "react-i18next";
import type { ClaudeMessage, ClaudeSession } from "@/types";

interface GroupedSearchResult {
  sessionId: string;
  projectPath: string | null;
  session: ClaudeSession | null;
  messages: ClaudeMessage[];
  isExpanded: boolean;
}

export const SearchView = () => {
  const { t } = useTranslation("common");
  const {
    searchQuery,
    searchResults,
    isLoadingMessages,
    projects,
    searchMessages,
    selectSession,
    selectProject,
    setSearchOpen,
    loadProjectSessions,
  } = useAppStore();

  const [query, setQuery] = useState(searchQuery);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [searchResultSessions, setSearchResultSessions] = useState<Map<string, ClaudeSession>>(new Map());

  // Load session metadata for all search results
  useEffect(() => {
    const loadSessionMetadata = async () => {
      if (searchResults.length === 0) {
        setSearchResultSessions(new Map());
        return;
      }

      // Group by project path to minimize backend calls
      const projectPaths = new Set<string>();
      searchResults.forEach(msg => {
        if (msg.projectPath) projectPaths.add(msg.projectPath);
      });

      const sessionMap = new Map<string, ClaudeSession>();

      // Load sessions for each project
      for (const projectPath of projectPaths) {
        try {
          const sessions = await loadProjectSessions(projectPath);
          sessions.forEach(session => {
            sessionMap.set(session.actual_session_id, session);
          });
        } catch (error) {
          console.error("Failed to load sessions for project:", projectPath, error);
        }
      }

      setSearchResultSessions(sessionMap);
    };

    loadSessionMetadata();
  }, [searchResults, loadProjectSessions]);

  // Group search results by session
  const groupedResults = useMemo(() => {
    const groups = new Map<string, GroupedSearchResult>();

    searchResults.forEach((message) => {
      if (!groups.has(message.sessionId)) {
        // Find the session in the loaded search result sessions
        const session = searchResultSessions.get(message.sessionId) || null;

        groups.set(message.sessionId, {
          sessionId: message.sessionId,
          projectPath: message.projectPath || null,
          session,
          messages: [],
          isExpanded: expandedSessions.has(message.sessionId),
        });
      }
      groups.get(message.sessionId)!.messages.push(message);
    });

    return Array.from(groups.values()).sort(
      (a, b) =>
        new Date(b.messages[0]?.timestamp || 0).getTime() -
        new Date(a.messages[0]?.timestamp || 0).getTime()
    );
  }, [searchResults, searchResultSessions, expandedSessions]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      await searchMessages(query);
    }
  };

  const handleClear = () => {
    setQuery("");
    searchMessages("", {});
  };

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const { t: tComponents } = useTranslation("components");

  const handleJumpToMessage = async (
    group: GroupedSearchResult,
    messageUuid: string
  ) => {
    console.log("Jump to message clicked:", { group, messageUuid });

    try {
      if (!group.session) {
        console.error("Session not loaded - this should not happen");
        alert("Session information not loaded yet. Please try again.");
        return;
      }

      if (!group.projectPath) {
        console.error("No project path - this should not happen");
        alert("Cannot jump to message: Missing project information");
        return;
      }

      // Find the project that matches this session
      const project = projects.find((p) => p.path === group.projectPath);
      if (!project) {
        console.error("Project not found:", group.projectPath);
        alert("Cannot find project for this session");
        return;
      }

      console.log("Switching to project:", project.name);
      // Switch to the project first (updates UI to show correct project)
      await selectProject(project);

      console.log("Closing search view");
      // Close search view
      setSearchOpen(false);

      console.log("Loading session with full messages:", group.session.session_id);
      // Load full conversation with large page size
      await selectSession(group.session, 10000);

      console.log("Waiting for render...");
      // Scroll to message after a brief delay to allow rendering
      setTimeout(() => {
        console.log("Attempting to find element:", `message-${messageUuid}`);
        const element = document.getElementById(`message-${messageUuid}`);
        if (element) {
          console.log("Element found, scrolling to it");
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight-message");
          setTimeout(() => element.classList.remove("highlight-message"), 2000);
        } else {
          console.error("Message element not found:", `message-${messageUuid}`);
          alert(`Message not found in conversation. UUID: ${messageUuid}`);
        }
      }, 500);
    } catch (error) {
      console.error("Error jumping to message:", error);
      alert(`Error jumping to message: ${error}`);
    }
  };

  const renderMessagePreview = (message: ClaudeMessage) => {
    let preview = "";

    // Try to extract text from content
    if (typeof message.content === "string") {
      preview = message.content;
    } else if (Array.isArray(message.content)) {
      // Extract all text from array items
      const texts = message.content
        .filter((c: any) => c.type === "text" && c.text)
        .map((c: any) => c.text);
      preview = texts.join(" ");
    } else if (message.content && typeof message.content === "object") {
      // Handle object content
      const obj = message.content as any;
      if (obj.text) {
        preview = obj.text;
      } else if (obj.content && typeof obj.content === "string") {
        preview = obj.content;
      }
    }

    // If still no preview, show a placeholder
    if (!preview.trim()) {
      preview = tComponents("message.none");
    }

    // Highlight search query in preview
    const highlightQuery = (text: string) => {
      if (!query) return text;
      const parts = text.split(new RegExp(`(${query})`, "gi"));
      return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
            {part}
          </mark>
        ) : (
          part
        )
      );
    };

    return (
      <div className={cn("text-sm", COLORS.ui.text.secondary)}>
        {highlightQuery(preview.slice(0, 200))}
        {preview.length > 200 && "..."}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Input */}
      <div className={cn("p-4 border-b", COLORS.ui.border.light)}>
        <form onSubmit={handleSearch} className="relative">
          <Search
            className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
              COLORS.ui.text.muted
            )}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className={cn(
              "w-full pl-10 pr-10 py-2 rounded-lg border",
              COLORS.ui.border.light,
              COLORS.ui.background.primary,
              COLORS.ui.text.primary,
              "focus:outline-none focus:ring-2 focus:ring-blue-500"
            )}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingMessages ? (
          <div className={cn("text-center py-8", COLORS.ui.text.muted)}>
            {t("search.searching")}
          </div>
        ) : searchResults.length === 0 ? (
          <div className={cn("text-center py-8", COLORS.ui.text.muted)}>
            {searchQuery
              ? t("search.noResults")
              : t("search.enterQuery")}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn("text-sm", COLORS.ui.text.muted)}>
              {t("search.foundResults", {
                count: searchResults.length,
                sessions: groupedResults.length,
              })}
            </div>

            {groupedResults.map((group) => (
              <div
                key={group.sessionId}
                className={cn(
                  "border rounded-lg",
                  COLORS.ui.border.light,
                  COLORS.ui.background.secondary
                )}
              >
                {/* Session Header */}
                <button
                  onClick={() => toggleSession(group.sessionId)}
                  className={cn(
                    "w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    {group.isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <MessageSquare className="w-4 h-4" />
                    <div className="text-left">
                      <div className={cn("font-medium", COLORS.ui.text.primary)}>
                        {group.session?.summary || `Session ${group.sessionId.slice(-8)}`}
                      </div>
                      <div className={cn("text-xs", COLORS.ui.text.muted)}>
                        {group.messages.length} {t("search.matches")}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Messages */}
                {group.isExpanded && (
                  <div className="border-t divide-y">
                    {group.messages.map((message) => (
                      <div
                        key={message.uuid}
                        className={cn(
                          "p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        )}
                        onClick={() =>
                          handleJumpToMessage(group, message.uuid)
                        }
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={cn(
                              "text-xs font-medium",
                              message.type === "user"
                                ? COLORS.message.user.text
                                : COLORS.message.assistant.text
                            )}
                          >
                            {message.type === "user" ? tComponents("message.user") : tComponents("message.claude")}
                          </div>
                          <div className={cn("text-xs", COLORS.ui.text.muted)}>
                            {new Date(message.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {renderMessagePreview(message)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
