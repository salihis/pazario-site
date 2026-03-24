import { PrismaClient, Marketplace, CargoCompany } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed işlemi başlatılıyor...');

  // 1. global_price_settings
  try {
    await prisma.globalPriceSettings.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' }, // Singleton ID
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        minPrice: 50,
        currency: 'TRY',
        updatedBy: 'SYSTEM'
      }
    });
    console.log('Global fiyat ayarları seed edildi.');
  } catch (error) {
    console.error('Global fiyat ayarları seed hatası:', error);
  }

  // 2. cargo_company_mappings
  const cargoMappings = [
    // Aras
    { cargoCompany: CargoCompany.ARAS, marketplace: Marketplace.TRENDYOL, marketplaceCargoCode: 'ARAS', marketplaceCargoName: 'Aras Kargo' },
    { cargoCompany: CargoCompany.ARAS, marketplace: Marketplace.HEPSIBURADA, marketplaceCargoCode: 'ArasKargo', marketplaceCargoName: 'Aras Kargo' },
    { cargoCompany: CargoCompany.ARAS, marketplace: Marketplace.N11, marketplaceCargoCode: '10', marketplaceCargoName: 'Aras Kargo' },
    { cargoCompany: CargoCompany.ARAS, marketplace: Marketplace.PAZARAMA, marketplaceCargoCode: 'ARAS', marketplaceCargoName: 'Aras Kargo' },
    // Yurtiçi
    { cargoCompany: CargoCompany.YURTICI, marketplace: Marketplace.TRENDYOL, marketplaceCargoCode: 'YURTICI', marketplaceCargoName: 'Yurtiçi Kargo' },
    { cargoCompany: CargoCompany.YURTICI, marketplace: Marketplace.HEPSIBURADA, marketplaceCargoCode: 'YurticiKargo', marketplaceCargoName: 'Yurtiçi Kargo' },
    { cargoCompany: CargoCompany.YURTICI, marketplace: Marketplace.N11, marketplaceCargoCode: '12', marketplaceCargoName: 'Yurtiçi Kargo' },
    { cargoCompany: CargoCompany.YURTICI, marketplace: Marketplace.PAZARAMA, marketplaceCargoCode: 'YK', marketplaceCargoName: 'Yurtiçi Kargo' },
    // Sürat
    { cargoCompany: CargoCompany.SURAT, marketplace: Marketplace.TRENDYOL, marketplaceCargoCode: 'SURAT', marketplaceCargoName: 'Sürat Kargo' },
    { cargoCompany: CargoCompany.SURAT, marketplace: Marketplace.HEPSIBURADA, marketplaceCargoCode: 'SuratKargo', marketplaceCargoName: 'Sürat Kargo' },
    { cargoCompany: CargoCompany.SURAT, marketplace: Marketplace.N11, marketplaceCargoCode: '6', marketplaceCargoName: 'Sürat Kargo' },
    { cargoCompany: CargoCompany.SURAT, marketplace: Marketplace.PAZARAMA, marketplaceCargoCode: 'SURAT', marketplaceCargoName: 'Sürat Kargo' },
    // PTT
    { cargoCompany: CargoCompany.PTT, marketplace: Marketplace.TRENDYOL, marketplaceCargoCode: 'PTT', marketplaceCargoName: 'PTT Kargo' },
    { cargoCompany: CargoCompany.PTT, marketplace: Marketplace.HEPSIBURADA, marketplaceCargoCode: 'PttKargo', marketplaceCargoName: 'PTT Kargo' },
    { cargoCompany: CargoCompany.PTT, marketplace: Marketplace.N11, marketplaceCargoCode: '8', marketplaceCargoName: 'PTT Kargo' },
    { cargoCompany: CargoCompany.PTT, marketplace: Marketplace.PAZARAMA, marketplaceCargoCode: 'PTT', marketplaceCargoName: 'PTT Kargo' },
  ];

  for (const mapping of cargoMappings) {
    try {
      await prisma.cargoCompanyMapping.upsert({
        where: {
          cargoCompany_marketplace: {
            cargoCompany: mapping.cargoCompany,
            marketplace: mapping.marketplace
          }
        },
        update: mapping,
        create: mapping
      });
    } catch (error) {
      console.error(`Kargo eşleştirme seed hatası (${mapping.cargoCompany} - ${mapping.marketplace}):`, error);
    }
  }
  console.log('Kargo eşleştirmeleri seed edildi.');

  // 3. users (SUPER_ADMIN)
  try {
    const hashedPassword = await bcrypt.hash('Admin123!@#', 10);
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Süper admin kullanıcısı seed edildi.');
  } catch (error) {
    console.error('Kullanıcı seed hatası:', error);
  }

  // 4. xml_sources örnek kayıt
  try {
    await prisma.xmlSource.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' }, // Örnek ID
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Tedarikçi A (Örnek)',
        url: 'https://example.com/feed.xml',
        active: false
      }
    });
    console.log('Örnek XML kaynağı seed edildi.');
  } catch (error) {
    console.error('XML kaynağı seed hatası:', error);
  }

  console.log('Seed işlemi tamamlandı.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
