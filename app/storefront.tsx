"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Lightbulb,
  Minus,
  Moon,
  Plus,
  Search,
  ShoppingBag,
  Sun,
  X,
} from "lucide-react";
import { lightingProducts, type LightingCategory, type LightingProduct } from "@/lib/lighting-products";
import styles from "./storefront.module.css";

const filters: { value: "all" | LightingCategory; label: string }[] = [
  { value: "all", label: "كل الإضاءة" },
  { value: "smart", label: "ذكية" },
  { value: "decorative", label: "ديكورية" },
  { value: "ambient", label: "سبوتات وأجواء" },
  { value: "task", label: "مكتبية" },
];

const featuredCategories: { value: LightingCategory; title: string; detail: string; offImageUrl: string; onImageUrl: string; offAlt: string; onAlt: string }[] = [
  { value: "decorative", title: "لمبات ديكورية", detail: "فتيلة عتيقة بلمسة ذهبية", offImageUrl: "/images/edison-amber-day.webp", onImageUrl: "/images/edison-amber.webp", offAlt: "لمبة فتيلة افتراضية مطفأة نهارًا", onAlt: "لمبة فتيلة افتراضية مضاءة ليلًا" },
  { value: "smart", title: "الإضاءة الذكية", detail: "ألوان هادئة وتحكم مرن", offImageUrl: "/images/smart-bulb-day.webp", onImageUrl: "/images/smart-bulb.webp", offAlt: "لمبة ذكية افتراضية مطفأة نهارًا", onAlt: "لمبة ذكية افتراضية مضاءة ليلًا" },
  { value: "ambient", title: "سبوتات وأجواء", detail: "تفاصيل معمارية بضوء دافئ", offImageUrl: "/images/ambient-spots-day.webp", onImageUrl: "/images/ambient-spots.webp", offAlt: "سبوتات سقف افتراضية مطفأة نهارًا", onAlt: "سبوتات سقف افتراضية مضاءة ليلًا" },
  { value: "task", title: "إضاءة مكتبية", detail: "تركيز وأناقة لكل مكتب", offImageUrl: "/images/task-lamp-day.webp", onImageUrl: "/images/task-lamp.webp", offAlt: "مصباح مكتب أسود ونحاسي مطفأ نهارًا", onAlt: "مصباح مكتب أسود ونحاسي مضاء ليلًا" },
];

const priceFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
const formatPrice = (value: number) => `${priceFormatter.format(value)} ج.م`;

