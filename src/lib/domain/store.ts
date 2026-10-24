/**
 * Where the lesson files live, as the rest of the app sees it. Two kinds
 * exist: `Repo` (a GitHub repo, through the API, where each save is a commit)
 * and `FolderStore` (a folder on this computer, through the browser's File
 * System Access API, where a save just writes the file). The pages never
 * know which one they have.
 *
 * `sha` is whatever the store uses to recognise the version it handed out:
 * the blob sha for GitHub, a hash of the text for a folder. A write passes it
 * back, and the store refuses with `ConflictError` if the file has changed
 * since.
 */

import type { Loaded } from './repo.ts';

/** One file in a `writeMany`. */
export interface Write {
	path: string;
	doc: unknown;
	/** The version the app loaded, or null for a file that must not exist yet. */
	sha: string | null;
}

export interface Store {
	/** Every file path the app may read, mapped to a version id (may be empty). */
	paths(): Promise<Map<string, string>>;
	/** Forget the listing so the next read sees files changed elsewhere. */
	refresh(): void;
	has(path: string): Promise<boolean>;
	readText(path: string): Promise<Loaded<string>>;
	readJson<T>(path: string): Promise<Loaded<T>>;
	/** Writes `doc` in the house format; returns the new version id. */
	writeJson(path: string, doc: unknown, sha: string, message: string): Promise<string>;
	/** Writes a new file; refuses with ConflictError if one is already there. */
	createJson(path: string, doc: unknown, message: string): Promise<string>;
	/**
	 * Writes several files together. Every file is checked first, and
	 * ConflictError means none was written. On GitHub they are one commit; in
	 * a folder, which has no commits, they are written one after another.
	 */
	writeMany(files: Write[], message: string): Promise<void>;
	/** The commit the files are at, where they are in git through the store; else null. */
	head(): Promise<string | null>;
}
