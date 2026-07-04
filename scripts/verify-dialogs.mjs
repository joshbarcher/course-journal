import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

console.log('=== Create a test course via "+ New Course" dialog ===');
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
const countBefore = await page.locator('.course-card').count();
await page.locator('.courses-add-btn').click();
await page.locator('.dialog-input').fill('Playwright Shell Test Course');
await page.locator('.dialog-btn--create').click();
await page.waitForURL('**/c/*');
const newCourseUrl = page.url();
const newCourseId = newCourseUrl.split('/c/')[1];
console.log('Created course id:', newCourseId);

console.log('=== New Page dialog: create a notes page ===');
await page.locator('.sidebar-add-btn').click();
await page.locator('#new-page-title').fill('PW Test Notes');
// Notes is index 3 in PAGE_TYPES (progress, progress-bars, list, notes, page)
await page.locator('input[name="page-type"][value="notes"]').check();
await page.locator('.dialog-btn--create').click();
await page.waitForTimeout(500);
console.log('URL after page create:', page.url());
const createdPageTitle = await page.locator('.page-title').innerText();
console.log('Created page title:', createdPageTitle);

console.log('=== Sidebar item context menu: rename via duplicate + delete ===');
const item = page.locator('.sidebar-item', { hasText: 'PW Test Notes' });
await item.locator('.sidebar-item-menu').click();
const menuItems = await page.locator('.ctx-menu-item').allInnerTexts();
console.log('Context menu items:', menuItems);
await page.locator('.ctx-menu-item', { hasText: 'Duplicate' }).click();
await page.waitForTimeout(500);
const itemCountAfterDup = await page.locator('.sidebar-item').count();
console.log('Sidebar items after duplicate:', itemCountAfterDup);

console.log('=== Delete both test pages via context menu ===');
for (let i = 0; i < 2; i++) {
	const target = page.locator('.sidebar-item', { hasText: 'PW Test Notes' }).first();
	await target.locator('.sidebar-item-menu').click();
	await page.locator('.ctx-menu-item', { hasText: 'Delete' }).click();
	await page.locator('.dialog-btn--confirm').click();
	await page.waitForTimeout(400);
}
const itemCountAfterDelete = await page.locator('.sidebar-item').count();
console.log('Sidebar items after deleting both:', itemCountAfterDelete);

console.log('=== Clean up: delete the test course ===');
await page.locator('.sidebar-back-link').click();
await page.waitForURL('**/');
const testCard = page.locator('.course-card', { hasText: 'Playwright Shell Test Course' });
await testCard.locator('.course-card-btn--danger').click();
await page.locator('.dialog-btn--confirm').click();
await page.waitForTimeout(500);
const countAfter = await page.locator('.course-card').count();
console.log('Course count before/after:', countBefore, countAfter);

console.log('Console/page errors:', errors);
const pass =
	errors.length === 0 &&
	createdPageTitle === 'PW Test Notes' &&
	itemCountAfterDup === 2 &&
	itemCountAfterDelete === 0 &&
	countAfter === countBefore;
console.log(pass ? 'PASS' : 'FAIL');

await browser.close();