function ProductCard({
  product,
  darkMode,
  quantity,
  onAdd,
}: {
  product: LightingProduct;
  darkMode: boolean;
  quantity: number;
  onAdd: (product: LightingProduct) => void;
}) {
  return (
    <article className={styles.productCard}>
      <div className={styles.productArt}>
        <Image className={`${styles.productPhoto} ${darkMode ? "" : styles.photoVisible}`} src={product.offImageUrl} alt={darkMode ? "" : product.offImageAlt} aria-hidden={darkMode} fill quality={90} sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw" />
        <Image className={`${styles.productPhoto} ${darkMode ? styles.photoVisible : ""}`} src={product.onImageUrl} alt={darkMode ? product.onImageAlt : ""} aria-hidden={!darkMode} fill quality={90} sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw" />
        <span className={styles.productBrand}>{product.brand}</span>
        <span className={styles.productSocket}>{product.socket}</span>
        <div className={styles.artCaption}>
          <span>{darkMode ? "الليل · اللمبة منوّرة" : "النهار · اللمبة مطفأة"}</span>
          <span>{product.kelvin.toLocaleString("ar-EG")} كلفن</span>
        </div>
      </div>

      <div className={styles.productDetails}>
        <h3>{product.name}</h3>
        <p className={styles.productDescription}>{product.description}</p>
        <div className={styles.specGrid}>
          <div><span>القدرة</span><strong>{priceFormatter.format(product.watts)} واط</strong></div>
          <div><span>السطوع</span><strong>{priceFormatter.format(product.lumens)} لومن</strong></div>
          <div><span>القاعدة</span><strong>{product.socket}</strong></div>
        </div>

        <div className={styles.cardBottom}>
          <div className={styles.priceBlock}>
            <strong>{formatPrice(product.price)}</strong>
            <span>{product.pieces > 1 ? `للعبوة · ${formatPrice(product.price / product.pieces)} للقطعة` : "للقطعة الواحدة"}</span>
          </div>
          <button className={styles.addButton} type="button" onClick={() => onAdd(product)} aria-label={`أضف ${product.name} للسلة`}>
            {quantity > 0 ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            <span>{quantity > 0 ? "أضف كمان" : "أضف للسلة"}</span>
          </button>
        </div>

        <p className={styles.productDisclosure}>موديل افتراضي · السعر للتجربة فقط</p>
      </div>
    </article>
  );
}

export function Storefront() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | LightingCategory>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState("");

  const visibleProducts = lightingProducts
    .filter((product) => activeFilter === "all" || product.category === activeFilter)
    .filter((product) => `${product.brand} ${product.name} ${product.description} ${product.socket}`.toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar")))
    .sort((first, second) => {
      if (sort === "price-low") return first.price - second.price;
      if (sort === "price-high") return second.price - first.price;
      return 0;
    });

  const cartProducts = lightingProducts.filter((product) => cart[product.id] > 0);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = cartProducts.reduce((total, product) => total + product.price * cart[product.id], 0);

  function addToCart(product: LightingProduct) {
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    setCartNotice(`أُضيفت ${product.name} إلى السلة`);
    window.setTimeout(() => setCartNotice(""), 1800);
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) => {
      const nextQuantity = (current[productId] ?? 0) + amount;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: nextQuantity };
    });
  }

  function toggleTheme() {
    setDarkMode((current) => !current);
  }

  return (
    <div className={`${styles.storefront} ${darkMode ? styles.darkMode : ""}`}>
      <div className={styles.announcement}>
          <span><Lightbulb size={15} aria-hidden="true" /> موديلات إضاءة افتراضية بصور واقعية</span>
          <span>الأسعار للمعاينة فقط</span>
      </div>

      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="Lamp، الصفحة الرئيسية">
          <span className={styles.brandIcon}><Lightbulb size={23} strokeWidth={1.8} aria-hidden="true" /></span>
          <span className={styles.brandText}><strong>Lamp</strong><small>لمبة لكل بيت</small></span>
        </a>
        <nav className={styles.navigation} aria-label="القائمة الرئيسية">
          <a href="#categories">الأقسام</a>
          <a href="#products">المنتجات</a>
          <a href="#guide">دليل القواعد</a>
          <a href="#about">عن Lamp</a>
        </nav>
        <div className={styles.headerActions}>
          <span className={styles.themeHint}>
            <Lightbulb size={14} aria-hidden="true" />
            {darkMode ? "اضغط عشان تطفيها" : "اضغط وشوفها تنوّر"}
          </span>
          <button className={styles.themeButton} type="button" onClick={toggleTheme} aria-pressed={darkMode} aria-label={darkMode ? "أطفئ اللمبات وارجع للمشهد الهادئ" : "شغّل اللمبات وجرب الإضاءة"}>
            {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            <span>{darkMode ? "أطفئ اللمبات" : "شغّل اللمبات"}</span>
          </button>
          <button className={styles.cartButton} type="button" onClick={() => setCartOpen(true)} aria-label={`افتح السلة، ${cartCount} عبوة`} aria-expanded={cartOpen}>
            <ShoppingBag size={19} aria-hidden="true" />
            <span>السلة</span>
            <span className={styles.cartCount}>{priceFormatter.format(cartCount)}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span className={styles.eyebrowDot} /> تفاصيل تصنع فرقًا</p>
            <h1 id="hero-title">نور يغيّر<br />إحساس المكان.</h1>
            <p className={styles.heroDescription}>من اللمبات الذكية إلى التفاصيل الديكورية، اكتشف أفكار إضاءة افتراضية لكل ركن في البيت.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryLink} href="#products">تصفّح اللمبات <ArrowLeft size={18} aria-hidden="true" /></a>
              <a className={styles.secondaryLink} href="#guide">دليل القاعدة المناسبة</a>
            </div>
            <div className={styles.heroFacts}>
              <span><strong>4 تشكيلات</strong><small>من الديكوري للمكتبي</small></span>
              <span><strong>صور مولّدة عالية الجودة</strong><small>تصاميم متخيّلة للمعاينة</small></span>
            </div>
          </div>

          <div className={styles.heroStage}>
            <Image
              className={`${styles.heroPhoto} ${darkMode ? "" : styles.photoVisible}`}
              src="/images/hero-day-off.webp"
              alt={darkMode ? "" : "مشهد افتراضي لغرفة معيشة ومصابيح معلقة مطفأة"}
              aria-hidden={darkMode}
              fill
              unoptimized
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
            />
            <Image
              className={`${styles.heroPhoto} ${darkMode ? styles.photoVisible : ""}`}
              src="/images/hero-night-on.webp"
              alt={darkMode ? "مشهد افتراضي لغرفة معيشة ومصابيح معلقة مضاءة" : ""}
              aria-hidden={!darkMode}
              fill
              unoptimized
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
            />
            <span className={styles.heroPhotoCredit}>مشهد افتراضي · Lamp</span>
            <span className={styles.heroPhotoTag}>{darkMode ? "الليل · الإضاءة تعمل بأجواء دافئة" : "النهار · الإضاءة مطفأة · جرّب زر التشغيل"}</span>
          </div>
        </section>

        <section className={styles.categories} id="categories" aria-labelledby="categories-title">
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>اختار الإضاءة حسب المكان</p>
              <h2 id="categories-title">تشكيلات Lamp</h2>
            </div>
            <p>تصاميم افتراضية بلمسة واقعية، من وهج الفتيلة إلى هدوء السبوت.</p>
          </div>
          <div className={styles.categoryGrid}>
            {featuredCategories.map((category) => (
              <a className={styles.categoryCard} href="#products" key={category.value} onClick={() => setActiveFilter(category.value)}>
                <Image className={`${styles.categoryPhoto} ${darkMode ? "" : styles.photoVisible}`} src={category.offImageUrl} alt={darkMode ? "" : category.offAlt} aria-hidden={darkMode} fill quality={90} sizes="(max-width: 700px) 50vw, (max-width: 980px) 50vw, 25vw" />
                <Image className={`${styles.categoryPhoto} ${darkMode ? styles.photoVisible : ""}`} src={category.onImageUrl} alt={darkMode ? category.onAlt : ""} aria-hidden={!darkMode} fill quality={90} sizes="(max-width: 700px) 50vw, (max-width: 980px) 50vw, 25vw" />
                <span className={styles.categoryCopy}><strong>{category.title}</strong><small>{category.detail}</small></span>
                <ArrowLeft className={styles.categoryArrow} size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section className={styles.catalog} id="products" aria-labelledby="products-title">
          <div className={styles.sectionIntro}>
            <div>
          <p className={styles.eyebrow}>مجموعة مختارة</p>
          <h2 id="products-title">إضاءات تستحق التجربة</h2>
            </div>
          <p>صور واقعية لموديلات متخيّلة؛ الأسعار والمواصفات هنا للتجربة وليست عروض بيع.</p>
          </div>

          <div className={styles.catalogTools}>
            <div className={styles.filterBar} role="group" aria-label="تصفية حسب نوع الإضاءة">
              {filters.map((filter) => (
                <button key={filter.value} className={activeFilter === filter.value ? styles.filterActive : styles.filterButton} type="button" aria-pressed={activeFilter === filter.value} onClick={() => setActiveFilter(filter.value)}>
                  {filter.label}
                </button>
              ))}
            </div>
            <div className={styles.toolRight}>
              <label className={styles.searchBox}>
                <Search size={18} aria-hidden="true" />
                <span className={styles.srOnly}>ابحث عن منتج أو قاعدة</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن لمبة أو قاعدة…" />
                {query ? <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}><X size={15} aria-hidden="true" /></button> : null}
              </label>
              <label className={styles.sortBox}>
                <span className={styles.srOnly}>ترتيب المنتجات</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="featured">ترتيب: المقترحة</option>
                  <option value="price-low">السعر: من الأقل</option>
                  <option value="price-high">السعر: من الأعلى</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
            </div>
          </div>

          <p className={styles.resultCount} aria-live="polite">{priceFormatter.format(visibleProducts.length)} منتجات</p>
          {visibleProducts.length > 0 ? (
            <div className={styles.productGrid}>
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} darkMode={darkMode} quantity={cart[product.id] ?? 0} onAdd={addToCart} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyResults}>
              <Search size={26} aria-hidden="true" />
              <h3>مفيش لمبات مطابقة للبحث</h3>
              <p>جرّب كلمة تانية أو اختار قاعدة مختلفة.</p>
              <button type="button" onClick={() => { setQuery(""); setActiveFilter("all"); }}>عرض كل المنتجات</button>
            </div>
          )}
          <p className={styles.priceNote}>المنتجات والأسعار للتجربة فقط، ولا تمثل علامات تجارية أو عروض شراء حقيقية.</p>
        </section>

        <section className={styles.guide} id="guide" aria-labelledby="guide-title">
          <div className={styles.guideIntro}>
            <p className={styles.eyebrow}>قبل ما تشتري</p>
            <h2 id="guide-title">بصّ على القاعدة<br />قبل درجة النور.</h2>
            <p>افصل الكهرباء، وشوف الرمز المكتوب على اللمبة القديمة أو وحدة الإضاءة. القاعدة الغلط مش هتركب.</p>
          </div>
          <div className={styles.socketList}>
            <article className={styles.socketTip}><strong>E27</strong><span>القلاوظ الكبير</span><small>الأكثر شيوعًا في اللمبات المنزلية.</small></article>
            <article className={styles.socketTip}><strong>E14</strong><span>القلاوظ الصغير</span><small>يناسب كثيرًا من الأباجورات والنجف.</small></article>
            <article className={styles.socketTip}><strong>GU10</strong><span>سبوت بلفّة</span><small>للوحدات الكشافات والسبوتات.</small></article>
          </div>
        </section>

        <section className={styles.about} id="about">
          <span className={styles.aboutIcon}><Lightbulb size={21} aria-hidden="true" /></span>
          <div><h2>نور مناسب، من غير تعقيد.</h2><p>Lamp يعرض أفكارًا افتراضية لمصابيح منزلية بصور واقعية للتجربة فقط.</p></div>
          <a href="#products">ارجع للمنتجات <ArrowLeft size={16} aria-hidden="true" /></a>
        </section>
      </main>

      <footer className={styles.footer}>
        <a className={styles.footerBrand} href="#top">Lamp</a>
        <p>الصور والموديلات والأسعار افتراضية للعرض فقط؛ لا يوجد بيع أو دفع إلكتروني.</p>
        <span>© {new Date().getFullYear()} Lamp</span>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">{cartNotice}</span>

      {cartOpen ? (
        <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className={styles.cartDrawer} role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className={styles.drawerHeader}>
              <div><p className={styles.eyebrow}>اختياراتك</p><h2 id="cart-title">سلة المشتريات</h2></div>
              <button className={styles.closeButton} type="button" onClick={() => setCartOpen(false)} aria-label="إغلاق السلة"><X size={20} aria-hidden="true" /></button>
            </div>
            {cartProducts.length > 0 ? (
              <>
                <div className={styles.cartItems}>
                  {cartProducts.map((product) => (
                    <div className={styles.cartItem} key={product.id}>
                      <div className={styles.cartItemArt}>
                        <Image className={`${styles.cartPhoto} ${darkMode ? "" : styles.cartPhotoVisible}`} src={product.offImageUrl} alt="" fill quality={90} sizes="64px" />
                        <Image className={`${styles.cartPhoto} ${darkMode ? styles.cartPhotoVisible : ""}`} src={product.onImageUrl} alt="" fill quality={90} sizes="64px" />
                      </div>
                      <div className={styles.cartItemInfo}>
                        <strong>{product.name}</strong>
                        <span>{formatPrice(product.price)} · سعر تجريبي</span>
                        <div className={styles.quantityControl}>
                          <button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`تقليل كمية ${product.name}`}><Minus size={14} aria-hidden="true" /></button>
                          <span>{priceFormatter.format(cart[product.id])}</span>
                          <button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label={`زيادة كمية ${product.name}`}><Plus size={14} aria-hidden="true" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.cartTotal}><span>إجمالي تقريبي</span><strong>{formatPrice(cartTotal)}</strong></div>
                <p className={styles.cartDisclaimer}>السلة للتجربة فقط؛ لا يوجد شراء حقيقي أو دفع إلكتروني.</p>
                <button className={styles.drawerDone} type="button" onClick={() => setCartOpen(false)}>متابعة التصفح</button>
              </>
            ) : (
              <div className={styles.emptyCart}>
                <span><ShoppingBag size={25} aria-hidden="true" /></span>
                <h3>السلة لسه فاضية</h3>
                <p>أضف الموديلات الافتراضية للمعاينة هنا.</p>
                <button type="button" onClick={() => setCartOpen(false)}>تصفّح المنتجات</button>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
