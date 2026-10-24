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
