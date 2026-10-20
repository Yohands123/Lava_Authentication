import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROFILES } from './settings.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function configuration(origin) {
  try {
    const response = await fetch(origin + '/api/lavaguard/config', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Port is occupied by an incompatible server.');
    return await response.json();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw error;
  }
}
function compatible(config, profile) {
  return config?.mode === 'enforce' && config.lab === true && config.featureVersion === 'lava-features-v1' && config.experimentalModel === profile.experimental && config.modelMode === profile.modelMode;
}
export class LocalServices {
  constructor() { this.children = new Set(); this.logs = []; this.built = false; this.status = {}; }
  launch(args, logName) {
    const log = createWriteStream(resolve('.cache/test-console/' + logName + '.log'), { flags: 'w' }); this.logs.push(log);
    const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.children.add(child); child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.once('exit', () => this.children.delete(child));
    child.on('error', error => { log.write(String(error.message)); });
    return child;
  }
  async build() {
    if (this.built) return;
    const child = this.launch(['node_modules/vite/bin/vite.js', 'build', '--outDir', '.cache/test-console/assets'], 'build');
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Local build failed; see .cache/test-console/build.log'))); });
    this.built = true;
  }
  async ensure() {
    await mkdir('.cache/test-console', { recursive: true });
    for (const [name, profile] of Object.entries(PROFILES)) {
      const existing = await configuration(profile.origin);
      if (existing) {
        if (!compatible(existing, profile)) throw new Error(`Existing ${profile.origin} has another configuration. It was left untouched. Close that server before starting this console.`);
        this.status[name] = { ...profile, configuration: existing, managed: false }; continue;
      }
      await this.build();
      const port = new URL(profile.origin).port;
      const child = this.launch(['node_modules/wrangler/wrangler-dist/cli.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', port,
        '--assets', '.cache/test-console/assets', '--persist-to', `.wrangler/test-console-${name}`,
        '--var', 'ORIGIN:' + profile.origin, '--var', 'LAVAGUARD_MODE:enforce', '--var', 'LAVAGUARD_LAB:1',
        '--var', 'LAVAGUARD_STEP_UP:off', '--var', 'LAVAGUARD_EXPERIMENTAL_MODEL:' + Number(profile.experimental), '--var', 'LAVAGUARD_ML_MODE:' + profile.modelMode], name + '-server');
      const deadline = Date.now() + 60000; let config = null;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Local ${name} Worker exited; see .cache/test-console/${name}-server.log`);
        config = await configuration(profile.origin);
        if (compatible(config, profile)) break;
        await wait(400);
      }
      if (!compatible(config, profile)) throw new Error(`Local ${name} Worker did not become ready.`);
      this.status[name] = { ...profile, configuration: config, managed: true };
    }
    return this.status;
  }
  close() {
    for (const child of this.children) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
      } else child.kill('SIGTERM');
    }
    this.children.clear(); for (const log of this.logs) log.end();
  }
}
