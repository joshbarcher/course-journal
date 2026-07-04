import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});

const url = 'http://localhost:5174/c/150a964c-1f53-495f-99e5-32f93e5d88d5/81947d61-5726-4017-9fd2-e0a0ae334f55';
await page.goto(url, { waitUntil: 'networkidle' });

console.log('Title:', await page.locator('.page-title').innerText());
const contentBefore = await page.locator('.rt-editor').innerHTML();
console.log('Content loaded, length:', contentBefore.length);

// Click into the editor, select all, check Bold toggles active state
const editor = page.locator('.rt-editor');
await editor.click();
await page.keyboard.press('Control+End'); // move caret to the end
await page.keyboard.type(' Playwright edit.');
await page.waitForTimeout(800); // debounce is 600ms

await page.reload({ waitUntil: 'networkidle' });
const contentAfterReload = await page.locator('.rt-editor').innerText();
console.log('Contains typed text after reload:', contentAfterReload.includes('Playwright edit.'));

// Revert: remove the text we added by resetting content via direct API call
console.log('Console/page errors:', errors);

// Test bold toggle active-state UI feedback
await page.locator('.rt-editor').click();
await page.keyboard.press('Control+A');
const boldBtn = page.locator('.rt-btn[data-cmd="bold"]');
const boldActiveBefore = (await boldBtn.getAttribute('class'))?.includes('active');
await boldBtn.click();
await page.waitForTimeout(200);
const boldActiveAfter = (await boldBtn.getAttribute('class'))?.includes('active');
console.log('Bold toggle active state changed:', boldActiveBefore, '->', boldActiveAfter);

const pass = errors.length === 0 && contentAfterReload.includes('Playwright edit.') && boldActiveBefore !== boldActiveAfter;
console.log(pass ? 'PASS' : 'FAIL');

await browser.close();
