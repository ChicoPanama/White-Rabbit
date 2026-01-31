/**
 * Memory Bank - Main Export
 *
 * Hybrid memory system for WhiteRabbit/Clawd autonomous security scanner.
 * Provides session continuity across AI context resets.
 *
 * Usage:
 *   import { memoryBank, handleMemoryCommand } from './memory';
 *
 *   // Initialize on startup
 *   await memoryBank.initialize();
 *
 *   // Get context for AI
 *   const context = await memoryBank.getContextForAI();
 *
 *   // Handle commands (Telegram/CLI)
 *   const response = await handleMemoryCommand('status', []);
 *
 *   // Update active context
 *   await memoryBank.updateActiveContext({
 *     currentFocus: 'Hunting Base micro-protocols',
 *     mode: 'Hunting'
 *   });
 *
 *   // Log a finding
 *   await memoryBank.logFinding({
 *     id: 'WR-001',
 *     protocol: 'ExampleProtocol',
 *     chain: 'ethereum',
 *     contract: '0x...',
 *     vulnerabilityType: 'Integer Overflow',
 *     severity: 'High',
 *     stage: 'Investigation',
 *     description: 'Overflow in fee calculation',
 *     trigger: 'High fee + large validator count',
 *     impact: 'Permanent DoS',
 *     createdAt: new Date(),
 *     updatedAt: new Date()
 *   });
 */

export { MemoryBank, memoryBank } from './memoryBank';
export { handleMemoryCommand, parseFinding } from './commands';
export * from './types';

// Quick initialization helper
export async function initMemoryBank(): Promise<void> {
  const { memoryBank } = await import('./memoryBank');
  await memoryBank.initialize();
}
