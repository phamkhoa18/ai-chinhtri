import { getDb } from "./mongodb";

// ─── Types ───

export interface BotConfig {
  id: string;
  name: string;
  greeting: string;
  system_prompt: string | null;
  theme_color: string;
  position: string;
  avatar_url: string | null;
  allowed_domains: string; // JSON array string
  created_at: string;
  updated_at: string;
}

export interface CreateBotInput {
  name: string;
  greeting?: string;
  system_prompt?: string;
  theme_color?: string;
  position?: string;
  avatar_url?: string;
  allowed_domains?: string[];
}

export interface UpdateBotInput {
  name?: string;
  greeting?: string;
  system_prompt?: string;
  theme_color?: string;
  position?: string;
  avatar_url?: string;
  allowed_domains?: string[];
}

// ─── Default system prompt ───

export const DEFAULT_SYSTEM_PROMPT = `Bạn là SaoMai AI - trợ lý AI chuyên phân tích và phản biện thông tin xuyên tạc tại Việt Nam.

Nhiệm vụ chính:
1. Nhận diện thông tin xuyên tạc, bóp méo sự thật
2. Phản biện bằng logic và dẫn chứng
3. Giáo dục người dùng về cách nhận biết tin giả

Phong cách:
- Trả lời bằng tiếng Việt
- Chuyên nghiệp, khách quan, có lý lẽ
- Trích dẫn nguồn khi có thể
- Ngắn gọn, đi thẳng vào vấn đề`;

// ─── Ensure indexes ───

let indexesCreated = false;
async function ensureIndexes() {
  if (indexesCreated) return;
  try {
    const db = await getDb();
    await db.collection("bots").createIndex({ id: 1 }, { unique: true });
    await db.collection("bots").createIndex({ created_at: -1 });
    indexesCreated = true;
  } catch (error) {
    console.error("[BotStore] Failed to create indexes:", (error as Error).message);
  }
}

// ─── CRUD Functions ───

export async function createBot(input: CreateBotInput): Promise<BotConfig> {
  const db = await getDb();
  await ensureIndexes();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const bot: BotConfig = {
    id,
    name: input.name,
    greeting: input.greeting || "Xin chào! Tôi là SaoMai AI. Tôi có thể giúp gì cho bạn?",
    system_prompt: input.system_prompt || null,
    theme_color: input.theme_color || "#DC2626",
    position: input.position || "bottom-right",
    avatar_url: input.avatar_url || null,
    allowed_domains: JSON.stringify(input.allowed_domains || ["*"]),
    created_at: now,
    updated_at: now,
  };

  await db.collection("bots").insertOne({ ...bot });
  return bot;
}

export async function getBot(id: string): Promise<BotConfig | null> {
  try {
    const db = await getDb();
    const doc = await db.collection("bots").findOne({ id });
    if (!doc) return null;

    return {
      id: doc.id as string,
      name: doc.name as string,
      greeting: doc.greeting as string,
      system_prompt: (doc.system_prompt as string) || null,
      theme_color: doc.theme_color as string,
      position: doc.position as string,
      avatar_url: (doc.avatar_url as string) || null,
      allowed_domains: doc.allowed_domains as string,
      created_at: doc.created_at as string,
      updated_at: doc.updated_at as string,
    };
  } catch {
    return null;
  }
}

export async function listBots(): Promise<BotConfig[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection("bots")
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    return docs.map((doc) => ({
      id: doc.id as string,
      name: doc.name as string,
      greeting: doc.greeting as string,
      system_prompt: (doc.system_prompt as string) || null,
      theme_color: doc.theme_color as string,
      position: doc.position as string,
      avatar_url: (doc.avatar_url as string) || null,
      allowed_domains: doc.allowed_domains as string,
      created_at: doc.created_at as string,
      updated_at: doc.updated_at as string,
    }));
  } catch {
    return [];
  }
}

export async function updateBot(id: string, input: UpdateBotInput): Promise<BotConfig | null> {
  const db = await getDb();
  const existing = await db.collection("bots").findOne({ id });
  if (!existing) return null;

  const now = new Date().toISOString();

  const updateFields: Record<string, unknown> = { updated_at: now };
  if (input.name !== undefined) updateFields.name = input.name;
  if (input.greeting !== undefined) updateFields.greeting = input.greeting;
  if (input.system_prompt !== undefined) updateFields.system_prompt = input.system_prompt;
  if (input.theme_color !== undefined) updateFields.theme_color = input.theme_color;
  if (input.position !== undefined) updateFields.position = input.position;
  if (input.avatar_url !== undefined) updateFields.avatar_url = input.avatar_url;
  if (input.allowed_domains !== undefined) updateFields.allowed_domains = JSON.stringify(input.allowed_domains);

  await db.collection("bots").updateOne({ id }, { $set: updateFields });

  return getBot(id);
}

export async function deleteBot(id: string): Promise<void> {
  const db = await getDb();
  await db.collection("bots").deleteOne({ id });
}

/**
 * Validate if a domain is allowed for a bot
 */
export function isDomainAllowed(bot: BotConfig, origin: string): boolean {
  try {
    const allowed: string[] = JSON.parse(bot.allowed_domains);
    if (allowed.includes("*")) return true;

    const hostname = new URL(origin).hostname;
    return allowed.some((domain) => {
      if (domain === hostname) return true;
      if (domain.startsWith("*.")) {
        return hostname.endsWith(domain.slice(1));
      }
      return false;
    });
  } catch {
    return true;
  }
}
