import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [
  'chemistry-hall-refinement', 'gongzi', 'old-library', 'reference-catalog',
  'science-hall-refinement', 'tongfang-refinement',
].map(name => join(root, 'tests', `${name}.test.mjs`));
const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=^local reference bytes:', ...files], {
  cwd: root, stdio: 'inherit', env: {...process.env, CAMPUS_TEST_REFERENCES: '1'},
});
if (result.error) throw result.error;
if (result.signal || result.status === null) throw new Error(`Reference tests did not finish: ${result.signal}`);
process.exitCode = result.status;
