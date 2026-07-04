import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const url = 'http://localhost:5174/c/fc8f30f5-eeff-48d8-a115-f8d95f5f8113/1815ddff-8445-47f6-901b-79bc8ed5f86a';
await page.goto(url, { waitUntil: 'networkidle' });

const titleText = await page.locator('.page-title').innerText();
console.log('Title:', titleText);

const before = await page.locator('.notes-card').count();
console.log('Notes before:', before);

await page.locator('.notes-input').fill('Playwright test note');
await page.locator('.notes-input').press('Control+Enter');
await page.waitForTimeout(500);

const after = await page.locator('.notes-card').count();
console.log('Notes after add:', after);

const firstCardText = await page.locator('.notes-card').first().locator('.notes-card-text').innerText();
console.log('First card text (should be newest):', firstCardText);

// Reload to confirm it persisted server-side
await page.reload({ waitUntil: 'networkidle' });
const afterReload = await page.locator('.notes-card').count();
console.log('Notes after reload:', afterReload);

// Clean up: delete the note we just added
await page.locator('.notes-card').first().locator('.notes-card-delete').click();
await page.waitForTimeout(500);
const afterDelete = await page.locator('.notes-card').count();
console.log('Notes after cleanup delete:', afterDelete);

console.log('Console/page errors:', errors);
console.log(errors.length === 0 && afterDelete === before ? 'PASS' : 'FAIL');

await browser.close();
