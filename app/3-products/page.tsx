
import { Heart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Button from "./button/button";


export default async function Product() {
  let products: {
    products: Array<{
      id: number;
      images: string[];
      rating: number;
      title: string;
      price: number;
    }>;
  } = { products: [] };

  try{

    const data = await fetch("https://dummyjson.com/products?limit=10");
    if (!data.ok) {
          throw new Error(`HTTP error! status: ${data.status}`);
    }
    products = await data.json();
  
  }catch (err: unknown){
console.error('Fetch error:', err);
  }
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">أحدث المنتجات</h2>
          <p className="text-xs text-gray-500 mt-1">
            اختيارات مميزة أُضيفت حديثاً للمتجر
          </p>
        </div>
        <Link
          href="AllProducts"
          className="text-sm font-semibold text-amber-600 hover:text-amber-700"
          >
          عرض الكل ←
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ">
        {products.products.map(function (item: {
          id: number;
          images: string[];
          rating: number;
          title: string;
          price: number;
        }) {
          return (
            <div
              key={item.id}
              className="  group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer "
              >
            <Link href={`AllProducts/${item.id}`} >
              
              <div className="overflow-hidden relative aspect-square bg-gray-100 flex items-center justify-center text-gray-400 font-medium text-sm">
                <Image
                  alt="صورة المنتج"
                  src={item.images[0]}
                  width={350}
                  height={350}
                  className="transition-transform duration-500 group-hover:scale-110 :"
                />
                <button className="absolute top-3 left-3 bg-white/80 backdrop-blur p-2 rounded-full hover:text-white hover:bg-red-500 text-gray-600 transition-colors cursor-pointer ">
                  <Heart className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  <span>{item.rating}</span>
                </div>
                <h3 className="font-bold text-sm text-gray-800 line-clamp-1">
                  {item.title}
                </h3>
               
                  <span className="font-black text-amber-600 text-base">
                    {item.price} ج.م
                  </span>
               
              </div>
        </Link>
        <div className="flex justify-between relative  ">

                <div></div>
                 <Button data={item}/>
        </div>
        
            </div>
         );
        })}
      </div>
    
    </section>
  );
}
