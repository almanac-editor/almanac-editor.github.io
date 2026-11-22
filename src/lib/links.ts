import { resolve } from '$app/paths';

type Params = Record<string, string | null | undefined>;

function query(params: Params): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) search.set(key, value);
	}
	const text = search.toString();
	return text ? `?${text}` : '';
}

export const links = {
	home: () => resolve('/'),
	settings: () => resolve('/settings'),
	newClass: (from?: string | null) => resolve('/new-class') + query({ from }),
	unitEdit: (u: string, o?: string | null, t?: string | null) =>
		resolve('/unit-edit') + query({ u, o, t }),
	unitTasks: (u: string, o?: string | null, t?: string | null) =>
		resolve('/unit-tasks') + query({ u, o, t }),
	outcomes: (u: string, o?: string | null, t?: string | null) =>
		resolve('/outcomes') + query({ u, o, t }),
	newUnit: (s?: string | null) => resolve('/new-unit') + query({ s }),
	/** A class's editor; `u` and `t` name the unit page it was opened from, to go back to. */
	editClass: (o: string, u?: string | null, t?: string | null) =>
		resolve('/class-edit') + query({ o, u, t }),
	newLesson: (u: string, o?: string | null, t?: string | null) =>
		resolve('/new-lesson') + query({ u, o, t }),
	/** One of a class's assessment specs: `o` is the offering's path, `a` the spec's file stem. */
	assessment: (o: string, a: string) => resolve('/assessment') + query({ o, a }),
	/** A spec's notification as students get it, to save as a PDF. */
	notification: (o: string, a: string) => resolve('/notification') + query({ o, a }),
	/** Editing a spec and its notification together; without `a`, a new one for the class. */
	assessmentEdit: (o: string, a?: string | null) => resolve('/assessment-edit') + query({ o, a }),
	unit: (u: string, o?: string | null, t?: string | null) => resolve('/unit') + query({ u, o, t }),
	/** A unit's syllabus coverage, planned and, for a class, taught. */
	coverage: (u: string, o?: string | null, t?: string | null) =>
		resolve('/coverage') + query({ u, o, t }),
	/** A class's calendar; `m` (`YYYY-MM`) is the month it opens on. */
	calendar: (o: string, m?: string | null) => resolve('/calendar') + query({ o, m }),
	/** A year's school calendar: terms, periods and days off. */
	calendarEdit: (y: number | string, o?: string | null) =>
		resolve('/calendar-edit') + query({ y: String(y), o }),
	lesson: (u: string, l: string, o?: string | null, t?: string | null, edit = false) =>
		resolve('/lesson') + query({ u, l, o, t, edit: edit ? '1' : null })
};
