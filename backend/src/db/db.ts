import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';
import { Pool, PoolClient } from 'pg';
import { MIGRATIONS } from './migrations';

/** Lo mínimo que usan los módulos: una consulta con parámetros. */
export interface Q {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface Driver {
  /** Corre fn dentro de una transacción. */
  transaction<T>(fn: (q: Q, exec: (sql: string) => Promise<void>) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PgDriver implements Driver {
  constructor(private pool: Pool) {}
  async transaction<T>(fn: (q: Q, exec: (sql: string) => Promise<void>) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('begin');
      const out = await fn(client as unknown as Q, async (sql) => { await client.query(sql); });
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  close() { return this.pool.end(); }
}

class PgliteDriver implements Driver {
  constructor(private pg: PGlite) {}
  transaction<T>(fn: (q: Q, exec: (sql: string) => Promise<void>) => Promise<T>): Promise<T> {
    // PGlite es una sola conexión: transaction() ya serializa las transacciones concurrentes.
    return this.pg.transaction(async (tx) => fn(tx as unknown as Q, async (sql) => { await tx.exec(sql); }));
  }
  close() { return this.pg.close(); }
}

export class Db {
  private constructor(private driver: Driver) {}

  /**
   * DATABASE_URL=postgres://… usa PostgreSQL real.
   * Si no, usa PGlite (PostgreSQL embebido): en disco con PGLITE_DIR, o en memoria con "memory://".
   */
  static async connect(opts: { databaseUrl?: string; pgliteDir?: string } = {}): Promise<Db> {
    if (opts.databaseUrl) return new Db(new PgDriver(new Pool({ connectionString: opts.databaseUrl, max: 10 })));
    const dir = opts.pgliteDir || 'memory://';
    if (!dir.startsWith('memory://')) mkdirSync(dir, { recursive: true });
    const pg = await PGlite.create(dir);
    return new Db(new PgliteDriver(pg));
  }

  /** Transacción con el rol de la app y el cliente fijado: RLS solo deja ver filas de ese cliente. */
  tenant<T>(tenantId: string, fn: (q: Q) => Promise<T>): Promise<T> {
    return this.driver.transaction(async (q) => {
      await q.query('set local role nivia_app');
      await q.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      return fn(q);
    });
  }

  /** Transacción sin cliente: solo lectura de la tabla tenant (pública para la app). */
  anon<T>(fn: (q: Q) => Promise<T>): Promise<T> {
    return this.driver.transaction(async (q) => {
      await q.query('set local role nivia_app');
      return fn(q);
    });
  }

  /** Transacción como dueño de la base: migraciones, semillas y tareas que cruzan clientes. */
  system<T>(fn: (q: Q, exec: (sql: string) => Promise<void>) => Promise<T>): Promise<T> {
    return this.driver.transaction(fn);
  }

  async migrate(): Promise<string[]> {
    return this.system(async (q, exec) => {
      await exec('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())');
      const done = new Set((await q.query<{ id: string }>('select id from schema_migrations')).rows.map((r) => r.id));
      const applied: string[] = [];
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await exec(m.sql);
        await q.query('insert into schema_migrations (id) values ($1)', [m.id]);
        applied.push(m.id);
      }
      return applied;
    });
  }

  close() { return this.driver.close(); }
}
