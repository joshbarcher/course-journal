import { z } from 'zod';

// Every schema uses z.looseObject (Zod v4's non-deprecated equivalent of
// .passthrough()) rather than z.object/.strict(): unknown keys must survive
// round-trips through this schema, since it sits in front of real production
// data on a live network share where any field this schema doesn't yet know
// about must not be silently dropped on the next read+write cycle.

export const ListItemSchema = z.looseObject({
	id: z.string(),
	title: z.string(),
	// Confirmed against public/js/views/list.js: subtasks are plain strings,
	// not {id, text} objects (unlike NoteSchema below, which are objects).
	subtasks: z.array(z.string()).default([]),
	order: z.number(),
	done: z.boolean()
});

export const TaskStateSchema = z.enum(['started', 'working', 'done']).nullable();

export const ProgressTaskSchema = z.looseObject({
	id: z.string(),
	title: z.string(),
	subtitle: z.string().default(''),
	state: TaskStateSchema,
	// Real data omits this key entirely when false (only ever set to `true`
	// by _toggleTaskOptional/_toggleStepOptional/_toggleBarOptional) — must
	// stay .optional(), not .default(false), or every non-optional record
	// would gain a key it never had on disk.
	optional: z.boolean().optional()
});

// Identical shape to ProgressTaskSchema today (progress-bars.js step === progress.js task).
export const ProgressBarStepSchema = ProgressTaskSchema;

export const ProgressBarSchema = z.looseObject({
	id: z.string(),
	title: z.string(),
	optional: z.boolean().optional(),
	steps: z.array(ProgressBarStepSchema).default([])
});

export const NoteSchema = z.looseObject({
	id: z.string(),
	text: z.string(),
	createdAt: z.string()
});

const PageBase = {
	id: z.string(),
	title: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
};

export const ListPageSchema = z.looseObject({
	...PageBase,
	type: z.literal('list'),
	ordered: z.boolean(),
	items: z.array(ListItemSchema)
});

export const ProgressPageSchema = z.looseObject({
	...PageBase,
	type: z.literal('progress'),
	tasks: z.array(ProgressTaskSchema),
	notes: z.string()
});

export const ProgressBarsPageSchema = z.looseObject({
	...PageBase,
	type: z.literal('progress-bars'),
	bars: z.array(ProgressBarSchema),
	notes: z.string()
});

export const NotesPageSchema = z.looseObject({
	...PageBase,
	type: z.literal('notes'),
	notes: z.array(NoteSchema)
});

export const ContentPageSchema = z.looseObject({
	...PageBase,
	type: z.literal('page'),
	content: z.string()
});

export const PageSchema = z.discriminatedUnion('type', [
	ListPageSchema,
	ProgressPageSchema,
	ProgressBarsPageSchema,
	NotesPageSchema,
	ContentPageSchema
]);

export type ListItem = z.infer<typeof ListItemSchema>;
export type ProgressTask = z.infer<typeof ProgressTaskSchema>;
export type ProgressBar = z.infer<typeof ProgressBarSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type ListPage = z.infer<typeof ListPageSchema>;
export type ProgressPage = z.infer<typeof ProgressPageSchema>;
export type ProgressBarsPage = z.infer<typeof ProgressBarsPageSchema>;
export type NotesPage = z.infer<typeof NotesPageSchema>;
export type ContentPage = z.infer<typeof ContentPageSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageType = Page['type'];

export const PagesFileSchema = z.looseObject({
	pages: z.array(PageSchema)
});
export type PagesFile = z.infer<typeof PagesFileSchema>;

// Mirrors journalService.js's typeDefaults() — used both for brand-new pages
// and to seed the fields the persistence layer will backfill on read if a
// schema mismatch is otherwise recoverable (see server/persistence/journal-service.ts).
export function typeDefaults(type: PageType): Record<string, unknown> {
	switch (type) {
		case 'list':
			return { ordered: true, items: [] };
		case 'progress':
			return { tasks: [], notes: '' };
		case 'progress-bars':
			return { bars: [], notes: '' };
		case 'notes':
			return { notes: [] };
		case 'page':
			return { content: '' };
	}
}

export const VALID_PAGE_TYPES = ['list', 'progress', 'progress-bars', 'notes', 'page'] as const satisfies readonly PageType[];
