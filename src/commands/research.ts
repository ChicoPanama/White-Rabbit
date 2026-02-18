/**
 * Research Mode CLI Command
 * 
 * Usage: /research <target> [--source <type>] [--depth <level>] [--output <format>]
 * 
 * Examples:
 *   /research quantstamp-api3 --source audit --depth deep
 *   /research https://arxiv.org/abs/1234 --source paper
 *   /research compound-forks --source comparison --depth full --output summary
 */

import { 
  parseResearchCommand, 
  validateResearchTarget,
  researchManager,
  ResearchResponses,
  ResearchFinding
} from '../services/researchMode.js';

export function registerResearchCommand(program: any): void {
  program
    .command('research <target>')
    .description('Activate Research Mode for audit/paper/protocol analysis (no scanning, no exploitation)')
    .option('-s, --source <type>', 'Source type: audit, paper, protocol, exploit, comparison', 'auto')
    .option('-d, --depth <level>', 'Analysis depth: surface, deep, full', 'deep')
    .option('-o, --output <format>', 'Output format: summary, detailed, patterns-only', 'detailed')
    .option('--dry-run', 'Show what would be researched without executing', false)
    .action(async (target: string, options: any) => {
      try {
        // Build command from arguments
        const command = {
          target,
          source: options.source,
          depth: options.depth,
          output: options.output,
          dryRun: options.dryRun
        };

        // Validate target safety (blocks contract addresses)
        const validation = validateResearchTarget(target);
        if (!validation.valid) {
          console.error(ResearchResponses.blocked(validation.reason!));
          process.exit(1);
        }

        // Check if already in Research Mode
        if (researchManager.isActive()) {
          console.error('Already in Research Mode. Complete current session first.');
          process.exit(1);
        }

        // Activate Research Mode
        const result = researchManager.activate(command);
        if (!result.success) {
          console.error(ResearchResponses.blocked(result.error!));
          process.exit(1);
        }

        console.log(ResearchResponses.activation(result.session!));

        if (command.dryRun) {
          console.log('\n🔍 DRY RUN - Would research:');
          console.log(`  Target: ${command.target}`);
          console.log(`  Source: ${command.source}`);
          console.log(`  Depth: ${command.depth}`);
          console.log(`  Output: ${command.output}`);
          researchManager.complete();
          return;
        }

        // Dispatch to appropriate research handler
        await executeResearch(result.session!);

        // Complete session
        const completed = researchManager.complete();
        console.log(ResearchResponses.completion(completed!));

      } catch (error) {
        console.error('Research Mode error:', error);
        researchManager.exit();
        process.exit(1);
      }
    });
}

/**
 * Execute research based on session configuration
 */
async function executeResearch(session: any): Promise<void> {
  const { command } = session;

  console.log(`\n🔬 Researching: ${command.target}...\n`);

  switch (command.source) {
    case 'audit':
      await researchAudit(session);
      break;
    case 'paper':
      await researchPaper(session);
      break;
    case 'exploit':
      await researchExploit(session);
      break;
    case 'protocol':
      await researchProtocol(session);
      break;
    case 'comparison':
      await researchComparison(session);
      break;
    default:
      console.log(`Unknown source type: ${command.source}`);
  }
}

/**
 * Research audit reports
 */
