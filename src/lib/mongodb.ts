import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/saomai";
const DB_NAME = process.env.MONGODB_DB || "saomai";

/**
 * MongoDB connection singleton.
 * In development, Next.js hot-reloads clear module cache, so we store
 * the client promise on `globalThis` to reuse across reloads.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

let clientPromise: Promise<MongoClient>;

if (!g._mongoClientPromise) {
  const client = new MongoClient(MONGODB_URI);
  g._mongoClientPromise = client.connect();
  console.log("[MongoDB] Creating new connection...");
}
clientPromise = g._mongoClientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export { clientPromise };
