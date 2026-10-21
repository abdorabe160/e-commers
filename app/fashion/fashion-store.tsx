"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  categories,
  fashionProducts,
  slotLabels,
  type Category,
  type FashionProduct,
  type Slot,
} from "@/lib/fashion-products";
import type { Outfit } from "./avatar";
import Avatar3D from "./avatar-3d";
import styles from "./fashion.module.css";

type CartLine = { key: string; product: FashionProduct; size: string; qty: number };
type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

const skinTones = [
  { value: "#f6d2b8", label: "فاتح" },
  { value: "#e8b48f", label: "حنطي" },
  { value: "#c68863", label: "قمحي" },
  { value: "#8d5a3c", label: "أسمر" },
];

const slotOrder: Slot[] = ["hat", "glasses", "outer", "top", "bottom", "shoes", "bag"];

const priceFormatter = new Intl.NumberFormat("ar-EG");
const formatPrice = (value: number) => `${priceFormatter.format(value)} ج.م`;

let toastSeq = 0;

function randomLook(): Outfit {
  const pick = (slot: Slot) => {
    const options = fashionProducts.filter((p) => p.slot === slot);
    return options[Math.floor(Math.random() * options.length)];
  };
  const look: Outfit = { top: pick("top"), bottom: pick("bottom"), shoes: pick("shoes") };
  for (const slot of ["outer", "hat", "glasses", "bag"] as Slot[]) {
    if (Math.random() > 0.5) look[slot] = pick(slot);
  }
  return look;
}

const pickSize = (product: FashionProduct) =>
  product.sizes[Math.min(1, product.sizes.length - 1)];

