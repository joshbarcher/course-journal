// Shared plumbing for the two GET .../export routes. The rendering itself
// lives in the shared (client+server) utils/export-page, so a file
// downloaded from the in-app menu and one fetched from this endpoint are
// byte-for-byte identical.
import { error } from '@sveltejs/kit';
import {
	EXPORT_FORMATS,
	EXPORT_MIME_TYPES,
	exportFilename,
	isExportFormat,
	renderExport,
	type Exportable
} from '$lib/utils/export-page';

export function exportResponse(record: Exportable, url: URL): Response {
	// Markdown is the default because that's what these exports are for —
	// reading and editing outside the app.
	const requested = url.searchParams.get('format') ?? 'md';
	if (!isExportFormat(requested)) {
		return error(400, { message: `format must be one of: ${EXPORT_FORMATS.join(', ')}` });
	}

	const body = renderExport(record, requested);
	// exportFilename slugs down to [a-z0-9-]+, so it's always safe to drop
	// straight into the header unquoted-safe — no filename* needed.
	const filename = exportFilename(record.title, requested);
	// `?download=0` reads the export in the browser/curl instead of saving it.
	const disposition = url.searchParams.get('download') === '0' ? 'inline' : 'attachment';

	return new Response(body, {
		headers: {
			'Content-Type': `${EXPORT_MIME_TYPES[requested]}; charset=utf-8`,
			'Content-Disposition': `${disposition}; filename="${filename}"`,
			// The underlying record changes on every edit, and an export is
			// cheap to regenerate — never hand back a stale one.
			'Cache-Control': 'no-store'
		}
	});
}
