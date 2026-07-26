// PostToolUse hook: format the just-edited file with Prettier, then oxlint --fix.
// Reads the tool-call JSON from stdin, extracts tool_input.file_path, and runs
// the formatter only for JS/TS/JSON/Markdown files. Best-effort: never fails the tool.
import { spawnSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file;
  try {
    file = JSON.parse(raw)?.tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!file || !/\.(ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml)$/.test(file)) process.exit(0);

  const run = (cmd, args) =>
    spawnSync(cmd, args, { stdio: 'ignore', shell: true });

  run('npx', ['--no-install', 'prettier', '--write', file]);
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) {
    run('npx', ['--no-install', 'oxlint', '--fix', file]);
  }
  process.exit(0);
});
