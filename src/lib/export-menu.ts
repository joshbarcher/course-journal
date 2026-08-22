// The Copy/Download menu shared by the page header (PageTitleHeader) and the
// per-row ⋮ menus (PageListRow, PlannersList).
import { showContextMenu, type ContextMenuItem } from './context-menu';
import { copyText, downloadText } from './download';
import { showError, showToast } from './dialogs';
import {
	EXPORT_FORMATS,
	EXPORT_FORMAT_LABELS,
	EXPORT_MIME_TYPES,
	exportFilename,
	renderExport,
	type Exportable
} from './utils/export-page';

// The record arrives as a getter rather than a value on purpose: an open
// page component holds the live, still-being-edited state, so the menu has
// to read it when the item is clicked. Capturing the value when the menu was
// built would export whatever was on screen a moment ago.
export function exportMenuItems(getRecord: () => Exportable): ContextMenuItem[] {
	const copyItems: ContextMenuItem[] = EXPORT_FORMATS.map((format) => ({
		label: `Copy as ${EXPORT_FORMAT_LABELS[format]}`,
		action: async () => {
			try {
				await copyText(renderExport(getRecord(), format));
				showToast(`Copied as ${EXPORT_FORMAT_LABELS[format].toLowerCase()}`);
			} catch (err) {
				showError(`Failed to copy: ${(err as Error).message}`);
			}
		}
	}));

	const downloadItems: ContextMenuItem[] = EXPORT_FORMATS.map((format) => ({
		label: `Download .${format}`,
		action: () => {
			try {
				const record = getRecord();
				downloadText(
					exportFilename(record.title, format),
					renderExport(record, format),
					EXPORT_MIME_TYPES[format]
				);
			} catch (err) {
				showError(`Failed to export: ${(err as Error).message}`);
			}
		}
	}));

	return [...copyItems, 'separator', ...downloadItems];
}

// For a ⋮ menu that already has its own items — nests the same actions one
// level down instead of doubling the menu's length.
export function exportSubmenu(getRecord: () => Exportable): ContextMenuItem {
	return { label: 'Export…', submenu: exportMenuItems(getRecord) };
}

export function showExportMenu(event: MouseEvent, getRecord: () => Exportable): void {
	showContextMenu(event, exportMenuItems(getRecord));
}
