import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DbService } from './db.service';

export interface Product {
  id: number;
  name: string;
  price_cents: number;
}

const CACHE_KEY = 'products';
const CACHE_SECONDS = 60;

/**
 * Reads products. Uses Redis as a cache in front of Postgres:
 * look in Redis first, and only ask Postgres if Redis doesn't have it.
 */
@Injectable()
export class ProductsService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  constructor(private readonly db: DbService) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async getAll(): Promise<Product[]> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as Product[];

    const { rows } = await this.db.pool.query<Product>(
      'SELECT id, name, price_cents FROM products ORDER BY id',
    );

    // Keep it for 60 seconds. After that, Redis deletes it and we read Postgres again.
    await this.redis.set(CACHE_KEY, JSON.stringify(rows), 'EX', CACHE_SECONDS);
    return rows;
  }
}
