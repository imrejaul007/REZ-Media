import { z } from 'zod';

// Types
export interface SemanticSearchResult {
  productId: string;
  score: number;
  matchedTerms: string[];
  embedding?: number[];
}

export interface SemanticSearchOptions {
  limit?: number;
  threshold?: number;
  includeEmbeddings?: boolean;
  filters?: ProductFilters;
}

export interface ProductFilters {
  category?: string;
  priceRange?: { min: number; max: number };
  tags?: string[];
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  tags: string[];
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

// Zod schemas for validation
export const SemanticSearchOptionsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  threshold: z.number().min(0).max(1).default(0.5),
  includeEmbeddings: z.boolean().default(false),
  filters: z.object({
    category: z.string().optional(),
    priceRange: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
    }).optional(),
    tags: z.array(z.string()).optional(),
    inStock: z.boolean().optional(),
  }).optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  price: z.number().min(0),
  tags: z.array(z.string()),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * SemanticSearchEngine - Handles semantic search using vector embeddings
 *
 * Architecture:
 * - Uses cosine similarity for semantic matching
 * - Supports text-to-text and text-to-product matching
 * - Integrates with AgentDB for vector storage (optional)
 */
export class SemanticSearchEngine {
  private embeddingDimension: number;
  private products: Map<string, Product>;
  private similarityCache: Map<string, number>;

  constructor(embeddingDimension: number = 1536) {
    this.embeddingDimension = embeddingDimension;
    this.products = new Map();
    this.similarityCache = new Map();
  }

  /**
   * Index a product for semantic search
   */
  async indexProduct(product: Product): Promise<void> {
    const validated = ProductSchema.parse(product);

    if (!validated.embedding && validated.description) {
      validated.embedding = await this.generateEmbedding(
        `${validated.name} ${validated.description} ${validated.tags.join(' ')}`
      );
    }

    this.products.set(validated.id, validated);
    this.similarityCache.clear(); // Invalidate cache on index
  }

  /**
   * Index multiple products in batch
   */
  async indexProducts(products: Product[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        await this.indexProduct(product);
        success++;
      } catch (error) {
        console.error(`Failed to index product ${product.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Generate embedding for text (placeholder - integrate with OpenAI/AgentDB)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder: In production, call OpenAI embeddings API or AgentDB
    // This generates a deterministic pseudo-embedding for demonstration
    const hash = this.simpleHash(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.embeddingDimension; i++) {
      const seed = hash + i;
      embedding.push(this.seededRandom(seed));
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Search for products using semantic query
   */
  async search(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    const opts = SemanticSearchOptionsSchema.parse(options);
    const queryEmbedding = await this.generateEmbedding(query);

    const results: SemanticSearchResult[] = [];

    for (const [productId, product] of this.products) {
      // Apply filters
      if (opts.filters && !this.passesFilters(product, opts.filters)) {
        continue;
      }

      if (!product.embedding) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, product.embedding);

      if (score >= opts.threshold) {
        results.push({
          productId,
          score,
          matchedTerms: this.extractMatchedTerms(query, product),
          embedding: opts.includeEmbeddings ? product.embedding : undefined,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, opts.limit);
  }

  /**
   * Find similar products using a seed product
   */
  async findSimilar(
    productId: string,
    options: Partial<SemanticSearchOptions> = {}
  ): Promise<SemanticSearchResult[]> {
    const product = this.products.get(productId);
    if (!product || !product.embedding) {
      throw new Error(`Product ${productId} not found or has no embedding`);
    }

    const opts = SemanticSearchOptionsSchema.parse({ ...options, limit: options.limit ?? 10 });
    const results: SemanticSearchResult[] = [];

    for (const [pid, p] of this.products) {
      if (pid === productId || !p.embedding) continue;

      const cacheKey = `${productId}:${pid}`;
      let score = this.similarityCache.get(cacheKey);

      if (score === undefined) {
        score = this.cosineSimilarity(product.embedding, p.embedding);
        this.similarityCache.set(cacheKey, score);
      }

      if (score >= (opts.threshold ?? 0.5)) {
        results.push({
          productId: pid,
          score,
          matchedTerms: [],
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Check if product passes filters
   */
  private passesFilters(product: Product, filters: NonNullable<SemanticSearchOptions['filters']>): boolean {
    if (filters.category && product.category !== filters.category) {
      return false;
    }

    if (filters.priceRange) {
      if (product.price < filters.priceRange.min || product.price > filters.priceRange.max) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag =>
        product.tags.some(pt => pt.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasMatchingTag) return false;
    }

    if (filters.inStock !== undefined) {
      const inStock = product.metadata?.inStock as boolean ?? true;
      if (filters.inStock !== inStock) return false;
    }

    return true;
  }

  /**
   * Extract terms from query that match the product
   */
  private extractMatchedTerms(query: string, product: Product): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const matchedTerms: string[] = [];

    const searchableText = `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase();

    for (const term of queryTerms) {
      if (searchableText.includes(term) && term.length > 2) {
        matchedTerms.push(term);
      }
    }

    return matchedTerms;
  }

  /**
   * Simple hash function for deterministic embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Seeded random for deterministic pseudo-embeddings
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Remove a product from the index
   */
  removeProduct(productId: string): boolean {
    const deleted = this.products.delete(productId);
    if (deleted) {
      this.similarityCache.clear();
    }
    return deleted;
  }

  /**
   * Get product count
   */
  getProductCount(): number {
    return this.products.size;
  }

  /**
   * Clear all indexed products
   */
  clear(): void {
    this.products.clear();
    this.similarityCache.clear();
  }
}

// Factory function for quick instantiation
export function createSemanticSearchEngine(embeddingDimension?: number): SemanticSearchEngine {
  return new SemanticSearchEngine(embeddingDimension);
}
