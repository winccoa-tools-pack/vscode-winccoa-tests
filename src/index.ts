export function log(message: string): void {
  console.log(`[core-utils] ${message}`);
}

export function validateConfig(config: unknown): boolean {
  return typeof config === 'object' && config !== null;
}

export async function getExtensions(): Promise<Array<{name: string; description?: string}>> {
  return [
    { name: 'winccoa-tools-pack/core-utils', description: 'Shared utilities' }
  ];
}
