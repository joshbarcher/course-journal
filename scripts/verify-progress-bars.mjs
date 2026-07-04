import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const url = 'http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/7ff68be3-d36b-4b70-b929-a9af3e8da423';
await page.goto(url, { waitUntil: 'networkidle' });

console.log('Title:', await page.locator('.page-title').innerText());
const barCount = await page.locator('.pb-bar-row').count();
console.log('Bar count:', barCount);

const firstSegTitle = await page.locator('.progress-seg-title').first().innerText();
console.log('First global-bar segment shows title text:', firstSegTitle);

const firstBar = page.locator('.pb-bar-row').first();
const chipCount = await firstBar.locator('.pb-chip').count();
console.log('Chips in first bar:', chipCount);

// Check chip title/subtitle/pin structure is present
const firstChip = firstBar.locator('.pb-chip').first();
console.log('First chip title:', await firstChip.locator('.pb-chip-title').innerText());
console.log('First chip subtitle:', await firstChip.locator('.pb-chip-subtitle').innerText());
const pinExists = (await firstChip.locator('.pb-chip-pin').count()) === 1;
console.log('Pin element present:', pinExists);

// Click chip body (not title/subtitle) to cycle state
const stateBefore = await firstChip.getAttribute('style');
await firstChip.click({ position: { x: 5, y: 5 } }); // click near top-left, away from title/subtitle text but not the delete btn
await page.waitForTimeout(400);
const stateAfter = await firstChip.getAttribute('style');
console.log('Chip style changed after click:', stateBefore !== stateAfter);

await page.reload({ waitUntil: 'networkidle' });
const stateAfterReload = await page.locator('.pb-bar-row').first().locator('.pb-chip').first().getAttribute('style');
console.log('State persisted after reload:', stateAfterReload === stateAfter);

// Cycle 3 more times to get back to original (cycle is null->started->working->done->null)
for (let i = 0; i < 3; i++) {
	await page.locator('.pb-bar-row').first().locator('.pb-chip').first().click({ position: { x: 5, y: 5 } });
	await page.waitForTimeout(300);
}
const stateAfterFullCycle = await page.locator('.pb-bar-row').first().locator('.pb-chip').first().getAttribute('style');
console.log('Back to original after full cycle:', stateAfterFullCycle === stateBefore);

// Add + delete a step
await firstBar.locator('.pb-chip-add').click();
await page.waitForTimeout(400);
const chipCountAfterAdd = await firstBar.locator('.pb-chip').count();
console.log('Chips after add:', chipCountAfterAdd);
await firstBar.locator('.pb-chip').last().hover();
await firstBar.locator('.pb-chip').last().locator('.pb-chip-delete').click({ force: true });
await page.waitForTimeout(400);
const chipCountAfterDelete = await firstBar.locator('.pb-chip').count();
console.log('Chips after delete:', chipCountAfterDelete);

console.log('Console/page errors:', errors);
const pass =
	errors.length === 0 &&
	!/^\d+$/.test(firstSegTitle) &&
	pinExists &&
	stateBefore !== stateAfter &&
	stateAfterReload === stateAfter &&
	stateAfterFullCycle === stateBefore &&
	chipCountAfterAdd === chipCount + 1 &&
	chipCountAfterDelete === chipCount;
console.log(pass ? 'PASS' : 'FAIL');

await browser.close();
