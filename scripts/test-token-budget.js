#!/usr/bin/env node
/**
 * Test script to validate token budget configuration
 */
const fs = require('fs');
const path = require('path');

// Load config
const configPath = '/home/ubuntu/.clawdbot/clawdbot.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('🐇 CLAWD Token Budget Validation');
console.log('='.repeat(50));

// Check config values
const contextTokens = config.agents?.defaults?.contextTokens;
const maxTokens = config.agents?.defaults?.model?.params?.maxTokens;
const model = config.agents?.defaults?.model?.primary;

console.log(`📋 Current Configuration:`);
console.log(`  Model: ${model || 'NOT SET'}`);
console.log(`  Context Limit: ${contextTokens?.toLocaleString() || 'NOT SET'}`);
console.log(`  Max Output Tokens: ${maxTokens || 'NOT SET (will fallback to /3 calc!)'}`);

// Calculate potential issue
if (!maxTokens) {
  const modelMaxTokens = 102144; // claude-sonnet-4 default
  const fallbackMaxTokens = Math.floor(modelMaxTokens / 3);
  console.log(`⚠️ WARNING: No maxTokens configured!`);
  console.log(`  pi-ai will use fallback: ${modelMaxTokens} / 3 = ${fallbackMaxTokens}`);
  console.log(`  This can cause context overflow!`);
} else {
  console.log(`✅ maxTokens explicitly set to ${maxTokens}`);
}

// Budget calculation
console.log(`📊 Budget Analysis:`);
const safeInputBudget = (contextTokens || 120000) - (maxTokens || 34048) - 1000;
console.log(`  Safe input budget: ~${safeInputBudget.toLocaleString()} tokens`);
console.log(`  (Context ${contextTokens} - MaxOutput ${maxTokens || 34048} - Safety 1000)`);

// Recommendations
console.log(`🎯 Recommendations:`);
if (!maxTokens) {
  console.log(`  1. Add "params": { "maxTokens": 2048 } to model config`);
}
if (contextTokens > 100000) {
  console.log(`  2. Consider reducing contextTokens for faster/cheaper requests`);
}
console.log(`  3. Implement pre-request budget validation`);
console.log(`  4. Add conversation truncation for long sessions`);

console.log('');
console.log('='.repeat(50));
console.log('Run this after config changes to verify fix.');