import { createCoverageHandler } from '../../../coverage.js';

export const GET = createCoverageHandler(process.cwd(), { name: 'course-journal' });
