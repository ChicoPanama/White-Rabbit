import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Prompt template manager.
 * Loads templates from the prompts/ directory, substitutes {{VARIABLE}} placeholders,
 * and supports shared partials via {{>shared/filename}} syntax.
 */

// Resolve prompts dir relative to the project root (works in both src/ and dist/)
const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts');

// Cache loaded templates to avoid repeated disk reads
const templateCache = new Map<string, string>();

/**
 * Resolve the file path for a template name.
 * Template names map to files: "vuln-arithmetic" -> "prompts/vuln-arithmetic.txt"
 */
function resolveTemplatePath(templateName: string): string {
  // Allow direct path with extension
  if (templateName.endsWith('.txt')) {
    return path.join(PROMPTS_DIR, templateName);
  }
  return path.join(PROMPTS_DIR, `${templateName}.txt`);
}

/**
 * Load a raw template string from disk (with caching).
 */
function loadRawTemplate(templateName: string): string {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const filePath = resolveTemplatePath(templateName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${templateName} (looked at ${filePath})`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  templateCache.set(templateName, content);
  return content;
}

/**
 * Expand shared partial includes: {{>shared/filename}} -> contents of prompts/shared/filename.txt
 */
function expandPartials(template: string): string {
  return template.replace(/\{\{>([\w\-/]+)\}\}/g, (_match, partialName: string) => {
    try {
      return loadRawTemplate(partialName);
    } catch {
      console.warn(`[PromptManager] Partial not found: ${partialName}, leaving placeholder`);
      return `[Partial not found: ${partialName}]`;
    }
  });
}

/**
 * Substitute {{VARIABLE}} placeholders with provided values.
 * Unknown variables are left as-is with a warning.
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (_match, varName: string) => {
    if (varName in variables) {
      return variables[varName];
    }
    console.warn(`[PromptManager] Unresolved variable: {{${varName}}}`);
    return `{{${varName}}}`;
  });
}

/**
 * Load a prompt template, expand partials, and substitute variables.
 *
 * @param templateName - Template name without extension (e.g., "vuln-arithmetic")
 * @param variables - Key-value map of variables to substitute (e.g., { CONTRACT_SOURCE: "..." })
 * @returns The fully resolved prompt string
 *
 * @example
 * ```ts
 * const prompt = loadPrompt('vuln-arithmetic', {
 *   CONTRACT_SOURCE: sourceCode,
 *   SOLIDITY_VERSION: '0.8.19',
 *   SLITHER_OUTPUT: JSON.stringify(slitherFindings),
 * });
 * ```
 */
export function loadPrompt(templateName: string, variables: Record<string, string> = {}): string {
  const raw = loadRawTemplate(templateName);
  const withPartials = expandPartials(raw);
  return substituteVariables(withPartials, variables);
}

/**
 * List all available template names.
 */
export function listTemplates(): string[] {
  if (!fs.existsSync(PROMPTS_DIR)) {
    return [];
  }

  const templates: string[] = [];

  function scanDir(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.txt')) {
        const name = prefix ? `${prefix}/${entry.name.replace('.txt', '')}` : entry.name.replace('.txt', '');
        templates.push(name);
      }
    }
  }

  scanDir(PROMPTS_DIR, '');
  return templates.sort();
}

/**
 * Get the variables expected by a template (scans for {{VARIABLE}} patterns).
 */
export function getTemplateVariables(templateName: string): string[] {
  const raw = loadRawTemplate(templateName);
  const expanded = expandPartials(raw);
  const vars = new Set<string>();
  const regex = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
  let match;
  while ((match = regex.exec(expanded)) !== null) {
    vars.add(match[1]);
  }
  return [...vars].sort();
}

/**
 * Clear the template cache (useful for development/testing).
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
