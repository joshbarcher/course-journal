// Seed script: creates a fully populated HTML + CSS Fundamentals course
// Run: node scripts/seed.js

const BASE = 'http://localhost:8060/api'

async function req(method, path, body) {
    const opts = { method, headers: {} }
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json'
        opts.body = JSON.stringify(body)
    }
    const res = await fetch(BASE + path, opts)
    if (res.status === 204) return null
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data
}

// ── Clean up test courses ─────────────────────────────────────────────────────

const existing = await req('GET', '/courses')
for (const c of existing) {
    if (c.title.startsWith('Test Course')) {
        await req('DELETE', `/courses/${c.id}`)
        console.log(`Deleted: ${c.title}`)
    }
}

// ── Create course ─────────────────────────────────────────────────────────────

const course = await req('POST', '/courses', { title: 'HTML & CSS Fundamentals' })
const cid = course.id
console.log(`Created course: ${course.title} (${cid})`)

async function page(body) {
    const p = await req('POST', `/courses/${cid}/pages`, body)
    console.log(`  + ${p.type}: ${p.title}`)
    return p
}

// ── Helper: build a step ──────────────────────────────────────────────────────

let _stepCounter = 0
function step(title, state) {
    return { id: `s${++_stepCounter}`, title, state }
}

function task(title, state) {
    return { id: `t${++_stepCounter}`, title, state }
}

function noteCard(text) {
    return { id: `n${++_stepCounter}`, text, createdAt: new Date().toISOString() }
}

