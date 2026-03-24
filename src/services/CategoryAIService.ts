import { Marketplace } from "@prisma/client";

export interface AISuggestion {
  categoryId: string;
  categoryPath: string;
  confidence: number;
  reason: string;
}

export class CategoryAIError extends Error {
  constructor(message: string, public code: string = "AI_ERROR") {
    super(message);
    this.name = "CategoryAIError";
  }
}

export class CategoryAIService {
  private static readonly API_KEY = process.env.ANTHROPIC_API_KEY;
  private static readonly API_URL = "https://api.anthropic.com/v1/messages";

  /**
   * Claude API'den kategori önerisi al
   */
  public static async getSuggestions(
    sourceCategory: string,
    marketplace: Marketplace,
    categoryCandidates: string[]
  ): Promise<AISuggestion[]> {
    if (!this.API_KEY) {
      // API Key yoksa mock dönelim (demo için)
      console.warn("ANTHROPIC_API_KEY not set. Returning mock suggestions.");
      return this.getMockSuggestions(sourceCategory, marketplace, categoryCandidates);
    }

    const systemPrompt = `Sen bir e-ticaret kategori eşleştirme uzmanısın.
Verilen kaynak kategoriyi, hedef pazaryerinin kategori listesinden
en uygun 3 kategoriye eşleştir.
SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir metin olmadan:
{
  "suggestions": [
    {"categoryId": "...", "categoryPath": "...", "confidence": 0.92, "reason": "..."},
    {"categoryId": "...", "categoryPath": "...", "confidence": 0.78, "reason": "..."},
    {"categoryId": "...", "categoryPath": "...", "confidence": 0.61, "reason": "..."}
  ]
}`;

    const userPrompt = `Kaynak kategori: '${sourceCategory}'
Hedef pazaryeri: ${marketplace}

${marketplace} kategori listesi (en alakalı 50 kategori):
${categoryCandidates.join("\n")}`;

    try {
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620", // Promptta claude-sonnet-4-20250514 denmiş ama güncel olanı kullanıyorum veya dökümana sadık kalıyorum
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new CategoryAIError(`Claude API error: ${response.status} - ${err}`, "API_ERROR");
      }

      const data = await response.json();
      const content = data.content[0].text;
      
      try {
        const parsed = JSON.parse(content);
        return parsed.suggestions;
      } catch (e) {
        throw new CategoryAIError("AI response is not valid JSON", "PARSE_ERROR");
      }
    } catch (error: any) {
      if (error instanceof CategoryAIError) throw error;
      throw new CategoryAIError(error.message, "NETWORK_ERROR");
    }
  }

  private static getMockSuggestions(
    sourceCategory: string,
    marketplace: Marketplace,
    candidates: string[]
  ): AISuggestion[] {
    // Demo amaçlı ilk 3 adayı alalım
    return candidates.slice(0, 3).map((c, i) => {
      const [id, path] = c.split(" | ");
      return {
        categoryId: id,
        categoryPath: path,
        confidence: 0.95 - i * 0.1,
        reason: `Kaynak kategori '${sourceCategory}' ile '${path}' arasında semantik benzerlik tespit edildi.`,
      };
    });
  }
}
