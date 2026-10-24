/**
 * Lesson files in a folder on this computer, through the browser's File
 * System Access API (Chrome and Edge). A save writes the file and nothing
 * else: if the folder is a git clone, committing is the teacher's business.
 *
 * Only `subjects/`, `offerings/` and `schemas/` are listed, so a folder that
 * also holds decks, scripts or a `.git` directory is not walked in full. A
 * file's version id is a hash of its text, taken when it is read; a write
 * hashes the file again first and refuses if someone changed it meanwhile.
 *
 * The handle types below are the parts of the API this module uses, so tests
 * can pass an in-memory folder.
 */

import { dump } from './format.ts';
import { ConflictError, NotFoundError, type Loaded } from './repo.ts';
import type { Store, Write } from './store.ts';

export interface FolderFile {
	kind: 'file';
	name: string;
	getFile(): Promise<{ text(): Promise<string> }>;
	createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

export interface FolderHandle {
	kind: 'directory';
	name: string;
	getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderHandle>;
	getFileHandle(name: string, options?: { create?: boolean }): Promise<FolderFile>;
	values(): AsyncIterable<FolderHandle | FolderFile>;
}

/** The folders the app reads; everything else in the folder is left alone. */
export const ROOTS = ['subjects', 'offerings', 'schemas'];

export async function digest(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function missing(error: unknown): boolean {
	return (error as DOMException)?.name === 'NotFoundError' || error instanceof TypeError;
}

export class FolderStore implements Store {
	private tree: Map<string, string> | null = null;

	constructor(readonly root: FolderHandle) {}

	async paths(): Promise<Map<string, string>> {
		if (this.tree) return this.tree;
		const found = new Map<string, string>();
		for (const name of ROOTS) {
			let dir: FolderHandle;
			try {
				dir = await this.root.getDirectoryHandle(name);
			} catch (error) {
				if (missing(error)) continue;
				throw error;
			}
			await walk(dir, name, found);
		}
		this.tree = found;
		return found;
	}

	refresh(): void {
		this.tree = null;
	}

	async has(path: string): Promise<boolean> {
		return (await this.paths()).has(path);
	}

	private async file(path: string): Promise<FolderFile> {
		const parts = path.split('/');
		const name = parts.pop() ?? '';
		try {
			let dir = this.root;
			for (const part of parts) dir = await dir.getDirectoryHandle(part);
			return await dir.getFileHandle(name);
		} catch (error) {
			if (missing(error)) throw new NotFoundError(`${path} is not in ${this.root.name}.`);
			throw error;
		}
	}

	async readText(path: string): Promise<Loaded<string>> {
		const text = await (await (await this.file(path)).getFile()).text();
		return { doc: text, sha: await digest(text) };
	}

	async readJson<T>(path: string): Promise<Loaded<T>> {
		const { doc, sha } = await this.readText(path);
		return { doc: JSON.parse(doc) as T, sha };
	}

	async writeJson(path: string, doc: unknown, sha: string): Promise<string> {
		const handle = await this.file(path);
		const current = await (await handle.getFile()).text();
		if ((await digest(current)) !== sha) {
			throw new ConflictError(`${path} changed on disk since it was opened.`);
		}
		return this.write(handle, doc);
	}

	/** A folder has no commits: every file is checked, then each is written in turn. */
	async writeMany(files: Write[]): Promise<void> {
		for (const file of files) {
			if (file.sha === null) {
				if (await this.has(file.path)) throw new ConflictError(`${file.path} already exists.`);
				continue;
			}
			const current = await (await (await this.file(file.path)).getFile()).text();
			if ((await digest(current)) !== file.sha) {
				throw new ConflictError(`${file.path} changed on disk since it was opened.`);
			}
		}
		for (const file of files) {
			if (file.sha === null) await this.createJson(file.path, file.doc);
			else await this.writeJson(file.path, file.doc, file.sha);
		}
	}

	async createJson(path: string, doc: unknown): Promise<string> {
		try {
			await this.file(path);
			throw new ConflictError(`${path} already exists.`);
		} catch (error) {
			if (!(error instanceof NotFoundError)) throw error;
		}
		const parts = path.split('/');
		const name = parts.pop() ?? '';
		let dir = this.root;
		for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
		const sha = await this.write(await dir.getFileHandle(name, { create: true }), doc);
		this.tree?.set(path, '');
		return sha;
	}

	/** A folder is never read through git, even when it is a clone. */
	async head(): Promise<null> {
		return null;
	}

	private async write(handle: FolderFile, doc: unknown): Promise<string> {
		const text = dump(doc);
		const writer = await handle.createWritable();
		await writer.write(text);
		await writer.close();
		return digest(text);
	}
}

async function walk(dir: FolderHandle, prefix: string, found: Map<string, string>) {
	for await (const entry of dir.values()) {
		if (entry.name.startsWith('.')) continue;
		const path = `${prefix}/${entry.name}`;
		if (entry.kind === 'file') found.set(path, '');
		else await walk(entry, path, found);
	}
}