function item(text, done = false) {
    return { id: `i${++_stepCounter}`, text, done }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 1: HTML Slides (Weeks 1–5)
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'progress-bars',
    title: 'HTML Slides (Weeks 1–5)',
    bars: [
        {
            id: 'b1', title: 'Week 1 · Intro to HTML',
            steps: [
                step('What is HTML?', 'done'),
                step('Tags & Elements', 'done'),
                step('Document Structure', 'done'),
                step('Text Formatting', 'done'),
                step('Links & Images', 'done'),
                step('HTML Comments', 'done'),
            ],
        },
        {
            id: 'b2', title: 'Week 2 · Semantic HTML',
            steps: [
                step('Why Semantics Matter', 'done'),
                step('Headings & Paragraphs', 'done'),
                step('Lists: ul, ol, dl', 'done'),
                step('nav, header, footer', 'done'),
                step('article & section', 'done'),
                step('aside & main', 'done'),
            ],
        },
        {
            id: 'b3', title: 'Week 3 · Forms & Tables',
            steps: [
                step('Form Element Overview', 'done'),
                step('Input Types', 'done'),
                step('Labels & Fieldsets', 'done'),
                step('Select & Textarea', 'done'),
                step('Table Structure', 'done'),
                step('Accessible Tables', 'done'),
            ],
        },
        {
            id: 'b4', title: 'Week 4 · HTML5 Features',
            steps: [
                step('Audio & Video Embeds', 'done'),
                step('Canvas Element', 'done'),
                step('Local Storage & Session', 'done'),
                step('Geolocation API', 'done'),
                step('Custom Data Attributes', 'working'),
                step('Template Element', null),
            ],
        },
        {
            id: 'b5', title: 'Week 5 · Accessibility',
            steps: [
                step('Why Accessibility Matters', 'done'),
                step('ARIA Roles & Labels', 'done'),
                step('Keyboard Navigation', 'done'),
                step('Alt Text Best Practices', 'done'),
                step('Focus Management', 'working'),
                step('WCAG 2.1 Overview', null),
            ],
        },
    ],
    notes: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 2: CSS Slides (Weeks 6–10)
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'progress-bars',
    title: 'CSS Slides (Weeks 6–10)',
    bars: [
        {
            id: 'b6', title: 'Week 6 · CSS Basics',
            steps: [
                step('What is CSS?', 'done'),
                step('Selectors & Specificity', 'done'),
                step('The Cascade', 'done'),
                step('Box Model', 'done'),
                step('Colors & Units', 'done'),
                step('Typography', 'done'),
            ],
        },
        {
            id: 'b7', title: 'Week 7 · Layout',
            steps: [
                step('Display Property', 'done'),
                step('Positioning', 'done'),
                step('Flexbox Fundamentals', 'working'),
                step('Flexbox Alignment', 'working'),
                step('CSS Grid Intro', 'started'),
                step('Grid Template Areas', null),
            ],
        },
        {
            id: 'b8', title: 'Week 8 · Responsive Design',
            steps: [
                step('Mobile-First Strategy', 'started'),
                step('Media Queries', null),
                step('Fluid Layouts', null),
                step('Responsive Images', null),
                step('Breakpoint Patterns', null),
                step('Testing Across Devices', null),
            ],
        },
        {
            id: 'b9', title: 'Week 9 · Advanced CSS',
            steps: [
                step('CSS Variables', null),
                step('Pseudo-classes', null),
                step('Pseudo-elements', null),
                step('Transitions', null),
                step('Keyframe Animations', null),
                step('CSS Filters & Transforms', null),
            ],
        },
        {
            id: 'b10', title: 'Week 10 · Review & Polish',
            steps: [
                step('Debugging CSS', null),
                step('Performance Tips', null),
                step('Cross-browser Compat', null),
                step('CSS Architecture', null),
                step('Portfolio Review', null),
                step('Deployment Prep', null),
            ],
        },
    ],
    notes: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 3: Labs
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'progress-bars',
    title: 'Labs',
    bars: [
        {
            id: 'lb1', title: 'Lab 1 · First Webpage',
            steps: [
                step('Create HTML skeleton', 'done'),
                step('Add headings & paragraphs', 'done'),
                step('Embed images', 'done'),
                step('Add external links', 'done'),
                step('Validate with W3C', 'done'),
            ],
        },
        {
            id: 'lb2', title: 'Lab 2 · Semantic Markup',
            steps: [
                step('Replace divs with semantic tags', 'done'),
                step('Build navigation bar', 'done'),
                step('Structure article + sidebar', 'done'),
                step('Add footer content', 'done'),
                step('Audit with aXe', 'done'),
            ],
        },
        {
            id: 'lb3', title: 'Lab 3 · HTML Forms',
            steps: [
                step('Registration form', 'done'),
                step('Add client-side validation', 'done'),
                step('Style with basic CSS', 'done'),
                step('Test all input types', 'done'),
                step('Add ARIA labels', 'done'),
            ],
        },
        {
            id: 'lb4', title: 'Lab 4 · CSS Styling',
            steps: [
                step('Link stylesheet', 'done'),
                step('Style typography', 'done'),
                step('Color palette + variables', 'done'),
                step('Border & background effects', 'done'),
                step('Style the form from Lab 3', 'done'),
            ],
        },
        {
            id: 'lb5', title: 'Lab 5 · Flexbox Layout',
            steps: [
                step('Flex nav bar', 'done'),
                step('Card grid with flex-wrap', 'working'),
                step('Centering techniques', 'working'),
                step('Flex sidebar layout', null),
                step('Responsive flex columns', null),
            ],
        },
        {
            id: 'lb6', title: 'Lab 6 · CSS Grid',
            steps: [
                step('Basic grid container', 'started'),
                step('Named grid areas', null),
                step('Responsive grid', null),
                step('Overlap & layering', null),
                step('Full-page layout', null),
            ],
        },
        {
            id: 'lb7', title: 'Lab 7 · Responsive Site',
            steps: [
                step('Mobile layout baseline', null),
                step('Tablet breakpoint', null),
                step('Desktop breakpoint', null),
                step('Test on real devices', null),
                step('Lighthouse audit', null),
            ],
        },
        {
            id: 'lb8', title: 'Lab 8 · Animations',
            steps: [
                step('Hover transitions', null),
                step('Loading spinner', null),
                step('Slide-in animation', null),
                step('Scroll-triggered class', null),
                step('Reduce-motion support', null),
            ],
        },
    ],
    notes: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 4: Assessments
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'progress',
    title: 'Assessments',
    tasks: [
        task('Quiz 1 · HTML Basics', 'done'),
        task('Quiz 2 · Semantic HTML', 'done'),
        task('Quiz 3 · Forms & Tables', 'done'),
        task('Quiz 4 · HTML5 Features', 'done'),
        task('Quiz 5 · Accessibility', 'done'),
        task('Quiz 6 · CSS Basics', 'done'),
        task('Quiz 7 · CSS Layout', 'working'),
        task('Quiz 8 · Responsive Design', null),
        task('Quiz 9 · Advanced CSS', null),
        task('Midterm: HTML Portfolio Page', 'done'),
        task('Final Exam', null),
    ],
    notes: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 5: Final Project
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'progress',
    title: 'Final Project',
    tasks: [
        task('Choose project topic', 'done'),
        task('Create wireframes', 'done'),
        task('Write project proposal', 'done'),
        task('Build HTML structure', 'done'),
        task('Add all content & assets', 'done'),
        task('Style with CSS', 'working'),
        task('Make fully responsive', null),
        task('Add CSS animations', null),
        task('Cross-browser testing', null),
        task('Lighthouse score ≥ 90', null),
        task('Write README', null),
        task('Deploy to GitHub Pages', null),
        task('Peer code review', null),
        task('Final submission', null),
    ],
    notes: '',
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 6: Reading List
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'list',
    title: 'Reading List',
    ordered: false,
    items: [
        item('MDN: Introduction to HTML', true),
        item('MDN: HTML forms guide', true),
        item('MDN: Accessibility', true),
        item('MDN: CSS first steps', true),
        item('CSS-Tricks: A Complete Guide to Flexbox', true),
        item('CSS-Tricks: A Complete Guide to Grid', false),
        item('web.dev: Learn Responsive Design', false),
        item('web.dev: Learn CSS Animations', false),
        item('Smashing Magazine: CSS Architecture', false),
        item('The A11Y Project: Checklist', false),
    ],
})

// ─────────────────────────────────────────────────────────────────────────────
// Page 7: Lecture Notes
// ─────────────────────────────────────────────────────────────────────────────

await page({
    type: 'notes',
    title: 'Lecture Notes',
    notes: [
        noteCard('Specificity order: inline > ID > class/attr > element. Use the lowest specificity that works — avoid IDs in stylesheets.'),
        noteCard('Flexbox is one-dimensional (row OR column). Grid is two-dimensional. Use flex for components, grid for page layout.'),
        noteCard('The box model: content → padding → border → margin. Use box-sizing: border-box on * to make widths predictable.'),
        noteCard('rem vs em: rem is always relative to root (html), em is relative to current element. Prefer rem for spacing & font sizes.'),
        noteCard('Semantic HTML improves SEO, accessibility, and readability. Ask: "Does this tag describe the content?" If not, use a div.'),
        noteCard('WCAG 2.1 AA requires 4.5:1 contrast ratio for normal text, 3:1 for large text. Use the WebAIM contrast checker.'),
        noteCard('Media query breakpoints: 480px (mobile), 768px (tablet), 1024px (desktop). Start mobile-first with min-width queries.'),
        noteCard('CSS custom properties (--var) cascade and inherit like regular properties. Great for theming and avoiding magic numbers.'),
    ],
})

console.log('\nDone! Course seeded successfully.')
console.log(`Visit http://localhost:8060/#c:${cid}`)
