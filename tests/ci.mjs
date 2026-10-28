// Runs the in-app checks (index.html?test) in headless Chrome, in English and in French.
// Used by .github/workflows/tests.yml; locally: python3 -m http.server 8000, then node tests/ci.mjs
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:8000/';
const browser = await chromium.launch();
let failed = 0;

for (const query of ['?test', '?test&lang=fr']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + query);
    await page.waitForFunction(() => window.__testResults, null, { timeout: 30000 });
    const results = await page.evaluate(() => window.__testResults);
    console.log(`\n${query}: ${results.passed} passed, ${results.failed} failed`);
    results.results.forEach(r => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n      ${r.error}`}`));
    if (errors.length) console.log(`  Page errors:\n    ${errors.join('\n    ')}`);
    failed += results.failed + errors.length;
    await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
