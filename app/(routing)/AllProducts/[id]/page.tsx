

// app/product/[id]/page.jsx
"use client";

import { use, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, Star, Truck, ShieldCheck, CreditCard, ArrowRight, Minus, Plus } from "lucide-react";

type Product = {
  title: string;
  description: string;
  category: string;
  brand?: string;
  price: number;
  rating: number;
  thumbnail?: string;
  images?: string[];
  message?: string;
};

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // فك الـ Promise الممرر في params (Next.js 15)
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("desc");

  // جلب بيانات المنتج من API
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`https://dummyjson.com/products/${productId}`);
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Failed to fetch product:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!product || product.message) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700">
        <h2 className="text-2xl font-bold mb-4">المنتج غير موجود 🙁</h2>
        <Link href="/shop" className="text-pink-600 hover:underline flex items-center gap-2">
          <ArrowRight size={18} /> العودة للمتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8 dir-rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumb Navigation */}
        <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-pink-600 transition">المتجر</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{product.title}</span>
        </nav>

        {/* Product Details Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-100">
          
          {/* Right: Gallery & Images */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="relative w-full h-100 sm:h-125 bg-gray-100 rounded-xl overflow-hidden group">
              <Image
                src={product.thumbnail || product.images?.[0] || "/placeholder-product.png"}
                alt={product.title}
                fill
                priority
                className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              />
            
            </div>

            {/* Thumbnail grid */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images?.slice(0, 4).map((img, idx) => (
                <div 
                  key={idx} 
                  className="relative w-20 h-20 bg-gray-50 border rounded-lg overflow-hidden shrink-0 cursor-pointer hover:border-pink-500 transition"
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Left: Product Info & Actions */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-3 py-1 rounded-full uppercase tracking-wider">
                {product.category}
              </span>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 mb-2">
                {product.title}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" className={i < Math.round(product.rating) ? "text-amber-400" : "text-gray-300"} />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {product.rating} (12 تقييم)
                </span>
              </div>

              {/* Price */}
              <div className="text-3xl font-bold text-gray-900 mb-6">
                {product.price} <span className="text-lg font-normal text-gray-500">ج.م</span>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {product.description}
              </p>

              {/* Sizes Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">المقاس:</label>
                <div className="flex gap-2">
                  {["S", "M", "L", "XL"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-10 rounded-lg border font-medium text-sm transition ${
                        selectedSize === size
                          ? "border-pink-600 bg-pink-50 text-pink-600"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity and Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex items-center border border-gray-200 rounded-lg w-fit">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 text-gray-600 hover:bg-gray-50 transition"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="px-5 font-semibold text-gray-800">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 text-gray-600 hover:bg-gray-50 transition"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
                  <ShoppingBag size={20} />
                  إضافة إلى السلة
                </button>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 border-t pt-6 text-center text-xs text-gray-500">
              <div className="flex flex-col items-center gap-1">
                <Truck size={20} className="text-pink-600" />
                <span>شحن سريع لكل المحافظات</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck size={20} className="text-pink-600" />
                <span>ضمان استرجاع 14 يوم</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <CreditCard size={20} className="text-pink-600" />
                <span>الدفع عند الاستلام</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs Section (Description, Specs, Reviews) */}
        <div className="mt-12 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <div className="flex border-b border-gray-100 gap-8 mb-6">
            <button
              onClick={() => setActiveTab("desc")}
              className={`pb-4 text-sm font-semibold border-b-2 transition ${
                activeTab === "desc" ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              الوصف التفصيلي
            </button>
            <button
              onClick={() => setActiveTab("specs")}
              className={`pb-4 text-sm font-semibold border-b-2 transition ${
                activeTab === "specs" ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              المواصفات
            </button>
          </div>

          <div className="text-gray-600 text-sm leading-relaxed">
            {activeTab === "desc" ? (
              <p>{product.description}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-900">التصنيف</span>
                  <span>{product.category}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-900">الماركة</span>
                  <span>{product.brand || "عامة"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}