/**
 * Validates an Ethereum-style address (0x + 40 hex characters).
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
