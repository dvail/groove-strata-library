import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TRACKS_DIR = path.join(ROOT, 'tracks');

const toPosix = (p) => p.split(path.sep).join('/');

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
};

const safeString = (value, fallback = null) => (typeof value === 'string' && value.trim() ? value : fallback);

const main = async () => {
  const files = await walk(TRACKS_DIR);
  const tracks = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    const relPath = toPosix(path.relative(ROOT, file));
    const artist = safeString(data.artist, 'Unknown');
    const title = safeString(data.title, path.basename(file, '.json'));
    const id = safeString(data.id, `${artist}::${title}`.toLowerCase().replace(/\s+/g, '-'));

    tracks.push({
      id,
      title,
      artist,
      tonic: data.tonic ?? null,
      tonicMidi: data.tonicMidi ?? null,
      mode: data.mode ?? null,
      tempoBpm: data.tempoBpm ?? null,
      lengthBars: data.length?.bars ?? null,
      path: relPath,
    });
  }

  tracks.sort((a, b) => {
    if (a.artist !== b.artist) return a.artist.localeCompare(b.artist);
    return a.title.localeCompare(b.title);
  });

  const index = {
    generatedAt: new Date().toISOString(),
    trackCount: tracks.length,
    tracks,
  };

  await fs.writeFile(path.join(ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Indexed ${tracks.length} tracks.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
