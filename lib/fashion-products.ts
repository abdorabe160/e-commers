export type Slot = "hat" | "glasses" | "top" | "outer" | "bottom" | "shoes" | "bag";

export type GarmentKind =
  | "tee"
  | "hoodie"
  | "shirt"
  | "sweater"
  | "jacket"
  | "coat"
  | "jeans"
  | "chinos"
  | "shorts"
  | "skirt"
  | "sneakers"
  | "boots"
  | "cap"
  | "beanie"
  | "sunglasses"
  | "round-glasses"
  | "crossbody"
  | "tote";

export type FabricFinish = "cotton" | "knit" | "denim" | "twill" | "nylon" | "leather" | "tulle" | "metal" | "plastic";

export type Category = "tops" | "outerwear" | "bottoms" | "shoes" | "accessories";

export type FashionProduct = {
  id: string;
  name: string;
  description: string;
  slot: Slot;
  kind: GarmentKind;
  category: Category;
  /** Main fabric color */
  color: string;
  /** Detail color: stitching, sole, print, lens… */
  accent: string;
  colorName: string;
  price: number;
  oldPrice?: number;
  rating: number;
  badge?: "جديد" | "خصم" | "الأكثر مبيعًا";
  sizes: string[];
  /** Product photo in /public */
  image: string;
  /** CSS object-position, for photos where the item isn't centred */
  imagePosition?: string;
  credit: { name: string; url: string };
  /** Swatch cut from the product photo, used as the 3D garment's texture; size = real width in metres. */
  fabric?: { src: string; size: number; finish: FabricFinish };
};

export const slotLabels: Record<Slot, string> = {
  hat: "غطاء الرأس",
  glasses: "النظارة",
  top: "الجزء العلوي",
  outer: "الجاكيت",
  bottom: "الجزء السفلي",
  shoes: "الحذاء",
  bag: "الشنطة",
};

export const categories: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "tops", label: "تيشيرتات وقمصان" },
  { value: "outerwear", label: "جواكت" },
  { value: "bottoms", label: "بناطيل وجيبات" },
  { value: "shoes", label: "أحذية" },
  { value: "accessories", label: "إكسسوارات" },
];

const clothing = ["S", "M", "L", "XL"];
const shoeSizes = ["40", "41", "42", "43", "44"];
const oneSize = ["مقاس واحد"];

const u = (slug: string) => `https://unsplash.com/photos/${slug}`;

