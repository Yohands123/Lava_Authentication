/** The original passing preview attack, unchanged movement and seed; no API mocks. */
export async function automatedStir(page, origin, seedValue = 42, options = {}) {
  let summary = null, evaluated = null;
  const capture = response => {
    if (response.url().endsWith('/api/lavaguard/evaluate')) {
      summary = response.request().postDataJSON().summary;
      evaluated = response.json().then(decision => ({ status: response.status(), decision }));
    }
  };
  page.on('response', capture);
  try {
    if (!options.resume) {
      await page.goto(origin);
      await page.getByRole('button', { name: 'Enter', exact: true }).click();
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    }
    await page.waitForFunction(() => document.querySelector('[data-screen=stir]').dataset.guardState === 'STIRRING');
    const box = await page.locator('[data-ring-arc]').boundingBox();
    let angle = 0, seed = seedValue;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const started = Date.now();
    while (await page.locator('[data-screen=stir]').getAttribute('data-guard-state') === 'STIRRING') {
      if (Date.now() - started > 45000) throw new Error('The automated stir did not clear the ring in time.');
      for (let i = 0; i < 40; i++) {
        angle += .12 + random() * .1;
        const radius = box.width / .6624 * (.08 + .3 * Math.abs(Math.sin(angle * .31)) + random() * .03);
        await page.mouse.move(box.x + box.width / 2 + Math.cos(angle) * radius, box.y + box.height / 2 + Math.sin(angle * 1.17) * radius);
      }
    }
    await page.waitForFunction(() => ['CLEAR', 'FLAG', 'BLOCK'].includes(document.querySelector('[data-screen=stir]').dataset.guardState));
    if (!evaluated) throw new Error('The result did not come from a server evaluation.');
    return { ...await evaluated, summary };
  } finally { page.off('response', capture); }
}
