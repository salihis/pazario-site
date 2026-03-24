import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Image,
  Dimensions
} from 'react-native';
import { 
  Text, 
  Title, 
  Subheading, 
  Button, 
  Searchbar, 
  Card, 
  Badge, 
  ProgressBar, 
  Divider,
  Portal,
  Modal,
  TextInput,
  Checkbox,
  IconButton,
  ActivityIndicator,
  Chip
} from 'react-native-paper';
import { Marketplace } from '@prisma/client';

const { width } = Dimensions.get('window');

// --- Types ---
interface Category {
  id: string;
  name: string;
  productCount: number;
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

const MarketplacePublishScreen: React.FC = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace>(Marketplace.TRENDYOL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAttributeModalVisible, setIsAttributeModalVisible] = useState(false);

  // 1. Fetch Products
  useEffect(() => {
    if (selectedCategory) {
      fetchProducts();
    }
  }, [selectedCategory, selectedMarketplace]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/products?categoryMappingId=${selectedCategory}&marketplace=${selectedMarketplace}`);
      const data = await res.json();
      
      // Get completeness
      const pIds = data.data.slice(0, 10).map((p: any) => p.id);
      const compRes = await fetch(`/api/v1/products/attributes/completeness?marketplace=${selectedMarketplace}&productIds=${pIds.join(',')}`);
      const compData = await compRes.json();

      setProducts(data.data.slice(0, 10).map((p: any) => {
        const comp = compData.find((c: any) => c.productId === p.id);
        return {
          ...p,
          completenessPercent: comp?.completenessPercent || 0,
          publishStatus: 'none'
        };
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (productId: string) => {
    try {
      const res = await fetch('/api/v1/publish/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: selectedMarketplace,
          productIds: [productId]
        })
      });
      const data = await res.json();
      if (data.success) {
        // Update local status to POLLING
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, publishStatus: 'POLLING' } : p));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Marketplace Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.values(Marketplace).map((m) => (
            <Chip
              key={m}
              selected={selectedMarketplace === m}
              onPress={() => setSelectedMarketplace(m)}
              style={styles.chip}
              mode="outlined"
            >
              {m}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* 2. Category Selection (Horizontal) */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['1', '2', '3'].map((id) => (
            <TouchableOpacity 
              key={id} 
              onPress={() => setSelectedCategory(id)}
              style={[
                styles.categoryCard, 
                selectedCategory === id && styles.categoryCardSelected
              ]}
            >
              <Text style={[styles.categoryText, selectedCategory === id && styles.categoryTextSelected]}>
                Kategori {id}
              </Text>
              <Badge size={18} style={styles.badge}>{Math.floor(Math.random() * 20)}</Badge>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. Search Bar */}
      <Searchbar
        placeholder="Ürün ara..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* 4. Product List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.productCard} onPress={() => {
              setSelectedProduct(item);
              setIsAttributeModalVisible(true);
            }}>
              <View style={styles.cardRow}>
                <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                <View style={styles.productInfo}>
                  <Title numberOfLines={1} style={styles.productTitle}>{item.title}</Title>
                  <Text style={styles.skuText}>SKU: {item.sku}</Text>
                  <View style={styles.progressRow}>
                    <ProgressBar 
                      progress={item.completenessPercent / 100} 
                      color={item.completenessPercent === 100 ? '#4CAF50' : '#FF9800'} 
                      style={styles.progressBar} 
                    />
                    <Text style={styles.progressText}>%{item.completenessPercent}</Text>
                  </View>
                </View>
                <View style={styles.actionColumn}>
                  {item.completenessPercent === 100 ? (
                    <IconButton 
                      icon="cloud-upload" 
                      iconColor="#2196F3" 
                      size={24} 
                      onPress={() => handlePublish(item.id)} 
                    />
                  ) : (
                    <IconButton icon="alert-circle" iconColor="#F44336" size={24} />
                  )}
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* 5. Attribute Editor Modal */}
      <Portal>
        <Modal 
          visible={isAttributeModalVisible} 
          onDismiss={() => setIsAttributeModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            <Title>Özellikleri Düzenle</Title>
            <Subheading>{selectedProduct?.title}</Subheading>
            <Divider style={styles.divider} />
            
            {/* Mock Attributes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Renk *</Text>
              <TextInput mode="outlined" placeholder="Seçiniz" dense />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Beden *</Text>
              <TextInput mode="outlined" placeholder="Seçiniz" dense />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Materyal</Text>
              <TextInput mode="outlined" placeholder="Girin" dense />
            </View>

            <Button 
              mode="contained" 
              style={styles.saveButton}
              onPress={() => setIsAttributeModalVisible(false)}
            >
              Kaydet
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    padding: 10,
    backgroundColor: '#fff',
  },
  chip: {
    marginRight: 8,
  },
  categoryContainer: {
    padding: 10,
  },
  categoryCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  categoryCardSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  categoryTextSelected: {
    color: '#2196F3',
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#ddd',
  },
  searchBar: {
    margin: 10,
    elevation: 2,
    borderRadius: 8,
  },
  listContent: {
    padding: 10,
  },
  productCard: {
    marginBottom: 10,
    borderRadius: 12,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  skuText: {
    fontSize: 12,
    color: '#888',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    marginLeft: 8,
    color: '#666',
    width: 30,
  },
  actionColumn: {
    marginLeft: 10,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  divider: {
    marginVertical: 10,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#444',
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 8,
  }
});

export default MarketplacePublishScreen;
