import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, cp, readFile, writeFile, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {imageDimensions, validateManifest, verifyReferenceLibrary, referenceMarkdown, projectRoot} from '../scripts/reference-library.mjs';
import manifest from '../data/reference-photo-inventory.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import appearance from '../data/appearance-profiles.json' with {type: 'json'};

test('entire 96-file research folder is registered; only verified licenses are archived', async () => {
  validateManifest(manifest);
  assert.equal(manifest.photos.length, 96);
  assert.equal(manifest.photos.filter(p => p.archive).length, 3);
  assert.equal(manifest.photos.filter(p => p.licenseUrl).length, 5);
  assert.equal(manifest.photos.filter(p => p.provenanceStatus === 'unresolved').length, 15);
  const result = await verifyReferenceLibrary();
  assert.equal(result.verifiedLocal + result.optionalMissing, 96);
  assert.equal(result.verifiedArchive, 3);
  const registeredSites = new Set([...catalog.sites, ...appearance.sites].map(s => s.id));
  for (const p of manifest.photos) for (const id of p.referenceSites) assert.ok(registeredSites.has(id));
  for (const s of [...catalog.sites, ...appearance.sites]) {
    for (const i of s.images) {
      const p = manifest.photos.find(p => p.localPath === i.path.replaceAll('\\', '/'));
      assert.equal(p?.sha256, i.sha256);
      assert.ok(p.referenceSites.includes(s.id));
    }
  }
});

test('photo dimensions are encoded dimensions; EXIF derivative is separately identified', () => {
  const original = manifest.photos.find(p => p.id === 'chemistry-hall-front-commons');
  const review = manifest.photos.find(p => p.id === 'chemistry-hall-front-commons-review');
  assert.deepEqual([original.width, original.height], [4032, 3024]);
  assert.deepEqual([review.width, review.height], [1800, 2400]);
  assert.equal(review.derivativeOf, original.localPath);
  assert.equal(review.author, '葉又嘉');
  assert.equal(review.archive, null);
  assert.match(original.archive.changes, /Orientation=6/);
  assert.throws(() => imageDimensions(Buffer.from('not an image')));
});

test('manifest rejects malformed known records and unverified archive promotion', () => {
  for (const mutate of [
    m => { m.photos[0].sha256 = 'bad'; },
    m => { m.photos[0].localPath = '../outside.jpg'; },
    m => { m.photos[0].width = 0; },
    m => { m.photos.push({...m.photos[0]}); },
    m => { m.photos[0].provenanceStatus = 'guessed'; },
    m => { m.photos[0].optionalLocalCopy = false; },
    m => { m.photos.find(p => p.archive).archive.path = 'assets/public.jpg'; },
    m => { m.photos.find(p => p.archive).author = '未确认'; },
    m => { m.photos.find(p => p.archive).license = 'MIT'; },
  ]) {
    const invalid = structuredClone(manifest); mutate(invalid);
    assert.throws(() => validateManifest(invalid));
  }
});

async function archiveOnlyClone() {
  const root = await mkdtemp(join(tmpdir(), 'campus-reference-test-'));
  await mkdir(join(root, 'data'));
  for (const file of ['reference-photo-inventory.json', 'reference-archive-rights.json']) {
    await cp(join(projectRoot, 'data', file), join(root, 'data', file));
  }
  for (const p of manifest.photos.filter(p => p.archive)) {
    const dest = join(root, p.archive.path);
    await mkdir(dirname(dest), {recursive: true});
    await cp(join(projectRoot, p.archive.path), dest);
  }
  return root;
}

test('clean clone may lack research photos, never mandatory archive copies; corrupt bytes fail', async () => {
  const root = await archiveOnlyClone();
  try {
    const result = await verifyReferenceLibrary({root});
    assert.equal(result.verifiedLocal, 0);
    assert.equal(result.optionalMissing, 96);
    assert.equal(result.verifiedArchive, 3);
    await assert.rejects(verifyReferenceLibrary({root, requireLocal: true}), /ENOENT/);
    const archived = manifest.photos.find(p => p.archive);
    await writeFile(join(root, archived.archive.path), 'corrupt');
    await assert.rejects(verifyReferenceLibrary({root}), /SHA256 mismatch/);
    await rm(join(root, archived.archive.path));
    await assert.rejects(verifyReferenceLibrary({root}), /ENOENT/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('unregistered photos and accidental public reference copies are detected offline', async () => {
  const root = await archiveOnlyClone();
  try {
    await mkdir(join(root, 'references'));
    await writeFile(join(root, 'references/new-unreviewed.jpg'), 'unapproved');
    await assert.rejects(verifyReferenceLibrary({root}), /uninventoried photo/);
    await rm(join(root, 'references/new-unreviewed.jpg'));
    const published = join(root, 'output/pages');
    await mkdir(published, {recursive: true});
    const original = manifest.photos.find(p => p.archive);
    await cp(join(root, original.archive.path), join(published, 'renamed.jpg'));
    await assert.rejects(verifyReferenceLibrary({root, publishedDirectory: published}), /reference pixels in public build/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('Chinese documentation covers every local path and retains full attribution', async () => {
  const markdown = await readFile(new URL('../docs/REFERENCE-LIBRARY.md', import.meta.url), 'utf8');
  assert.equal(markdown, referenceMarkdown(manifest));
  for (const p of manifest.photos) {
    assert.ok(markdown.includes(p.localPath));
    assert.ok(markdown.includes(p.sha256));
    if (p.archive) {
      assert.ok(markdown.includes(p.author));
      assert.ok(markdown.includes(p.licenseUrl));
      assert.ok(markdown.includes(p.archive.changes));
    }
  }
});
