export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  // Try up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

      console.log(`[WebSearch] Attempt ${attempt} - Query: "${query}"`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(`[WebSearch] DuckDuckGo returned status ${response.status}`);
        if (attempt < 2) continue;
        return [];
      }

      const html = await response.text();
      const results = parseDuckDuckGoResults(html);
      console.log(`[WebSearch] Found ${results.length} results for "${query}"`);
      return results;
    } catch (error) {
      console.error(`[WebSearch] Attempt ${attempt} error:`, (error as Error).message);
      if (attempt < 2) {
        // Wait 1s before retry
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return [];
    }
  }
  return [];
}

function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match result blocks
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex =
    /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links = [...html.matchAll(resultRegex)];
  const snippets = [...html.matchAll(snippetRegex)];

  for (let i = 0; i < Math.min(links.length, 5); i++) {
    let url = links[i][1] || "";
    const title = stripHtml(links[i][2] || "");
    const snippet = stripHtml(snippets[i]?.[1] || "");

    // DuckDuckGo wraps URLs in a redirect
    const udMatch = url.match(/uddg=([^&]*)/);
    if (udMatch) {
      url = decodeURIComponent(udMatch[1]);
    }

    if (title && url && !url.includes("duckduckgo.com")) {
      results.push({ title, snippet, url });
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    console.log(`[WebSearch] Fetching page: ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AITuTuong/1.0; +https://example.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[WebSearch] Fetch failed for ${url}: ${response.status}`);
      return "";
    }

    const html = await response.text();

    // Extract main content - remove scripts, styles, nav, etc.
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "");

    text = stripHtml(text);

    // Limit to first 2000 chars
    return text.substring(0, 2000);
  } catch (error) {
    console.warn(`[WebSearch] Fetch error for ${url}:`, (error as Error).message);
    return "";
  }
}