function ProductCard({
  product,
  worn,
  onTry,
  onAdd,
}: {
  product: FashionProduct;
  worn: boolean;
  onTry: () => void;
  onAdd: () => void;
}) {
  return (
    <article className={styles.card} data-worn={worn || undefined}>
      <div className={styles.cardArt}>
        <Image
          src={product.image}
          alt={`${product.name}، ${product.colorName}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1080px) 33vw, 280px"
          className={styles.photo}
          style={product.imagePosition ? { objectPosition: product.imagePosition } : undefined}
        />
        {product.badge && <span className={styles.badge}>{product.badge}</span>}
        {worn && (
          <span className={styles.wornTag}>
            <Check size={13} strokeWidth={3} /> لابسه دلوقتي
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={styles.swatch} style={{ background: product.color }} aria-hidden="true" />
          <span>{product.colorName}</span>
          <span className={styles.rating}>
            <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {priceFormatter.format(product.rating)}
          </span>
        </div>
        <h3 className={styles.cardTitle}>{product.name}</h3>
        <p className={styles.cardDesc}>{product.description}</p>
        <div className={styles.priceRow}>
          <strong>{formatPrice(product.price)}</strong>
          {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
        </div>
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.tryButton}
            data-active={worn || undefined}
            aria-pressed={worn}
            onClick={onTry}
          >
            {worn ? <X size={16} /> : <Shirt size={16} />}
            {worn ? "اقلعه" : <>جرّبه<span className={styles.tryLong}> على الشخصية</span></>}
          </button>
          <button type="button" className={styles.iconButton} onClick={onAdd} aria-label={`أضف ${product.name} للسلة`}>
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function FashionStore() {
  const [category, setCategory] = useState<"all" | Category>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");
  const [outfit, setOutfit] = useState<Outfit>({});
  const [skin, setSkin] = useState(skinTones[1].value);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!cartOpen && !roomOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setRoomOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, roomOpen]);

  const notify = (text: string) => setToast({ id: ++toastSeq, text });

  const visible = useMemo(() => {
    const q = query.trim();
    const list = fashionProducts.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.includes(q) || p.colorName.includes(q) || p.description.includes(q)),
    );
    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, query, sort]);

  const wornItems = slotOrder.flatMap((slot) => (outfit[slot] ? [outfit[slot]] : []));
  const outfitTotal = wornItems.reduce((sum, p) => sum + p.price, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.qty * line.product.price, 0);

  const toggleTry = (product: FashionProduct) => {
    const isWorn = outfit[product.slot]?.id === product.id;
    setOutfit((current) => {
      const next = { ...current };
      if (isWorn) delete next[product.slot];
      else next[product.slot] = product;
      return next;
    });
    notify(isWorn ? `قلعنا ${product.name}` : `الشخصية لبست ${product.name} ✨`);
  };

  const removeFromOutfit = (slot: Slot) =>
    setOutfit((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });

  const randomOutfit = () => {
    setOutfit(randomLook());
    notify("جهزنالك لوك جديد 🎲");
  };

  const addToCart = (products: FashionProduct[]) => {
    setCart((current) => {
      const next = [...current];
      for (const product of products) {
        const size = pickSize(product);
        const key = `${product.id}:${size}`;
        const existing = next.findIndex((line) => line.key === key);
        if (existing >= 0) next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
        else next.push({ key, product, size, qty: 1 });
      }
      return next;
    });
    notify(products.length === 1 ? `اتضاف ${products[0].name} للسلة` : `اتضاف اللوك كامل (${products.length} قطع) للسلة`);
  };

  const updateQty = (key: string, delta: number) =>
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        const qty = line.qty + delta;
        return qty > 0 ? [{ ...line, qty }] : [];
      }),
    );

  const changeSize = (key: string, size: string) =>
    setCart((current) => {
      const line = current.find((l) => l.key === key);
      if (!line) return current;
      const newKey = `${line.product.id}:${size}`;
      const merged = current.find((l) => l.key === newKey);
      const rest = current.filter((l) => l.key !== key && l.key !== newKey);
      const qty = line.qty + (merged?.qty ?? 0);
      return [...rest, { ...line, key: newKey, size, qty }];
    });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#" className={styles.logo} aria-label="دولاب، الصفحة الرئيسية">
            <span className={styles.logoMark}>د</span>
            دولاب
          </a>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر على تيشيرت، جينز، لون…"
              aria-label="بحث في المنتجات"
            />
          </label>
          <button type="button" className={styles.cartButton} onClick={() => setCartOpen(true)}>
            <ShoppingBag size={20} />
            <span className={styles.cartLabel}>السلة</span>
            {cartCount > 0 && <span className={styles.cartCount}>{priceFormatter.format(cartCount)}</span>}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>
                <Sparkles size={15} /> مجموعة الخريف ٢٠٢٦
              </p>
              <h1>
                جرّب قبل ما تشتري،
                <br />
                <span>والبس اللي يشبهك.</span>
              </h1>
              <p className={styles.heroText}>
                دوس «جرّبه على الشخصية» على أي قطعة، وشوفها على الموديل في غرفة البروفة. نسّق اللوك كله وضيفه للسلة بضغطة.
              </p>
            </div>
            <ul className={styles.perks}>
              <li><strong>شحن مجاني</strong> فوق ١٥٠٠ ج.م</li>
              <li><strong>استبدال</strong> خلال ١٤ يوم</li>
              <li><strong>دفع</strong> عند الاستلام</li>
            </ul>
          </section>

          <div className={styles.toolbar}>
            <div className={styles.chips} role="tablist" aria-label="الأقسام">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="tab"
                  aria-selected={category === c.value}
                  className={styles.chip}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className={styles.sort}>
              <span>ترتيب:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="featured">المميز</option>
                <option value="price-asc">السعر: من الأقل</option>
                <option value="price-desc">السعر: من الأعلى</option>
                <option value="rating">الأعلى تقييمًا</option>
              </select>
            </label>
          </div>

          <p className={styles.resultCount}>{priceFormatter.format(visible.length)} منتج</p>

          {visible.length > 0 ? (
            <div className={styles.grid}>
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  worn={outfit[product.slot]?.id === product.id}
                  onTry={() => toggleTry(product)}
                  onAdd={() => addToCart([product])}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>مفيش منتجات مطابقة لـ «{query}».</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>
                اعرض كل المنتجات
              </button>
            </div>
          )}
        </main>

        <aside className={styles.room} data-open={roomOpen || undefined} aria-label="غرفة البروفة">
          <div className={styles.roomCard}>
            <div className={styles.roomHead}>
              <div>
                <h2>غرفة البروفة</h2>
                <p>{wornItems.length ? `لابس ${priceFormatter.format(wornItems.length)} قطع` : "اختار قطعة وجرّبها"}</p>
              </div>
              <div className={styles.roomTools}>
                <button type="button" className={styles.ghostIcon} onClick={randomOutfit} aria-label="لوك عشوائي" title="لوك عشوائي">
                  <Shuffle size={17} />
                </button>
                <button
                  type="button"
                  className={styles.ghostIcon}
                  onClick={() => setOutfit({})}
                  disabled={!wornItems.length}
                  aria-label="اقلع كل حاجة"
                  title="ابدأ من جديد"
                >
                  <RotateCcw size={17} />
                </button>
                <button type="button" className={`${styles.ghostIcon} ${styles.roomClose}`} onClick={() => setRoomOpen(false)} aria-label="اقفل غرفة البروفة">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.stage}>
              <Avatar3D
                outfit={outfit}
                skin={skin}
                label={wornItems.length ? `الشخصية لابسة: ${wornItems.map((p) => p.name).join("، ")}` : "الشخصية بدون قطع من المتجر"}
                onRemove={removeFromOutfit}
                onAdd={(product) => addToCart([product])}
              />
              <div className={styles.skinPicker} role="radiogroup" aria-label="لون البشرة">
                {skinTones.map((tone) => (
                  <button
                    key={tone.value}
                    type="button"
                    role="radio"
                    aria-checked={skin === tone.value}
                    aria-label={tone.label}
                    title={tone.label}
                    style={{ background: tone.value }}
                    onClick={() => setSkin(tone.value)}
                  />
                ))}
              </div>
            </div>

            {wornItems.length > 0 ? (
              <ul className={styles.wornList}>
                {wornItems.map((item) => (
                  <li key={item.id} title={`${slotLabels[item.slot]}: ${item.name} — ${formatPrice(item.price)}`}>
                    <span className={styles.wornThumb}>
                      <Image src={item.image} alt="" fill sizes="32px" className={styles.photo} />
                    </span>
                    <span className={styles.wornName}>{item.name}</span>
                    <button type="button" onClick={() => removeFromOutfit(item.slot)} aria-label={`اقلع ${item.name}`}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.roomHint}>
                كل قطعة بتتلبس في مكانها: تيشيرت، جاكيت، بنطلون، جزمة، كاب، نظارة وشنطة. جرّب أكتر من قطعة مع بعض!
              </p>
            )}

            <div className={styles.roomFooter}>
              <div className={styles.total}>
                <span>إجمالي اللوك</span>
                <strong>{formatPrice(outfitTotal)}</strong>
              </div>
              <button
                type="button"
                className={styles.primary}
                disabled={!wornItems.length}
                onClick={() => addToCart(wornItems)}
              >
                <ShoppingBag size={18} /> أضف اللوك كله للسلة
              </button>
            </div>
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <p>دولاب متجر تجريبي: الأسعار والطلبات للعرض فقط.</p>
        <p>
          موديلات غرفة البروفة ثلاثية الأبعاد:{" "}
          <a href="https://quaternius.itch.io/universal-base-characters" target="_blank" rel="noreferrer">Universal Base Characters</a> من Quaternius (CC0).
        </p>
        <p>
          صور المنتجات من{" "}
          <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a> بعدسة:{" "}
          {fashionProducts.map((p, i) => (
            <span key={p.id}>
              {i > 0 && "، "}
              <a href={p.credit.url} target="_blank" rel="noreferrer">{p.credit.name}</a>
            </span>
          ))}
        </p>
      </footer>

      <button type="button" className={styles.roomFab} onClick={() => setRoomOpen(true)}>
        <Shirt size={19} /> غرفة البروفة
        {wornItems.length > 0 && <span key={wornItems.length}>{priceFormatter.format(wornItems.length)}</span>}
      </button>
      {roomOpen && <div className={styles.scrim} onClick={() => setRoomOpen(false)} aria-hidden="true" />}

      {cartOpen && <div className={styles.scrim} onClick={() => setCartOpen(false)} aria-hidden="true" />}
      <div className={styles.drawer} data-open={cartOpen || undefined} role="dialog" aria-modal="true" aria-label="سلة المشتريات" inert={!cartOpen}>
        <div className={styles.drawerHead}>
          <h2>السلة {cartCount > 0 && <span>({priceFormatter.format(cartCount)})</span>}</h2>
          <button type="button" className={styles.ghostIcon} onClick={() => setCartOpen(false)} aria-label="اقفل السلة">
            <X size={20} />
          </button>
        </div>
        {cart.length === 0 ? (
          <div className={styles.drawerEmpty}>
            <ShoppingBag size={40} strokeWidth={1.4} />
            <p>السلة فاضية لسه.</p>
            <button type="button" className={styles.secondary} onClick={() => setCartOpen(false)}>كمّل تسوق</button>
          </div>
        ) : (
          <>
            <ul className={styles.cartList}>
              {cart.map((line) => (
                <li key={line.key}>
                  <div className={styles.cartThumb}>
                    <Image src={line.product.image} alt="" fill sizes="78px" className={styles.photo} />
                  </div>
                  <div className={styles.cartInfo}>
                    <strong>{line.product.name}</strong>
                    <span>{line.product.colorName}</span>
                    {line.product.sizes.length > 1 && (
                      <select
                        value={line.size}
                        onChange={(e) => changeSize(line.key, e.target.value)}
                        aria-label={`مقاس ${line.product.name}`}
                      >
                        {line.product.sizes.map((s) => (
                          <option key={s} value={s}>المقاس: {s}</option>
                        ))}
                      </select>
                    )}
                    <div className={styles.qty}>
                      <button type="button" onClick={() => updateQty(line.key, 1)} aria-label="زوّد الكمية"><Plus size={14} /></button>
                      <span>{priceFormatter.format(line.qty)}</span>
                      <button type="button" onClick={() => updateQty(line.key, -1)} aria-label="قلّل الكمية">
                        {line.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                      </button>
                    </div>
                  </div>
                  <strong className={styles.linePrice}>{formatPrice(line.qty * line.product.price)}</strong>
                </li>
              ))}
            </ul>
            <div className={styles.drawerFoot}>
              <div className={styles.total}>
                <span>الإجمالي</span>
                <strong>{formatPrice(cartTotal)}</strong>
              </div>
              <p className={styles.shippingNote}>
                {cartTotal >= 1500
                  ? "مبروك! الشحن عليك مجانًا 🎉"
                  : `فاضل ${formatPrice(1500 - cartTotal)} وتاخد شحن مجاني`}
              </p>
              <button type="button" className={styles.primary} onClick={() => notify("ده متجر تجريبي، مفيش دفع حقيقي 🙂")}>
                إتمام الطلب
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div key={toast.id} className={styles.toast} data-room-open={roomOpen || undefined} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
