import { createSlocHandler } from '../../../sloc.js';

export const GET = createSlocHandler(process.cwd(), { name: 'course-journal' });
