import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, BarChart3, RefreshCw, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-black text-emerald-600">Pazar.io</div>
        <div className="space-x-8 font-semibold text-slate-600">
          <Link to="/" className="text-emerald-600">Ana Sayfa</Link>
          <Link to="/publish" className="hover:text-emerald-600 transition-colors">Ürün Gönderim</Link>
          <Link to="/admin" className="hover:text-emerald-600 transition-colors">Admin Panel</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-20 text-center px-6">
        <h1 className="text-6xl font-black tracking-tighter mb-6 leading-tight">
          Tüm Pazaryerlerini <br /> <span className="text-emerald-600">Tek Noktadan</span> Yönetin.
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
          Trendyol, Hepsiburada, N11 ve daha fazlası. Ürünlerinizi saniyeler içinde yayınlayın, stoklarınızı otomatik senkronize edin.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/publish" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
            Hemen Başlayın <ArrowRight size={20} />
          </Link>
          <Link to="/admin" className="bg-white border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all">
            Demoyu İzle
          </Link>
        </div>
      </main>

      <section className="max-w-7xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 px-6 pb-20">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <Zap size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">Hızlı Yayınlama</h3>
          <p className="text-slate-500">Ürünlerinizi tüm pazaryerlerine saniyeler içinde, kategori eşleştirmeleriyle birlikte gönderin.</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <BarChart3 size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">Akıllı Analiz</h3>
          <p className="text-slate-500">Satış verilerinizi analiz ederek en karlı ürünlerinizi ve pazaryerlerinizi keşfedin.</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
            <RefreshCw size={24} />
          </div>
          <h3 className="text-xl font-bold mb-3">Otomatik Senkron</h3>
          <p className="text-slate-500">Stok ve fiyat değişiklikleriniz tüm platformlarda anlık olarak güncellenir.</p>
        </div>
      </section>

      <footer className="p-10 text-center text-slate-400 border-t border-slate-100">
        &copy; 2026 Pazar.io - Tüm Hakları Saklıdır.
      </footer>
    </div>
  );
};

export default LandingPage;
