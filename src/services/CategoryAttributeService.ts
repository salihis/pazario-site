import { PrismaClient, Marketplace, AttributeType } from '@prisma/client';

const prisma = new PrismaClient();

export interface Attribute {
  attributeId: string;
  attributeName: string;
  attributeType: AttributeType;
  isMandatory: boolean;
  allowCustomValue: boolean;
  values: { id: string; name: string }[];
  validationRules: { min?: number; max?: number; maxLength?: number; pattern?: string };
  displayOrder: number;
}

export interface FormField extends Attribute {
  currentValue: string | string[] | boolean | null; // ürünün mevcut değeri
  isValid: boolean;
  validationError: string | null;
}

export class CategoryAttributeService {
  /**
   * Pazaryeri kategori özelliklerini önbellekten veya API'den getirir.
   */
  async getAttributes(marketplace: Marketplace, categoryId: string, productId?: string): Promise<FormField[]> {
    // 1. marketplace_category_attributes tablosunu sorgula
    const cached = await prisma.marketplaceCategoryAttribute.findMany({
      where: { marketplace, categoryId },
      orderBy: { displayOrder: 'asc' },
    });

    let attributes: Attribute[] = [];

    if (cached.length > 0) {
      // 2. Sonuç varsa:
      const fetchedAt = cached[0].fetchedAt;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (fetchedAt < sevenDaysAgo) {
        // b. fetchedAt >= 7 gün → döndür + arka planda refreshFromAPI() tetikle
        this.refreshFromAPI(marketplace, categoryId).catch(console.error);
      }
      
      attributes = cached.map(attr => ({
        attributeId: attr.attributeId,
        attributeName: attr.attributeName,
        attributeType: attr.attributeType,
        isMandatory: attr.isMandatory,
        allowCustomValue: attr.allowCustomValue,
        values: (attr.values as any) || [],
        validationRules: (attr.validationRules as any) || {},
        displayOrder: attr.displayOrder,
      }));
    } else {
      // 3. Sonuç yoksa → refreshFromAPI() await et, sonra döndür
      attributes = await this.refreshFromAPI(marketplace, categoryId);
    }

    // 4. productId verilmişse → product_attributes'tan mevcut değerleri ekle (currentValue)
    let productAttributes: any[] = [];
    if (productId) {
      productAttributes = await prisma.productAttribute.findMany({
        where: { productId, marketplace },
      });
    }

    return this.buildFormSchema(attributes, productAttributes);
  }

  /**
   * API'den kategori özelliklerini çeker ve DB'yi günceller.
   */
  async refreshFromAPI(marketplace: Marketplace, categoryId: string): Promise<Attribute[]> {
    let apiAttributes: any[] = [];

    try {
      switch (marketplace) {
        case Marketplace.TRENDYOL:
          apiAttributes = await this.fetchTrendyolAttributes(categoryId);
          break;
        case Marketplace.HEPSIBURADA:
          apiAttributes = await this.fetchHepsiburadaAttributes(categoryId);
          break;
        case Marketplace.N11:
          apiAttributes = await this.fetchN11Attributes(categoryId);
          break;
        case Marketplace.PAZARAMA:
          apiAttributes = await this.fetchPazaramaAttributes(categoryId);
          break;
        default:
          apiAttributes = [];
      }
    } catch (error) {
      console.error(`Error fetching attributes for ${marketplace} category ${categoryId}:`, error);
      // If API fails, we return empty or throw depending on requirements
      return [];
    }

    const normalized: Attribute[] = apiAttributes.map((attr, index) => ({
      attributeId: attr.id.toString(),
      attributeName: attr.name,
      attributeType: this.mapAttributeType(attr.type, marketplace),
      isMandatory: !!attr.required,
      allowCustomValue: !!attr.allowCustomValue,
      values: attr.values || [],
      validationRules: attr.rules || {},
      displayOrder: index,
    }));

    // Prisma upsert ile marketplace_category_attributes'a yaz
    for (const attr of normalized) {
      await prisma.marketplaceCategoryAttribute.upsert({
        where: {
          marketplace_categoryId_attributeId: {
            marketplace,
            categoryId,
            attributeId: attr.attributeId,
          },
        },
        update: {
          attributeName: attr.attributeName,
          attributeType: attr.attributeType,
          isMandatory: attr.isMandatory,
          allowCustomValue: attr.allowCustomValue,
          values: attr.values as any,
          validationRules: attr.validationRules as any,
          displayOrder: attr.displayOrder,
          fetchedAt: new Date(),
        },
        create: {
          marketplace,
          categoryId,
          attributeId: attr.attributeId,
          attributeName: attr.attributeName,
          attributeType: attr.attributeType,
          isMandatory: attr.isMandatory,
          allowCustomValue: attr.allowCustomValue,
          values: attr.values as any,
          validationRules: attr.validationRules as any,
          displayOrder: attr.displayOrder,
          fetchedAt: new Date(),
        },
      });
    }

    return normalized;
  }

