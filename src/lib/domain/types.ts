/**
 * Shapes of the data repo's files, as far as the editor reads them. The JSON
 * schemas in the data repo's `schemas/` are the definition; these types only
 * describe the fields the app touches, and every type allows the rest.
 */

export type Tier = 'core' | 'practice' | 'stretch';
export type Kind = 'instruction' | 'practice' | 'discussion' | 'review';

export interface Section {
	label?: string;
	section: string;
	duration_minutes: number;
	tier?: Tier;
	kind?: Kind;
}

export interface CurriculumLink {
	framework: string;
	id: string;
	coverage: string;
	mode: string;
	note?: string;
}

export interface Differentiation {
	support?: string;
	extension?: string;
	eald?: string;
	response_modes?: string;
	adhd?: string;
}

export interface Resource {
	name: string;
	url?: string;
	canvas?: string;
	file?: string;
	notes?: string;
}

/** Where a lesson's claims come from: a public link or a file in the repo, never both. */
export interface Reference {
	citation: string;
	url?: string;
	path?: string;
	used_for: string;
}

export interface Lesson {
	title: string;
	description: string;
	summary?: string;
	duration_minutes: number;
	sections: Section[];
	learning_intentions: string[];
	success_criteria: string[];
	curriculum_links: CurriculumLink[];
	assessment?: { formative?: string; evidence?: string[] };
	differentiation?: Differentiation;
	resources?: Resource[];
	references?: Reference[];
	materials?: unknown;
	[key: string]: unknown;
}

export interface RegistryEntry {
	id: string;
	framework: string;
	phase: string;
	text: string;
	owned_by?: string;
	[key: string]: unknown;
}

export interface Unit {
	unit_title: string;
	description?: string;
	syllabus_registry?: RegistryEntry[];
	/** Outcome codes from the subject's `outcome.json`. */
	applicable_outcomes?: string[];
	lessons?: string[];
	[key: string]: unknown;
}

export interface OfferingUnit {
	unit: string;
	term?: string;
	lessons?: string[];
	duration_weeks?: number;
	notes?: string;
	[key: string]: unknown;
}

export interface Offering {
	id: string;
	year: number;
	year_group?: string;
	class_label?: string;
	/** The class's house colour in the editor; see house.ts. */
	colour?: string;
	mode?: string;
	subject: string;
	units: OfferingUnit[];
	/** The class's folder in cloud storage, an `https:` link. */
	folder?: string;
	[key: string]: unknown;
}
