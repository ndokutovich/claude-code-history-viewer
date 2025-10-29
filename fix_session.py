#!/usr/bin/env python3
"""
Fix artificial session to add missing Claude Code metadata fields.
This makes the session compatible with Claude Code's validation.
"""

import json
import sys
from pathlib import Path
import uuid

def fix_session(session_path: str):
    """Add missing Claude Code metadata to artificial session."""

    session_file = Path(session_path)
    if not session_file.exists():
        print(f"Error: Session file not found: {session_path}")
        return False

    # Read all lines
    lines = []
    with open(session_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                lines.append(msg)
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line: {e}")
                continue

    if not lines:
        print("Error: No valid messages found in session")
        return False

    print(f"Found {len(lines)} messages in session")

    # Check if file-history-snapshot exists
    has_snapshot = any(msg.get('type') == 'file-history-snapshot' for msg in lines)

    fixed_lines = []

    # Add file-history-snapshot as first message if missing
    if not has_snapshot:
        first_msg_uuid = lines[0].get('uuid', str(uuid.uuid4()))
        snapshot = {
            "type": "file-history-snapshot",
            "messageId": first_msg_uuid,
            "snapshot": {
                "messageId": first_msg_uuid,
                "trackedFileBackups": {},
                "timestamp": lines[0].get('timestamp', '2025-10-29T10:00:00.000Z')
            },
            "isSnapshotUpdate": False
        }
        fixed_lines.append(snapshot)
        print("[+] Added file-history-snapshot")

    # Fix each message
    for msg in lines:
        msg_type = msg.get('type', '')

        # Skip file-history-snapshot (already added)
        if msg_type == 'file-history-snapshot':
            fixed_lines.append(msg)
            continue

        # Update version to match real Claude Code
        if 'version' in msg:
            msg['version'] = '2.0.28'

        # Add gitBranch if missing
        if 'gitBranch' not in msg and msg_type in ['user', 'assistant']:
            msg['gitBranch'] = 'main'

        # Add requestId for assistant messages
        if msg_type == 'assistant' and 'requestId' not in msg:
            msg['requestId'] = f"req_{uuid.uuid4().hex}"

        # Add thinkingMetadata for user messages
        if msg_type == 'user' and 'thinkingMetadata' not in msg:
            msg['thinkingMetadata'] = {
                "level": "high",
                "disabled": False,
                "triggers": []
            }

        fixed_lines.append(msg)

    # Create backup
    backup_path = session_file.with_suffix('.jsonl.backup')
    session_file.rename(backup_path)
    print(f"[+] Created backup: {backup_path}")

    # Write fixed session
    with open(session_file, 'w', encoding='utf-8') as f:
        for msg in fixed_lines:
            f.write(json.dumps(msg, ensure_ascii=False) + '\n')

    print(f"[+] Fixed session written: {session_file}")
    print(f"[+] Total messages: {len(fixed_lines)}")

    return True

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python fix_session.py <session.jsonl>")
        sys.exit(1)

    session_path = sys.argv[1]
    success = fix_session(session_path)
    sys.exit(0 if success else 1)
