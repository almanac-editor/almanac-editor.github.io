/**
 * What a class saw: the decks, workbooks and handouts behind a lesson.
 *
 * Two sources. A delivery's `materials` are links a teacher pasted, to a
 * cloud storage location (OneDrive, Google Drive, SharePoint and the like),
 * for what that class actually had. A lesson's own `materials` is derived by
 * the data repo's `scripts/lesson_materials.py`: where each class's outputs
 * land when rendered from the current plan, as paths, not links.
 *
 * Links only leave the app when clicked; nothing here fetches them. Only
 * `https:` links are accepted, and each shows its host so a teacher can see
 * where it goes.
 */

import { normaliseText } from './format.ts';
import { dirname, join } from './paths.ts';
import type { Lesson } from './types.ts';

export const MATERIAL_KINDS = ['deck', 'workbook', 'handout', 'file'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const KIND_NAMES: Record<MaterialKind, string> = {
	deck: 'Deck',
	workbook: 'Workbook',
	handout: 'Handout',
	file: 'File'
};

/** One link on a delivery, as `delivery.schema.json` has it. */
export interface MaterialLink {
	kind: MaterialKind;
	label?: string;
	url: string;
}

export interface MaterialDraft {
	kind: MaterialKind;
	label: string;
	url: string;
}

export function blankMaterial(kind: MaterialKind = 'deck'): MaterialDraft {
	return { kind, label: '', url: '' };
}

/** The host of an `https:` link, or null for anything else, which is never made a link. */
export function httpsHost(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' && parsed.hostname ? parsed.hostname : null;
	} catch {
		return null;
	}
}

/**
 * The links from what the teacher typed. Rows left wholly blank are dropped;
 * a row with a label but no link, or a link that is not `https:`, is refused
 * with a sentence saying which, numbered as the rows show.
 */
export function materialsFrom(drafts: MaterialDraft[]): MaterialLink[] {
	const out: MaterialLink[] = [];
	drafts.forEach((d, i) => {
		const label = normaliseText(d.label).trim();
		const url = d.url.trim();
		if (!label && !url) return;
		if (!url) throw new Error(`Link ${i + 1} has a label but no link.`);
		if (!httpsHost(url)) throw new Error(`Link ${i + 1} must be a web address starting https://.`);
		out.push(label ? { kind: d.kind, label, url } : { kind: d.kind, url });
	});
	return out;
}

export function toMaterialDrafts(links: MaterialLink[] | undefined): MaterialDraft[] {
	return (links ?? []).map((l) => ({ kind: l.kind, label: l.label ?? '', url: l.url }));
}

/** Where one output of the current plan lands for one class, relative to the repo root. */
export interface Output {
	kind: 'workbook' | 'deck' | 'deck_pdf' | 'handout';
	/** The offering id the output is rendered for. */
	offering: string;
	path: string;
}

const OUTPUT_KINDS = ['deck', 'deck_pdf', 'workbook', 'handout'] as const;

export const OUTPUT_NAMES: Record<Output['kind'], string> = {
	deck: 'Deck',
	deck_pdf: 'Deck (PDF)',
	workbook: 'Workbook',
	handout: 'Handout'
};

/**
 * The current plan's outputs from its derived `materials`: for one class
 * when `offering` is given, otherwise for every class. Also the content file
 * and the source files beside the plan, as paths from the repo root.
 */
export function lessonOutputs(
	lesson: Lesson,
	lessonPath: string,
	offering: string | null
): { outputs: Output[]; sources: string[] } {
	const materials = (lesson.materials ?? {}) as Record<string, unknown>;
	const outputs: Output[] = [];
	for (const kind of OUTPUT_KINDS) {
		const byClass = materials[kind];
		if (!byClass || typeof byClass !== 'object') continue;
		for (const [id, path] of Object.entries(byClass as Record<string, unknown>)) {
			if (typeof path !== 'string' || (offering !== null && id !== offering)) continue;
			outputs.push({ kind, offering: id, path });
		}
	}
	const dir = dirname(lessonPath);
	const files = Array.isArray(materials.files) ? materials.files : [];
	const sources = [materials.content, ...files]
		.filter((f): f is string => typeof f === 'string' && f !== '')
		.map((f) => join(dir, f));
	return { outputs, sources };
}
