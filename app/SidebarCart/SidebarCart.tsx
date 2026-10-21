'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarCartProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SidebarCart({ isOpen, onClose }: SidebarCartProps) {
  // قفل السكرول الخاص بالصفحة عند فتح الكارت الجانبي
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // إغلاق الكارت عند الضغط على زر ESC
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* 1. الفراغ الخارجي (Backdrop) - الضغط عليه يغلق الكارت */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
          />

          {/* 2. الكارت الجانبي نفسه (Drawer) */}
          <div className="fixed inset-y-0 left-0 max-w-full flex pl-0">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-screen max-w-md bg-white text-gray-900 shadow-2xl flex flex-col"
            >
              {/* الهيدر وزر الإغلاق */}
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800">سلة التسوق</h2>
                
                {/* زر الإغلاق العادي (X) */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="إغلاق السلة"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* محتوى السلة / المنتجات */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-semibold text-sm">منتج MiniKids</p>
                    <p className="text-xs text-gray-500">150 ج.م × 1</p>
                  </div>
                  <button className="text-red-500 text-xs hover:underline">
                    حذف
                  </button>
                </div>
              </div>

              {/* الفوتر وسعر الإجمالي */}
              <div className="p-4 border-t bg-gray-50 space-y-3">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>الإجمالي:</span>
                  <span>150 ج.م</span>
                </div>
                <button
                  type="button"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  إتمام الشراء
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}