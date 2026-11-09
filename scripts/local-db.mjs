import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Adaptador local da interface D1 usada pelo mesmo backend da hospedagem.
export function openLocalDatabase(filename, migrationsDirectory) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if (filename !== ':memory:') sqlite.exec('PRAGMA journal_mode=WAL;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _local_schema_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
  try {
    for (const name of fs.readdirSync(migrationsDirectory).filter(name => name.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, name), 'utf8');
      const hash = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const applied = sqlite.prepare('SELECT hash FROM _local_schema_migrations WHERE name=?').get(name);
      if (applied) {
        if (applied.hash !== hash) throw new Error(`A migração ${name} já foi aplicada com outro conteúdo. Preserve o banco e crie uma nova migração.`);
        continue;
      }
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        sqlite.exec(sql);
        sqlite.prepare('INSERT INTO _local_schema_migrations(name,hash) VALUES (?,?)').run(name, hash);
        sqlite.exec('COMMIT');
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  } catch (error) { sqlite.close(); throw error; }

  function prepare(sql, values = []) {
    return {
      sql, values,
      bind(...args) { return prepare(sql, args); },
      async first(column) { const row = sqlite.prepare(sql).get(...values); return row ? (column ? row[column] : { ...row }) : null; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...values).map(row => ({ ...row })) }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; }
    };
  }
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => {
          const prepared = sqlite.prepare(statement.sql);
          if (/^\s*(SELECT|WITH)\b/i.test(statement.sql)) return { success: true, results: prepared.all(...statement.values).map(row => ({ ...row })) };
          const result = prepared.run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); }
  };
}
