/** Algo capaz de ejecutar consultas parametrizadas ($1, $2...). */
export interface Queryable {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Conexión con soporte de transacciones. */
export interface Db extends Queryable {
  /** Ejecuta `fn` dentro de una transacción (COMMIT o ROLLBACK automático). */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /** Libera la conexión. */
  close(): Promise<void>;
}

/**
 * Conexión a PostgreSQL en Neon mediante WebSockets (`Pool`), que permite
 * transacciones interactivas desde funciones serverless.
 * El pool se crea por invocación y se cierra al terminar.
 */
export async function createNeonDb(connectionString: string): Promise<Db> {
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString });
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async query<R>(text: string, params: unknown[] = []): Promise<R[]> {
            return (await client.query(text, params)).rows as R[];
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
