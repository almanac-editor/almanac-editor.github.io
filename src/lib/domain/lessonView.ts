/** Labels and timing for showing a lesson, as the data repo's view.py shows them. */

import type { Kind, Lesson } from './types.ts';

export const TALK_KINDS: ReadonlySet<string> = new Set(['instruction', 'discussion', 'review']);

export const KIND_LABELS: Record<Kind, string> = {
	instruction: 'Direct instruction',
	discussion: 'Discussion',
	review: 'Review',
	practice: 'Practice'
};

export const TIER_LABELS = { core: 'Core', practice: 'Practice', stretch: 'Stretch' } as const;

export const DIFFERENTIATION_LABELS = {
	support: 'Support',
	extension: 'Extension',
	eald: 'EAL/D',
	response_modes: 'Response modes',
	adhd: 'ADHD'
} as const;

export function kindClass(kind: string | undefined): string {
	return kind && TALK_KINDS.has(kind) ? 'talk' : kind === 'practice' ? 'activity' : '';
}

export function timing(lesson: Pick<Lesson, 'sections' | 'duration_minutes'>) {
	const sections = lesson.sections ?? [];
	const sum = (keep: (kind: string | undefined) => boolean) =>
		sections.filter((s) => keep(s.kind)).reduce((n, s) => n + (s.duration_minutes || 0), 0);
	const talk = sum((k) => !!k && TALK_KINDS.has(k));
	const activity = sum((k) => k === 'practice');
	const total = sum(() => true);
	return {
		talk,
		activity,
		other: total - talk - activity,
		total,
		nominal: lesson.duration_minutes
	};
}

/** Minutes elapsed before each section starts. */
export function startTimes(durations: (number | null)[]): number[] {
	let at = 0;
	return durations.map((d) => {
		const start = at;
		at += Number(d) || 0;
		return start;
	});
}

/**
 * A citation in runs of plain and italic text. Citations mark italics with
 * *asterisks*, as Markdown does; an unpaired asterisk stays as it is.
 */
export function citationParts(citation: string): { text: string; italic: boolean }[] {
	return citation
		.split(/\*([^*]+)\*/)
		.map((text, i) => ({ text, italic: i % 2 === 1 }))
		.filter((part) => part.text !== '');
}

/**
 * The host name to show for a reference's link, or null when the link is not
 * a web address and should not be made clickable.
 */
export function linkHost(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.hostname : null;
	} catch {
		return null;
	}
}

/**
 * Where a resource's `shared` file is, given its unit's `shared_folder.url`:
 * - `link`: the file's web address, the folder's address, `/`, then the path
 *   percent-encoded segment by segment, as `scripts/shared_resources.py` makes
 *   it with Python's `quote(path, safe="/")`.
 * - `missing`: the path has no extension, so the file is known but not found yet.
 * - `text`: the unit has no usable folder address; show the path as it is.
 */
export type SharedPlace = { kind: 'link'; url: string } | { kind: 'missing' } | { kind: 'text' };

export function sharedPlace(shared: string, folderUrl: string | undefined): SharedPlace {
	if (!hasSuffix(shared)) return { kind: 'missing' };
	if (!folderUrl || linkHost(folderUrl) === null) return { kind: 'text' };
	return { kind: 'link', url: folderUrl.replace(/\/+$/, '') + '/' + quotePath(shared) };
}

/** Python's `Path(p).suffix` is not empty: the last part has a dot that neither starts nor ends it. */
function hasSuffix(path: string): boolean {
	const name = path.replace(/\/+$/, '').split('/').pop() ?? '';
	const dot = name.lastIndexOf('.');
	return dot > 0 && dot < name.length - 1;
}

/** Python's `quote(path, safe="/")`: everything but letters, digits, `_.-~` and `/` is encoded. */
export function quotePath(path: string): string {
	return path
		.split('/')
		.map((part) =>
			encodeURIComponent(part).replace(
				/[!'()*]/g,
				(c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
			)
		)
		.join('/');
}
