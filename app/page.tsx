
import Product from "./3-products/page";
import Hero from "./2-hero/page";





export default function Home() {
  return (
    <div  className="min-h-screen bg-gray-50 text-gray-800 dir-rtl" dir="rtl">

    <main className=" max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10" >
  
    <Hero />
    <Product />
    
    </main>
    </div>
  );
}
