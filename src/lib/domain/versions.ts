/**
 * A lesson's history: each distinct plan any class was taught, from the
 * `plan` snapshots in every class's delivery records, and the plan as it
 * stands. Classes taught the same plan share a version, so the list reads as
 * the plan's own versions, oldest first, whichever class is being looked at.
 */

import type { DeliveryRecord } from './deliveries.ts';
import { planChanged } from './planDiff.ts';
import type { Lesson } from './types.ts';

/** One class's delivery of a version. */
export interface Taught {
	/** The offering file, or null for an unattributed record. */
	offeringPath: string | null;
	/** The date the lesson ran, or null where it was never recorded. */
	taught: string | null;
	/** Who taught it, where recorded. */
	by: string | null;
	/** What changed on the day: what was skipped, cut short or added. */
	deviations: string | null;
}

export interface Version {
	plan: Lesson;
	/** Who had this version, oldest first. Empty for a current plan no class has had yet. */
	taught: Taught[];
	/** Whether this is the plan as it stands. */
	current: boolean;
}

/**
 * The lesson's versions, oldest first by the first time each was taught.
 * Undated deliveries count as older than any dated one. The current plan is
 * marked on the version it matches, or added last when no class has had it.
 */
export function lessonVersions(
	records: { offeringPath: string | null; record: DeliveryRecord }[],
	current: Lesson
): Version[] {
	const entries = records.flatMap(({ offeringPath, record }) =>
		record.deliveries.flatMap((d) =>
			d.plan
				? [
						{
							plan: d.plan,
							offeringPath,
							taught: d.taught ?? null,
							by: d.by ?? null,
							deviations: d.deviations?.trim() || null
						}
					]
				: []
		)
	);
	// A stable sort keeps record order among undated entries and equal dates.
	entries.sort((a, b) => (a.taught ?? '').localeCompare(b.taught ?? ''));
	const versions: Version[] = [];
	for (const { plan, ...taught } of entries) {
		const same = versions.find((v) => !planChanged(v.plan, plan));
		if (same) same.taught.push(taught);
		else versions.push({ plan, taught: [taught], current: false });
	}
	const now = versions.find((v) => !planChanged(v.plan, current));
	if (now) {
		now.current = true;
		// The current file, not a snapshot, so it carries what snapshots leave out.
		now.plan = current;
	} else {
		versions.push({ plan: current, taught: [], current: true });
	}
	return versions;
}

/**
 * The version one class had: the one holding that class's latest delivery
 * with a plan. -1 when the class has none recorded.
 */
export function versionOf(versions: Version[], offeringPath: string): number {
	let found = -1;
	let latest = '';
	versions.forEach((v, i) => {
		for (const t of v.taught) {
			if (t.offeringPath !== offeringPath) continue;
			const date = t.taught ?? '';
			if (found === -1 || date >= latest) {
				found = i;
				latest = date;
			}
		}
	});
	return found;
}
