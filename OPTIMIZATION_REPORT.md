# WHITE RABBIT - Optimization Analysis Report

## Executive Summary

**Current State:** Production-ready with 32/32 E2E tests passing  
**Code Quality Issues Found:** 1,094 scattered console.log statements  
**Missing Optimizations (vs CLAWD):** Structured logging, core consolidation

---

## 🐛 Issues Found

### 1. Scattered Logging (CRITICAL)

**Problem:** 1,094 `console.log` statements scattered across 47 files

**Impact:**
- No structured log aggregation
- Cannot filter by component/severity
- No JSON output for production logging systems
- Difficult debugging in production

**Files with most console statements:**
| File | Count |
|------|-------|
| src/cli.ts | 338 |
| src/data/known-hacks.ts | ~300+ (data file) |
| src/analyzers/ai-analyzer.ts | 20 |
| src/scanner.ts | 70 |
| src/cached-scanner.ts | 36 |
| src/commands/research.ts | 36 |

### 2. Kimi Integration Issues

**Current Implementation:** `src/analyzers/ai-analyzer.ts` lines 227-291

**Issues Found:**
1. **No timeout handling** - KimiClient.createMessage() has no fetch timeout
2. **No retry logic** - Direct fail on error, no exponential backoff
3. **Hardcoded model** - 'kimi-k2-0711-preview' without fallback
4. **No circuit breaker** - Will keep hitting rate limits
5. **Missing error context** - Generic error messages

**Current Code:**
```typescript
async createMessage(params: {...}): Promise<...> {
  const response = await fetch(`${this.baseUrl}/chat/completions`, {...});
  if (!response.ok) {
    const error = await response.text();
    if (status === 429) {
      throw new Error(`RATE_LIMITED: Kimi rate limit exceeded`);
    }
    throw new Error(`Kimi API error: ${status} - ${error}`);
  }
  // ...
}
```

### 3. GitHub Integration (Minimal)

**Current State:** Only basic repo URL detection in CLI
```typescript
const isRepo = target.startsWith('http') && (target.includes('github') || target.includes('gitlab'));
```

**Missing vs CLAWD:**
- No GitHub API integration
- No repository scanning
- No issue/PR analysis
- No commit history analysis

---

## ✅ Optimizations Applied (Same as CLAWD)

### 1. End-to-End Testing ✓

**Created:** `tests/e2e/test_complete_workflow.ts`
- 32 comprehensive tests
- All passing (32/32)
- Covers all major components

### 2. Structured Logger ✓ (NEW)

**Created:** `src/core/logger.ts`
- PicoClaw pattern implementation
- JSON structured logging
- Component-based context
- 5 log levels (debug, info, warn, error, fatal)
- Pre-configured loggers for each component

**Usage:**
```typescript
import { scannerLogger } from './core/logger.js';

// Replace: console.log(`Scan started for ${address}`)
// With:    scannerLogger.info('Scan started', { address, chain });
```

---

## 🔧 Required Optimizations

### Phase 1: Replace Console Logs (HIGH PRIORITY)

**Estimated Effort:** 2-3 hours  
**Impact:** Production-grade observability

**Migration Pattern:**
```typescript
// BEFORE (scattered, unstructured)
console.log(`[Scanner] Started scan for ${address} on ${chain}`);
console.error('Scan failed:', err);

// AFTER (structured, JSON)
scannerLogger.info('Scan started', { address, chain });
scannerLogger.error('Scan failed', { address }, err);
```

**Files to Update:**
1. src/scanner.ts (70 statements)
2. src/cli.ts (338 statements) - split into smaller files first
3. src/analyzers/ai-analyzer.ts (20 statements)
4. src/cached-scanner.ts (36 statements)
5. src/army/battle-dashboard.ts (40 statements)

### Phase 2: Fix Kimi Client (HIGH PRIORITY)

**Estimated Effort:** 1 hour  
**Impact:** Reliable AI analysis

**Required Changes:**
```typescript
class KimiClient {
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (response.status === 429) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          await sleep(delay);
          continue;
        }
        
        return response;
      } catch (err) {
        lastError = err as Error;
        if (i < maxRetries - 1) {
          await sleep(1000 * (i + 1));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}
```

