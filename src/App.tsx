/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  ShoppingCart, 
  AlertCircle, 
  ChevronRight, 
  Search, 
  Filter,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowRight,
  Printer,
  FileText,
  User,
  MapPin,
  Phone,
  Mail,
  X,
  ExternalLink,
  ChevronDown,
  Calendar,
  CloudUpload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Marketplace, OrderStatus, Order, OrderItem } from './types/index';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';
import { 
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation
} from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import CategoryPublishPage from './pages/CategoryPublishPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Router>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/publish" element={<CategoryPublishPage />} />
        <Route path="/app/*" element={<AppContent />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'publish' | 'dashboard' | 'settings'>('products');
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace>(Marketplace.TRENDYOL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [pricePreview, setPricePreview] = useState<any | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [pendingMappings, setPendingMappings] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [orderMarketplaceFilter, setOrderMarketplaceFilter] = useState<Marketplace | 'ALL'>('ALL');

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (orderStatusFilter !== 'ALL') params.append('status', orderStatusFilter);
      if (orderMarketplaceFilter !== 'ALL') params.append('marketplace', orderMarketplaceFilter);
      if (orderSearch) params.append('search', orderSearch);

      const response = await fetch(`/api/v1/orders?${params.toString()}`);
      const data = await response.json();
      setOrders(data.data);
    } catch (error) {
      console.error('Fetch orders failed:', error);
      toast.error('Siparişler yüklenirken bir hata oluştu.');
    }
  };

  const handleSyncOrders = async () => {
    setIsSyncingOrders(true);
    const toastId = toast.loading('Siparişler senkronize ediliyor...');
    try {
      const response = await fetch('/api/v1/orders/sync', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success('Siparişler başarıyla senkronize edildi.', { id: toastId });
      } else {
        toast.error('Senkronizasyon hatası: ' + data.error, { id: toastId });
      }
      await fetchOrders();
    } catch (error) {
      console.error('Sync orders failed:', error);
      toast.error('Senkronizasyon sırasında bir ağ hatası oluştu.', { id: toastId });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string, note?: string) => {
    const toastId = toast.loading('Durum güncelleniyor...');
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Sipariş durumu güncellendi.', { id: toastId });
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data);
        }
        await fetchOrders();
      } else {
        toast.error('Hata: ' + data.error, { id: toastId });
      }
    } catch (error) {
      console.error('Update status failed:', error);
      toast.error('Durum güncellenirken bir hata oluştu.', { id: toastId });
    }
  };

  const handleGenerateLabel = async (orderId: string) => {
    const toastId = toast.loading('Kargo barkodu oluşturuluyor...');
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/label`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        toast.success('Kargo barkodu başarıyla oluşturuldu.', { id: toastId });
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data);
        }
        await fetchOrders();
      } else {
        toast.error('Hata: ' + data.error, { id: toastId });
      }
    } catch (error) {
      console.error('Label generation failed:', error);
      toast.error('Barkod oluşturulurken bir hata oluştu.', { id: toastId });
    }
  };

  const fetchPendingMappings = async () => {
    try {
      const response = await fetch('/api/v1/category-mappings/pending');
      const data = await response.json();
      setPendingMappings(data.data);
    } catch (error) {
      console.error('Fetch pending mappings failed:', error);
    }
  };

  const handleSuggest = async (sourceCategory: string) => {
    setIsSuggesting(true);
    try {
      const response = await fetch('/api/v1/category-mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCategory: sourceCategory, marketplace: selectedMarketplace })
      });
      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleApprove = async (mappingId: string, suggestion: any) => {
    try {
      await fetch(`/api/v1/category-mappings/${mappingId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceCategoryId: suggestion.categoryId,
          marketplaceCategoryPath: suggestion.categoryPath
        })
      });
      fetchPendingMappings();
      setSuggestions([]);
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const fetchPricePreview = async (productId: string) => {
    setIsLoadingPrice(true);
    try {
      const response = await fetch(`/api/v1/price-rules/preview/${productId}`);
      const data = await response.json();
      setPricePreview(data);
    } catch (error) {
      console.error('Price preview failed:', error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    fetchPricePreview(product.id);
  };

  // Initial load
  React.useEffect(() => {
    fetchPendingMappings();
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab, orderStatusFilter, orderMarketplaceFilter, orderSearch]);

  // Mock data for demonstration based on doc
  const categories = [
    { id: '1', name: 'Elektronik > Cep Telefonu', count: 47 },
    { id: '2', name: 'Elektronik > Bilgisayar', count: 12 },
    { id: '3', name: 'Ev & Yaşam > Mutfak', count: 85 },
  ];

  const products = [
    { id: 'SKU-001', title: 'iPhone 15 Pro 256GB', price: 72000, stock: 15, completeness: 100, status: 'published' },
    { id: 'SKU-002', title: 'Samsung Galaxy S24 Ultra', price: 68000, stock: 8, completeness: 85, status: 'pending' },
    { id: 'SKU-003', title: 'Xiaomi 14 Pro', price: 45000, stock: 0, completeness: 40, status: 'failed' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-8 border-r border-slate-800">
        <Link to="/" className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
          P.i
        </Link>
        <nav className="flex flex-col gap-4">
          <NavIcon icon={<LayoutDashboard size={24} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Panel" />
          <NavIcon icon={<Package size={24} />} active={activeTab === 'products'} onClick={() => setActiveTab('products')} label="Ürünler" />
          <NavIcon icon={<CloudUpload size={24} />} active={activeTab === 'publish'} onClick={() => setActiveTab('publish')} label="Yayınla" />
          <NavIcon icon={<ShoppingCart size={24} />} active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} label="Siparişler" />
          <NavIcon icon={<Settings size={24} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Ayarlar" />
        </nav>
        <div className="mt-auto">
          <NavIcon icon={<AlertCircle size={24} />} active={false} onClick={() => {}} label="Hatalar" />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* AI Suggestion Overlay */}
        <AnimatePresence>
          {isSuggesting || suggestions.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-8"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <RefreshCw className={isSuggesting ? 'animate-spin text-emerald-500' : 'text-emerald-500'} size={24} />
                      AI Kategori Önerileri
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">En uygun pazaryeri kategorisini seçiniz.</p>
                  </div>
                  <button onClick={() => setSuggestions([])} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <ArrowRight className="rotate-180" size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {isSuggesting ? (
                    <div className="py-20 text-center">
                      <RefreshCw className="animate-spin text-emerald-500 mx-auto mb-4" size={48} />
                      <p className="text-slate-600 font-medium">Gemini AI analiz ediyor...</p>
                    </div>
                  ) : (
                    suggestions.map((sug, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group relative"
                        onClick={() => handleApprove(pendingMappings[0].id, sug)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Öneri #{idx + 1}</span>
                          <span className="text-sm font-bold text-emerald-600 font-mono">%{(sug.confidence * 100).toFixed(0)} Güven</span>
                        </div>
                        <h3 className="font-semibold text-slate-800 text-lg">{sug.categoryPath}</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed italic">"{sug.reason}"</p>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CheckCircle2 className="text-emerald-500" size={24} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-800">
              {activeTab === 'products' ? 'Ürün Yönetimi' : activeTab === 'orders' ? 'Sipariş Yönetimi' : 'Panel'}
            </h1>
            <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
            {activeTab === 'products' ? (
              <div className="flex gap-2">
                {([Marketplace.TRENDYOL, Marketplace.HEPSIBURADA, Marketplace.N11, Marketplace.PAZARAMA] as Marketplace[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMarketplace(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                      selectedMarketplace === m 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {m.toLowerCase()}
                  </button>
                ))}
              </div>
            ) : activeTab === 'orders' ? (
              <button 
                onClick={handleSyncOrders}
                disabled={isSyncingOrders}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncingOrders ? 'animate-spin' : ''} />
                {isSyncingOrders ? 'Senkronize Ediliyor...' : 'Siparişleri Çek'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder={activeTab === 'products' ? "SKU, Barkod veya Başlık..." : "Sipariş No veya Müşteri..."}
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            {activeTab === 'products' && (
              <button className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                <RefreshCw size={16} />
                Senkronize Et
              </button>
            )}
          </div>
        </header>

        {/* Conditional Content */}
        {activeTab === 'publish' ? (
          <CategoryPublishPage />
        ) : activeTab === 'products' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Panel 1: Category Explorer (280px) */}
            <aside className="w-[280px] bg-white border-r border-slate-200 overflow-y-auto p-4 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 italic">Kategoriler</div>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center justify-between p-3 rounded-xl text-sm transition-all group ${
                    selectedCategory === cat.id 
                    ? 'bg-emerald-50 text-emerald-700 font-medium' 
                    : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    selectedCategory === cat.id ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}

              {pendingMappings.length > 0 && (
                <div className="mt-8">
                  <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-2 px-2 italic flex items-center gap-2">
                    <Clock size={12} />
                    Onay Bekleyenler
                  </div>
                  {pendingMappings.map(mapping => (
                    <button
                      key={mapping.id}
                      onClick={() => handleSuggest(mapping.sourceCategory)}
                      className="w-full text-left p-3 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all group"
                    >
                      <div className="text-xs font-medium text-slate-700 truncate">{mapping.sourceCategory}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] font-bold uppercase text-rose-500">{mapping.marketplace}</span>
                        <span className="text-[9px] text-slate-400">• AI %{(mapping.aiConfidence * 100).toFixed(0)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {/* Panel 2: Product List (flex-1) */}
            <section className="flex-1 bg-slate-50/50 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Ürün Listesi</h2>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="SKU veya Ürün Adı..." 
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all w-64"
                      />
                    </div>
                    <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all">
                      <Filter size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {products.map(product => (
                    <motion.div
                      key={product.id}
                      whileHover={{ y: -2 }}
                      onClick={() => handleProductClick(product)}
                      className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-6 ${
                        selectedProduct?.id === product.id ? 'border-emerald-500 shadow-lg shadow-emerald-500/5' : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Package size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.id}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            product.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 
                            product.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {product.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 truncate">{product.title}</h3>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">₺{product.price.toLocaleString()}</span>
                            <span>Ham Fiyat</span>
                          </div>
                          <div className="w-px h-3 bg-slate-200" />
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{product.stock}</span>
                            <span>Stok</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Doluluk</div>
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              product.completeness > 80 ? 'bg-emerald-500' : 
                              product.completeness > 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${product.completeness}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Panel 3: Price Preview (360px) */}
            <aside className="w-[360px] bg-white border-l border-slate-200 overflow-y-auto p-6">
              {selectedProduct ? (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Fiyat Önizleme</h3>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-400 uppercase font-bold mb-1">Kaynak Fiyat</div>
                      <div className="text-2xl font-bold text-slate-800">₺{selectedProduct.price.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 italic">Pazaryeri Dağılımı</div>
                    {isLoadingPrice ? (
                      <div className="py-12 text-center">
                        <RefreshCw className="animate-spin text-emerald-500 mx-auto mb-2" size={24} />
                        <p className="text-xs text-slate-500">Hesaplanıyor...</p>
                      </div>
                    ) : (
                      pricePreview?.results.map((res: any) => (
                        <div key={res.marketplace} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase text-slate-400">{res.marketplace}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{res.rule}</span>
                          </div>
                          <div className="flex items-end justify-between">
                            <div className="text-xl font-bold text-slate-800">
                              ₺{res.finalPrice?.toLocaleString() || '---'}
                            </div>
                            {res.minApplied && (
                              <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">MİN FİYAT</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                        <RefreshCw size={16} />
                      </div>
                      <div className="text-sm font-bold text-emerald-800">Akıllı Fiyatlandırma</div>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Bu ürün için en karlı kural otomatik olarak uygulandı. Kargo ve komisyon oranları günceldir.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                    <Package size={32} />
                  </div>
                  <h3 className="text-slate-800 font-bold mb-2">Ürün Seçilmedi</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Fiyat dağılımını ve kural detaylarını görmek için listeden bir ürün seçin.
                  </p>
                </div>
              )}
            </aside>
          </div>
        ) : activeTab === 'orders' ? (
          <section className="flex-1 bg-slate-50/50 overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                  title="Yeni Siparişler" 
                  value={orders.filter(o => o.status === OrderStatus.NEW).length} 
                  icon={<Clock className="text-amber-500" size={20} />}
                  color="amber"
                />
                <StatCard 
                  title="Hazırlananlar" 
                  value={orders.filter(o => o.status === OrderStatus.PREPARING).length} 
                  icon={<Package className="text-blue-500" size={20} />}
                  color="blue"
                />
                <StatCard 
                  title="Kargodakiler" 
                  value={orders.filter(o => o.status === OrderStatus.SHIPPED || o.status === OrderStatus.IN_TRANSIT).length} 
                  icon={<Truck className="text-indigo-500" size={20} />}
                  color="indigo"
                />
                <StatCard 
                  title="Tamamlanan" 
                  value={orders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED).length} 
                  icon={<CheckCircle2 className="text-emerald-500" size={20} />}
                  color="emerald"
                />
              </div>

              {/* Filters & Actions */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Sipariş No, Müşteri veya Takip No..." 
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <select 
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border-none rounded-xl text-sm px-4 py-2 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    <option value="ALL">Tüm Durumlar</option>
                    {Object.values(OrderStatus).map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <select 
                    value={orderMarketplaceFilter}
                    onChange={(e) => setOrderMarketplaceFilter(e.target.value as any)}
                    className="bg-slate-50 border-none rounded-xl text-sm px-4 py-2 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    <option value="ALL">Tüm Pazaryerleri</option>
                    {Object.values(Marketplace).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSyncOrders}
                    disabled={isSyncingOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <RefreshCw size={16} className={isSyncingOrders ? 'animate-spin' : ''} />
                    {isSyncingOrders ? 'Senkronize Ediliyor...' : 'Siparişleri Çek'}
                  </button>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pazaryeri</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sipariş Bilgisi</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Müşteri</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tutar</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Durum</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map(order => (
                        <tr 
                          key={order.id} 
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit",
                                order.marketplace === Marketplace.TRENDYOL ? "bg-orange-100 text-orange-700" :
                                order.marketplace === Marketplace.HEPSIBURADA ? "bg-blue-100 text-blue-700" :
                                order.marketplace === Marketplace.N11 ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {order.marketplace}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">#{order.marketplaceOrderId}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {order.id.slice(0, 8)}...</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-700 font-medium">{order.customerName}</span>
                              <span className="text-[10px] text-slate-400">{order.customerPhone || 'Telefon Yok'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-black text-slate-900">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: order.currency || 'TRY' }).format(order.totalAmount)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-600">{format(new Date(order.createdAt), 'dd MMM yyyy', { locale: tr })}</span>
                              <span className="text-[10px] text-slate-400">{format(new Date(order.createdAt), 'HH:mm')}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {order.status === OrderStatus.NEW && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleUpdateOrderStatus(order.id, OrderStatus.PREPARING); }}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
                                  title="Onayla"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              )}
                              {order.status === OrderStatus.PREPARING && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleGenerateLabel(order.id); }}
                                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                  title="Barkod Oluştur"
                                >
                                  <Printer size={16} />
                                </button>
                              )}
                              <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length === 0 && (
                    <div className="py-32 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShoppingCart className="text-slate-200" size={40} />
                      </div>
                      <h3 className="text-slate-800 font-bold text-lg mb-2">Sipariş Bulunamadı</h3>
                      <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">
                        Seçilen filtrelere uygun sipariş bulunmuyor veya henüz senkronizasyon yapılmadı.
                      </p>
                      <button 
                        onClick={handleSyncOrders}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Siparişleri Şimdi Çek
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order Details Modal */}
            <AnimatePresence>
              {selectedOrder && (
                <OrderDetailsModal 
                  order={selectedOrder} 
                  onClose={() => setSelectedOrder(null)} 
                  onUpdateStatus={handleUpdateOrderStatus}
                  onGenerateLabel={handleGenerateLabel}
                />
              )}
            </AnimatePresence>
          </section>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Bu bölüm henüz yapım aşamasında.
          </div>
        )}
      </main>
    </div>
  );
}

function NavIcon({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`relative group p-3 rounded-2xl transition-all ${
        active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-800'
      }`}
    >
      {icon}
      <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label}
      </span>
    </button>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string, color: string }> = {
    [OrderStatus.NEW]: { label: 'Yeni', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    [OrderStatus.PENDING_APPROVAL]: { label: 'Onay Bekliyor', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    [OrderStatus.PREPARING]: { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    [OrderStatus.LABEL_CREATED]: { label: 'Barkod Hazır', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    [OrderStatus.SHIPPED]: { label: 'Kargoya Verildi', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    [OrderStatus.IN_TRANSIT]: { label: 'Yolda', color: 'bg-violet-100 text-violet-700 border-violet-200' },
    [OrderStatus.DELIVERED]: { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    [OrderStatus.COMPLETED]: { label: 'Tamamlandı', color: 'bg-emerald-500 text-white border-emerald-600' },
    [OrderStatus.CANCELLATION_REQUESTED]: { label: 'İptal Talebi', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    [OrderStatus.CANCELLED]: { label: 'İptal Edildi', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    [OrderStatus.RETURN_REQUESTED]: { label: 'İade Talebi', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    [OrderStatus.RETURN_APPROVED]: { label: 'İade Onaylandı', color: 'bg-rose-500 text-white border-rose-600' },
    [OrderStatus.RETURN_REJECTED]: { label: 'İade Reddedildi', color: 'bg-slate-700 text-white border-slate-800' },
    [OrderStatus.RETURNED]: { label: 'İade Geldi', color: 'bg-rose-700 text-white border-rose-900' },
    [OrderStatus.REFUNDED]: { label: 'Ücret İade Edildi', color: 'bg-rose-900 text-white border-rose-950' },
    [OrderStatus.DELIVERY_FAILED]: { label: 'Teslim Edilemedi', color: 'bg-red-100 text-red-700 border-red-200' },
  };

  const item = config[status] || { label: status, color: 'bg-slate-100 text-slate-700' };

  return (
    <span className={cn("text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-tighter", item.color)}>
      {item.label}
    </span>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-100',
    blue: 'bg-blue-50 border-blue-100',
    indigo: 'bg-indigo-50 border-indigo-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };

  return (
    <div className={cn("p-5 rounded-3xl border bg-white shadow-sm flex items-center justify-between", colors[color])}>
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</div>
        <div className="text-2xl font-black text-slate-900">{value}</div>
      </div>
      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
        {icon}
      </div>
    </div>
  );
}

function OrderDetailsModal({ order, onClose, onUpdateStatus, onGenerateLabel }: { 
  order: Order, 
  onClose: () => void, 
  onUpdateStatus: (id: string, status: string) => void,
  onGenerateLabel: (id: string) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-end"
      onClick={onClose}
    >
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg",
              order.marketplace === Marketplace.TRENDYOL ? "bg-orange-500 shadow-orange-500/20" :
              order.marketplace === Marketplace.HEPSIBURADA ? "bg-blue-500 shadow-blue-500/20" :
              order.marketplace === Marketplace.N11 ? "bg-purple-500 shadow-purple-500/20" : "bg-emerald-500 shadow-emerald-500/20"
            )}>
              {order.marketplace[0]}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Sipariş #{order.marketplaceOrderId}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <OrderStatusBadge status={order.status} />
                <span className="text-xs text-slate-400">• {format(new Date(order.createdAt), 'dd MMMM yyyy HH:mm', { locale: tr })}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Action Bar */}
          <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-3xl border border-slate-100">
            {order.status === OrderStatus.NEW && (
              <button 
                onClick={() => onUpdateStatus(order.id, OrderStatus.PREPARING)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 size={18} />
                Siparişi Onayla
              </button>
            )}
            {order.status === OrderStatus.PREPARING && (
              <button 
                onClick={() => onGenerateLabel(order.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
              >
                <Printer size={18} />
                Barkod Oluştur
              </button>
            )}
            {order.cargoLabelUrl && (
              <a 
                href={order.cargoLabelUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-2xl font-bold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
              >
                <FileText size={18} />
                Barkodu Yazdır
              </a>
            )}
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
              <X size={18} />
              İptal Et
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Customer Info */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <User size={14} />
                Müşteri Bilgileri
              </h3>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <User size={16} />
                  </div>
                  <div className="text-sm font-bold text-slate-800">{order.customerName}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Phone size={16} />
                  </div>
                  <div className="text-sm text-slate-600">{order.customerPhone || 'Girilmemiş'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Mail size={16} />
                  </div>
                  <div className="text-sm text-slate-600 truncate">{order.customerEmail || 'Girilmemiş'}</div>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Truck size={14} />
                Kargo Bilgileri
              </h3>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Truck size={16} />
                  </div>
                  <div className="text-sm font-bold text-slate-800">{order.cargoCompany || 'Henüz Atanmadı'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <FileText size={16} />
                  </div>
                  <div className="text-sm text-slate-600 font-mono">{order.trackingNumber || 'Takip No Yok'}</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 mt-1">
                    <MapPin size={16} />
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">{order.shippingAddress || 'Adres Bilgisi Yok'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package size={14} />
              Sipariş İçeriği
            </h3>
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Ürün</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Adet</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Birim</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.items?.map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{item.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-slate-600">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600">₺{item.unitPrice.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">₺{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 border-t border-slate-100">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-slate-500 uppercase">Genel Toplam</td>
                    <td className="px-6 py-4 text-right text-lg font-black text-emerald-600">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: order.currency || 'TRY' }).format(order.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FormField({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

