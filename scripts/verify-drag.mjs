import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

// ── List item reorder ──────────────────────────────────────────────────────
console.log('=== List item drag-reorder ===');
await page.goto('http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/df976fdf-eea7-42fd-813c-e642a8eabc84', {
	waitUntil: 'networkidle'
});
const titlesBefore = await page.locator('.list-item-title').allInnerTexts();
console.log('Order before:', titlesBefore.slice(0, 3));

const first = page.locator('.list-item').nth(0);
const third = page.locator('.list-item').nth(2);
await first.dragTo(third);
await page.waitForTimeout(500);
const titlesAfterDrag = await page.locator('.list-item-title').allInnerTexts();
console.log('Order after drag:', titlesAfterDrag.slice(0, 3));

await page.reload({ waitUntil: 'networkidle' });
const titlesAfterReload = await page.locator('.list-item-title').allInnerTexts();
console.log('Order after reload (persisted?):', titlesAfterReload.slice(0, 3));
const reorderWorkedAndPersisted =
	JSON.stringify(titlesAfterDrag) !== JSON.stringify(titlesBefore) &&
	JSON.stringify(titlesAfterReload) === JSON.stringify(titlesAfterDrag);
console.log('Reorder worked and persisted:', reorderWorkedAndPersisted);

// Revert: drag first item back to its original position (undo the swap)
if (reorderWorkedAndPersisted) {
	const movedTitle = titlesBefore[0];
	const movedIdx = titlesAfterReload.indexOf(movedTitle);
	if (movedIdx > 0) {
		await page.locator('.list-item').nth(movedIdx).dragTo(page.locator('.list-item').nth(0));
		await page.waitForTimeout(500);
	}
}
const titlesAfterRevert = await page.locator('.list-item-title').allInnerTexts();
console.log('Order after revert:', titlesAfterRevert.slice(0, 3));
console.log('Revert matches original:', JSON.stringify(titlesAfterRevert) === JSON.stringify(titlesBefore));

// ── Progress-bars chip drag (within one bar) ───────────────────────────────
console.log('=== Progress-bars chip drag-reorder ===');
await page.goto('http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/2447d4e6-3d09-4a61-a203-fc8d5b30101d', {
	waitUntil: 'networkidle'
});
const firstBar = page.locator('.pb-bar-row').first();
const chipTitlesBefore = await firstBar.locator('.pb-chip-title').allInnerTexts();
console.log('Chip order before:', chipTitlesBefore);

if (chipTitlesBefore.length >= 2) {
	await firstBar.locator('.pb-chip').nth(0).dragTo(firstBar.locator('.pb-chip').nth(1));
	await page.waitForTimeout(500);
	const chipTitlesAfter = await firstBar.locator('.pb-chip-title').allInnerTexts();
	console.log('Chip order after drag:', chipTitlesAfter);
	const chipsChanged = JSON.stringify(chipTitlesAfter) !== JSON.stringify(chipTitlesBefore);
	console.log('Chip order changed:', chipsChanged);

	// revert
	if (chipsChanged) {
		await firstBar.locator('.pb-chip').nth(1).dragTo(firstBar.locator('.pb-chip').nth(0));
		await page.waitForTimeout(500);
	}
	const chipTitlesReverted = await firstBar.locator('.pb-chip-title').allInnerTexts();
	console.log('Chip order after revert:', chipTitlesReverted);
	console.log('Chip revert matches original:', JSON.stringify(chipTitlesReverted) === JSON.stringify(chipTitlesBefore));
}

console.log('Console/page errors:', errors);
console.log(errors.length === 0 ? 'PASS (see individual checks above)' : 'FAIL (console errors present)');

await browser.close();
