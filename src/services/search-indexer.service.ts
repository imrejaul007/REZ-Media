/**
 * Search Indexer - Event-Driven Product Indexing
 * REZ-Media - Real-time search updates
 */

import { embed } from '@rez/intelligence-embeddings';

const INDEX_PREFIX = 'search:index:';
const EVENT_PREFIX = 'search:event:';
const PROCESSOR_KEY = 'search:processor:';

/** Index product/event types */
const PRODUCT_EVENTS = ['product.created', 'product.updated', 'product.deleted'];

/**
 * Handle product indexing event
 */
export async function handleProductEvent(event: {
  type: string;
  productId: string;
  data: { name?: string; description?: string; category?: string; };
}): Promise<void> {
  if (!PRODUCT_EVENTS.includes(event.type)) return;

  switch (event.type) {
    case 'product.created':
    case 'product.updated':
      await indexProduct(event.productId, event.data);
      break;
    case 'product.deleted':
      await deleteProduct(event.productId);
      break;
  }
}

/**
 * Index product for search
 */
async function indexProduct(id: string, data: Record<string, string>): Promise<void> {
  const text = [data.name, data.description, data.category].filter(Boolean).join(' ');
  const embedding = await embed(text);

  await redis.set(`${INDEX_PREFIX}product:${id}`, JSON.stringify({
    id,
    text,
    embedding,
    data,
    indexedAt: Date.now(),
  }));

  await redis.zadd('search:products', Date.now(), id);
}

/**
 * Delete product from index
 */
async function deleteProduct(id: string): Promise<void> {
  await redis.del(`${INDEX_PREFIX}product:${id}`);
  await redis.zrem('search:products', id);
}

/**
 * Search indexed products
 */
export async function searchProducts(query: string, limit = 20): Promise<string[]> {
  const queryEmbedding = await embed(query);
  const productIds = await redis.zrange('search:products', 0, -1);

  const scored: Array<{ id: string; score: number }> = [];

  for (const id of productIds.slice(0, 100)) {
    const stored = await redis.get(`${INDEX_PREFIX}product:${id}`);
    if (!stored) continue;

    const { embedding } = JSON.parse(stored);
    const score = cosine(queryEmbedding, embedding);
    scored.push({ id, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.id);
}
