import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { FashionStore } from "./fashion-store";

const storeFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store",
  display: "swap",
});

export const metadata: Metadata = {
  title: "3D Fashion Try-On",
  description: "An Arabic fashion store where 3D characters try on every piece: tops, jackets, trousers, shoes and accessories.",
};

export default function FashionPage() {
  return (
    <div className={storeFont.variable}>
      <FashionStore />
    </div>
  );
}
