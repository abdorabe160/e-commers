"use client";
import SidebarCart from "@/app/SidebarCart/SidebarCart";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";


export default function Button({ data }: { data?: unknown }) {
        const [state,useStat] = useState(false)
        function handler (): void{

        }
  return (
    <button className=" left-4 absolute bottom-2.5 bg-gray-100 hover:bg-amber-500 hover:text-white p-2 rounded-xl transition-colors text-gray-700 cursor-pointer " onClick={handler}>
                    <ShoppingBag className="w-4 h-4" />
                    
                              <SidebarCart isOpen={false} onClose={function (): void {
          throw new Error("Function not implemented.");
        } } />
                  </button>
  )
}
