import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const url = 'http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/452e4308-7968-4041-baf3-15d37e2abea7';
await page.goto(url, { waitUntil: 'networkidle' });

console.log('Title:', await page.locator('.page-title').innerText());
const taskCount = await page.locator('.progress-task').count();
console.log('Task count:', taskCount);

// Check the global bar shows title text, not just a number
const firstSegTitle = await page.locator('.progress-seg-title').first().innerText();
console.log('First global-bar segment shows title text:', firstSegTitle);

// Toggle a task's state and confirm active class + persistence
const firstTask = page.locator('.progress-task').first();
const workingBtn = firstTask.locator('.progress-state-btn', { hasText: 'WORKING' });
const wasActive = (await workingBtn.getAttribute('class'))?.includes('active');
await workingBtn.click();
await page.waitForTimeout(400);
const isActiveNow = (await workingBtn.getAttribute('class'))?.includes('active');
console.log('WORKING toggled:', wasActive, '->', isActiveNow);

await page.reload({ waitUntil: 'networkidle' });
const isActiveAfterReload = (
	await page.locator('.progress-task').first().locator('.progress-state-btn', { hasText: 'WORKING' }).getAttribute('class')
)?.includes('active');
console.log('State persisted:', isActiveAfterReload === isActiveNow);

// revert
if (isActiveAfterReload !== wasActive) {
	await page.locator('.progress-task').first().locator('.progress-state-btn', { hasText: 'WORKING' }).click();
	await page.waitForTimeout(400);
}

// Edit subtitle on first task, verify it persists, then revert it
const subtitleEl = firstTask.locator('.progress-task-subtitle');
const originalSubtitle = await subtitleEl.innerText();
await subtitleEl.click();
await page.keyboard.press('Control+A');
await page.keyboard.type('Playwright subtitle test');
await page.locator('.progress-task-title').first().click(); // click elsewhere to blur
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
const subtitleAfterReload = await page.locator('.progress-task-subtitle').first().innerText();
console.log('Subtitle after reload:', subtitleAfterReload);

// revert (Ctrl+A only selects — must Delete before typing replacement, else
// an empty originalSubtitle leaves the edited text untouched)
await page.locator('.progress-task-subtitle').first().click();
await page.keyboard.press('Control+A');
await page.keyboard.press('Delete');
if (originalSubtitle) await page.keyboard.type(originalSubtitle);
await page.locator('.progress-task-title').first().click();
await page.waitForTimeout(400);
const subtitleAfterRevert = await page.locator('.progress-task-subtitle').first().innerText();
console.log('Subtitle after revert (should match original):', subtitleAfterRevert, '===', originalSubtitle);

// Add + delete a task (round trip)
await page.locator('.progress-add-btn').click();
await page.waitForTimeout(400);
const countAfterAdd = await page.locator('.progress-task').count();
console.log('Task count after add:', countAfterAdd);
await page.locator('.progress-task').last().locator('.list-item-delete').click();
await page.waitForTimeout(400);
const countAfterDelete = await page.locator('.progress-task').count();
console.log('Task count after delete:', countAfterDelete);

console.log('Console/page errors:', errors);
const pass =
	errors.length === 0 &&
	!/^\d+$/.test(firstSegTitle) &&
	isActiveAfterReload === isActiveNow &&
	subtitleAfterReload === 'Playwright subtitle test' &&
	countAfterAdd === taskCount + 1 &&
	countAfterDelete === taskCount;
console.log(pass ? 'PASS' : 'FAIL');

await browser.close();
