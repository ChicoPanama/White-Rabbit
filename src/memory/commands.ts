/**
 * Memory Bank Commands
 * CLI/Telegram command handlers for memory operations
 */

import { memoryBank } from './memoryBank';
import { Finding, OperationStatus } from './types';

export async function handleMemoryCommand(command: string, args: string[]): Promise<string> {
  try {
    switch (command) {
      case 'init':
      case 'initialize':
        await memoryBank.initialize();
        const health = await memoryBank.checkHealth();
        if (health.healthy) {
          return '🐇 Memory Bank initialized. All files loaded.';
        } else {
          return `⚠️ Memory Bank initialized with warnings.\nMissing: ${health.missing.join(', ')}`;
        }

      case 'status':
      case 'health':
        const healthCheck = await memoryBank.checkHealth();
        const state = memoryBank.getState();
        const loaded = Object.keys(state).length;

        let statusMsg = `📚 Memory Bank Status\n`;
        statusMsg += `├─ Files loaded: ${loaded}\n`;
        statusMsg += `├─ Health: ${healthCheck.healthy ? '🟢 Healthy' : '🟡 Issues'}\n`;

        if (healthCheck.missing.length > 0) {
          statusMsg += `└─ Missing: ${healthCheck.missing.join(', ')}`;
        } else {
          statusMsg += `└─ All core files present`;
        }

        return statusMsg;

      case 'context':
      case 'full-context':
        const context = await memoryBank.getContextForAI();
        return context;

      case 'quick':
      case 'quick-context':
        const quickContext = await memoryBank.getQuickContext();
        return quickContext;

      case 'focus':
        if (args.length === 0) {
          return '❌ Usage: focus <current focus description>';
        }
        const focus = args.join(' ');
        await memoryBank.updateActiveContext({ currentFocus: focus });
        return `🎯 Focus updated: ${focus}`;

      case 'mode':
        const validModes = ['Hunting', 'Analyzing', 'Verifying', 'Submitting', 'Learning', 'Idle'];
        const mode = args[0];
        if (!mode || !validModes.includes(mode)) {
          return `❌ Usage: mode <${validModes.join('|')}>`;
        }
        await memoryBank.updateActiveContext({ mode: mode as any });
        return `🔄 Mode set to: ${mode}`;

      case 'action':
        if (args.length === 0) {
          return '❌ Usage: action <last action description>';
        }
        const action = args.join(' ');
        await memoryBank.updateActiveContext({ lastAction: action });
        return `✅ Last action recorded: ${action}`;

      case 'next':
      case 'nextsteps':
        if (args.length === 0) {
          return '❌ Usage: next <step1> | <step2> | <step3>';
        }
        const steps = args.join(' ').split('|').map(s => s.trim());
        await memoryBank.updateActiveContext({ nextSteps: steps });
        return `📋 Next steps updated:\n${steps.map(s => `  - ${s}`).join('\n')}`;

      case 'log':
      case 'log-finding':
        // Quick finding log: log <protocol> <chain> <type> <severity> <description>
        if (args.length < 5) {
          return '❌ Usage: log <protocol> <chain> <type> <severity> <description...>';
        }
        const [protocol, chain, vulnType, severity, ...descParts] = args;
        const finding: Finding = {
          id: `WR-${String(Date.now()).slice(-6)}`,
          protocol,
          chain,
          contract: 'TBD',
          vulnerabilityType: vulnType,
          severity: severity as Finding['severity'],
          stage: 'Investigation',
          description: descParts.join(' '),
          trigger: 'TBD',
          impact: 'TBD',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await memoryBank.logFinding(finding);
        return `🎯 Finding logged: ${finding.id} - ${protocol} ${vulnType}`;

      case 'ops':
      case 'operations':
        const opsContent = await memoryBank.readFile('operations');
        // Extract just the status table
        const tableMatch = opsContent.match(/## System Health:[\s\S]*?(?=## Infrastructure)/);
        return tableMatch ? tableMatch[0] : opsContent.slice(0, 1000);

      case 'findings':
        const findingsContent = await memoryBank.readFile('findingsLog');
        // Extract summary stats
        const summaryMatch = findingsContent.match(/## Summary Statistics[\s\S]*?(?=---)/);
        return summaryMatch ? summaryMatch[0] : 'No findings summary found';

      case 'hunting':
      case 'stats':
        const huntingLog = await memoryBank.getHuntingLog();
        return `📊 Hunting Stats\n` +
          `├─ Scans: ${huntingLog.stats.totalScans}\n` +
          `├─ Contracts: ${huntingLog.stats.totalContracts}\n` +
          `├─ Findings: ${huntingLog.stats.totalFindings}\n` +
          `├─ Verified: ${huntingLog.stats.verifiedExploits}\n` +
          `├─ FPs: ${huntingLog.stats.falsePositives}\n` +
          `└─ Value: $${huntingLog.stats.totalExploitableValue}`;

      case 'update-ops':
        // Update operation status: update-ops <component> <status>
        if (args.length < 2) {
          return '❌ Usage: update-ops <component> <🟢|🟡|🔴|⚠️|❌|⏳>';
        }
        const [component, opStatus] = args;
        await memoryBank.updateOperationStatus([{
          component,
          status: opStatus as OperationStatus['status'],
          lastCheck: new Date()
        }]);
        return `✅ Updated ${component} status to ${opStatus}`;

      case 'help':
      default:
        return `🐇 Memory Bank Commands

**Session Management:**
  init          - Initialize memory bank
  status        - Check health & loaded files
  context       - Get full AI context
  quick         - Get quick context

**Active Context:**
  focus <desc>  - Update current focus
  mode <mode>   - Set mode (Hunting/Analyzing/Verifying/Submitting/Learning/Idle)
  action <desc> - Record last action
  next <steps>  - Set next steps (pipe-separated)

**Findings:**
  log <proto> <chain> <type> <sev> <desc> - Log new finding
  findings      - Show findings summary

**Operations:**
  ops           - Show system status
  update-ops <component> <status> - Update component status
  stats         - Show hunting statistics
  hunting       - Alias for stats`;
    }
  } catch (error) {
    return `❌ Error: ${(error as Error).message}`;
  }
}

/**
 * Parse a finding from structured input
 */
export function parseFinding(input: string): Partial<Finding> {
  const lines = input.split('\n');
  const finding: Partial<Finding> = {};

  for (const line of lines) {
    const match = line.match(/^-?\s*\*?\*?(\w+)\*?\*?:\s*(.+)$/i);
    if (match) {
      const [, key, value] = match;
      const keyLower = key.toLowerCase();

      switch (keyLower) {
        case 'protocol': finding.protocol = value; break;
        case 'chain': finding.chain = value; break;
        case 'contract': finding.contract = value; break;
        case 'function': finding.function = value; break;
        case 'type':
        case 'vulnerability': finding.vulnerabilityType = value; break;
        case 'severity': finding.severity = value as Finding['severity']; break;
        case 'description': finding.description = value; break;
        case 'trigger': finding.trigger = value; break;
        case 'impact': finding.impact = value; break;
        case 'value':
        case 'estimatedvalue': finding.estimatedValue = value; break;
      }
    }
  }

  return finding;
}
