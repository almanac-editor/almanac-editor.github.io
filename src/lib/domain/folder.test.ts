import { describe, expect, it } from 'vitest';
import { FolderStore, type FolderFile, type FolderHandle } from './folder.ts';
import { ConflictError, NotFoundError, PartlySavedError } from './repo.ts';

type Tree = { [name: string]: string | Tree };

/** An in-memory folder shaped like the File System Access API. */
function folder(name: string, tree: Tree): FolderHandle {
	const notFound = () => Object.assign(new Error('missing'), { name: 'NotFoundError' });
	const file = (key: string): FolderFile => ({
		kind: 'file',
		name: key,
		getFile: async () => ({ text: async () => tree[key] as string }),
		createWritable: async () => {
			let next = '';
			return {
				write: async (data: string) => void (next += data),
				close: async () => void (tree[key] = next)
			};
		}
	});
	return {
		kind: 'directory',
		name,
		getDirectoryHandle: async (key, options) => {
			if (typeof tree[key] !== 'object') {
				if (!options?.create) throw notFound();
				tree[key] = {};
			}
			return folder(key, tree[key] as Tree);
		},
		getFileHandle: async (key, options) => {
			if (typeof tree[key] !== 'string') {
				if (!options?.create) throw notFound();
				tree[key] = '';
			}
			return file(key);
		},
		async *values() {
			for (const [key, value] of Object.entries(tree)) {
				yield typeof value === 'string' ? file(key) : folder(key, value);
			}
		}
	};
}

const plans = (): Tree => ({
	'.git': { HEAD: 'ref: refs/heads/main\n' },
	decks: { 'big.pptx': 'binary' },
	subjects: {
		sorting: {
			'unit.json': '{\n  "unit_title": "Sorting"\n}\n',
			lessons: { '01_socks.json': '{\n  "title": "Socks"\n}\n' }
		}
	},
	offerings: { 'y7.json': '{\n  "id": "y7"\n}\n' },
	calendar: { '2027.json': '{\n  "year": 2027\n}\n' }
});

describe('FolderStore', () => {
	it('lists only the folders the app reads, skipping hidden ones', async () => {
		const store = new FolderStore(folder('almanac', plans()));
		expect([...(await store.paths()).keys()].sort()).toEqual([
			'calendar/2027.json',
			'offerings/y7.json',
			'subjects/sorting/lessons/01_socks.json',
			'subjects/sorting/unit.json'
		]);
	});

	it('writes in the house format and hands back a new version', async () => {
		const tree = plans();
		const store = new FolderStore(folder('almanac', tree));
		const { doc, sha } = await store.readJson<{ title: string }>(
			'subjects/sorting/lessons/01_socks.json'
		);
		const next = await store.writeJson(
			'subjects/sorting/lessons/01_socks.json',
			{ ...doc, title: 'Odd socks — sorted' },
			sha
		);
		const lessons = (tree.subjects as Tree).sorting as Tree;
		expect((lessons.lessons as Tree)['01_socks.json']).toBe(
			'{\n  "title": "Odd socks — sorted"\n}\n'
		);
		expect(next).not.toBe(sha);
		expect((await store.readText('subjects/sorting/lessons/01_socks.json')).sha).toBe(next);
	});

	it('refuses to save over a file changed on disk', async () => {
		const tree = plans();
		const store = new FolderStore(folder('almanac', tree));
		const { doc, sha } = await store.readJson<object>('offerings/y7.json');
		(tree.offerings as Tree)['y7.json'] = '{\n  "id": "y7",\n  "year": 2026\n}\n';
		await expect(store.writeJson('offerings/y7.json', doc, sha)).rejects.toBeInstanceOf(
			ConflictError
		);
	});

	it('creates a new file, and never over an existing one', async () => {
		const tree = plans();
		const store = new FolderStore(folder('almanac', tree));
		await store.createJson('offerings/y8.json', { id: 'y8' });
		expect((tree.offerings as Tree)['y8.json']).toBe('{\n  "id": "y8"\n}\n');
		expect(await store.has('offerings/y8.json')).toBe(true);
		await expect(store.createJson('offerings/y7.json', { id: 'y7' })).rejects.toBeInstanceOf(
			ConflictError
		);
	});

	it('says which file is missing', async () => {
		const store = new FolderStore(folder('almanac', plans()));
		await expect(store.readText('subjects/nope/unit.json')).rejects.toBeInstanceOf(NotFoundError);
	});
	it('writes JSON and text together, and reads a file outside the folders it lists', async () => {
		const tree: Tree = { ...plans(), year9: { 'note.md': '# Old\n' } };
		const store = new FolderStore(folder('almanac', tree));
		const note = await store.readText('year9/note.md');
		const spec = await store.readJson<object>('offerings/y7.json');
		await store.writeMany([
			{ path: 'offerings/y7.json', doc: { id: 'y7', year: 2026 }, sha: spec.sha },
			{ path: 'year9/note.md', text: '# New\n', sha: note.sha },
			{ path: 'offerings/y7/assessments/final.md', text: '# Final\n', sha: null }
		]);
		expect((tree.year9 as Tree)['note.md']).toBe('# New\n');
		expect(((tree.offerings as Tree).y7 as Tree).assessments).toEqual({ 'final.md': '# Final\n' });
		expect(await store.has('offerings/y7/assessments/final.md')).toBe(true);
	});

	it('writes nothing when one of several files changed', async () => {
		const tree = plans();
		const store = new FolderStore(folder('almanac', tree));
		const spec = await store.readJson<object>('offerings/y7.json');
		await expect(
			store.writeMany([
				{ path: 'offerings/y7.json', doc: { id: 'y7', year: 2026 }, sha: spec.sha },
				{ path: 'calendar/2027.json', text: '{}\n', sha: 'stale' }
			])
		).rejects.toBeInstanceOf(ConflictError);
		expect((tree.offerings as Tree)['y7.json']).toBe('{\n  "id": "y7"\n}\n');
	});

	it('says which file was saved when a later write fails', async () => {
		const tree = plans();
		const root = folder('almanac', tree);
		const store = new FolderStore(root);
		const spec = await store.readJson<object>('offerings/y7.json');
		const calendar = await store.readText('calendar/2027.json');
		const getDirectoryHandle = root.getDirectoryHandle;
		let reads = 0;
		root.getDirectoryHandle = async (name, options) => {
			// The checks pass; the second write finds its folder gone.
			if (name === 'calendar' && ++reads > 1) throw new Error('The disk is full.');
			return getDirectoryHandle(name, options);
		};
		const saving = store.writeMany([
			{ path: 'offerings/y7.json', doc: { id: 'y7', year: 2026 }, sha: spec.sha },
			{ path: 'calendar/2027.json', text: '{}\n', sha: calendar.sha }
		]);
		await expect(saving).rejects.toBeInstanceOf(PartlySavedError);
		await expect(saving).rejects.toThrow(
			'offerings/y7.json was saved, but calendar/2027.json was not: The disk is full.'
		);
	});
});
