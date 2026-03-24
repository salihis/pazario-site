import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Settings, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="bg-slate-50 text-slate-900 flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-8 border-r border-slate-800">
        <Link to="/" className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
          P.i
        </Link>
        <nav className="flex flex-col gap-4">
          <Link to="/admin" className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 cursor-pointer">
            <LayoutDashboard size={24} />
          </Link>
          <Link to="/publish" className="p-3 text-slate-500 hover:bg-slate-800 rounded-2xl transition-all cursor-pointer">
            <Package size={24} />
          </Link>
          <div className="p-3 text-slate-500 hover:bg-slate-800 rounded-2xl transition-all cursor-pointer">
            <ShoppingCart size={24} />
          </div>
          <div className="p-3 text-slate-500 hover:bg-slate-800 rounded-2xl transition-all cursor-pointer">
            <Settings size={24} />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black">Admin Panel</h1>
            <p className="text-slate-500">Pazaryeri performansınızı izleyin.</p>
          </div>
          <div className="flex gap-4">
            <Link to="/" className="bg-white border border-slate-200 px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Siteye Dön</Link>
            <Link to="/publish" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">Yeni Ürün</Link>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Toplam Satış</div>
            <div className="text-2xl font-black">₺142.500</div>
            <div className="text-xs text-emerald-500 font-bold mt-2 flex items-center gap-1">
              <ArrowUpRight size={12} /> +%12.5 artış
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Aktif Ürünler</div>
            <div className="text-2xl font-black">842</div>
            <div className="text-xs text-emerald-500 font-bold mt-2">12 yeni ürün</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Bekleyen Sipariş</div>
            <div className="text-2xl font-black">24</div>
            <div className="text-xs text-amber-500 font-bold mt-2">Acil gönderim</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">İade Oranı</div>
            <div className="text-2xl font-black">%1.2</div>
            <div className="text-xs text-emerald-500 font-bold mt-2 flex items-center gap-1">
              <ArrowDownRight size={12} /> -%0.5 düşüş
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 font-bold text-lg">Son Siparişler</div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold text-slate-400 uppercase">
              <tr>
                <th className="p-6">Sipariş No</th>
                <th className="p-6">Müşteri</th>
                <th className="p-6">Pazaryeri</th>
                <th className="p-6">Tutar</th>
                <th className="p-6">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td className="p-6 font-bold">#ORD-1234</td>
                <td className="p-6 text-slate-600">Ahmet Yılmaz</td>
                <td className="p-6"><span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Trendyol</span></td>
                <td className="p-6 font-bold">₺1.250</td>
                <td className="p-6"><span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Hazırlanıyor</span></td>
              </tr>
              <tr>
                <td className="p-6 font-bold">#ORD-1235</td>
                <td className="p-6 text-slate-600">Mehmet Demir</td>
                <td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Hepsiburada</span></td>
                <td className="p-6 font-bold">₺850</td>
                <td className="p-6"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Kargoda</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
