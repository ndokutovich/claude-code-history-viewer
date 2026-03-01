/**
 * Agent Progress Helpers
 *
 * Functions for grouping and processing agent progress messages.
 */

import type { UIMessage } from "../../../types";
import type { ProgressData } from "../../../types/core/message";
import type { AgentProgressEntry, AgentProgressGroupResult } from "../types";

export const getAgentIdFromProgress = (
  message: UIMessage
): string | null => {
  if (message.type !== "progress") return null;
  const data = (message as UIMessage & { data?: ProgressData }).data;
  return data?.type === "agent_progress" ? data.agentId || null : null;
};

/**
 * Group consecutive agent progress messages by agentId
 * Only groups progress messages that appear consecutively in the message list
 */
export const groupAgentProgressMessages = (
  messages: UIMessage[]
): Map<string, AgentProgressGroupResult> => {
  const groups = new Map<string, AgentProgressGroupResult>();

  let prevAgentId: string | null = null;
  let prevWasProgress = false;
  let currentGroup: { leaderId: string; entries: AgentProgressEntry[]; messageUuids: Set<string> } | null = null;

  for (const msg of messages) {
    const agentId = getAgentIdFromProgress(msg);

    if (agentId) {
      const progressData = (msg as UIMessage & { data?: ProgressData }).data;
      const entry: AgentProgressEntry = {
        data: progressData as ProgressData,
        timestamp: msg.timestamp,
        uuid: msg.uuid,
      };

      // Check if this continues the current group (same agentId and previous was also progress)
      if (prevWasProgress && prevAgentId === agentId && currentGroup) {
        // Append to current group
        currentGroup.entries.push(entry);
        currentGroup.messageUuids.add(msg.uuid);
      } else {
        // Start a new group
        currentGroup = {
          leaderId: msg.uuid,
          entries: [entry],
          messageUuids: new Set([msg.uuid]),
        };
        groups.set(msg.uuid, {
          entries: currentGroup.entries,
          messageUuids: currentGroup.messageUuids,
        });
      }

      prevAgentId = agentId;
      prevWasProgress = true;
    } else {
      // Not a progress message - reset tracking
      prevAgentId = null;
      prevWasProgress = false;
      currentGroup = null;
    }
  }

  return groups;
};
