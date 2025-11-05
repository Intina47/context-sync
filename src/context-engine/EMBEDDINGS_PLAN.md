# Embeddings — Current state and roadmap

This document describes the current persistent storage state for extracted contexts, how embeddings are currently used in the codebase, and a recommended, phased plan to add embeddings persistence and retrieval in a safe, incremental way.

## Current state (what we have today)

- Persistent storage
  - There is a `Storage` implementation at `src/storage.ts` that persists projects, conversations and decisions into a SQLite DB.
  - Default DB path: `~/.context-sync/data.db` (on Windows: `%USERPROFILE%\.context-sync\data.db`).
  - Tables already created: `projects`, `conversations`, `decisions`.

- Extraction and persistence
  - The `AutoContextExtractor` emits events when it extracts contexts: `context-extracted`, `context-item-extracted`, etc.
  - We added a persistence wiring module (`src/context-engine/persistence.ts`) which listens to `context-item-extracted` and saves items into SQLite:
    - `decision` items -> `decisions` table
    - `documentation` / `code_change` / other -> `conversations` table (tool = 'other')
  - The extractor does not compute or store embeddings when persisting items.

- Relevance scoring and embeddings usage
  - `RelevanceScorer` supports semantic scoring using embeddings (OpenAI-style API) and keeps an in-memory cache (`embeddingCache`).
  - If an OpenAI API key is not provided, the scorer falls back to keyword matching.
  - There is no persistence for embeddings in the DB yet — embeddings live only in memory while the process runs.

## Why persist embeddings

Benefits:
- Reuse embeddings across restarts: avoid recomputation and provider costs.
- Faster semantic searches and scoring when DB-backed vectors are indexed properly.
- Auditability: know which model produced an embedding and when.

Costs/concerns:
- Storage space (vectors can be large depending on model dimensionality)
- Increased complexity (schema + retrieval code)
- Need to choose an index strategy for nearest-neighbor lookup (SQLite, Faiss, Annoy, PGVector, or managed vector DB)
- Provider cost for embedding computation (or local models, if available)

## Options (high level)

1. Persist embeddings in SQLite (simple)
   - Add an `embeddings` table with columns: `id`, `project_id`, `context_id`, `model`, `vector` (JSON/BLOB), `created_at`.
   - Pros: straightforward, no additional services.
   - Cons: nearest-neighbor searches on raw arrays in SQLite will be slow without extensions (but fine for small projects).

2. Persist embeddings in SQLite + use an approximate nearest neighbor index (Faiss/Annoy)
   - Store vectors in DB and maintain a separate index using Faiss/Annoy.
   - Pros: fast semantic search at scale.
   - Cons: additional runtime and ops complexity (native dependencies).

3. Use specialized vector DB (e.g., Milvus, Pinecone, Weaviate, PGVector)
   - Pros: production-ready performance and features (filtering, namespaces, metadata).
   - Cons: an external service and cost/ops overhead.

4. Cache embeddings to disk (file-based) and rely on in-memory LRU while process runs
   - Pros: simpler, no DB changes.
   - Cons: lost guarantees, weaker querying capabilities.

## Recommended approach (phased)

We recommend a phased, low-risk approach that provides immediate value and allows later upgrades.

Phase 1 — DB schema + storage API (low risk)
- Add an `embeddings` table to SQLite and new `Storage` APIs:
  - `saveEmbedding(contextId: string, model: string, vector: number[], metadata?: Record<string, any>)`
  - `getEmbedding(contextId: string, model?: string): { vector: number[], model: string, createdAt: Date } | null`
  - `findNearest(vector: number[], topK: number, filter?: { projectId?: string }): Array<{ contextId: string, score: number }>` — initial implementation can be a linear scan using cosine similarity in JS for small data sets.
- Acceptance criteria: embeddings can be saved and retrieved; `getEmbedding()` returns cached vectors; `findNearest()` works correctly for small datasets.

Phase 2 — Background worker to compute embeddings (non-blocking)
- When a context item is persisted, push a job to a simple queue to compute embeddings asynchronously (do not block the extractor).
- Worker responsibilities:
  - Compute embeddings via the configured provider (Xenova/local or OpenAI/OpenProvider) or skip if embeddings disabled.
  - Save embedding via `Storage.saveEmbedding()`.
  - Emit events on success/failure (`embedding-saved`, `embedding-error`).
