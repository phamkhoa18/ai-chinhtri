import { analysisCompletion, chatCompletion, chatCompletionStream, extractContent } from "./fpt-ai";
import { search as vectorSearch } from "./vector-store";
import { searchWeb } from "./web-search";
import type OpenAI from "openai";

// ─── Progress callback system ───
export type AnalysisStep = "detecting" | "searching" | "rebutting";

export interface ProgressEvent {
  type: "step" | "claims" | "sources" | "result" | "error" | "rebuttal_chunk";
  step?: AnalysisStep;
  label?: string;
  progress?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Run an async function with a timeout. Returns fallback value if timeout.
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[Timeout] ${label} exceeded ${timeoutMs}ms, using fallback`);
        resolve(fallback);
      }, timeoutMs)
    ),
  ]);
}

export interface DetectedClaim {
  claim: string;
  tactic: string;
  reason: string;
  impact: string;
  severity: "high" | "medium" | "low";
}

export interface SourceEvidence {
  title: string;
  url: string;
  snippet: string;
  relevance: string;
}

export interface AnalysisResult {
  claims: DetectedClaim[];
  sources: SourceEvidence[];
  rebuttal: string;
  ragContext: string[];
}

// ─── Danh sách tác giả / tổ chức phản động đã biết ───
const KNOWN_HOSTILE_AUTHORS = [
  "Lý Thái Hùng",
  "Nguyễn Văn Đài",
  "Phạm Đoan Trang",
  "Trịnh Hữu Long",
  "Nguyễn Quang A",
  "Lê Công Định",
  "Nguyễn Ngọc Như Quỳnh",
  "Trần Huỳnh Duy Thức",
  "Việt Tân",
  "RFA",
  "VOA Tiếng Việt",
  "BBC Tiếng Việt",
  "Người Việt Online",
  "Đài Á Châu Tự Do",
];

// ─── Dấu hiệu ngôn ngữ phản động ───
const HOSTILE_LANGUAGE_MARKERS = [
  "CSVN",
  "cộng sản Việt Nam",
  "chế độ độc tài",
  "công an trị",
  "nhà nước cảnh sát",
  "đảng cộng sản",
  "bóp nghẹt tự do",
  "đàn áp nhân quyền",
  "chế độ toàn trị",
  "bưng bít thông tin",
  "tự do dân chủ",
  "dân chủ hoá",
  "đa đảng",
  "xoá bỏ điều 4",
  "thể chế dân chủ",
  "lật đổ",
  "chuyển đổi thể chế",
  "nhà cầm quyền",
  "guồng máy lạc hậu",
  "xác khô",
  "ý thức hệ hoang tưởng",
  "ảo tưởng",
  "tự lừa dối",
  "kiệt quệ lối thoát",
  "dùi cui",
];

/**
 * Pre-process: Nhận diện dấu hiệu phản động từ metadata
 */
function detectHostileSignals(text: string): {
  detectedAuthors: string[];
  detectedMarkers: string[];
  hostileScore: number;
} {
  const lowerText = text.toLowerCase();

  const detectedAuthors = KNOWN_HOSTILE_AUTHORS.filter((author) =>
    text.includes(author)
  );

  const detectedMarkers = HOSTILE_LANGUAGE_MARKERS.filter((marker) =>
    lowerText.includes(marker.toLowerCase())
  );

  // Hostile score: 0-10
  const hostileScore = Math.min(
    10,
    detectedAuthors.length * 3 + detectedMarkers.length
  );

  return { detectedAuthors, detectedMarkers, hostileScore };
}

// ─── Question / chat patterns ───
const QUESTION_PATTERNS = [
  /^.{0,10}(là gì|nghĩa là|có nghĩa)/i,
  /^.{0,10}(tại sao|vì sao|do đâu|nguyên nhân)/i,
  /^.{0,10}(ai là|ai đã|ai sẽ)/i,
  /^.{0,10}(làm sao|bằng cách nào|như thế nào|thế nào)/i,
  /^.{0,10}(có phải|đúng không|phải không)/i,
  /^.{0,20}(giải thích|cho .* biết|kể .* nghe)/i,
  /\?$/,
];

/**
 * Decide if user input should trigger full analysis pipeline or just chat.
 *
 * Returns true (= run analyze pipeline) when:
 * - Text is long (>150 chars) AND has hostile language markers
 * - Text is very long (>300 chars) and looks like a pasted article
 * - Text has multiple sentences and hostile signals
 *
 * Returns false (= just chat) when:
 * - Short text / questions
 * - Follow-up in conversation
 */
export function shouldAnalyze(text: string, hasHistory: boolean): boolean {
  const trimmed = text.trim();
  const len = trimmed.length;

  // Very short → always chat
  if (len < 80) return false;

  // Question patterns → always chat
  if (QUESTION_PATTERNS.some((p) => p.test(trimmed))) return false;

  // Check hostile signals
  const signals = detectHostileSignals(trimmed);

  // Has hostile markers + reasonably long → analyze
  if (signals.hostileScore >= 2 && len > 120) return true;

  // Very long text (pasted article) even without clear hostile markers → analyze
  // Must have at least 2 sentences to look like an article
  const sentenceCount = (trimmed.match(/[.!?]\s/g) || []).length + 1;
  if (len > 300 && sentenceCount >= 3) return true;

  // Long text with some hostile signals → analyze
  if (len > 200 && signals.hostileScore >= 1) return true;

  // Has ongoing conversation → likely follow-up chat, not new analysis
  if (hasHistory && len < 300) return false;

  return false;
}

/**
 * Step 1: Detect misinformation claims in the input text
 * Uses DeepSeek-R1 for deep reasoning analysis
 */
export async function detectMisinformation(
  text: string
): Promise<DetectedClaim[]> {
  // Pre-processing: detect hostile signals
  const signals = detectHostileSignals(text);

  let contextHint = "";
  if (signals.detectedAuthors.length > 0) {
    contextHint += `\n\n⚠️ CẢNH BÁO: Bài viết có chứa tên tác giả/tổ chức đã nằm trong danh sách đối tượng chống phá: ${signals.detectedAuthors.join(", ")}. Hãy phân tích CỰC KỲ CẨN THẬN và NGHIÊM KHẮC.`;
  }
  if (signals.detectedMarkers.length > 0) {
    contextHint += `\n\n⚠️ PHÁT HIỆN ngôn ngữ đặc trưng phản động/thù địch: "${signals.detectedMarkers.join('", "')}"`;
  }
  if (signals.hostileScore >= 3) {
    contextHint += `\n\n🔴 CHỈ SỐ NGUY HIỂM: ${signals.hostileScore}/10. Bài viết này có XÁC SUẤT CAO là nội dung phản động, xuyên tạc. KHÔNG ĐƯỢC bỏ sót bất kỳ luận điểm thù địch nào.`;
  }

  const systemPrompt = `Bạn là chuyên gia PHÂN CẤP CAO NHẤT về công tác tư tưởng, lý luận chính trị và bảo vệ nền tảng tư tưởng của Đảng Cộng sản Việt Nam.

NHIỆM VỤ TUYỆT ĐỐI: Phân tích đoạn text để bóc trần TẤT CẢ các luận điệu xuyên tạc, chống phá, phản động. Bạn phải nhận diện TỪNG luận điểm thù địch, dù được ngụy trang tinh vi đến đâu.

═══════════════════════════════════════
PHÂN LOẠI CÁC DẠNG XUYÊN TẠC CẦN NHẬN DIỆN:
═══════════════════════════════════════

1. PHỦ NHẬN CNXH & CON ĐƯỜNG XHCN CỦA VIỆT NAM:
   - Gọi CNXH là "đã chết", "lạc hậu", "thất bại", "ý thức hệ hoang tưởng"
   - Phủ nhận tính đúng đắn của con đường xây dựng CNXH tại Việt Nam
   - Tuyên truyền rằng CNXH chỉ là "nhãn hiệu chính trị" để hợp thức hoá quyền lực
   - So sánh thiên lệch rằng các nước XHCN "thua kém" các nước tư bản

2. XUYÊN TẠC PHÁT NGÔN / CHỦ TRƯƠNG CỦA LÃNH ĐẠO ĐẢNG, NHÀ NƯỚC:
   - Bóp méo, gán ý đồ xấu cho phát biểu của Tổng Bí thư, Chủ tịch nước, Thủ tướng
   - Xuyên tạc các chủ trương, nghị quyết của Đảng thành "tham vọng quyền lực cá nhân"
   - Bóp méo "kỷ nguyên vươn mình" thành khẩu hiệu rỗng
   - Gán ghép động cơ cá nhân cho các quyết sách vĩ mô

3. ĐÁNH ĐỒNG LỰC LƯỢNG CÔNG AN = "CÔNG AN TRỊ":
   - Xuyên tạc vai trò của lực lượng CAND trong đảm bảo an ninh trật tự
   - Gán nhãn "nhà nước cảnh sát", "nhà nước công an hoá"
   - Bóp méo rằng công an chỉ để "trấn áp", "kiểm soát" chứ không bảo vệ nhân dân
   - Phủ nhận vai trò của CAND trong phát triển kinh tế - xã hội

4. SO SÁNH THIÊN LỆCH QUỐC TẾ:
   - So sánh không tương xứng Việt Nam với Hàn Quốc, Đài Loan, Singapore
   - Cố tình bỏ qua bối cảnh lịch sử, điểm xuất phát, hoàn cảnh chiến tranh
   - Ngụy biện rằng chỉ có "dân chủ phương Tây" mới phát triển được

5. GIẢ DANH "PHÂN TÍCH KHÁCH QUAN" ĐỂ CHE ĐẬY Ý ĐỒ PHẢN ĐỘNG:
   - Dùng giọng văn học thuật, "phân tích chính trị" để ngụy trang
   - Trích dẫn có chọn lọc, cắt xén để phục vụ luận điểm chống phá
   - Tạo vẻ "trung lập" nhưng kết luận luôn hướng tới phủ nhận Đảng và chế độ

6. KÍCH ĐỘNG, CHIA RẼ:
   - Chia rẽ Đảng với nhân dân, chia rẽ các lực lượng vũ trang với dân
   - Kích động bất mãn xã hội, tạo tâm lý hoang mang
   - Tuyên truyền rằng "nhân dân hết niềm tin", "xã hội cạn nhiệt huyết"

7. BÔI NHỌ, HẠ BỆ LÃNH ĐẠO:
   - Dùng mỹ từ "phản biện" để công kích cá nhân lãnh đạo
   - Gắn nhãn "say mê quyền lực", "tham vọng cá nhân", "lúng túng", "lạc hướng"
   - Xúc phạm danh dự, uy tín của lãnh đạo Đảng, Nhà nước

8. PHỦ NHẬN / XÉT LẠI LỊCH SỬ:
   - Bóp méo lịch sử cách mạng, lịch sử kháng chiến
   - Phủ nhận thành tựu 50 năm xây dựng đất nước sau chiến tranh
   - Đánh tráo khái niệm về các sự kiện lịch sử

9. GẮN NHÃN "ĐỘC TÀI":
   - Đánh đồng hệ thống chính trị Việt Nam với chế độ "độc tài", "toàn trị"
   - Tuyên truyền rằng Đảng lãnh đạo = thiểu số cầm quyền
   - Phủ nhận tính dân chủ trong hệ thống chính trị Việt Nam

10. TUYÊN TRUYỀN CHUYỂN ĐỔI THỂ CHẾ:
    - Kêu gọi "dân chủ hoá", "đa đảng", "xoá bỏ điều 4 Hiến pháp"
    - Tuyên truyền mô hình chính trị phương Tây thay thế CNXH
    - Sử dụng các khái niệm "tự do", "nhân quyền" theo cách bóp méo

═══════════════════════════════════════
QUY TẮC PHÂN TÍCH:
═══════════════════════════════════════

- BẮT BUỘC nhận diện TỪNG luận điểm xuyên tạc riêng biệt, không gom chung
- Phân tích THẬT SÂU: bóc tách lớp ngụy biện, chỉ rõ sự dối trá ẩn giấu
- Đặc biệt cảnh giác với bài viết có VẺ NGOÀI khách quan, trung lập nhưng KẾT LUẬN luôn chống phá
- Một bài viết có thể chứa NHIỀU luận điểm xuyên tạc thuộc NHIỀU dạng khác nhau
- KHÔNG BAO GIỜ bỏ sót luận điểm xuyên tạc. Nếu không chắc chắn, hãy đưa vào với severity "low"
${contextHint}

═══════════════════════════════════════
ĐỊNH DẠNG OUTPUT:
═══════════════════════════════════════

Trả về JSON array, mỗi phần tử BẮT BUỘC có các field:
- "claim": Trích nguyên văn hoặc tóm tắt luận điểm xuyên tạc
- "tactic": Tên thủ đoạn (từ 10 dạng trên, VD: "Phủ nhận CNXH", "Bôi nhọ lãnh đạo", "Giả danh khách quan", "So sánh thiên lệch"...)
- "reason": Phân tích BÓC TRẦN sự dối trá, phản bác bằng lý luận chính trị sắc bén, chỉ ra bản chất thật
- "impact": Mục đích chính trị sâu xa và tác hại nghiêm trọng của luận điểm này
- "severity": "high" (trực tiếp chống phá Đảng/chế độ), "medium" (xuyên tạc gián tiếp), "low" (ngụ ý tiêu cực)

Nếu đoạn text hoàn toàn trong sạch, không có DẤU HIỆU nào xấu độc, trả về [].
CHỈ trả về JSON array, KHÔNG có text nào khác trước hoặc sau JSON.`;

  const response = (await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    { temperature: 0.3, maxTokens: 8192 }
  )) as OpenAI.ChatCompletion;

  const content = extractContent(response) || "[]";

  try {
    return parseJsonArray(content);
  } catch {
    console.error("Failed to parse detection result:", content);
    return [];
  }
}

/**
 * Robust JSON array parser - handles various LLM output formats
 */
function parseJsonArray(content: string): DetectedClaim[] {
  // Try direct parse first
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Continue to fallback strategies
  }

  // Try extracting from markdown code block ```json ... ```
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Continue
    }
  }

  // Try finding JSON array pattern
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue
    }
  }

  // Last resort: try to find and fix common JSON issues
  const lastBracket = content.lastIndexOf("]");
  const firstBracket = content.indexOf("[");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(content.substring(firstBracket, lastBracket + 1));
    } catch {
      // Give up
    }
  }

  return [];
}

/**
 * Step 2: Generate search queries for finding counter-evidence
 */
async function generateSearchQueries(
  claims: DetectedClaim[]
): Promise<string[]> {
  if (claims.length === 0) return [];

  const systemPrompt = `Bạn là chuyên gia tìm kiếm thông tin chính thống Việt Nam.
Nhiệm vụ: Tạo các truy vấn tìm kiếm ngắn gọn bằng tiếng Việt để tìm bài báo chính thống PHẢN BÁC các luận điểm xuyên tạc.

Quy tắc:
- Mỗi luận điểm tạo 1 truy vấn tìm kiếm
- Truy vấn phải NGẮN GỌN (5-10 từ), cụ thể, dễ tìm thấy kết quả
- Ưu tiên tìm bài từ nhandan.vn, baochinhphu.vn, qdnd.vn, dangcongsan.vn
- KHÔNG dùng câu hỏi, chỉ dùng từ khóa

Ví dụ input: ["CNXH đã chết", "Tô Lâm say mê quyền lực"]
Ví dụ output: ["thành tựu chủ nghĩa xã hội Việt Nam", "Tổng Bí thư Tô Lâm kỷ nguyên vươn mình phát triển"]

Trả về JSON array các string. CHỈ trả về JSON, không có text khác.`;

  try {
    const response = (await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(claims.map((c) => c.claim)),
        },
      ],
      { temperature: 0.3, maxTokens: 1024 }
    )) as OpenAI.ChatCompletion;

    const content = extractContent(response) || "[]";
    console.log("[SearchQuery] AI generated:", content.substring(0, 200));
    const queries = parseJsonArray(content) as unknown as string[];

    if (Array.isArray(queries) && queries.length > 0 && typeof queries[0] === "string") {
      console.log(`[SearchQuery] Generated ${queries.length} queries`);
      return queries;
    }
  } catch (error) {
    console.error("[SearchQuery] AI generation failed:", (error as Error).message);
  }

  return [];
}

/**
 * Fallback: Generate search queries directly from claims when AI fails
 */
function generateFallbackQueries(
  claims: DetectedClaim[],
  originalText: string
): string[] {
  const queries: string[] = [];

  // Extract leader/event names from original text
  const knownEntities = [
    "Tô Lâm", "Tổng Bí thư", "Nguyễn Duy Ngọc", "Nguyễn Phú Trọng",
    "Công an nhân dân", "kỷ nguyên vươn mình", "xã hội chủ nghĩa",
  ];
  const foundEntities = knownEntities.filter((name) => originalText.includes(name));

  // Generate queries from found entities
  if (foundEntities.includes("Tô Lâm") || foundEntities.includes("Tổng Bí thư")) {
    queries.push("Tổng Bí thư Tô Lâm phát biểu chỉ đạo phát triển");
  }
  if (foundEntities.includes("kỷ nguyên vươn mình")) {
    queries.push("Việt Nam kỷ nguyên vươn mình thành tựu phát triển");
  }
  if (foundEntities.includes("Công an nhân dân")) {
    queries.push("Công an nhân dân bảo vệ an ninh phát triển kinh tế");
  }
  if (foundEntities.includes("xã hội chủ nghĩa")) {
    queries.push("con đường đi lên chủ nghĩa xã hội Việt Nam thành tựu");
  }

  // General queries about Vietnam achievements
  if (queries.length < 2) {
    queries.push("Việt Nam thành tựu phát triển kinh tế xã hội");
  }

  // Add queries from top claims (extract first few keywords)
  for (const claim of claims.slice(0, 2)) {
    const shortClaim = claim.claim.substring(0, 60).replace(/["']/g, "");
    queries.push(`phản bác ${shortClaim}`);
  }

  console.log(`[SearchQuery] Fallback generated ${queries.length} queries:`, queries);
  return queries;
}

/**
 * Step 2b: Search for evidence from web and knowledge base
 */
async function findEvidence(
  claims: DetectedClaim[],
  originalText: string
): Promise<{ sources: SourceEvidence[]; ragContext: string[] }> {
  // ─── PARALLEL: Run RAG search + AI query generation + fallback web search simultaneously ───
  const fallbackQueries = generateFallbackQueries(claims, originalText);

  const [aiQueries, ragContext, fallbackWebResults] = await Promise.all([
    // AI query generation (timeout 15s)
    withTimeout(
      () => generateSearchQueries(claims),
      15_000,
      [] as string[],
      "AI search query generation"
    ),
    // RAG search (timeout 10s)
    withTimeout(
      async () => {
        try {
          const ragResults = await vectorSearch(originalText, 3);
          return ragResults
            .filter((r) => r.score > 0.3)
            .map((r) => `[${r.document_name}]: ${r.content}`);
        } catch {
          return [];
        }
      },
      10_000,
      [] as string[],
      "RAG search"
    ),
    // Start searching with fallback queries immediately (don't wait for AI)
    withTimeout(
      async () => {
        const promises = fallbackQueries.slice(0, 3).map((q) => searchWeb(q));
        const results = await Promise.all(promises);
        return results.flat();
      },
      20_000,
      [] as { title: string; snippet: string; url: string }[],
      "Fallback web search"
    ),
  ]);

  // If AI generated queries, search with those too
  let aiWebResults: { title: string; snippet: string; url: string }[] = [];
  if (aiQueries.length > 0) {
    console.log(`[Evidence] AI generated ${aiQueries.length} queries, searching...`);
    aiWebResults = await withTimeout(
      async () => {
        const promises = aiQueries.slice(0, 3).map((q) => searchWeb(q));
        const results = await Promise.all(promises);
        return results.flat();
      },
      20_000,
      [],
      "AI web search"
    );
  }

  // Merge and deduplicate results (AI results first = higher priority)
  const allWebResults = [...aiWebResults, ...fallbackWebResults];
  console.log(`[Evidence] Total raw results: ${allWebResults.length}`);

  const seen = new Set<string>();
  const uniqueResults = allWebResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Skip page fetch — DuckDuckGo snippets are sufficient for citation
  const sources: SourceEvidence[] = uniqueResults
    .slice(0, 5)
    .filter((r) => r.snippet)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      relevance: "",
    }));

  console.log(`[Evidence] Final sources: ${sources.length}`);
  sources.forEach((s) => console.log(`  - ${s.title}: ${s.url}`));

  return { sources, ragContext };
}

/**
 * Step 3: Generate rebuttal article — STREAMING version
 * Yields content chunks via ProgressCallback for real-time display.
 */
async function generateRebuttalStreaming(
  originalText: string,
  claims: DetectedClaim[],
  sources: SourceEvidence[],
  ragContext: string[],
  emit: ProgressCallback
): Promise<string> {
  // Detect hostile signals for rebuttal context
  const signals = detectHostileSignals(originalText);

  let authorContext = "";
  if (signals.detectedAuthors.length > 0) {
    authorContext = `\n\n⚠️ BÀI VIẾT CÓ LIÊN QUAN ĐẾN: ${signals.detectedAuthors.join(", ")}. Hãy chỉ rõ nguồn gốc và bản chất thù địch của tác giả/tổ chức này trong bài phản biện.`;
  }

  const systemPrompt = `Bạn là nhà báo, nhà lý luận chính trị cấp cao, chuyên gia bảo vệ nền tảng tư tưởng của Đảng tại Việt Nam.
Nhiệm vụ: Viết bài phản biện CỰC KỲ SẮC BÉN, thâm thúy, có chiều sâu lý luận và thực tiễn, kiên quyết đập tan các luận điệu xuyên tạc, thù địch.

Quy tắc:
- Viết bằng tiếng Việt, lập luận đanh thép, khách quan, giàu sức thuyết phục, dùng từ ngữ chuyên môn về công tác tư tưởng.
- MỞ BÀI: Nhận diện rõ đây là bài viết phản động, chỉ rõ nguồn gốc (tác giả, tổ chức nào), mục đích chống phá tổng thể.
- THÂN BÀI: Mỗi luận điểm phản biện phải bóc trần tận gốc sự dối trá, chỉ rõ thủ đoạn thâm độc.
  + Đặt phát biểu của lãnh đạo vào ĐÚNG BỐI CẢNH thực tế
  + Nêu thành tựu cụ thể, con số thực tế để phản bác
  + Chỉ ra logic ngụy biện, sự cố ý bóp méo
- KẾT BÀI: Tổng hợp thủ đoạn chung của bài viết, khẳng định đường lối đúng đắn của Đảng, củng cố niềm tin.

QUY TẮC TRÍCH DẪN NGUỒN (CỰC KỲ QUAN TRỌNG):
- CHỈ ĐƯỢC trích dẫn nguồn từ danh sách NGUỒN THẬT được cung cấp bên dưới.
- Format trích dẫn: [Tiêu đề bài viết](URL thật)
- TUYỆT ĐỐI KHÔNG tự bịa tên nguồn, tên báo cáo, tên tài liệu hay URL.
- KHÔNG ĐƯỢC viết kiểu "[Nguồn: Văn kiện Đại hội XIII]" hay "[Báo cáo UNDP]" nếu không có URL thật.
- Nếu không có nguồn phù hợp trong danh sách, hãy phản biện bằng lý luận thuần túy mà KHÔNG trích dẫn.
- Giữ bài viết mạch lạc (500-1000 từ).${authorContext}`;

  let context = "";
  if (ragContext.length > 0) {
    context +=
      "\n\n📚 TÀI LIỆU THAM KHẢO (Knowledge Base):\n" +
      ragContext.join("\n");
  }
  if (sources.length > 0) {
    context +=
      "\n\n🌐 NGUỒN TỪ INTERNET:\n" +
      sources.map((s) => `- ${s.title}: ${s.snippet} (${s.url})`).join("\n");
  }

  // Stream the rebuttal token by token
  const stream = await chatCompletionStream(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `ĐOẠN TEXT XUYÊN TẠC:\n${originalText}\n\nCÁC LUẬN ĐIỂM XUYÊN TẠC ĐÃ NHẬN DIỆN:\n${JSON.stringify(claims, null, 2)}\n\nBẰNG CHỨNG PHẢN BÁC:${context}\n\nHãy viết bài phản biện:`,
      },
    ],
    { temperature: 0.5, maxTokens: 8192 }
  );

  let fullRebuttal = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullRebuttal += content;
      emit({ type: "rebuttal_chunk", data: content });
    }
  }

  return fullRebuttal || "Không thể tạo bài phản biện.";
}

/**
 * Full analysis pipeline (backward-compatible, no progress)
 */
export async function analyzeText(text: string): Promise<AnalysisResult> {
  return analyzeTextWithProgress(text);
}

/**
 * Full analysis pipeline WITH real-time progress callbacks.
 * 
 * OPTIMIZED: Step 1 (detect) + Step 2 (evidence search) run IN PARALLEL.
 * Step 3 (rebuttal) streams token-by-token for instant perceived response.
 */
export async function analyzeTextWithProgress(
  text: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const emit = onProgress || (() => {});

  // ═══ Step 1 + Step 2: PARALLEL ═══
  // Start detect AND evidence search at the same time!
  emit({ type: "step", step: "detecting", label: "Nhận diện luận điểm xuyên tạc...", progress: 10 });

  // Prepare fallback queries from text right away (no AI needed)
  const placeholderClaims: DetectedClaim[] = [];
  const fallbackQueries = generateFallbackQueries(placeholderClaims, text);

  // Run in parallel: detection + RAG + web search
  const [claims, ragContext, fallbackWebResults] = await Promise.all([
    // Step 1: Detect claims
    withTimeout(
      () => detectMisinformation(text),
      45_000,
      [] as DetectedClaim[],
      "Detect misinformation"
    ).catch((error) => {
      console.error("[Pipeline] Step 1 (detect) failed:", (error as Error).message);
      emit({ type: "error", data: { step: "detecting", message: "Nhận diện thất bại, bỏ qua bước này." } });
      return [] as DetectedClaim[];
    }),

    // Step 2a: RAG search (start immediately, don't wait for claims)
    withTimeout(
      async () => {
        try {
          const ragResults = await vectorSearch(text, 3);
          return ragResults
            .filter((r) => r.score > 0.3)
            .map((r) => `[${r.document_name}]: ${r.content}`);
        } catch {
          return [];
        }
      },
      10_000,
      [] as string[],
      "RAG search"
    ),

    // Step 2b: Web search with fallback queries (start immediately)
    withTimeout(
      async () => {
        const promises = fallbackQueries.slice(0, 3).map((q) => searchWeb(q));
        const results = await Promise.all(promises);
        return results.flat();
      },
      20_000,
      [] as { title: string; snippet: string; url: string }[],
      "Fallback web search"
    ),
  ]);

  // Send claims
  emit({ type: "claims", data: claims, progress: 30 });

  if (claims.length === 0) {
    const result: AnalysisResult = {
      claims: [],
      sources: [],
      rebuttal: "Không phát hiện luận điểm xuyên tạc rõ ràng trong đoạn text này.",
      ragContext: [],
    };
    emit({ type: "result", data: result, progress: 100 });
    return result;
  }

  // ═══ Step 2c: AI-generated queries (only if claims available) ═══
  emit({ type: "step", step: "searching", label: "Tìm nguồn chính thống...", progress: 35 });

  let aiWebResults: { title: string; snippet: string; url: string }[] = [];
  try {
    const aiQueries = await withTimeout(
      () => generateSearchQueries(claims),
      15_000,
      [] as string[],
      "AI search query generation"
    );
    if (aiQueries.length > 0) {
      aiWebResults = await withTimeout(
        async () => {
          const promises = aiQueries.slice(0, 3).map((q) => searchWeb(q));
          const results = await Promise.all(promises);
          return results.flat();
        },
        20_000,
        [],
        "AI web search"
      );
    }
  } catch {
    // AI queries failed — that's ok, we have fallback results
  }

  // Merge + deduplicate (AI results first)
  const allWebResults = [...aiWebResults, ...fallbackWebResults];
  const seen = new Set<string>();
  const uniqueResults = allWebResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const sources: SourceEvidence[] = uniqueResults
    .slice(0, 5)
    .filter((r) => r.snippet)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      relevance: "",
    }));

  // Send sources
  emit({ type: "sources", data: { sources, ragContext }, progress: 60 });

  // ═══ Step 3: Generate rebuttal — STREAMING ═══
  emit({ type: "step", step: "rebutting", label: "Viết bài phản biện...", progress: 65 });

  let rebuttal = "";
  try {
    rebuttal = await generateRebuttalStreaming(text, claims, sources, ragContext, emit);
  } catch (error) {
    console.error("[Pipeline] Step 3 (rebuttal) failed:", (error as Error).message);
    rebuttal = "Lỗi khi tạo bài phản biện: " + (error as Error).message;
    emit({ type: "error", data: { step: "rebutting", message: "Viết phản biện thất bại." } });
  }

  const result: AnalysisResult = { claims, sources, rebuttal, ragContext };
  emit({ type: "result", data: result, progress: 100 });
  return result;
}