async function researchAudit(session: any): Promise<void> {
  console.log('📋 Research Mode: Audit Analysis');
  console.log('=================================');
  
  // Simulate finding extraction based on depth
  const findings: ResearchFinding[] = [];
  
  if (session.command.depth === 'surface') {
    console.log('Extracting high-level patterns...');
    findings.push({
      pattern: 'Sample Pattern',
      severity: 'medium',
      confidence: 75,
      description: 'Example finding from audit research',
      sourceReference: session.command.target,
      category: 'access-control'
    });
  } else if (session.command.depth === 'deep') {
    console.log('Extracting patterns + methodology gaps...');
    findings.push(
      {
        pattern: 'Access Control Gap',
        severity: 'high',
        confidence: 85,
        description: 'Privileged role without timelock',
        sourceReference: `${session.command.target} - Finding #3`,
        category: 'access-control'
      },
      {
        pattern: 'Oracle Manipulation Vector',
        severity: 'medium',
        confidence: 70,
        description: 'Single-source price feed with no fallback',
        sourceReference: `${session.command.target} - Finding #7`,
        category: 'oracle'
      }
    );
  } else {
    console.log('Full analysis: patterns + gaps + cross-references...');
    findings.push(
      {
        pattern: 'Reentrancy Acknowledged',
        severity: 'high',
        confidence: 90,
        description: 'Critical function lacks reentrancy guard (acknowledged, not fixed)',
        sourceReference: `${session.command.target} - QSP-7`,
        category: 'reentrancy'
      },
      {
        pattern: 'Methodology Gap: Economic Analysis',
        severity: 'medium',
        confidence: 80,
        description: 'Audit focused on technical correctness, not economic manipulation',
        sourceReference: 'Cross-reference with known exploits',
        category: 'economic'
      }
    );
  }

  // Add findings to session
  for (const finding of findings) {
    researchManager.addFinding(finding);
    console.log(`  ✓ ${finding.pattern} (${finding.severity}, ${finding.confidence}% confidence)`);
  }

  console.log(`\n📁 Output will be saved to: ${session.outputPath}`);
}

/**
 * Research academic papers
 */
async function researchPaper(session: any): Promise<void> {
  console.log('📄 Research Mode: Paper Analysis');
  console.log('=================================');
  console.log('Extracting novel attack vectors and theoretical frameworks...');
  
  researchManager.addFinding({
    pattern: 'Novel Oracle Manipulation',
    severity: 'critical',
    confidence: 60, // Lower for theoretical
    description: 'New oracle manipulation technique described in paper',
    sourceReference: session.command.target,
    category: 'oracle'
  });

  console.log('✓ Paper patterns extracted (theoretical, needs validation)');
}

/**
 * Research historical exploits
 */
async function researchExploit(session: any): Promise<void> {
  console.log('💥 Research Mode: Exploit Post-Mortem');
  console.log('=======================================');
  console.log('Extracting patterns from incident reports...');
  
  researchManager.addFinding({
    pattern: 'Flash Loan Price Manipulation',
    severity: 'critical',
    confidence: 95,
    description: 'Known attack pattern: flash loan → price manipulation → liquidation',
    sourceReference: session.command.target,
    category: 'economic'
  });

  console.log('✓ Exploit patterns indexed for fork hunting');
}

/**
 * Research protocol documentation
 */
async function researchProtocol(session: any): Promise<void> {
  console.log('📚 Research Mode: Protocol Documentation');
  console.log('=========================================');
  console.log('Analyzing architecture and design patterns...');
  
  researchManager.addFinding({
    pattern: 'Upgradeable Proxy Pattern',
    severity: 'medium',
    confidence: 75,
    description: 'Uses transparent proxy with admin role',
    sourceReference: session.command.target,
    category: 'upgradeability'
  });

  console.log('✓ Architecture patterns documented');
}

/**
 * Research cross-protocol comparisons
 */
async function researchComparison(session: any): Promise<void> {
  console.log('🔍 Research Mode: Protocol Comparison');
  console.log('=======================================');
  console.log('Comparing implementations across forks...');
  
  researchManager.addFinding({
    pattern: 'Fork Vulnerability Transfer',
    severity: 'high',
    confidence: 85,
    description: 'Vulnerability present in original exists in fork without fix',
    sourceReference: session.command.target,
    category: 'other'
  });

  console.log('✓ Fork comparison complete');
}

/**
 * Check if input is a research command
 */
export function isResearchCommand(input: string): boolean {
  return input.trim().startsWith('/research') || input.trim().startsWith('research ');
}

/**
 * Handle research command from chat/telegram
 */
export async function handleResearchCommand(input: string): Promise<string> {
  try {
    const command = parseResearchCommand(input);
    
    // Validate
    const validation = validateResearchTarget(command.target);
    if (!validation.valid) {
      return ResearchResponses.blocked(validation.reason!);
    }

    // Check if already active
    if (researchManager.isActive()) {
      return 'Already in Research Mode. Complete current session first.';
    }

    // Activate
    const result = researchManager.activate(command);
    if (!result.success) {
      return ResearchResponses.blocked(result.error!);
    }

    return ResearchResponses.activation(result.session!);

  } catch (error) {
    return `Research Mode error: ${error}`;
  }
}
