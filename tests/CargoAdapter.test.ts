import { describe, it, expect } from 'vitest';
import { BaseCargoAdapter } from '../src/adapters/cargo/BaseCargoAdapter.js';

describe('BaseCargoAdapter', () => {
  it('should calculate desi correctly', () => {
    const product = { width: 20, height: 30, depth: 10 };
    const desi = BaseCargoAdapter.calculateDesi(product);
    // (20 * 30 * 10) / 3000 = 6000 / 3000 = 2
    expect(desi).toBe(2);
  });

  it('should return default desi if dimensions are missing', () => {
    process.env.DEFAULT_DESI = '1';
    const product = { weight: 5 };
    const desi = BaseCargoAdapter.calculateDesi(product);
    expect(desi).toBe(1);
  });

  it('should return at least 1 desi', () => {
    const product = { width: 5, height: 5, depth: 5 };
    const desi = BaseCargoAdapter.calculateDesi(product);
    // (5 * 5 * 5) / 3000 = 125 / 3000 = 0.0416
    expect(desi).toBe(1);
  });
});
