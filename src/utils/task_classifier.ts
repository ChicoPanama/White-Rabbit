/**
 * Task Classifier - Centralized detection for audit/research tasks
 *
 * Determines whether a task should be routed to the Research Pipeline
 * based on mode, tags, or explicit commands.
 */

export interface TaskContext {
  command?: string;
  mode?: string;
  tags?: string[];
  args?: string[];
  message?: string;
}

// Commands that trigger the audit/research pipeline
const AUDIT_COMMANDS = ['audit', 'research', 'deep-audit', 'security-review'];

// Tags that indicate an audit/research task
const AUDIT_TAGS = ['audit', 'research', 'security', 'vulnerability', 'deep-dive'];

// Modes that trigger the pipeline
const AUDIT_MODES = ['audit', 'research', 'security-analysis'];

// Keywords in messages that suggest audit/research intent
const AUDIT_KEYWORDS = [
  'audit this',
  'research this',
  'deep dive',
  'security review',
  'vulnerability analysis',
  'find vulnerabilities',
  'security audit',
  'full audit',
  'comprehensive audit',
];

/**
 * Check if a task should be routed to the audit/research pipeline
 */
export function isAuditOrResearchTask(task: TaskContext): boolean {
  // Check explicit command
  if (task.command && AUDIT_COMMANDS.includes(task.command.toLowerCase())) {
    return true;
  }

  // Check mode
  if (task.mode && AUDIT_MODES.includes(task.mode.toLowerCase())) {
    return true;
  }

  // Check tags
  if (task.tags && task.tags.length > 0) {
    const lowerTags = task.tags.map(t => t.toLowerCase());
    if (AUDIT_TAGS.some(tag => lowerTags.includes(tag))) {
      return true;
    }
  }

  // Check args for explicit flags
  if (task.args) {
    if (task.args.includes('--research') || task.args.includes('--deep-audit')) {
      return true;
    }
  }

  // Check message content for audit keywords
  if (task.message) {
    const lowerMessage = task.message.toLowerCase();
    if (AUDIT_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the audit pipeline feature is enabled
 */
export function isAuditPipelineEnabled(): boolean {
  const envValue = process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED;
  return envValue === 'true' || envValue === '1';
}

/**
 * Get the classification reason for logging/debugging
 */
export function getClassificationReason(task: TaskContext): string {
  if (task.command && AUDIT_COMMANDS.includes(task.command.toLowerCase())) {
    return `command:${task.command}`;
  }
  if (task.mode && AUDIT_MODES.includes(task.mode.toLowerCase())) {
    return `mode:${task.mode}`;
  }
  if (task.tags) {
    const matchedTag = task.tags.find(t => AUDIT_TAGS.includes(t.toLowerCase()));
    if (matchedTag) return `tag:${matchedTag}`;
  }
  if (task.args) {
    if (task.args.includes('--research')) return 'flag:--research';
    if (task.args.includes('--deep-audit')) return 'flag:--deep-audit';
  }
  if (task.message) {
    const lowerMessage = task.message.toLowerCase();
    const matchedKeyword = AUDIT_KEYWORDS.find(k => lowerMessage.includes(k));
    if (matchedKeyword) return `keyword:${matchedKeyword}`;
  }
  return 'none';
}

/**
 * Parse a Telegram message or CLI args into a TaskContext
 */
export function parseTaskContext(input: string | string[]): TaskContext {
  if (Array.isArray(input)) {
    // CLI args
    const command = input[0];
    const args = input.slice(1);
    const hasResearchFlag = args.includes('--research') || args.includes('--deep-audit');

    return {
      command,
      args,
      mode: hasResearchFlag ? 'research' : undefined,
      tags: [],
    };
  }

  // Telegram message string
  const message = input.trim();
  const words = message.split(/\s+/);
  const command = words[0]?.replace(/^\//, ''); // Remove leading slash

  return {
    command,
    message,
    args: words.slice(1),
    tags: [],
  };
}

// Export constants for testing
export const CONSTANTS = {
  AUDIT_COMMANDS,
  AUDIT_TAGS,
  AUDIT_MODES,
  AUDIT_KEYWORDS,
};
