import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { FashionStore } from "./fashion/fashion-store";

const storeFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store",
  display: "swap",
});

export default function Home() {
  return (
    <div className={storeFont.variable}>
      <FashionStore />
    </div>
  );
}
