const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#emailOrUserId', 'demo@ecoguardian.ai');
  await page.fill('#password', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('URL after login:', page.url());

  await page.goto('http://localhost:5173/calculator', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('URL after calculator goto:', page.url());
  const kmInputs = await page.locator('input[placeholder="0.0 km"]').count();
  console.log('km inputs found:', kmInputs);
  if (kmInputs === 0) {
    const body = await page.locator('body').innerText();
    console.log('BODY SNIPPET:', body.slice(0, 400));
  }

  const occupantsBefore = await page.locator('text=Vehicle Occupants').count();
  if (kmInputs > 0) await page.fill('input[placeholder="0.0 km"] >> nth=3', '12');
  await page.waitForTimeout(500);
  const occupantsAfter = await page.locator('text=Vehicle Occupants').count();
  const splitVisible = await page.locator('text=Splitting').count();

  const transportVal = await page.locator('text=kg CO₂ Equivalent').locator('xpath=preceding-sibling::span').first().textContent().catch(() => 'n/a');

  await page.click('button:has-text("+") >> nth=0');
  await page.waitForTimeout(300);
  const occupantsText = await page.locator('.w-10.text-center').first().textContent().catch(() => 'n/a');

  await page.goto('http://localhost:5173/simulator', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const carpoolPreset = await page.locator('text=4-Person Carpool').count();
  const schoolBusPreset = await page.locator('text=School Run').count();
  const carpoolCtrl = await page.locator('text=Carpool — Vehicle Occupants').count();

  console.log('RESULT:');
  console.log('  occupants control before car km:', occupantsBefore, '(expect 0)');
  console.log('  occupants control after car km:', occupantsAfter, '(expect 1)');
  console.log('  split info line visible:', splitVisible, '(expect 1)');
  console.log('  live transport value:', transportVal);
  console.log('  occupants after + click:', occupantsText, '(expect 2)');
  console.log('  carpool preset on simulator:', carpoolPreset, '(expect 1)');
  console.log('  school bus preset:', schoolBusPreset, '(expect 1)');
  console.log('  carpool custom control:', carpoolCtrl, '(expect 1)');
  console.log('  JS errors:', errors.length === 0 ? 'NONE' : errors.join(' | '));

  await browser.close();
  process.exit(errors.length > 0 || occupantsAfter !== 1 || carpoolPreset !== 1 ? 1 : 0);
})();
