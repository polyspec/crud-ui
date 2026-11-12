/**
 * LRU Cache for Parsed Condition Expressions
 *
 * Provides efficient caching of parsed AST nodes with:
 * - LRU (Least Recently Used) eviction policy
 * - Configurable maximum cache size
 * - Cache hit rate statistics
 */

import { ASTNode, CachedCondition } from '../types';

/**
 * Cache statistics interface
 */
export interface CacheStats {
  /** Number of lookups served from the cache. */
  hits: number;
  /** Number of lookups that missed and required parsing. */
  misses: number;
  /** Hit ratio in the range 0..1 (`hits / (hits + misses)`); 0 when there were no lookups. */
  hitRate: number;
}

/**
 * LRU Cache node for doubly-linked list
 */
interface CacheNode {
  key: string;
  value: ASTNode;
  prev: CacheNode | null;
  next: CacheNode | null;
}

/**
 * LRU Cache implementation for condition expressions
 *
 * Uses a combination of a Map for O(1) lookups and a doubly-linked list
 * for O(1) LRU eviction.
 */
export class ConditionCache {
  private readonly maxSize: number;
  private cache: Map<string, CacheNode>;
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;

  // Statistics
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Create a new ConditionCache
   * @param maxSize Maximum number of entries to cache (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    if (maxSize < 1) {
      throw new Error('Cache maxSize must be at least 1');
    }
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get a cached AST for the given expression
   * @param expression The condition expression string
   * @returns The cached AST node, or null if not found
   */
  get(expression: string): ASTNode | null {
    const node = this.cache.get(expression);

    if (node) {
      this.hits++;
      // Move to front (most recently used)
      this.moveToFront(node);
      return node.value;
    }

    this.misses++;
    return null;
  }

  /**
   * Cache an AST for the given expression
   * @param expression The condition expression string
   * @param ast The parsed AST node
   */
  set(expression: string, ast: ASTNode): void {
    // Check if already exists
    const existingNode = this.cache.get(expression);

    if (existingNode) {
      // Update value and move to front
      existingNode.value = ast;
      this.moveToFront(existingNode);
      return;
    }

    // Create new node
    const newNode: CacheNode = {
      key: expression,
      value: ast,
      prev: null,
      next: this.head,
    };

    // Add to front of list
    if (this.head) {
      this.head.prev = newNode;
    }
    this.head = newNode;

    if (!this.tail) {
      this.tail = newNode;
    }

    // Add to map
    this.cache.set(expression, newNode);

    // Evict if over capacity
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Check if the cache contains an entry for the given expression
   * @param expression The condition expression string
   * @returns true if cached, false otherwise
   */
  has(expression: string): boolean {
    return this.cache.has(expression);
  }

  /**
   * Clear all cached entries and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns Object containing hits, misses, and hit rate
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  /**
   * Get the current number of cached entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get the maximum cache size
   */
  get capacity(): number {
    return this.maxSize;
  }

  /**
   * Get all cached conditions (for debugging/inspection)
   * @returns Array of cached condition entries
   */
  getEntries(): CachedCondition[] {
    const entries: CachedCondition[] = [];
    let current = this.head;

    while (current) {
      entries.push({
        expression: current.key,
        ast: current.value,
      });
      current = current.next;
    }

    return entries;
  }

  /**
   * Move a node to the front of the list (most recently used)
   */
  private moveToFront(node: CacheNode): void {
    if (node === this.head) {
      return; // Already at front
    }

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }

    // Update tail if necessary
    if (node === this.tail) {
      this.tail = node.prev;
    }

    // Move to front
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
  }

  /**
   * Evict the least recently used entry (tail of the list)
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const evicted = this.tail;

    // Remove from map
    this.cache.delete(evicted.key);

    // Update tail
    this.tail = evicted.prev;

    if (this.tail) {
      this.tail.next = null;
    } else {
      // List is now empty
      this.head = null;
    }
  }
}

/**
 * Default global cache instance
 */
let defaultCache: ConditionCache | null = null;

/**
 * Get the default global cache instance
 * @param maxSize Maximum cache size (only used on first call)
 * @returns The default ConditionCache instance
 */
export function getDefaultCache(maxSize: number = 1000): ConditionCache {
  if (!defaultCache) {
    defaultCache = new ConditionCache(maxSize);
  }
  return defaultCache;
}
