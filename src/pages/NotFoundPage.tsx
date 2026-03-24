import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="bg-slate-50 text-slate-900 flex items-center justify-center h-screen text-center px-6">
      <main className="max-w-md mx-auto">
        <div className="text-9xl font-black text-emerald-600 mb-6">404</div>
        <h1 className="text-3xl font-black mb-4 leading-tight">Aradığınız Sayfa <br /> Bulunamadı.</h1>
        <p className="text-slate-500 mb-10">
          Üzgünüz, aradığınız sayfa taşınmış veya silinmiş olabilir. Lütfen ana sayfaya dönerek devam edin.
        </p>
        <Link to="/" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
          Ana Sayfaya Dön
        </Link>
      </main>
    </div>
  );
};

export default NotFoundPage;
