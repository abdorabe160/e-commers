import { ChevronDown, Heart, Search, ShoppingBag, SlidersHorizontal, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react'

// Fetch at request time so the build doesn't depend on dummyjson.com being reachable.
export const dynamic = 'force-dynamic'

export default async function page() {
  let products: { products: [] } = { products: [] }
  try {
    const data = await fetch('https://dummyjson.com/products?limit=10')
    if (data.ok) products = await data.json()
  } catch {
    // Network failure: render the page with an empty list.
  }
  return (
   <div className="min-h-screen bg-gray-50 text-gray-800" dir="rtl">
      
      {/* 1. Header / عنوان الصفحة */}
      <div className="bg-white border-b py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">جميع المنتجات</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">تصفح تشكيلتنا الكاملة لأزياء وأطقم الأطفال العصرية</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* 2. Sidebar Filters / الفلترة الجانبية */}
          <aside className="w-full lg:w-64 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-fit space-y-6 shrink-0">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                تصفية النتائج
              </h3>
            </div>

            {/* الأقسام */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-gray-500 uppercase">الأقسام</h4>
              <div className="space-y-2 text-sm text-gray-700">
                {['الكل', 'أطقم', 'بيجامات', 'فساتين', 'جاكيتات', 'حديثي الولادة'].map((cat, idx) => (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer hover:text-amber-500 transition-colors">
                    <input type="checkbox" defaultChecked={idx === 0} className="rounded text-amber-500 focus:ring-amber-400" />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* السعر */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-bold text-xs text-gray-500 uppercase">السعر (ج.م)</h4>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="من" className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-amber-400" />
                <span className="text-gray-400">-</span>
                <input type="number" placeholder="إلى" className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-amber-400" />
              </div>
            </div>

            <button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-sm transition-colors shadow">
              تطبيق التصفية
            </button>
          </aside>

          {/* 3. Main Content / قائمة المنتجات */}
          <main className="flex-1 space-y-6">
            
            {/* Top Toolbar / شريط التحكم والترتيب */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="ابحث في المنتجات..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-amber-400 transition-all"
                />
                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end">
                <span className="text-xs text-gray-500 whitespace-nowrap">عرض 1-6 من 24 منتج</span>
                <div className="relative">
                  <select className="appearance-none bg-gray-50 border border-gray-200 text-xs font-semibold px-4 py-2 pr-8 rounded-xl focus:outline-none focus:border-amber-400 cursor-pointer">
                    <option>الأحدث</option>
                    <option>السعر: من الأقل إلى الأعلى</option>
                    <option>السعر: من الأعلى إلى الأقل</option>
                    <option>الأعلى تقييماً</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.products.map((item: {
                images: string[];
                id: number;
                image: string;
                title: string;
                category: string;
                rating: number;
                price: number;
                oldPrice?: number;
              }): React.JSX.Element => (
                <Link href={`AllProducts/${item.id}`} key={item.id}>
                <div
                  
                  className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  {/* حاوية الصورة مع أنيميشن الهوفر */}
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    <Image
                      width={350}
                      height={350}
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110" />
                    <button className="absolute top-3 left-3 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-red-500 hover:text-white cursor-pointer text-gray-600 transition-colors shadow-sm">
                      <Heart className="w-4 h-4" />
                    </button>
                    <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                      {item.category}
                    </span>
                  </div>

                  {/* معلومات المنتج */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{item.rating}</span>
                    </div>

                    <h3 className="font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-amber-600 transition-colors">
                      {item.title}
                    </h3>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-amber-600 text-base">{item.price} ج.م</span>
                        {item.oldPrice && (
                          <span className="text-xs text-gray-400 line-through">{item.oldPrice} ج.م</span>
                        )}
                      </div>
                      <button className="bg-gray-100 hover:bg-amber-500 hover:text-white cursor-pointer p-2.5 rounded-xl transition-colors text-gray-700 shadow-sm">
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
              ))}
            </div>

          </main>
        </div>
      </div>
    </div>
  )
}
