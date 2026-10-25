// Removes dist/ before a build so deleted sources never linger in the output.
import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
