import { Marketplace } from '@prisma/client';
import { BaseAdapter } from './BaseAdapter';
import { TrendyolAdapter } from './TrendyolAdapter';
import { HepsiburadaAdapter } from './HepsiburadaAdapter';
import { N11Adapter } from './N11Adapter';
import { PazaramaAdapter } from './PazaramaAdapter';
import { AmazonAdapter } from './AmazonAdapter';

export class AdapterFactory {
  static getAdapter(marketplace: Marketplace): BaseAdapter {
    switch (marketplace) {
      case Marketplace.TRENDYOL:
        return new TrendyolAdapter();
      case Marketplace.HEPSIBURADA:
        return new HepsiburadaAdapter();
      case Marketplace.N11:
        return new N11Adapter();
      case Marketplace.PAZARAMA:
        return new PazaramaAdapter({
          clientId: process.env.PAZARAMA_API_KEY || '',
          clientSecret: process.env.PAZARAMA_API_SECRET || '',
        });
      case Marketplace.AMAZON:
        return new AmazonAdapter();
      default:
        throw new Error(`Unsupported marketplace: ${marketplace}`);
    }
  }
}
