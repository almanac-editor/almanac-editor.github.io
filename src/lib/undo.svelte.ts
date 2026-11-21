/**
 * One step of undo for removing something on the assessment edit page. Each
 * removal says how to put back just what it removed, where it was, so Undo
 * never touches edits made since. The save bar offers Undo until the next
 * removal, a Cancel, or a save.
 */

let restore: (() => void) | null = null;

export const undo = $state<{ label: string | null }>({ label: null });

/** Call just before removing something, with how to put it back: "Removed the table". */
export function removing(label: string, putBack: () => void): void {
	restore = putBack;
	undo.label = label;
}

export function undoRemove(): void {
	const fn = restore;
	restore = null;
	undo.label = null;
	fn?.();
}

export function forgetUndo(): void {
	restore = null;
	undo.label = null;
}
