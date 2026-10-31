import { buildSystemTool, shareSystemTool } from './system-tool';

/** Before every test, once: the program for the system's own input (tests/e2e/system-tool.ts). */
export default function globalSetup() {
  shareSystemTool(buildSystemTool());
}