- Acceptance criteria: embeddings are computed and stored in background; extractor remains responsive and non-blocking.

Phase 3 — Use persisted embeddings in scoring
- Update `RelevanceScorer.getEmbedding()` to check DB (via `Storage.getEmbedding()`) before calling the provider.
- If DB embedding exists and matches requested model, use it; otherwise compute and (optionally) persist.
- Acceptance criteria: `RelevanceScorer.isEmbeddingsEnabled()` remains based on provider key config; scoring uses persisted embeddings when available.

Phase 4 — Improve nearest-neighbor search
- For larger datasets, replace linear scan with an ANN index (Faiss/Annoy or vector DB).
- Consider a pluggable index provider interface so we can swap in-memory FAISS for production vector DB later.
- Acceptance criteria: search latencies reduced and results consistent with linear (for verification datasets).

Phase 5 — Policies, pruning, and cost control
- Retention/purging for old embeddings (staleness policy)
- Throttling or batching embedding calls to control provider costs
- Configurable models per-project and model-version metadata for reproducibility

## Example DB schema (Phase 1)

```sql
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  context_id TEXT,
  model TEXT,
  vector_json TEXT, -- JSON array of numbers
  created_at INTEGER,
  metadata TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id);
``` 

Notes: using JSON is portable; if/when we adopt a vector-enabled DB, we can migrate vectors into the specialized store and keep metadata in SQLite.

## API changes to `Storage` (suggested)

Add the following to `StorageInterface` and `Storage`:

- `saveEmbedding(contextId: string, model: string, vector: number[], metadata?: Record<string, any>): void`
- `getEmbedding(contextId: string, model?: string): { vector: number[], model: string, createdAt: Date, metadata?: any } | null`
- `findNearest(vector: number[], topK: number, filter?: { projectId?: string }): Array<{ contextId: string, score: number }>`

These are simple to implement in Phase 1 (linear scan) and can be optimized later.

## Background worker pseudocode (Phase 2)

- Use a simple in-process queue (array + setInterval) or a lightweight job queue (bullmq, bee-queue) if needed in future.

Pseudocode:

```ts
// persistence wiring (on save)
queue.push({ contextId, projectId, text, model });

// worker loop
setInterval(async () => {
  const job = queue.shift();
  if (!job) return;
  try {
    const vector = await provider.generateEmbeddings(job.text, { model: job.model });
    storage.saveEmbedding(job.contextId, job.model, vector, { source: 'auto-extractor' });
    emitter.emit('embedding-saved', { contextId: job.contextId, model: job.model });
  } catch (err) {
    emitter.emit('embedding-error', { job, error: err });
  }
}, 500);
```

Design notes:
- Keep the job size small (truncate text to model limits) and persist a job record if you need durability.
- Honor a max in-flight limit to avoid flooding provider.

## Testing plan

- Unit tests for `Storage.saveEmbedding` / `getEmbedding` / `findNearest` (linear scan correctness)
- Integration test: persist an extracted item, run worker to compute embedding, then call scorer.scoreSemanticWithEmbeddings() and ensure it uses stored embedding and computes similarity.
- Performance test: verify findNearest correctness vs linear brute force on small dataset.

## Operational considerations

- Cost monitoring: track embedding API usage and cost per model. Consider a usage cap per project.
- Model versioning: store `model` alongside the vector so you can re-compute with new models later.
- Migration path: provide a migration script to export vectors if switching to a vector DB.

## Next steps (immediate)

1. Implement Phase 1 (DB schema + API) — low risk and gives immediate value.
2. Implement a small background worker (Phase 2) to compute embeddings asynchronously.
3. Update `RelevanceScorer.getEmbedding()` to consult `Storage.getEmbedding()` before calling the provider.

If you want, I can implement Phase 1 now (add schema + Storage APIs) and wire it into the persistence worker as a PoC.

---

Document created by the codebase maintenance workflow. If you want me to implement Phase 1 now, say "Implement Phase 1" and I'll add code changes and tests.