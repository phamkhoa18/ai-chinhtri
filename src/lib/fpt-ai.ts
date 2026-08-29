import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.FPT_API_KEY!,
  baseURL: process.env.FPT_API_BASE_URL || "https://mkp-api.fptcloud.com/v1",
});

const CHAT_MODEL = process.env.FPT_CHAT_MODEL || "Qwen3.6-27B";
const ANALYSIS_MODEL = process.env.FPT_ANALYSIS_MODEL || "DeepSeek-V4-Flash";
const EMBEDDING_MODEL = process.env.FPT_EMBEDDING_MODEL || "Vietnamese_Embedding";

/**
 * Qwen3 thinking mode fix: Thêm /no_think vào đầu system message
 * để model trả content trực tiếp thay vì chỉ reasoning_content.
 */
function injectNoThink(
  messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg, i) => {
    if (i === 0 && msg.role === "system" && typeof msg.content === "string") {
      return { ...msg, content: "/no_think\n" + msg.content };
    }
    return msg;
  });
}

/**
 * Extract content from chat completion response.
 * Handles Qwen3 thinking mode where content may be null
 * and the actual response is in reasoning_content.
 */
export function extractContent(response: OpenAI.ChatCompletion): string {
  const message = response.choices[0]?.message;
  if (message?.content) return message.content;
  // Fallback: đọc reasoning_content nếu content null (Qwen3 thinking mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reasoning = (message as any)?.reasoning_content;
  if (reasoning && typeof reasoning === "string") return reasoning;
  return "";
}

export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
) {
  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: injectNoThink(messages),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
    stream: options?.stream ?? false,
  });
  return response;
}

/**
 * Deep analysis completion using a stronger reasoning model (DeepSeek-R1).
 * Does NOT inject /no_think — allows the model to reason freely.
 */
export async function analysisCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
) {
  const response = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages, // No /no_think injection — let model reason deeply
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 16384,
    stream: false,
  });
  return response;
}

export async function chatCompletionStream(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
) {
  const stream = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: injectNoThink(messages),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
    stream: true,
  });
  return stream;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // Batch in groups of 10 to avoid API limits
  const results: number[][] = [];
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));
  }
  return results;
}

export { client, CHAT_MODEL, ANALYSIS_MODEL, EMBEDDING_MODEL };
