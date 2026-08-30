import { getDb } from "./mongodb";
import { getEmbedding, getEmbeddings } from "./fpt-ai";

// ─── Types ───

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

// ─── Helpers ───

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

// ─── Ensure indexes ───

let indexesCreated = false;
async function ensureIndexes() {
  if (indexesCreated) return;
  try {
    const db = await getDb();
    await db.collection("chunks").createIndex({ document_id: 1 });
    await db.collection("documents").createIndex({ created_at: -1 });
    indexesCreated = true;
  } catch (error) {
    console.error("[VectorStore] Failed to create indexes:", (error as Error).message);
  }
}

// ─── CRUD ───

export async function addDocument(
  docId: string,
  name: string,
  chunks: string[],
  fileType?: string,
  fileSize?: number
): Promise<void> {
  const db = await getDb();
  await ensureIndexes();

  const embeddings = await getEmbeddings(chunks);

  // Upsert document
  await db.collection("documents").updateOne(
    { id: docId },
    {
      $set: {
        id: docId,
        name,
        chunk_count: chunks.length,
        file_type: fileType || null,
        file_size: fileSize || 0,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  // Delete old chunks then insert new
  await db.collection("chunks").deleteMany({ document_id: docId });

  if (chunks.length > 0) {
    const chunkDocs = chunks.map((content, i) => ({
      document_id: docId,
      content,
      embedding: embeddings[i],
      chunk_index: i,
    }));
    await db.collection("chunks").insertMany(chunkDocs);
  }
}

export async function search(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    const db = await getDb();
    const queryEmbedding = await getEmbedding(query);

    // Get all chunks with their document info
    const chunks = await db
      .collection("chunks")
      .aggregate([
        {
          $lookup: {
            from: "documents",
            localField: "document_id",
            foreignField: "id",
            as: "doc",
          },
        },
        { $unwind: "$doc" },
        {
          $project: {
            content: 1,
            embedding: 1,
            chunk_index: 1,
            document_name: "$doc.name",
            document_id: "$doc.id",
          },
        },
      ])
      .toArray();

    // Calculate cosine similarity
    const scored = chunks.map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding as number[]);
      return {
        content: chunk.content as string,
        document_name: chunk.document_name as string,
        document_id: chunk.document_id as string,
        score,
        chunk_index: chunk.chunk_index as number,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  } catch (error) {
    console.error("[VectorStore] Search error:", (error as Error).message);
    return [];
  }
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection("documents")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    return docs.map((doc) => ({
      id: doc.id as string,
      name: doc.name as string,
      created_at: doc.created_at as string,
      chunk_count: doc.chunk_count as number,
      file_type: (doc.file_type as string) || null,
      file_size: (doc.file_size as number) || 0,
    }));
  } catch {
    return [];
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  const db = await getDb();
  await db.collection("chunks").deleteMany({ document_id: docId });
  await db.collection("documents").deleteOne({ id: docId });
}

export async function getDocument(docId: string): Promise<DocumentInfo | null> {
  try {
    const db = await getDb();
    const doc = await db.collection("documents").findOne({ id: docId });
    if (!doc) return null;

    return {
      id: doc.id as string,
      name: doc.name as string,
      created_at: doc.created_at as string,
      chunk_count: doc.chunk_count as number,
      file_type: (doc.file_type as string) || null,
      file_size: (doc.file_size as number) || 0,
    };
  } catch {
    return null;
  }
}
