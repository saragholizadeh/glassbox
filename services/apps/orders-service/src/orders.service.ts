import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from './db.service';
import { ProductsService } from './products.service';

export interface OrderItemInput {
  productId: number;
  quantity?: number;
}

interface OrderRow {
  id: number;
  total_cents: number;
  created_at: Date;
}

interface ItemRow {
  order_id: number;
  product_id: number;
  quantity: number;
  price_cents: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbService,
    private readonly products: ProductsService,
  ) {}

  /** Saves a new order and its items. Returns the order id and the total. */
  async create(input: OrderItemInput[]) {
    const products = await this.products.getAll();

    const items = input.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new BadRequestException(`Unknown product ${item.productId}`);
      return {
        productId: product.id,
        quantity: item.quantity ?? 1,
        priceCents: product.price_cents,
      };
    });

    const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

    // A transaction: the order and its items are saved together, or not at all.
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{ id: number }>(
        'INSERT INTO orders (total_cents) VALUES ($1) RETURNING id',
        [totalCents],
      );
      const orderId = rows[0].id;

      // All items in one query. unnest() turns the arrays into rows.
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_cents)
         SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[])`,
        [
          orderId,
          items.map((i) => i.productId),
          items.map((i) => i.quantity),
          items.map((i) => i.priceCents),
        ],
      );

      await client.query('COMMIT');
      return { orderId, totalCents };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** The latest orders with their items. Always 2 queries, no matter how many orders. */
  async latest(limit: number) {
    const { rows: orders } = await this.db.pool.query<OrderRow>(
      'SELECT id, total_cents, created_at FROM orders ORDER BY id DESC LIMIT $1',
      [limit],
    );

    const { rows: items } = await this.db.pool.query<ItemRow>(
      'SELECT order_id, product_id, quantity, price_cents FROM order_items WHERE order_id = ANY($1)',
      [orders.map((o) => o.id)],
    );

    return orders.map((order) => ({
      ...order,
      items: items.filter((i) => i.order_id === order.id),
    }));
  }
}
