import { makeSiteCertificate } from './site';
import { buildSystemTool, shareSystemTool } from './system-tool';

/**
 * Before every test, once: the program for the system's own input (tests/e2e/system-tool.ts) and the test sites'
 * certificate (tests/e2e/site.ts).
 */
export default function globalSetup() {
  shareSystemTool(buildSystemTool());
  makeSiteCertificate();
}
