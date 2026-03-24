import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Layout, 
  Tabs, 
  List, 
  Card, 
  Badge, 
  Progress, 
  Button, 
  Checkbox, 
  Input, 
  Space, 
  Typography,
  Divider,
  Empty,
  Spin,
  message,
  Drawer,
  Tag
} from 'antd';
import { 
  SearchOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  SyncOutlined,
  CloudUploadOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { Marketplace } from '@prisma/client';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;

// --- Types ---
interface Category {
  id: string;
  name: string;
  productCount: number;
  readyCount: number;
  missingCount: number;
}

interface Product {
  id: string;
  title: string;
  sku: string;
  images: string[];
  completenessPercent: number;
  publishStatus?: string;
}

// --- Components ---

const CategoryPublishPage: React.FC = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace>(Marketplace.TRENDYOL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();

  // 1. Categories Query
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['category-mappings', selectedMarketplace],
    queryFn: async () => {
      const res = await fetch(`/api/v1/category-mappings?status=APPROVED&marketplace=${selectedMarketplace}`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      // Mocking counts for now
      return data.map((c: any) => ({
        id: c.marketplaceCategoryId,
        name: c.marketplaceCategoryPath || c.sourceCategory,
        productCount: Math.floor(Math.random() * 50) + 10,
        readyCount: Math.floor(Math.random() * 10),
        missingCount: Math.floor(Math.random() * 5),
      }));
    }
  });

  // 2. Products Query
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', selectedCategory, selectedMarketplace],
    enabled: !!selectedCategory,
    queryFn: async () => {
      const res = await fetch(`/api/v1/products?categoryMappingId=${selectedCategory}&marketplace=${selectedMarketplace}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      
      // Get completeness for these products
      const pIds = data.data.slice(0, 20).map((p: any) => p.id);
      const compRes = await fetch(`/api/v1/products/attributes/completeness?marketplace=${selectedMarketplace}&productIds=${pIds.join(',')}`);
      const compData = await compRes.json();

      return data.data.slice(0, 20).map((p: any) => {
        const comp = compData.find((c: any) => c.productId === p.id);
        return {
          ...p,
          completenessPercent: comp?.completenessPercent || 0,
          publishStatus: 'none'
        };
      });
    }
  });

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((c: Category) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [categories, searchQuery]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', background: '#f0f2f5' }}>
      {/* 1. Category Sidebar */}
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #e8e8e8' }}>
        <div style={{ padding: '16px' }}>
          <Tabs 
            activeKey={selectedMarketplace} 
            onChange={(key) => setSelectedMarketplace(key as Marketplace)}
            size="small"
          >
            <Tabs.TabPane tab="Trendyol" key={Marketplace.TRENDYOL} />
            <Tabs.TabPane tab="HB" key={Marketplace.HEPSIBURADA} />
            <Tabs.TabPane tab="N11" key={Marketplace.N11} />
            <Tabs.TabPane tab="Pazarama" key={Marketplace.PAZARAMA} />
          </Tabs>
          <Input 
            prefix={<SearchOutlined />} 
            placeholder="Kategori ara..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginTop: '12px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', height: 'calc(100% - 120px)' }}>
          <List
            dataSource={filteredCategories}
            loading={categoriesLoading}
            renderItem={(item: Category) => (
              <List.Item 
                onClick={() => setSelectedCategory(item.id)}
                style={{ 
                  cursor: 'pointer', 
                  padding: '12px 16px',
                  background: selectedCategory === item.id ? '#e6f7ff' : 'transparent',
                  borderLeft: selectedCategory === item.id ? '4px solid #1890ff' : '4px solid transparent'
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong ellipsis style={{ maxWidth: '180px' }}>{item.name}</Text>
                    <Badge count={item.productCount} color="#bfbfbf" size="small" />
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    <Tag color="success" style={{ margin: 0 }}>{item.readyCount} Hazır</Tag>
                    <Tag color="warning" style={{ marginLeft: '4px' }}>{item.missingCount} Eksik</Tag>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Sider>

      {/* 2. Product List */}
      <Content style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {selectedCategory ? (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
              <Title level={4} style={{ margin: 0 }}>{categories?.find(c => c.id === selectedCategory)?.name}</Title>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Checkbox 
                    checked={selectedProductIds.length === products?.length && products?.length > 0}
                    indeterminate={selectedProductIds.length > 0 && selectedProductIds.length < products?.length}
                    onChange={(e) => setSelectedProductIds(e.target.checked ? products.map((p: any) => p.id) : [])}
                  />
                  <Text type="secondary">{selectedProductIds.length} ürün seçildi</Text>
                  {selectedProductIds.length > 0 && (
                    <Space>
                      <Button size="small" icon={<AppstoreOutlined />}>Toplu Özellik</Button>
                      <Button size="small" type="primary" icon={<CloudUploadOutlined />}>Gönder</Button>
                    </Space>
                  )}
                </Space>
                <Space>
                  <Button icon={<SyncOutlined />} size="small" />
                </Space>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={products}
                loading={productsLoading}
                renderItem={(item: Product) => (
                  <List.Item style={{ padding: 0, marginBottom: '12px' }}>
                    <Card 
                      size="small" 
                      hoverable 
                      onClick={() => handleSelectProduct(item)}
                      style={{ 
                        border: selectedProduct?.id === item.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                        boxShadow: selectedProduct?.id === item.id ? '0 0 8px rgba(24,144,255,0.1)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox 
                          checked={selectedProductIds.includes(item.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedProductIds(prev => 
                              e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                            );
                          }}
                          style={{ marginRight: '12px' }}
                        />
                        <img 
                          src={item.images[0]} 
                          alt={item.title} 
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', marginRight: '12px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <Text strong ellipsis style={{ display: 'block', maxWidth: '400px' }}>{item.title}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>SKU: {item.sku}</Text>
                        </div>
                        <div style={{ width: '120px', marginRight: '24px' }}>
                          <Progress 
                            percent={item.completenessPercent} 
                            size="small" 
                            strokeColor={
                              item.completenessPercent === 100 ? '#52c41a' : 
                              item.completenessPercent >= 70 ? '#faad14' : 
                              item.completenessPercent >= 50 ? '#ff7a45' : '#f5222d'
                            }
                          />
                        </div>
                        <div style={{ width: '80px' }}>
                          {item.publishStatus === 'SUCCESS' && <Tag color="success">Yayında</Tag>}
                          {item.publishStatus === 'FAILED' && <Tag color="error">Hata</Tag>}
                          {item.publishStatus === 'POLLING' && <Tag color="processing" icon={<SyncOutlined spin />}>Gönderiliyor</Tag>}
                        </div>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </>
        ) : (
          <Empty description="Lütfen bir kategori seçin" style={{ marginTop: '100px' }} />
        )}
      </Content>

      {/* 3. Attribute Form Panel */}
      <Sider width={420} theme="light" style={{ borderLeft: '1px solid #e8e8e8', padding: '16px' }}>
        {selectedProduct ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <img 
                src={selectedProduct.images[0]} 
                alt={selectedProduct.title} 
                style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', marginRight: '12px' }}
              />
              <div style={{ flex: 1 }}>
                <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{selectedProduct.title}</Title>
                <Text type="secondary">SKU: {selectedProduct.sku}</Text>
              </div>
            </div>
            
            <Tabs defaultActiveKey="mandatory" size="small">
              <Tabs.TabPane 
                tab={<span>Zorunlu <Badge count={2} size="small" style={{ backgroundColor: '#ff4d4f' }} /></span>} 
                key="mandatory"
              >
                <AttributeForm productId={selectedProduct.id} marketplace={selectedMarketplace} categoryId={selectedCategory!} type="mandatory" />
              </Tabs.TabPane>
              <Tabs.TabPane tab="Opsiyonel" key="optional">
                <AttributeForm productId={selectedProduct.id} marketplace={selectedMarketplace} categoryId={selectedCategory!} type="optional" />
              </Tabs.TabPane>
              <Tabs.TabPane tab="Geçmiş" key="history">
                <Empty description="Henüz geçmiş bulunmuyor" />
              </Tabs.TabPane>
            </Tabs>
          </div>
        ) : (
          <Empty description="Lütfen bir ürün seçin" style={{ marginTop: '100px' }} />
        )}
      </Sider>
    </Layout>
  );
};

// --- Sub-components ---

const AttributeForm: React.FC<{ productId: string; marketplace: Marketplace; categoryId: string; type: 'mandatory' | 'optional' }> = ({ productId, marketplace, categoryId, type }) => {
  const { data: attributes, isLoading } = useQuery({
    queryKey: ['attributes', marketplace, categoryId, productId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/category-attributes/${marketplace}/${categoryId}?productId=${productId}`);
      if (!res.ok) throw new Error('Failed to fetch attributes');
      const data = await res.json();
      return data.attributes.filter((a: any) => type === 'mandatory' ? a.isMandatory : !a.isMandatory);
    }
  });

  if (isLoading) return <Spin style={{ width: '100%', marginTop: '20px' }} />;

  return (
    <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 350px)', paddingRight: '8px' }}>
      {attributes?.map((attr: any) => (
        <div key={attr.attributeId} style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '4px' }}>
            <Text strong>{attr.attributeName}</Text>
            {attr.isMandatory && <Text type="danger"> *</Text>}
          </div>
          <AttributeInput attribute={attr} />
          {attr.validationError && <Text type="danger" style={{ fontSize: '12px' }}>{attr.validationError}</Text>}
        </div>
      ))}
      <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
        <Button type="primary" block>Kaydet</Button>
        <Button block>Kaydet & Sonraki</Button>
      </div>
    </div>
  );
};

const AttributeInput: React.FC<{ attribute: any }> = ({ attribute }) => {
  const { attributeType, values, currentValue } = attribute;

  switch (attributeType) {
    case 'dropdown':
      return (
        <select 
          className="ant-input" 
          defaultValue={currentValue || ''}
          style={{ width: '100%' }}
        >
          <option value="">Seçiniz</option>
          {values.map((v: any) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      );
    case 'boolean':
      return <Checkbox defaultChecked={currentValue === true}>Evet / Hayır</Checkbox>;
    case 'number':
      return <Input type="number" defaultValue={currentValue} placeholder="Sayı giriniz" />;
    default:
      return <Input defaultValue={currentValue} placeholder="Değer giriniz" />;
  }
};

export default CategoryPublishPage;
