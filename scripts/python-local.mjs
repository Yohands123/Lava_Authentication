import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// npm uses cmd.exe on Windows, where .venv/Scripts/python is not executable.
const executable = resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
if (!existsSync(executable)) throw new Error('Create the project .venv and install ml/requirements.txt first.');
const result = spawnSync(executable, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
