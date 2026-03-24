import { GoogleGenAI, Type } from "@google/genai";
import { Marketplace, CategoryMapping } from "../src/types";

export interface CategorySuggestion {
  category_id: string;
  category_path: string;
  confidence: number;
  reason: string;
}

export class CategoryEngine {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  /**
   * Döküman Bölüm 9.3: AI Prompt Yapısı
   */
  async suggestCategories(sourceCategory: string, marketplace: Marketplace, categoryTree: string[]): Promise<CategorySuggestion[]> {
    const systemInstruction = `
      Sen bir e-ticaret kategori eşleştirme uzmanısın.
      Görevin: verilen kaynak kategoriyi, hedef pazaryerinin resmi kategori ağacından en uygun 3 kategoriye eşleştirmek.
      Yanıtın SADECE belirtilen JSON formatında olmalı, başka hiçbir metin olmadan.
    `;

    const userPrompt = `
      Kaynak kategori: '${sourceCategory}'
      Hedef pazaryeri: ${marketplace}
      
      Aday Pazaryeri Kategorileri:
      ${categoryTree.join('\n')}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category_id: { type: Type.STRING },
                    category_path: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  },
                  required: ["category_id", "category_path", "confidence", "reason"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      });

      const result = JSON.parse(response.text || '{"suggestions": []}');
      return result.suggestions;
    } catch (error) {
      console.error("Category AI Suggestion Error:", error);
      return [];
    }
  }
}
