import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const url = 'http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/df976fdf-eea7-42fd-813c-e642a8eabc84';
await page.goto(url, { waitUntil: 'networkidle' });

console.log('Title:', await page.locator('.page-title').innerText());
const itemCount = await page.locator('.list-item').count();
console.log('Item count:', itemCount);

// Toggle done on the first item, verify class + persists across reload
const firstItem = page.locator('.list-item').first();
const wasDone = (await firstItem.getAttribute('class'))?.includes('list-item--done');
await firstItem.locator('.list-item-done-btn').click();
await page.waitForTimeout(400);
const isDoneNow = (await firstItem.getAttribute('class'))?.includes('list-item--done');
console.log('Toggled done:', wasDone, '->', isDoneNow);

await page.reload({ waitUntil: 'networkidle' });
const isDoneAfterReload = (await page.locator('.list-item').first().getAttribute('class'))?.includes(
	'list-item--done'
);
console.log('Done state persisted:', isDoneAfterReload === isDoneNow);

// Revert the toggle so we don't leave test data changed
await page.locator('.list-item').first().locator('.list-item-done-btn').click();
await page.waitForTimeout(400);

// Add a subtask to the first item, verify it shows up, then remove it
const subtasksBefore = await firstItem.locator('.subtask-chip').count();
await firstItem.locator('.subtask-add-btn').click();
await firstItem.locator('.subtask-input').fill('Playwright subtask');
await firstItem.locator('.subtask-input').press('Enter');
await page.waitForTimeout(400);
const subtasksAfterAdd = await firstItem.locator('.subtask-chip').count();
console.log('Subtasks before/after add:', subtasksBefore, subtasksAfterAdd);

// Escape closes the (still open, empty) input
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Remove the chip we just added
await firstItem.locator('.subtask-chip', { hasText: 'Playwright subtask' }).locator('.subtask-chip-remove').click();
await page.waitForTimeout(400);
const subtasksAfterRemove = await firstItem.locator('.subtask-chip').count();
console.log('Subtasks after remove:', subtasksAfterRemove);

// Add a brand new item, then delete it (round-trip create/delete)
const addBtn = page.locator('.list-add-btn');
await addBtn.click();
await page.waitForTimeout(400);
const itemCountAfterAdd = await page.locator('.list-item').count();
console.log('Item count after add:', itemCountAfterAdd);

const lastItem = page.locator('.list-item').last();
await lastItem.locator('.list-item-delete').click();
await page.waitForTimeout(400);
const itemCountAfterDelete = await page.locator('.list-item').count();
console.log('Item count after delete:', itemCountAfterDelete);

console.log('Console/page errors:', errors);
const pass =
	errors.length === 0 &&
	isDoneAfterReload === isDoneNow &&
	subtasksAfterAdd === subtasksBefore + 1 &&
	subtasksAfterRemove === subtasksBefore &&
	itemCountAfterAdd === itemCount + 1 &&
	itemCountAfterDelete === itemCount;
console.log(pass ? 'PASS' : 'FAIL');

await browser.close();
