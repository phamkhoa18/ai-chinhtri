import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { getEmbedding, getEmbeddings } from "./fpt-ai";

const DB_PATH = path.join(process.cwd(), "data", "knowledge.db");

// ─── Safe SQLite loading ───
// better-sqlite3 is a native C++ addon. If it's compiled for the wrong
// platform/Node version, it will SEGFAULT — a kernel-level crash that
// JavaScript try/catch CANNOT intercept.
//
// Strategy: test the module in a CHILD PROCESS first. If the subprocess
// crashes (segfault), our main process stays alive.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseConstructor: any = null;
let sqliteAvailable: boolean | null = null; // null = not tested yet

function testSqliteInSubprocess(): boolean {
  try {
    // Run require('better-sqlite3') in a separate process
    // If it segfaults, only the child dies — main process is safe
    execSync(
      `node -e "const DB = require('better-sqlite3'); const db = new DB(':memory:'); db.exec('SELECT 1'); db.close();"`,
      {
        timeout: 10000,
        cwd: process.cwd(),
        stdio: "ignore",
        env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules") },
      }
    );
    return true;
  } catch {
    return false;
  }
}

function initSqlite(): boolean {
  // Already tested
  if (sqliteAvailable === true && DatabaseConstructor) return true;
  if (sqliteAvailable === false) return false;

  // First time: test in subprocess
  console.log("[VectorStore] Testing SQLite availability...");
  const available = testSqliteInSubprocess();

  if (!available) {
    console.error("[VectorStore] ❌ better-sqlite3 NOT working (subprocess test failed)");
    console.error("[VectorStore] → Run on server: npm rebuild better-sqlite3");
    console.warn("[VectorStore] → Knowledge Base / RAG disabled. App will continue without it.");
    sqliteAvailable = false;
    return false;
  }

  // Subprocess passed — safe to require in main process
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("better-sqlite3");
    DatabaseConstructor = mod.default || mod;
    sqliteAvailable = true;
    console.log("[VectorStore] ✅ SQLite initialized successfully");
    return true;
  } catch (error) {
    console.error("[VectorStore] ❌ Failed to load better-sqlite3:", (error as Error).message);
    sqliteAvailable = false;
    return false;
  }
}

function getDb() {
  if (!initSqlite() || !DatabaseConstructor) {
    throw new Error("SQLite not available");
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseConstructor(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      chunk_count INTEGER DEFAULT 0,
      file_type TEXT,
      file_size INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB NOT NULL,
      chunk_index INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
  `);

  return db;
}

export interface DocumentInfo {
  id: string;
  name: string;
  created_at: string;
  chunk_count: number;
  file_type: string | null;
  file_size: number;
}

export interface SearchResult {
  content: string;
  document_name: string;
  document_id: string;
  score: number;
  chunk_index: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function embeddingToBuffer(embedding: number[]): Buffer {
  const buf = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i], i * 4);
  }
  return buf;
}

function bufferToEmbedding(buf: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    embedding.push(buf.readFloatLE(i));
  }
  return embedding;
}

export async function addDocument(
  docId: string,
  name: string,
  chunks: string[],
  fileType?: string,
  fileSize?: number
): Promise<void> {
  if (!initSqlite()) {
    throw new Error("Knowledge Base không khả dụng — chạy trên server: npm rebuild better-sqlite3");
  }

  const db = getDb();
  const embeddings = await getEmbeddings(chunks);

  const insertDoc = db.prepare(
    `INSERT OR REPLACE INTO documents (id, name, chunk_count, file_type, file_size) VALUES (?, ?, ?, ?, ?)`
  );
  const insertChunk = db.prepare(
    `INSERT INTO chunks (document_id, content, embedding, chunk_index) VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(docId);
    insertDoc.run(docId, name, chunks.length, fileType || null, fileSize || 0);

    for (let i = 0; i < chunks.length; i++) {
      insertChunk.run(docId, chunks[i], embeddingToBuffer(embeddings[i]), i);
    }
  });

  transaction();
  db.close();
}

export async function search(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  if (!initSqlite()) return [];

  try {
    const db = getDb();
    const queryEmbedding = await getEmbedding(query);

    const rows = db
      .prepare(
        `SELECT c.content, c.embedding, c.chunk_index, d.name as document_name, d.id as document_id
         FROM chunks c
         JOIN documents d ON c.document_id = d.id`
      )
      .all() as Array<{
      content: string;
      embedding: Buffer;
      chunk_index: number;
      document_name: string;
      document_id: string;
    }>;

    const scored = rows.map((row) => {
      const embedding = bufferToEmbedding(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);
      return {
        content: row.content,
        document_name: row.document_name,
        document_id: row.document_id,
        score,
        chunk_index: row.chunk_index,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    db.close();
    return scored.slice(0, topK);
  } catch (error) {
    console.error("[VectorStore] Search error:", (error as Error).message);
    return [];
  }
}

export function listDocuments(): DocumentInfo[] {
  if (!initSqlite()) return [];

  try {
    const db = getDb();
    const docs = db
      .prepare(`SELECT * FROM documents ORDER BY created_at DESC`)
      .all() as DocumentInfo[];
    db.close();
    return docs;
  } catch {
    return [];
  }
}

export function deleteDocument(docId: string): void {
  if (!initSqlite()) {
    throw new Error("Knowledge Base không khả dụng — chạy trên server: npm rebuild better-sqlite3");
  }

  const db = getDb();
  db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(docId);
  db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);
  db.close();
}

export function getDocument(docId: string): DocumentInfo | null {
  if (!initSqlite()) return null;

  try {
    const db = getDb();
    const doc = db
      .prepare(`SELECT * FROM documents WHERE id = ?`)
      .get(docId) as DocumentInfo | undefined;
    db.close();
    return doc || null;
  } catch {
    return null;
  }
}
