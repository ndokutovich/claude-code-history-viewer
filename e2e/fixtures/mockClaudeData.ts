/**
 * Mock Claude Data Fixtures
 *
 * This module provides helper functions to generate mock Claude conversation data
 * for testing purposes. It creates a temporary .claude directory structure with
 * sample JSONL files that mimic real Claude Code conversation history.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MockProject {
  name: string;
  sessions: MockSession[];
}

export interface MockSession {
  id: string;
  messages: MockMessage[];
  summary?: string;
}

export interface MockMessage {
  type: 'user' | 'assistant';
  content: string;
  hasToolUse?: boolean;
  hasError?: boolean;
  toolName?: string;
}

/**
 * Create a temporary .claude directory with mock data for testing
 */
export async function createMockClaudeDirectory(testId: string): Promise<string> {
  const mockClaudePath = path.join(os.tmpdir(), 'claude-test', testId, '.claude');
  const projectsPath = path.join(mockClaudePath, 'projects');

  // Create directory structure
  if (!fs.existsSync(projectsPath)) {
    fs.mkdirSync(projectsPath, { recursive: true });
  }

  // Create mock projects
  await createMockProject(projectsPath, 'test-project-1', [
    {
      id: 'session-1',
      summary: 'Setup project and implement feature X',
      messages: [
        { type: 'user', content: 'Help me setup a new project' },
        {
          type: 'assistant',
          content: 'I\'ll help you set up the project. Let me read your package.json.',
          hasToolUse: true,
          toolName: 'Read',
        },
        { type: 'user', content: 'Now implement feature X' },
        {
          type: 'assistant',
          content: 'I\'ll implement feature X by creating a new component.',
          hasToolUse: true,
          toolName: 'Write',
        },
      ],
    },
    {
      id: 'session-2',
      summary: 'Fix bug in authentication',
      messages: [
        { type: 'user', content: 'There\'s a bug in the auth system' },
        {
          type: 'assistant',
          content: 'Let me investigate the authentication code.',
          hasToolUse: true,
          toolName: 'Read',
        },
        {
          type: 'assistant',
          content: 'I found the issue. The token validation is incorrect.',
        },
      ],
    },
  ]);

  await createMockProject(projectsPath, 'test-project-2', [
    {
      id: 'session-3',
      summary: 'Refactor database layer',
      messages: [
        { type: 'user', content: 'Refactor the database layer to use TypeORM' },
        {
          type: 'assistant',
          content: 'I\'ll help refactor to TypeORM.',
          hasToolUse: true,
          toolName: 'Edit',
        },
      ],
    },
  ]);

  return mockClaudePath;
}

/**
 * Create a mock project with sessions
 */
async function createMockProject(
  projectsPath: string,
  projectName: string,
  sessions: MockSession[]
): Promise<void> {
  const projectPath = path.join(projectsPath, projectName);

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  for (const session of sessions) {
    await createMockSession(projectPath, session);
  }
}

/**
 * Create a mock session JSONL file
 */
async function createMockSession(
  projectPath: string,
  session: MockSession
): Promise<void> {
  const sessionFile = path.join(projectPath, `${session.id}.jsonl`);
  const lines: string[] = [];

  // Add summary message if provided
  if (session.summary) {
    lines.push(
      JSON.stringify({
        uuid: `summary-${session.id}`,
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        type: 'summary',
        summary: session.summary,
      })
    );
  }

  // Add messages
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    const uuid = `msg-${session.id}-${i}`;
    const timestamp = new Date(Date.now() + i * 1000).toISOString();

    if (msg.type === 'user') {
      lines.push(
        JSON.stringify({
          uuid,
          sessionId: session.id,
          timestamp,
          type: 'user',
          message: {
            role: 'user',
            content: msg.content,
          },
        })
      );
    } else {
      // Assistant message
      const content: any[] = [
        {
          type: 'text',
          text: msg.content,
        },
      ];

      // Add tool use if specified
      if (msg.hasToolUse && msg.toolName) {
        content.push({
          type: 'tool_use',
          id: `tool-${uuid}`,
          name: msg.toolName,
          input: { path: '/test/path' },
        });
      }

      lines.push(
        JSON.stringify({
          uuid,
          sessionId: session.id,
          timestamp,
          type: 'assistant',
          message: {
            role: 'assistant',
            id: `msg-${uuid}`,
            model: 'claude-opus-4-20250514',
            content,
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
        })
      );

      // Add tool result if has error
      if (msg.hasError) {
        lines.push(
          JSON.stringify({
            uuid: `result-${uuid}`,
            parentUuid: uuid,
            sessionId: session.id,
            timestamp: new Date(Date.now() + i * 1000 + 500).toISOString(),
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: `tool-${uuid}`,
                  content: 'Error: Test error occurred',
                  is_error: true,
                },
              ],
            },
          })
        );
      }
    }
  }

  fs.writeFileSync(sessionFile, lines.join('\n'));
}

/**
 * Clean up mock Claude directory
 */
export async function cleanupMockClaudeDirectory(mockClaudePath: string): Promise<void> {
  if (fs.existsSync(mockClaudePath)) {
    fs.rmSync(mockClaudePath, { recursive: true, force: true });
  }
}
