import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * The connection to Postgres (database "orders").
 *
 * A Pool keeps a few connections open and reuses them. Opening a new
 * connection for every query would be slow.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  pool!: Pool;

  async onModuleInit() {
    const url = process.env.DATABASE_URL ?? 'postgres://glassbox:glassbox@localhost:5432';
    this.pool = new Pool({ connectionString: `${url}/orders`, max: 10 });

    await this.createTables();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Creates the tables if they don't exist, and adds 20 products. */
  private async createTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          int PRIMARY KEY,
        name        text NOT NULL,
        price_cents int NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id          serial PRIMARY KEY,
        total_cents int NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        order_id    int NOT NULL REFERENCES orders(id),
        product_id  int NOT NULL REFERENCES products(id),
        quantity    int NOT NULL,
        price_cents int NOT NULL
      );

      CREATE INDEX IF NOT EXISTS order_items_order_id ON order_items(order_id);

      INSERT INTO products (id, name, price_cents)
      SELECT i, 'Product ' || i, 500 + i * 100
      FROM generate_series(1, 20) AS i
      ON CONFLICT (id) DO NOTHING;
    `);
  }
}
