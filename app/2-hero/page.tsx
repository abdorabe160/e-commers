import {  RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';

export default function Hero(){
  return (
    <> 
        <section className="w-full bg-linear-to-r from-amber-500 to-orange-500 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-lg">
          <div className="max-w-xl relative z-10 space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
              أفضل الأزيـاء لراحة أنـاقتهم الصغيـرة
            </h1>
            <p className="text-sm sm:text-base text-amber-50 opacity-95">
              اكتشف تشكيلتنا العصرية المصممة بعناية فائقة لتناسب حركة أطفالكم وتمنحهم الراحة والأناقة اليومية.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
             <Link href={'/'} > <button className="bg-white text-amber-600 hover:bg-amber-50 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow">
                تسوق الآن ←
              </button>
              </Link>
              <button className="border border-white/80 hover:bg-white/10 px-6 py-2.5 rounded-full font-bold text-sm transition-all">
                استعرض العروض
              </button>
            </div>
          </div>
        </section>

        {/* 3. Features Bar / المميزات */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 border-b pb-8">
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <Truck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900">شحن سريع وآمن</h4>
              <p className="text-xs text-gray-500">توصيل لباب المنزل لجميع المحافظات</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <ShieldCheck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900">جودة مضمونة 100%</h4>
              <p className="text-xs text-gray-500">خامات قطنية ناعمة ومناسبة للبشرة</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <RotateCcw className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-gray-900">استرجاع مرن</h4>
              <p className="text-xs text-gray-500">إمكانية الاستبدال والاسترجاع خلال 14 يوماً</p>
            </div>
          </div>
        </section>
        </>
  )
}