  /**
   * FormField[] döndür: her attribute'a productAttributes'tan currentValue ekle
   */
  buildFormSchema(attributes: Attribute[], productAttributes: any[]): FormField[] {
    return attributes.map(attr => {
      const saved = productAttributes.find(pa => pa.attributeId === attr.attributeId);
      let currentValue: any = null;

      if (saved) {
        if (attr.attributeType === AttributeType.multi_select) {
          currentValue = saved.valueId ? saved.valueId.split(',') : (saved.valueText ? JSON.parse(saved.valueText) : []);
        } else if (attr.attributeType === AttributeType.boolean) {
          currentValue = saved.valueText === 'true';
        } else {
          currentValue = saved.valueId || saved.valueText;
        }
      }

      const validation = this.validateValue(attr, currentValue);

      return {
        ...attr,
        currentValue,
        isValid: validation.isValid,
        validationError: validation.error,
      };
    });
  }

  /**
   * Değer doğrulaması yapar.
   */
  validateValue(attribute: Attribute, value: any): { isValid: boolean; error: string | null } {
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

    if (attribute.isMandatory && isEmpty) {
      return { isValid: false, error: 'Bu alan zorunludur' };
    }

    if (isEmpty) return { isValid: true, error: null };

    if (attribute.attributeType === AttributeType.number) {
      const num = Number(value);
      if (isNaN(num)) return { isValid: false, error: 'Geçersiz sayı' };
      if (attribute.validationRules.min !== undefined && num < attribute.validationRules.min) {
        return { isValid: false, error: `En az ${attribute.validationRules.min} olmalı` };
      }
      if (attribute.validationRules.max !== undefined && num > attribute.validationRules.max) {
        return { isValid: false, error: `En fazla ${attribute.validationRules.max} olmalı` };
      }
    }

    if (typeof value === 'string' && attribute.validationRules.maxLength !== undefined && value.length > attribute.validationRules.maxLength) {
      return { isValid: false, error: `En fazla ${attribute.validationRules.maxLength} karakter` };
    }

    if (attribute.attributeType === AttributeType.dropdown && attribute.values.length > 0) {
      const exists = attribute.values.some(v => v.id === value);
      if (!exists && !attribute.allowCustomValue) {
        return { isValid: false, error: 'Geçersiz değer' };
      }
    }

    return { isValid: true, error: null };
  }

  // --- API Fetchers (Mocks for now) ---

  private async fetchTrendyolAttributes(categoryId: string): Promise<any[]> {
    // GET /integration/product/product-categories/{categoryId}/attributes
    // Mock response
    return [
      { id: '1', name: 'Renk', type: 'dropdown', required: true, values: [{ id: 'red', name: 'Kırmızı' }, { id: 'blue', name: 'Mavi' }] },
      { id: '2', name: 'Beden', type: 'dropdown', required: true, values: [{ id: 'S', name: 'Small' }, { id: 'M', name: 'Medium' }] },
    ];
  }

  private async fetchHepsiburadaAttributes(categoryId: string): Promise<any[]> {
    // GET /product/api/categories/{categoryId}/attributes
    return [
      { id: 'h1', name: 'Materyal', type: 'dropdown', required: false, values: [{ id: 'cotton', name: 'Pamuk' }] },
    ];
  }

  private async fetchN11Attributes(categoryId: string): Promise<any[]> {
    // GET /cdn/category/{categoryId}/attribute
    return [
      { id: 'n1', name: 'Garanti Süresi', type: 'number', required: true, rules: { min: 0, max: 24 } },
    ];
  }

  private async fetchPazaramaAttributes(categoryId: string): Promise<any[]> {
    // GET /category/getCategoryTree (ağaçtan filtrele)
    return [
      { id: 'p1', name: 'Açıklama', type: 'free_text', required: false },
    ];
  }

  private mapAttributeType(apiType: string, marketplace: Marketplace): AttributeType {
    // Simple mapping logic
    switch (apiType.toLowerCase()) {
      case 'dropdown': return AttributeType.dropdown;
      case 'multi_select': return AttributeType.multi_select;
      case 'number': return AttributeType.number;
      case 'boolean': return AttributeType.boolean;
      case 'color': return AttributeType.color;
      default: return AttributeType.free_text;
    }
  }
}