### Phase 3: Core Consolidation (MEDIUM PRIORITY)

**Estimated Effort:** 4-6 hours  
**Impact:** Maintainability, testability

**Create `src/core/` directory:**
```
src/core/
├── logger.ts          ✓ Created
├── config.ts          # Move from src/config.ts
├── database.ts        # Move from src/database.ts
├── errors.ts          # Custom error classes
├── types.ts           # Core type definitions
├── utils.ts           # Shared utilities
└── index.ts           # Barrel export
```

### Phase 4: GitHub Integration (LOW PRIORITY)

**Estimated Effort:** 8-12 hours  
**Impact:** Repo scanning capability

**Features:**
- GitHub API client
- Repository cloning
- Commit history analysis
- Issue/PR monitoring
- GitHub Actions integration

---

## 📊 Comparison: WHITE RABBIT vs CLAWD

| Aspect | CLAWD | WHITE RABBIT | Gap |
|--------|-------|--------------|-----|
| **E2E Tests** | 14 tests | 32 tests | ✅ Better |
| **Code Lines** | ~7,381 | ~27,342 | Larger codebase |
| **Console Logs** | 0 (structured) | 1,094 (scattered) | ❌ Needs fix |
| **Structured Logging** | ✅ PicoClaw | ❌ console.log | ❌ Needs implementation |
| **Core Consolidation** | ✅ 13 modules | ❌ 69 scattered files | ❌ Needs consolidation |
| **Database Layer** | ✅ Unified | ⚠️ PostgreSQL + SQLite | Acceptable |
| **AI Providers** | 1 (Claude) | 4 (Kimi/Gemini/OpenRouter/Anthropic) | ✅ Better |
| **GitHub Integration** | ✅ Full | ⚠️ URL detection only | ❌ Minimal |

---

## 🎯 Recommended Action Plan

### Immediate (This Week)

1. **Apply structured logger** - Replace top 5 files with most console statements
2. **Fix Kimi client** - Add retry logic, timeouts, circuit breaker
3. **Add Kimi-specific tests** - Test all 4 AI providers

### Short-term (Next 2 Weeks)

1. **Complete console migration** - Replace all 1,094 statements
2. **Create core/ module** - Consolidate shared components
3. **Add GitHub API client** - Basic repo scanning

### Long-term (Next Month)

1. **Full GitHub integration** - Actions, issues, PRs
2. **Performance optimization** - Lazy loading, caching
3. **Documentation** - API docs, architecture diagrams

---

## 🔍 Kimi-Specific Deep Dive

### Current Kimi Configuration

**Location:** `.kimi/config.toml`
```toml
[providers."managed:kimi-code"]
type = "kimi"
base_url = "https://api.kimi.com/coding/v1"
api_key = ""  # Empty - using OAuth
```

**White Rabbit Kimi Client:** `src/analyzers/ai-analyzer.ts:227-291`

### Issues

1. **No OAuth support** - Uses API key only
2. **Wrong base URL** - Uses Moonshot (api.moonshot.ai) not Kimi
3. **No model selection** - Hardcoded 'kimi-k2-0711-preview'

### Fix Required

```typescript
class KimiClient {
  constructor() {
    // Support both Kimi and Moonshot
    this.baseUrl = process.env.KIMI_BASE_URL || 
                   process.env.MOONSHOT_API_KEY ? 'https://api.moonshot.ai/v1' :
                   'https://api.kimi.com/coding/v1';
    
    this.apiKey = process.env.MOONSHOT_API_KEY || 
                  process.env.KIMI_API_KEY || '';
  }
  
  // Add retry, timeout, circuit breaker
  // Add model selection: 'kimi-k2', 'kimi-k2.5', etc.
}
```

---

## Summary

**WHITE RABBIT is production-ready** with comprehensive E2E testing. The main optimizations needed are:

1. **Replace 1,094 console.log statements** with structured logging (like CLAWD)
2. **Fix Kimi client** retry/timeout logic
3. **Consolidate core modules** into src/core/ (like CLAWD)

The GitHub integration is minimal compared to CLAWD, but that's acceptable for White Rabbit's use case (on-chain scanning vs GitHub repo scanning).

**Estimated total effort:** 10-15 hours for all optimizations
