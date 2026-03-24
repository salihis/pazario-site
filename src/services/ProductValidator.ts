import { ProductData } from './XMLParser';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ProductValidator {
  async validate(product: ProductData): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!product.id) errors.push('Product ID is missing');
    if (!product.name) errors.push('Product name is missing');
    if (product.price <= 0) errors.push('Product price must be greater than zero');
    if (product.stock < 0) errors.push('Product stock cannot be negative');
    if (!product.category) errors.push('Product category is missing');
    if (product.images.length === 0) errors.push('Product must have at least one image');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
