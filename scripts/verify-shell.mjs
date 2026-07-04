import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const CID = '150a964c-1f53-495f-99e5-32f93e5d88d5'; // CS 123 - Java 3

console.log('=== Courses list ===');
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
const courseCount = await page.locator('.course-card').count();
console.log('Course cards:', courseCount);
const miniHeatRows = await page.locator('.course-card').first().locator('.mini-heat-row').count();
console.log('First card mini-heatmap rows:', miniHeatRows);

console.log('=== Navigate into a course (click card) ===');
await page.locator('.course-card', { hasText: 'Java 3' }).click();
await page.waitForURL(`**/c/${CID}`);
console.log('URL after click:', page.url());

console.log('=== Sidebar present with course header + TOC + items ===');
const sidebarVisible = await page.locator('#sidebar').isVisible();
console.log('Sidebar visible:', sidebarVisible);
const courseName = await page.locator('.sidebar-course-name').innerText();
console.log('Sidebar course name:', courseName);
const itemCount = await page.locator('.sidebar-item').count();
console.log('Sidebar item count:', itemCount);

console.log('=== Heatmap renders on course home ===');
const heatmapRowCount = await page.locator('.heatmap-row').count();
console.log('Heatmap rows:', heatmapRowCount);

console.log('=== Click a sidebar item navigates to the page ===');
const firstItemTitle = await page.locator('.sidebar-item .sidebar-item-title').first().innerText();
await page.locator('.sidebar-item-content').first().click();
await page.waitForTimeout(500);
console.log('URL after sidebar item click:', page.url());
const pageTitle = await page.locator('.page-title').innerText();
console.log('Page title matches sidebar item:', pageTitle === firstItemTitle, `(${pageTitle} vs ${firstItemTitle})`);
const activeItemCount = await page.locator('.sidebar-item.active').count();
console.log('Active sidebar item highlighted:', activeItemCount === 1);

console.log('=== TOC link ===');
await page.locator('.sidebar-toc-btn').click();
await page.waitForURL(`**/c/${CID}/toc`);
const tocSections = await page.locator('.toc-section').count();
console.log('TOC sections:', tocSections);
const tocLinks = await page.locator('.toc-link').count();
console.log('TOC links:', tocLinks);

console.log('=== Back to Courses link ===');
await page.locator('.sidebar-back-link').click();
await page.waitForURL('**/');
console.log('URL after back link:', page.url());

console.log('Console/page errors:', errors);
console.log(errors.length === 0 ? 'PASS' : 'FAIL');

await browser.close();
