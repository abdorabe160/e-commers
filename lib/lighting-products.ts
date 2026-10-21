export type SocketType = "E27" | "E14" | "GU10";
export type LightingCategory = "smart" | "decorative" | "ambient" | "task";

export type LightingProduct = {
  id: string;
  category: LightingCategory;
  brand: string;
  name: string;
  description: string;
  offImageUrl: string;
  offImageAlt: string;
  onImageUrl: string;
  onImageAlt: string;
  socket: SocketType | "مدمج";
  watts: number;
  lumens: number;
  kelvin: number;
  pieces: number;
  price: number;
  dimmable: boolean;
};

export const lightingProducts: LightingProduct[] = [
  {
    id: "lamp-e27-opal",
    category: "decorative",
    brand: "Lamp · تصميم افتراضي",
    name: "لمبة LED كروية E27",
    description: "ضوء دافئ ناعم للاستخدام اليومي",
    offImageUrl: "/images/bulb-e27-off.webp",
    offImageAlt: "تصميم افتراضي واقعي لمبة E27 مطفأة في وحدة معلقة",
    onImageUrl: "/images/bulb-e27-on.webp",
    onImageAlt: "تصميم افتراضي واقعي لمبة E27 مضاءة بضوء دافئ",
    socket: "E27",
    watts: 5,
    lumens: 470,
    kelvin: 2700,
    pieces: 1,
    price: 125,
    dimmable: false,
  },
  {
    id: "lamp-e14-candle",
    category: "decorative",
    brand: "Lamp · تصميم افتراضي",
    name: "لمبة LED شمعة E14",
    description: "حجم رشيق مناسب للأباجورات والنجف",
    offImageUrl: "/images/bulb-e14-off.webp",
    offImageAlt: "تصميم افتراضي واقعي لمبة شمعة E14 مطفأة في حامل حائطي",
    onImageUrl: "/images/bulb-e14-on.webp",
    onImageAlt: "تصميم افتراضي واقعي لمبة شمعة E14 مضاءة بضوء دافئ",
    socket: "E14",
    watts: 3,
    lumens: 250,
    kelvin: 2700,
    pieces: 1,
    price: 145,
    dimmable: false,
  },
  {
    id: "lamp-gu10-spot",
    category: "ambient",
    brand: "Lamp · تصميم افتراضي",
    name: "لمبة سبوت LED GU10",
    description: "إضاءة مركزة لإبراز زاوية أو مساحة صغيرة",
    offImageUrl: "/images/bulb-gu10-off.webp",
    offImageAlt: "تصميم افتراضي واقعي لوحدة سبوت GU10 مطفأة في السقف",
    onImageUrl: "/images/bulb-gu10-on.webp",
    onImageAlt: "تصميم افتراضي واقعي لوحدة سبوت GU10 مضاءة",
    socket: "GU10",
    watts: 3,
    lumens: 230,
    kelvin: 3000,
    pieces: 1,
    price: 159,
    dimmable: false,
  },
  {
    id: "lamp-aurora-smart",
    category: "smart",
    brand: "Lamp · تصميم افتراضي",
    name: "لمبة Aurora الذكية",
    description: "إضاءة ذكية بتدرجات هادئة لغرفتك",
    offImageUrl: "/images/smart-bulb-day.webp",
    offImageAlt: "تصميم افتراضي للمبة ذكية مطفأة في ضوء النهار",
    onImageUrl: "/images/smart-bulb.webp",
    onImageAlt: "تصميم افتراضي للمبة ذكية مضاءة بتدرجات لونية",
    socket: "E27",
    watts: 9,
    lumens: 806,
    kelvin: 2700,
    pieces: 1,
    price: 259,
    dimmable: true,
  },
  {
    id: "lamp-edison-amber",
    category: "decorative",
    brand: "Lamp · تصميم افتراضي",
    name: "لمبة Edison كهرمانية",
    description: "فتيلة ظاهرة وتوهج دافئ للزوايا الهادئة",
    offImageUrl: "/images/edison-amber-day.webp",
    offImageAlt: "تصميم افتراضي للمبة Edison مطفأة في ضوء النهار",
    onImageUrl: "/images/edison-amber.webp",
    onImageAlt: "تصميم افتراضي للمبة Edison متوهجة",
    socket: "E27",
    watts: 4,
    lumens: 400,
    kelvin: 2200,
    pieces: 1,
    price: 189,
    dimmable: true,
  },
  {
    id: "lamp-led-strip",
    category: "ambient",
    brand: "Lamp · تصميم افتراضي",
    name: "شريط LED مخفي",
    description: "خط نور ناعم خلف الأرفف والحوائط",
    offImageUrl: "/images/led-strip-day.webp",
    offImageAlt: "تصميم افتراضي لشريط LED مخفي مطفأ في ضوء النهار",
    onImageUrl: "/images/led-strip.webp",
    onImageAlt: "تصميم افتراضي لشريط LED مخفي مضاء",
    socket: "مدمج",
    watts: 9,
    lumens: 600,
    kelvin: 2700,
    pieces: 1,
    price: 220,
    dimmable: true,
  },
  {
    id: "lamp-task-brass",
    category: "task",
    brand: "Lamp · تصميم افتراضي",
    name: "مصباح مكتب نحاسي",
    description: "ذراع متحرك وضوء مركز للقراءة والعمل",
    offImageUrl: "/images/task-lamp-day.webp",
    offImageAlt: "تصميم افتراضي لمصباح مكتب نحاسي مطفأ في ضوء النهار",
    onImageUrl: "/images/task-lamp.webp",
    onImageAlt: "تصميم افتراضي لمصباح مكتب نحاسي مضاء",
    socket: "مدمج",
    watts: 7,
    lumens: 520,
    kelvin: 3000,
    pieces: 1,
    price: 420,
    dimmable: false,
  },
];
