import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

export function readGasBackendUrl() {
  const deploymentFile = path.join(root, '.gas-deployment.json');
  if (fs.existsSync(deploymentFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      if (typeof parsed.backendUrl === 'string' && parsed.backendUrl) {
        return parsed.backendUrl;
      }
    } catch {
      // Fall through to generated file.
    }
  }

  const generatedUrlFile = path.join(root, 'src/gas-backend-url.generated.ts');
  if (fs.existsSync(generatedUrlFile)) {
    const match = fs.readFileSync(generatedUrlFile, 'utf8').match(/gasBackendUrl = '([^']+)'/);
    if (match) return match[1];
  }

  throw new Error(
    'Missing GAS backend URL. Run npm run gas:deploy first, or create src/gas-backend-url.generated.ts.',
  );
}