export const fashionProducts: FashionProduct[] = [
  { id: "tee-white", name: "تيشيرت قطن أبيض", description: "قطن ١٠٠٪ ياقة دائرية، الأساسي اللي لازم يبقى في كل دولاب.", slot: "top", kind: "tee", category: "tops", color: "#ececee", accent: "#c8a57a", colorName: "أبيض", price: 349, rating: 4.7, badge: "الأكثر مبيعًا", sizes: clothing, image: "/products/tee-white.webp", credit: { name: "Avtar Singh", url: u("a-plain-white-t-shirt-hangs-on-a-wooden-hanger-8ACmRoleM24") }, fabric: { src: "/products/fabric/tee-white.webp", size: 0.23, finish: "cotton" } },
  { id: "tee-black", name: "تيشيرت قطن أسود", description: "قصة ريجولر وخامة تقيلة مش بتبهت مع الغسيل.", slot: "top", kind: "tee", category: "tops", color: "#1f2124", accent: "#6b4a3a", colorName: "أسود", price: 349, rating: 4.6, sizes: clothing, image: "/products/tee-black.webp", credit: { name: "Luis Quintero", url: u("man-wearing-black-crew-neck-t-shirt-3qqiMT2LdR8") }, fabric: { src: "/products/fabric/tee-black.webp", size: 0.1, finish: "cotton" } },
  { id: "hoodie-rust", name: "هودي فليس نحاسي", description: "بطانة فليس ناعمة وجيب كنغر وكابيشون برباط.", slot: "top", kind: "hoodie", category: "tops", color: "#8a5440", accent: "#1e1e1e", colorName: "بني نحاسي", price: 749, oldPrice: 899, rating: 4.8, badge: "خصم", sizes: clothing, image: "/products/hoodie-1.webp", credit: { name: "Ali Saadat", url: u("person-in-brown-hoodie-and-black-pants-standing-on-staircase-ikLELWYbyxk") }, fabric: { src: "/products/fabric/hoodie-1.webp", size: 0.19, finish: "cotton" } },
  { id: "sweatshirt-white", name: "سويت شيرت أوف وايت", description: "سويت شيرت ياقة دائرية بأساور مضلعة، دافي من غير تقل.", slot: "top", kind: "sweater", category: "tops", color: "#eeeaec", accent: "#9a9a9a", colorName: "أوف وايت", price: 649, rating: 4.5, sizes: clothing, image: "/products/hoodie-2.webp", credit: { name: "Mediamodifier", url: u("white-crew-neck-long-sleeve-shirt-7cERndkOyDw") }, fabric: { src: "/products/fabric/hoodie-2.webp", size: 0.23, finish: "cotton" } },
  { id: "shirt-flannel", name: "قميص فلانيل كاروهات", description: "فلانيل قطن مخملي بكاروهات أحمر وأسود.", slot: "top", kind: "shirt", category: "tops", color: "#7a2428", accent: "#1a1a1a", colorName: "أحمر نبيتي", price: 599, rating: 4.6, badge: "جديد", sizes: clothing, image: "/products/shirt.webp", credit: { name: "Yap", url: u("red-and-black-plaid-dress-shirt-Kvu8S9HlvcA") }, fabric: { src: "/products/fabric/shirt.webp", size: 0.17, finish: "cotton" } },
  { id: "jacket-denim", name: "جاكيت جينز بياقة قطيفة", description: "دنيم نيلي غامق بياقة قطيفة بني وزراير معدن.", slot: "outer", kind: "jacket", category: "outerwear", color: "#34446a", accent: "#9c6a2e", colorName: "نيلي غامق", price: 1099, rating: 4.7, sizes: clothing, image: "/products/jacket-denim.webp", credit: { name: "Caio Coelho", url: u("blue-denim-button-up-jacket-QRN47la37gw") }, fabric: { src: "/products/fabric/jacket-denim.webp", size: 0.07, finish: "denim" } },
  { id: "jacket-bomber", name: "جاكيت بومبر", description: "نايلون خفيف للخريف بأساور ووسط مضلع.", slot: "outer", kind: "jacket", category: "outerwear", color: "#ba7050", accent: "#2a2f3a", colorName: "بني محمر", price: 1249, oldPrice: 1450, rating: 4.6, badge: "خصم", sizes: clothing, image: "/products/jacket-2.webp", credit: { name: "Tobias Tullius", url: u("brown-bomber-jacket-on-hanger-Fg15LdqpWrs") }, fabric: { src: "/products/fabric/jacket-2.webp", size: 0.15, finish: "nylon" } },
  { id: "coat-trench", name: "ترينش كوت بحزام", description: "قصة طويلة كلاسيك بحزام في الوسط، للخريف والشتا.", slot: "outer", kind: "coat", category: "outerwear", color: "#c9b79c", accent: "#8a7356", colorName: "بيج", price: 1899, rating: 4.9, badge: "جديد", sizes: clothing, image: "/products/coat.webp", credit: { name: "Dane Moukao", url: u("a-woman-in-a-trench-coat-posing-for-a-picture-5vrque5NVHI") }, fabric: { src: "/products/fabric/coat.webp", size: 0.1, finish: "twill" } },
  { id: "jeans-blue", name: "جينز سليم أزرق", description: "دنيم مرن بقصة سليم وغسلة زرقا متوسطة.", slot: "bottom", kind: "jeans", category: "bottoms", color: "#3a5779", accent: "#c9a66b", colorName: "أزرق جينز", price: 799, rating: 4.6, badge: "الأكثر مبيعًا", sizes: ["30", "32", "34", "36"], image: "/products/jeans.webp", credit: { name: "TuanAnh Blue", url: u("a-pair-of-blue-jeans-on-a-white-background-9yoXrG6Er_g") }, fabric: { src: "/products/fabric/jeans.webp", size: 0.13, finish: "denim" } },
  { id: "chinos-khaki", name: "بنطلون تشينو كاكي", description: "قطن مرن بلون كاكي يمشي مع كل حاجة.", slot: "bottom", kind: "chinos", category: "bottoms", color: "#8a7d68", accent: "#5c5242", colorName: "كاكي", price: 649, rating: 4.4, sizes: ["30", "32", "34", "36"], image: "/products/chinos.webp", imagePosition: "center 35%", credit: { name: "Redd Francisco", url: u("man-wearing-brown-fitted-jeans-and-sneakers-standing-on-road-at-daytime-jC7nVH_Sw8k") }, fabric: { src: "/products/fabric/chinos.webp", size: 0.09, finish: "twill" } },
  { id: "shorts-denim", name: "شورت جينز فاتح", description: "غسلة فاتحة بستايل ممزق وحواف مطوية.", slot: "bottom", kind: "shorts", category: "bottoms", color: "#a9bdd2", accent: "#c9a66b", colorName: "أزرق فاتح", price: 449, rating: 4.3, sizes: clothing, image: "/products/shorts.webp", credit: { name: "engin akyurt", url: u("blue-denim-shorts-on-white-surface-Hd4nlxLgIbA") }, fabric: { src: "/products/fabric/shorts.webp", size: 0.08, finish: "denim" } },
  { id: "skirt-tulle", name: "جيبة تول ميدي", description: "طبقات تول خفيفة بطول ميدي وحركة ناعمة.", slot: "bottom", kind: "skirt", category: "bottoms", color: "#8a5a30", accent: "#e8cfc0", colorName: "كراميل", price: 699, rating: 4.7, badge: "جديد", sizes: clothing, image: "/products/skirt.webp", imagePosition: "62% center", credit: { name: "Gaelle Marcel", url: u("brown-skirt-hanged-on-wall-1PKjyPsH8sw") }, fabric: { src: "/products/fabric/skirt.webp", size: 0.24, finish: "tulle" } },
  { id: "sneakers-white", name: "كوتشي جلد أبيض", description: "جلد ناعم بقصة لو-توب ونعل مريح لليوم كله.", slot: "shoes", kind: "sneakers", category: "shoes", color: "#f2f2f0", accent: "#8a9098", colorName: "أبيض", price: 1299, rating: 4.8, badge: "الأكثر مبيعًا", sizes: shoeSizes, image: "/products/sneakers-white.webp", credit: { name: "Mnz", url: u("pair-of-white-low-top-sneakers-BeClz11lyXY") }, fabric: { src: "/products/fabric/sneakers-white.webp", size: 0.05, finish: "leather" } },
  { id: "sneakers-chunky", name: "كوتشي شانكي ملوّن", description: "نعل عالي وألوان مبهجة: برتقالي ومنت وبنفسجي.", slot: "shoes", kind: "sneakers", category: "shoes", color: "#e8e4de", accent: "#d6303a", colorName: "ملوّن", price: 1499, oldPrice: 1699, rating: 4.5, badge: "خصم", sizes: shoeSizes, image: "/products/sneakers-2.webp", credit: { name: "Irene Kredenets", url: u("pair-of-white-and-orange-athletic-shoes-on-white-box-dwKiHoqqxk8") }, fabric: { src: "/products/fabric/sneakers-2.webp", size: 0.04, finish: "twill" } },
  { id: "boots-leather", name: "بوت جلد برباط", description: "جلد طبيعي بني غامق ونعل متين بيستحمل.", slot: "shoes", kind: "boots", category: "shoes", color: "#4a2a1c", accent: "#1a1a1a", colorName: "بني غامق", price: 1899, rating: 4.7, sizes: shoeSizes, image: "/products/boots.webp", credit: { name: "Zac Wolff", url: u("brown-leather-lace-up-boots-esxf7PJmExQ") }, fabric: { src: "/products/fabric/boots.webp", size: 0.05, finish: "leather" } },
  { id: "cap-charcoal", name: "كاب قطن مغسول", description: "قطن مغسول بلون فحمي ومقاس قابل للتعديل.", slot: "hat", kind: "cap", category: "accessories", color: "#4b4c55", accent: "#1e1e22", colorName: "رمادي فحمي", price: 299, rating: 4.4, sizes: oneSize, image: "/products/cap.webp", credit: { name: "Yang Deng", url: u("gray-baseball-cap-on-white-surface-2loKxdi6Hmo") }, fabric: { src: "/products/fabric/cap.webp", size: 0.05, finish: "twill" } },
  { id: "beanie-knit", name: "طاقية تريكو بطيّة", description: "تريكو دافي بطيّة عريضة وباتش صغير.", slot: "hat", kind: "beanie", category: "accessories", color: "#2e2c2a", accent: "#e6e6e6", colorName: "فحمي غامق", price: 249, rating: 4.6, sizes: oneSize, image: "/products/beanie.webp", credit: { name: "Ryan Hoffman", url: u("black-knit-cap-on-white-surface-2BK0JEwQSpQ") }, fabric: { src: "/products/fabric/beanie.webp", size: 0.1, finish: "knit" } },
  { id: "sunglasses-round", name: "نظارة شمس دائرية", description: "إطار شفاف شامبين وعدسات بني بحماية UV400.", slot: "glasses", kind: "sunglasses", category: "accessories", color: "#d9cbb8", accent: "#7d4219", colorName: "شامبين", price: 549, rating: 4.5, sizes: oneSize, image: "/products/sunglasses.webp", credit: { name: "Sebastian Coman Travel", url: u("white-framed-brown-lens-sunglasses-dtOTQYmTEs0") } },
  { id: "glasses-silver", name: "نظارة نظر معدن", description: "إطار معدن فضي رفيع بستايل كلاسيك.", slot: "glasses", kind: "round-glasses", category: "accessories", color: "#b8b8bc", accent: "#f0f0f0", colorName: "فضي", price: 449, rating: 4.3, sizes: oneSize, image: "/products/glasses.webp", credit: { name: "Jocelyn Morales", url: u("silver-framed-eyeglasses-on-white-table-Mv7kokwzIMw") } },
  { id: "bag-sling", name: "شنطة كروس نايلون", description: "صغيرة وعملية بسوستة أمامية لموبايلك ومفاتيحك.", slot: "bag", kind: "crossbody", category: "accessories", color: "#1c1c1c", accent: "#b0b0b0", colorName: "أسود", price: 549, rating: 4.6, sizes: oneSize, image: "/products/bag-crossbody.webp", credit: { name: "Maryam Nemati", url: u("black-sling-bag-on-white-surface-LW2iqpHzr8Y") }, fabric: { src: "/products/fabric/bag-crossbody.webp", size: 0.05, finish: "nylon" } },
  { id: "bag-tote", name: "شنطة توت كانفاس", description: "كانفاس طبيعي سميك تشيل كل حاجة.", slot: "bag", kind: "tote", category: "accessories", color: "#e2e0da", accent: "#8f8f8f", colorName: "بيج كريمي", price: 329, rating: 4.4, sizes: oneSize, image: "/products/bag-tote.webp", credit: { name: "Brando Makes Branding", url: u("white-reusable-bag-on-gray-surface-smTDI-z1rlY") }, fabric: { src: "/products/fabric/bag-tote.webp", size: 0.16, finish: "cotton" } },
];
