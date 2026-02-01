/**
 * Research Mode Command Handler
 * 
 * Explicitly activates Research Mode for audit/paper/protocol analysis
 * WITHOUT triggering active scanning or exploitation.
 */

export interface ResearchCommand {
  target: string;
  source: 'audit' | 'paper' | 'protocol' | 'exploit' | 'comparison' | 'auto';
  depth: 'surface' | 'deep' | 'full';
  output: 'summary' | 'detailed' | 'patterns-only';
  dryRun: boolean;
}

export interface ResearchSession {
  id: string;
  startTime: Date;
  command: ResearchCommand;
  status: 'active' | 'completed' | 'blocked';
  findings: ResearchFinding[];
  outputPath: string;
}

export interface ResearchFinding {
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  description: string;
  sourceReference: string;
  category: 'reentrancy' | 'oracle' | 'access-control' | 'arithmetic' | 'upgradeability' | 'economic' | 'other';
}

/**
 * Parse /research command from user input
 */
export function parseResearchCommand(input: string): ResearchCommand {
  // Remove /research prefix
  const args = input.replace(/^\/research\s*/, '').trim();
  
  // Default command
  const command: ResearchCommand = {
    target: '',
    source: 'auto',
    depth: 'deep',
    output: 'detailed',
    dryRun: false
  };

  // Parse target (first non-flag argument)
  const parts = args.split(' ');
  command.target = parts[0];

  // Parse flags
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    if (part === '--source' && parts[i + 1]) {
      const source = parts[i + 1] as ResearchCommand['source'];
      if (['audit', 'paper', 'protocol', 'exploit', 'comparison'].includes(source)) {
        command.source = source;
      }
      i++;
    }
    
    if (part === '--depth' && parts[i + 1]) {
      const depth = parts[i + 1] as ResearchCommand['depth'];
      if (['surface', 'deep', 'full'].includes(depth)) {
        command.depth = depth;
      }
      i++;
    }
    
    if (part === '--output' && parts[i + 1]) {
      const output = parts[i + 1] as ResearchCommand['output'];
      if (['summary', 'detailed', 'patterns-only'].includes(output)) {
        command.output = output;
      }
      i++;
    }
    
    if (part === '--dry-run') {
      command.dryRun = true;
    }
  }

  // Auto-detect source from target if not specified
  if (command.source === 'auto') {
    if (command.target.includes('audit') || command.target.includes('quantstamp') || command.target.includes('trailofbits')) {
      command.source = 'audit';
    } else if (command.target.includes('arxiv') || command.target.includes('paper')) {
      command.source = 'paper';
    } else if (command.target.includes('exploit') || command.target.includes('hack') || command.target.includes('incident')) {
      command.source = 'exploit';
    } else {
      command.source = 'protocol';
    }
  }

  return command;
}

/**
 * Validate that target is safe for Research Mode
 * (documentation/audit only, not live contracts)
 */
export function validateResearchTarget(target: string): { valid: boolean; reason?: string } {
  // Block live contract addresses
  if (/^0x[a-fA-F0-9]{40}$/.test(target)) {
    return { 
      valid: false, 
      reason: 'Research Mode does not accept live contract addresses. Use /hunt or /audit for contract analysis.' 
    };
  }

  // Block commands that imply live interaction
  const blockedTerms = ['scan', 'exploit', 'attack', 'deploy', 'send', 'call', 'drain'];
  for (const term of blockedTerms) {
    if (target.toLowerCase().includes(term)) {
      return { 
        valid: false, 
        reason: `Research Mode blocked: term "${term}" implies active exploitation.` 
      };
    }
  }

  return { valid: true };
}

/**
 * Research Mode State Manager
 */
export class ResearchModeManager {
  private activeSession: ResearchSession | null = null;
  private readonly sessions: ResearchSession[] = [];

  /**
   * Check if currently in Research Mode
   */
  isActive(): boolean {
    return this.activeSession !== null && this.activeSession.status === 'active';
  }

  /**
   * Get current Research Mode session
   */
  getSession(): ResearchSession | null {
    return this.activeSession;
  }

  /**
   * Activate Research Mode with safety checks
   */
  activate(command: ResearchCommand): { success: boolean; session?: ResearchSession; error?: string } {
    // Validate target safety
    const validation = validateResearchTarget(command.target);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Check if already in Research Mode
    if (this.isActive()) {
      return { 
        success: false, 
        error: `Already in Research Mode (session: ${this.activeSession?.id}). Exit or complete current session.` 
      };
    }

    // Create new session
    const session: ResearchSession = {
      id: `research-${Date.now()}`,
      startTime: new Date(),
      command,
      status: 'active',
      findings: [],
      outputPath: `research/${command.target.replace(/[^a-zA-Z0-9-]/g, '-')}-${new Date().toISOString().split('T')[0]}.md`
    };

    this.activeSession = session;
    this.sessions.push(session);

    return { success: true, session };
  }

  /**
   * Add finding to current Research Mode session
   */
  addFinding(finding: ResearchFinding): boolean {
    if (!this.isActive()) {
      return false;
    }
    this.activeSession!.findings.push(finding);
    return true;
  }

  /**
   * Complete current Research Mode session
   */
  complete(): ResearchSession | null {
    if (!this.isActive()) {
      return null;
    }
    this.activeSession!.status = 'completed';
    const session = this.activeSession;
    this.activeSession = null;
    return session;
  }

  /**
   * Force exit Research Mode (emergency)
   */
  exit(): void {
    if (this.activeSession) {
      this.activeSession.status = 'completed';
      this.activeSession = null;
    }
  }

  /**
   * Get all sessions (for logging/debugging)
   */
  getAllSessions(): ResearchSession[] {
    return [...this.sessions];
  }
}

/**
 * Research Mode Response Templates
 */
export const ResearchResponses = {
  activation: (session: ResearchSession) => `
🐇 **RESEARCH MODE ACTIVATED**

**Target:** ${session.command.target}
**Source:** ${session.command.source}
**Depth:** ${session.command.depth}
**Session ID:** ${session.id}

🔒 **Safety Constraints Active:**
- ❌ No live contract scanning
- ❌ No PoC generation  
- ❌ No on-chain interaction
- ✅ Pattern extraction only
- ✅ Documentation analysis

Research findings will be stored in: \`${session.outputPath}\`
`,

  blocked: (reason: string) => `
⛔ **RESEARCH MODE BLOCKED**

${reason}

Use \`/hunt <address>\` for contract analysis or \`/audit <address>\` for full audit.
`,

  boundaryViolation: (attemptedAction: string) => `
⚠️ **RESEARCH MODE VIOLATION**

Attempted: "${attemptedAction}"

Research Mode is documentation analysis ONLY.
- No scanning
- No exploitation  
- No on-chain activity

To perform this action, exit Research Mode first.
`,

  completion: (session: ResearchSession) => `
✅ **RESEARCH MODE COMPLETED**

**Session:** ${session.id}
**Duration:** ${(new Date().getTime() - session.startTime.getTime()) / 1000}s
**Findings:** ${session.findings.length}

**Stored:**
- Analysis: \`${session.outputPath}\`
- Patterns: Indexed in ATTACK_VECTOR_DATABASE.md (if confidence > 70%)
- Memory: Logged in daily notes
`
};

// Export singleton instance
export const researchManager = new ResearchModeManager();
