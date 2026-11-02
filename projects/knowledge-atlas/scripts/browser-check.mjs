import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function checkKnowledgeAtlas({ page, frame, screenshots }) {
  const source = new URL('./', frame.url());
  const scripts = {};
  for (const name of ['experiments', 'prototype']) {
    scripts[name] = await readFile(new URL(`../tests/${name}.browser.js`, import.meta.url), 'utf8');
  }
  const results = [];
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
    await frame.goto(source.href, { waitUntil: 'networkidle0' });
    await frame.waitForFunction(() => window.__sceneReady);
    const experiments = await frame.evaluate(scripts.experiments);
    assert.equal(experiments.passed, experiments.assertions);
    for (const view of ['cosmos', 'city', 'metro', 'radial', 'river', 'lab']) {
      await frame.evaluate(view => {
        document.querySelector(`button[data-view="${view}"]`).click();
        window.scrollTo(0, 0);
      }, view);
      await page.screenshot({ path: path.join(screenshots, `atlas-${view}-${width}.png`) });
    }
    await frame.goto(new URL('knowledge-prototype.html', source).href, { waitUntil: 'networkidle0' });
    const prototype = await frame.evaluate(scripts.prototype);
    assert.equal(prototype.passed, prototype.assertions);
    for (const variant of ['A', 'B', 'C']) {
      await frame.evaluate(variant => {
        document.querySelector(`button[data-variant="${variant}"]`).click();
        window.scrollTo(0, 0);
      }, variant);
      assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `Prototype ${variant} overflows at ${width}`);
      await page.screenshot({ path: path.join(screenshots, `atlas-${variant}-${width}.png`) });
    }
    results.push({ width, experiments, prototype });
  }
  await frame.goto(new URL('sources.html', source).href, { waitUntil: 'networkidle0' });
  for (const width of [320, 768]) {
    await page.setViewport({ width, height: 1000 });
    assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  const destinations = await frame.$$eval('a[href]', links => links.map(link => link.href));
  for (const destination of destinations) {
    const url = new URL(destination);
    if (url.origin !== source.origin) continue;
    const response = await fetch(url.href);
    assert.equal(response.status, 200, `Broken bibliography navigation: ${url}`);
    await response.arrayBuffer();
  }
  await writeFile(path.join(screenshots, 'atlas-checks.json'), JSON.stringify(results, null, 2));
  await page.setViewport({ width: 1440, height: 1000 });
  await frame.goto(source.href, { waitUntil: 'networkidle0' });
}
