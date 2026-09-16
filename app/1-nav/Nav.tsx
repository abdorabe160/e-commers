
import { Search, ShoppingBag, Heart, Star, } from 'lucide-react';

export default  function Nav() {
  // بيانات تجريبية للمنتجات

  
  return (
    <>
      {/* 1. Navbar */}
      <header className="rounded-4xl bg-white s sticky top-1 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Main Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 font-extrabold text-2xl text-amber-500 cursor-pointer">
              <span>✨ MiniKids</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-600">
              <a href="#" className="text-amber-500">الرئيسية</a>
              <a href="#" className="hover:text-amber-500 transition-colors">الأقسام</a>
              <a href="#" className="hover:text-amber-500 transition-colors">العروض 🔥</a>
            </nav>
          </div>

          {/* Search Bar & Icons */}
          <div className="flex items-center gap-4 flex-1 justify-end max-w-md">
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-100 border border-transparent rounded-full focus:outline-none focus:bg-white focus:border-amber-400 transition-all"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
                <Heart className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  3
                </span>
              </button>
            </div>
          </div>

        </div>
      </header>

    </>
  );
}