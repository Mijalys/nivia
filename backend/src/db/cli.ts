import { loadConfig, systemClock } from '../config';
import { Db } from './db';
import { copyDemoMedia, seed } from './seed';

async function run(cmd: string) {
  const cfg = loadConfig();
  const db = await Db.connect({ databaseUrl: cfg.databaseUrl, pgliteDir: cfg.pgliteDir });
  try {
    if (cmd === 'migrate' || cmd === 'seed') {
      const applied = await db.migrate();
      console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Sin migraciones pendientes');
    }
    if (cmd === 'seed') {
      console.log((await seed(db, systemClock)) ? 'Datos de demostración cargados' : 'La base ya tenía datos; no se cargó nada');
      copyDemoMedia(cfg.storageDir, process.env.DEMO_MEDIA_DIR || '../prototipo/media');
    }
  } finally {
    await db.close();
  }
}

const cmd = process.argv[2];
if (!['migrate', 'seed'].includes(cmd)) {
  console.error('Uso: node dist/db/cli.js migrate|seed');
  process.exit(1);
}
run(cmd).catch((e) => { console.error(e); process.exit(1); });
