# Frontend Developer Portfolio

بورتفوليو احترافي لمطور واجهات أمامية مع تأثيرات ثلاثية الأبعاد مذهلة باستخدام Three.js و GSAP.

## ✨ المميزات

- 🌌 **Hero Section ثلاثي الأبعاد** - مشهد فضائي تفاعلي مع نجوم، سديم، وجبال
- 🎬 **حركات GSAP سلسة** - انيميشنز احترافية على جميع العناصر
- 📱 **تصميم متجاوب بالكامل** - يعمل بسلاسة من 360px إلى 1440px+
- 🎨 **Framer Motion** - حركات micro-interactions لجميع المكونات
- 🌐 **دعم RTL كامل** - مصمم للعربية والإنجليزية
- ⚡ **أداء محسّن** - تحميل سريع وتجربة سلسة
- 🎯 **أقسام احترافية**:
  - Hero Section مع Three.js
  - About Section
  - Skills Section مع progress bars
  - Projects Section مع 6 مشاريع
  - Contact Section مع نموذج تواصل

## 🚀 التقنيات المستخدمة

- **Next.js 16.3.4** - إطار العمل الرئيسي
- **React 19** - مكتبة UI
- **TypeScript** - للأمان والكتابة القوية
- **Three.js** - للرسومات ثلاثية الأبعاد
- **GSAP** - للحركات والانيميشنز
- **Framer Motion** - لـ micro-interactions
- **Tailwind CSS 4** - للتنسيق
- **Lucide React** - للأيقونات

## 📦 التثبيت والتشغيل

### 1. تثبيت المكتبات

```bash
npm install
```

أو باستخدام yarn:

```bash
yarn install
```

### 2. تشغيل المشروع

```bash
npm run dev
```

المشروع سيعمل على: `http://localhost:3000`

### 3. بناء للإنتاج

```bash
npm run build
npm start
```

## 📁 هيكل المشروع

```
my-app/
├── app/
│   ├── sections/
│   │   ├── about.tsx        # قسم نبذة عني
│   │   ├── skills.tsx       # قسم المهارات
│   │   ├── projects.tsx     # قسم الأعمال
│   │   └── contact.tsx      # قسم التواصل
│   ├── layout.tsx           # التخطيط الرئيسي
│   ├── page.tsx             # الصفحة الرئيسية
│   └── globals.css          # التنسيقات العامة
├── components/
│   ├── ui/
│   │   └── horizon-hero.tsx # مكون Hero ثلاثي الأبعاد
│   └── navigation.tsx       # شريط التنقل
└── lib/
    └── utils.ts             # دوال مساعدة
```

## 🎨 الأقسام الرئيسية

### 1. Hero Section (Three.js)
- مشهد فضائي ثلاثي الأبعاد
- 5000+ نجم متحرك
- سديم مع shader effects
- جبال متعددة الطبقات
- يتفاعل مع التمرير (Scroll)

### 2. About Section
- نبذة عن المطور
- 4 كروت مميزات
- أزرار CTA متحركة
- تأثيرات hover سلسة

### 3. Skills Section
- 4 فئات مهارات
- Progress bars متحركة
- 16 مهارة تقنية
- ألوان gradient مميزة

### 4. Projects Section
- 6 مشاريع مميزة
- صور عالية الجودة من Unsplash
- Hover effects احترافية
- روابط GitHub و Live Demo
- Tags للتقنيات المستخدمة

### 5. Contact Section
- نموذج تواصل تفاعلي
- معلومات التواصل
- روابط السوشيال ميديا
- Validation وحالات loading

### 6. Navigation
- ثابت في الأعلى
- يتغير عند التمرير
- Smooth scroll للأقسام
- Responsive menu للموبايل
- Progress bar للتمرير

## 🎯 التخصيص

### تغيير المعلومات الشخصية

عدل ملفات الأقسام في `app/sections/`:

```typescript
// في contact.tsx
const contactInfo = [
  { icon: Mail, text: "your-email@example.com", href: "mailto:..." },
  { icon: Phone, text: "+20 123 456 7890", href: "tel:..." },
  // ...
];
```

### تغيير المشاريع

عدل مصفوفة المشاريع في `app/sections/projects.tsx`:

```typescript
const projects = [
  {
    title: "اسم مشروعك",
    description: "وصف المشروع",
    image: "رابط الصورة",
    tags: ["React", "Next.js"],
    github: "رابط GitHub",
    live: "رابط الموقع"
  }
];
```

### تغيير المهارات

عدل مصفوفة المهارات في `app/sections/skills.tsx`:

```typescript
const skills = [
  {
    category: "اسم الفئة",
    items: [
      { name: "اسم المهارة", level: 95, color: "from-cyan-400 to-blue-500" }
    ]
  }
];
```

### تغيير نصوص Hero

عدل في `components/ui/horizon-hero.tsx`:

```typescript
const titles = {
  0: 'عنوانك الأول',
  1: 'عنوانك الثاني',
  2: 'عنوانك الثالث'
};
```

## 🎨 الألوان

المشروع يستخدم نظام ألوان gradient:

- **Cyan to Blue**: `from-cyan-400 to-blue-500`
- **Purple to Pink**: `from-purple-500 to-pink-600`
- **Green to Emerald**: `from-green-400 to-emerald-500`
- **Slate**: `slate-950, slate-900, slate-800`

## 📱 التجاوب

التصميم متجاوب بالكامل:

- **Mobile**: 360px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px - 1439px
- **Large Desktop**: 1440px+

## ⚡ الأداء

- **Lazy Loading** للصور
- **Code Splitting** تلقائي من Next.js
- **WebGL Optimization** لـ Three.js
- **GSAP Performance** محسّن
- **Smooth Scroll** سلس

## 🔧 المشاكل الشائعة

### المشروع لا يعمل بعد npm install

```bash
# تأكد من إصدار Node.js
node --version  # يجب أن يكون 18+

# حذف node_modules وإعادة التثبيت
rm -rf node_modules package-lock.json
npm install
```

### Three.js types errors

```bash
npm install --save-dev @types/three
```

### الحركات لا تعمل

تأكد من تسجيل GSAP ScrollTrigger:

```typescript
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
```

## 🌐 Deployment

### Vercel (موصى به)

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm run build
# ارفع مجلد .next
```

## 📄 الترخيص

MIT License - استخدم المشروع كما تشاء!

## 🤝 المساهمة

المساهمات مرحب بها! افتح Issue أو Pull Request.

## 📧 التواصل

- **Email**: hello@frontend-dev.com
- **GitHub**: [your-github](https://github.com)
- **LinkedIn**: [your-linkedin](https://linkedin.com)

---

**Built with ❤️ using Next.js, Three.js, GSAP & Framer Motion**

صُنع بـ ❤️ باستخدام Next.js و Three.js و GSAP و Framer Motion
