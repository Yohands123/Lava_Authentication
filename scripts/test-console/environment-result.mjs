// Keep this local report sanitizer independent of the TS browser bundle.
export function environmentResult(v) {
  const e = v.automationEnvironment;
  const keys = ['webdriver', 'headlessUserAgent', 'headlessBrand'];
  const valid = e && e.version === 'lava-automation-environment-v1' && e.authority === 'advisory'
    && Object.keys(e).sort().join(',') === 'authority,signals,version' && e.signals && Object.keys(e.signals).sort().join(',') === [...keys].sort().join(',')
    && keys.every(k => e.signals[k] === null || typeof e.signals[k] === 'boolean');
  return { automationEnvironment: valid ? { version: e.version, authority: 'advisory', signals: Object.fromEntries(keys.map(k => [k, e.signals[k]])) } : null,
    declaredEnvironment: ['headed-playwright', 'headless-playwright', 'puppeteer', 'ghost-cursor'].includes(v.declaredEnvironment) ? v.declaredEnvironment : 'unknown',
    declaredControl: v.declaredControl === 'scripted' ? 'scripted' : 'unknown', displayMode: ['headed', 'headless'].includes(v.displayMode) ? v.displayMode : 'unknown' };
}
