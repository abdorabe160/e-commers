import type { FashionProduct, GarmentKind, Slot } from "@/lib/fashion-products";
import styles from "./fashion.module.css";

/*
 * The avatar and every garment share one 200×400 coordinate space, so a
 * garment drawn here lands on the body as-is, and the same drawing (cropped
 * with a viewBox) doubles as the product card illustration.
 */

export type Outfit = Partial<Record<Slot, FashionProduct>>;

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r} ${g} ${b})`;
}

const TORSO = "M66,128 Q100,116 134,128 L132,240 Q100,246 68,240 Z";
const ARM_L = { x1: 68, y1: 134, x2: 50, y2: 226 };
const ARM_R = { x1: 132, y1: 134, x2: 150, y2: 226 };

/** A point `t` (0..1) along an arm, used for sleeve length. */
const along = (arm: typeof ARM_L, t: number) => ({
  x: arm.x1 + (arm.x2 - arm.x1) * t,
  y: arm.y1 + (arm.y2 - arm.y1) * t,
});

function Sleeves({ color, length, width, cuff }: { color: string; length: number; width: number; cuff?: string }) {
  return (
    <>
      {[ARM_L, ARM_R].map((arm, i) => {
        const end = along(arm, length);
        const cuffStart = along(arm, length - 0.08);
        return (
          <g key={i}>
            <line x1={arm.x1} y1={arm.y1} x2={end.x} y2={end.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
            {cuff && <line x1={cuffStart.x} y1={cuffStart.y} x2={end.x} y2={end.y} stroke={cuff} strokeWidth={width} strokeLinecap="round" />}
          </g>
        );
      })}
    </>
  );
}

function Top({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  const line = shade(color, -0.22);
  switch (kind) {
    case "tee":
    case "sweater":
      return (
        <g>
          <Sleeves color={color} length={kind === "sweater" ? 0.94 : 0.36} width={27} cuff={kind === "sweater" ? line : undefined} />
          <path d={TORSO} fill={color} />
          <path d="M87,123 Q100,137 113,123" fill="none" stroke={line} strokeWidth={3} strokeLinecap="round" />
          <circle cx={100} cy={172} r={11} fill="none" stroke={accent} strokeWidth={3} />
          <path d="M95,172 L99,176 L106,168" fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "hoodie":
      return (
        <g>
          <Sleeves color={color} length={0.94} width={27} cuff={line} />
          <path d={TORSO} fill={color} />
          <path d="M74,130 Q100,100 126,130 Q100,142 74,130 Z" fill={line} />
          <path d="M80,200 L120,200 L126,226 L74,226 Z" fill="none" stroke={line} strokeWidth={2.5} strokeLinejoin="round" />
          <path d="M68,234 Q100,242 132,234" fill="none" stroke={line} strokeWidth={6} />
          <line x1={94} y1={134} x2={92} y2={162} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={106} y1={134} x2={108} y2={162} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case "shirt":
      return (
        <g>
          <Sleeves color={color} length={0.93} width={25} cuff={accent} />
          <path d={TORSO} fill={color} />
          <line x1={100} y1={134} x2={100} y2={242} stroke={line} strokeWidth={2} />
          {[152, 174, 196, 218].map((y) => (
            <circle key={y} cx={104} cy={y} r={2.2} fill={line} />
          ))}
          <rect x={112} y={150} width={14} height={14} rx={2} fill="none" stroke={line} strokeWidth={1.8} />
          <path d="M86,121 L100,134 L90,142 Z" fill={accent} stroke={line} strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M114,121 L100,134 L110,142 Z" fill={accent} stroke={line} strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      );
    default:
      return null;
  }
}

function Outer({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  const dark = shade(color, -0.25);
  const long = kind === "coat";
  const hem = long ? 312 : 246;
  return (
    <g>
      <Sleeves color={color} length={0.95} width={30} cuff={dark} />
      <path d={`M64,127 Q80,119 93,121 L96,${hem} L${long ? 56 : 63},${hem - 2} Z`} fill={color} />
      <path d={`M136,127 Q120,119 107,121 L104,${hem} L${long ? 144 : 137},${hem - 2} Z`} fill={color} />
      <path d="M80,121 L93,121 L95,160 Z" fill={dark} />
      <path d="M120,121 L107,121 L105,160 Z" fill={dark} />
      {long ? (
        <>
          <rect x={62} y={226} width={34} height={8} fill={accent} />
          <rect x={104} y={226} width={34} height={8} fill={accent} />
          <line x1={77} y1={248} x2={74} y2={300} stroke={dark} strokeWidth={2} />
          <line x1={123} y1={248} x2={126} y2={300} stroke={dark} strokeWidth={2} />
        </>
      ) : (
        <>
          <rect x={63} y={236} width={33} height={9} fill={dark} />
          <rect x={104} y={236} width={33} height={9} fill={dark} />
          {[160, 190, 220].map((y) => (
            <circle key={y} cx={90} cy={y} r={2.6} fill={accent} />
          ))}
          <rect x={70} y={160} width={16} height={12} rx={2} fill="none" stroke={dark} strokeWidth={2} />
          <rect x={114} y={160} width={16} height={12} rx={2} fill="none" stroke={dark} strokeWidth={2} />
        </>
      )}
    </g>
  );
}

function Bottom({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  const dark = shade(color, -0.2);
  if (kind === "skirt") {
    return (
      <g>
        <path d="M70,230 L130,230 L148,302 Q100,312 52,302 Z" fill={color} />
        {[74, 87, 100, 113, 126].map((x, i) => (
          <line key={x} x1={x + (i - 2) * 1} y1={240} x2={x + (i - 2) * 9} y2={304} stroke={dark} strokeWidth={1.8} />
        ))}
        <rect x={70} y={228} width={60} height={8} rx={2} fill={accent} />
      </g>
    );
  }
  const legEnd = kind === "shorts" ? 292 : 344;
  return (
    <g>
      <line x1={86} y1={248} x2={86} y2={legEnd} stroke={color} strokeWidth={kind === "shorts" ? 30 : 27} />
      <line x1={114} y1={248} x2={114} y2={legEnd} stroke={color} strokeWidth={kind === "shorts" ? 30 : 27} />
      <path d="M68,230 L132,230 L130,262 L68,262 Z" fill={color} />
      <rect x={68} y={230} width={64} height={7} fill={dark} />
      <rect x={96} y={231} width={8} height={5} rx={1} fill={accent} />
      <line x1={100} y1={238} x2={100} y2={262} stroke={dark} strokeWidth={2} />
      <path d="M72,240 Q80,248 88,240" fill="none" stroke={accent} strokeWidth={1.8} />
      <path d="M112,240 Q120,248 128,240" fill="none" stroke={accent} strokeWidth={1.8} />
      {kind === "shorts" ? (
        <>
          <rect x={66} y={258} width={10} height={16} rx={2} fill={dark} />
          <rect x={124} y={258} width={10} height={16} rx={2} fill={dark} />
        </>
      ) : (
        <>
          <line x1={78} y1={338} x2={94} y2={338} stroke={dark} strokeWidth={3} />
          <line x1={106} y1={338} x2={122} y2={338} stroke={dark} strokeWidth={3} />
        </>
      )}
    </g>
  );
}

function Shoes({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  const sole = kind === "boots" ? accent : "#ffffff";
  const edge = shade(color, -0.18);
  return (
    <g>
      {[72, 100].map((x) => (
        <g key={x}>
          {kind === "boots" && (
            <>
              <rect x={x + 1} y={300} width={26} height={50} rx={4} fill={color} />
              <rect x={x + 8} y={304} width={12} height={28} rx={5} fill={edge} />
            </>
          )}
          <rect x={x - 2} y={338} width={32} height={24} rx={11} fill={color} stroke={edge} strokeWidth={1.5} />
          <rect x={x - 2} y={355} width={32} height={8} rx={4} fill={sole} stroke={edge} strokeWidth={1.2} />
          {kind === "sneakers" && (
            <>
              <line x1={x + 8} y1={344} x2={x + 20} y2={344} stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
              <line x1={x + 8} y1={349} x2={x + 20} y2={349} stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

function Hat({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  const dark = shade(color, -0.15);
  if (kind === "beanie") {
    return (
      <g>
        <path d="M59,64 Q59,22 100,22 Q141,22 141,64 Z" fill={color} />
        {[76, 88, 100, 112, 124].map((x) => (
          <line key={x} x1={x} y1={30} x2={x} y2={56} stroke={dark} strokeWidth={1.6} opacity={0.6} />
        ))}
        <rect x={56} y={52} width={88} height={17} rx={8} fill={dark} />
        <circle cx={100} cy={18} r={10} fill={accent} />
      </g>
    );
  }
  return (
    <g>
      <path d="M62,60 Q62,26 100,26 Q138,26 138,60 Z" fill={color} />
      <path d="M100,28 L100,58" stroke={dark} strokeWidth={1.6} />
      <circle cx={100} cy={27} r={3.5} fill={dark} />
      <path d="M58,60 Q100,50 142,60 Q146,70 134,70 Q100,64 66,70 Q54,70 58,60 Z" fill={dark} />
      <circle cx={100} cy={44} r={6} fill={accent} />
    </g>
  );
}

function Glasses({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  if (kind === "round-glasses") {
    return (
      <g>
        <circle cx={86} cy={78} r={11} fill={accent} fillOpacity={0.45} stroke={color} strokeWidth={2.5} />
        <circle cx={114} cy={78} r={11} fill={accent} fillOpacity={0.45} stroke={color} strokeWidth={2.5} />
        <path d="M97,77 Q100,73 103,77" fill="none" stroke={color} strokeWidth={2.2} />
        <line x1={75} y1={76} x2={62} y2={73} stroke={color} strokeWidth={2.2} />
        <line x1={125} y1={76} x2={138} y2={73} stroke={color} strokeWidth={2.2} />
      </g>
    );
  }
  return (
    <g>
      <rect x={72} y={69} width={26} height={17} rx={7} fill={accent} stroke={color} strokeWidth={3} />
      <rect x={102} y={69} width={26} height={17} rx={7} fill={accent} stroke={color} strokeWidth={3} />
      <line x1={98} y1={74} x2={102} y2={74} stroke={color} strokeWidth={3} />
      <line x1={72} y1={73} x2={62} y2={71} stroke={color} strokeWidth={3} />
      <line x1={128} y1={73} x2={138} y2={71} stroke={color} strokeWidth={3} />
      <path d="M77,73 L83,73" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
      <path d="M107,73 L113,73" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Bag({ kind, color, accent }: { kind: GarmentKind; color: string; accent: string }) {
  if (kind === "tote") {
    return (
      <g>
        <path d="M136,240 L166,240 L170,282 L132,282 Z" fill={color} stroke={shade(color, -0.2)} strokeWidth={1.5} strokeLinejoin="round" />
        <rect x={140} y={254} width={22} height={14} rx={3} fill={accent} />
        <path d="M142,242 Q151,220 160,242" fill="none" stroke={shade(color, -0.35)} strokeWidth={3.5} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <line x1={126} y1={126} x2={80} y2={216} stroke={shade(color, 0.15)} strokeWidth={5} strokeLinecap="round" />
      <rect x={60} y={212} width={34} height={28} rx={7} fill={color} />
      <path d="M60,222 Q60,212 67,212 L87,212 Q94,212 94,222 Z" fill={shade(color, 0.12)} />
      <circle cx={77} cy={223} r={3} fill={accent} />
    </g>
  );
}

export function GarmentLayer({ product }: { product: FashionProduct }) {
  const props = { kind: product.kind, color: product.color, accent: product.accent };
  switch (product.slot) {
    case "top":
      return <Top {...props} />;
    case "outer":
      return <Outer {...props} />;
    case "bottom":
      return <Bottom {...props} />;
    case "shoes":
      return <Shoes {...props} />;
    case "hat":
      return <Hat {...props} />;
    case "glasses":
      return <Glasses {...props} />;
    case "bag":
      return <Bag {...props} />;
  }
}

const cropBoxes: Record<GarmentKind, string> = {
  tee: "30 104 140 145",
  hoodie: "30 98 140 152",
  shirt: "30 104 140 145",
  sweater: "30 104 140 145",
  chinos: "40 222 120 128",
  jacket: "30 104 140 150",
  coat: "16 104 168 215",
  jeans: "40 222 120 128",
  shorts: "40 222 120 80",
  skirt: "36 222 128 96",
  sneakers: "60 330 80 40",
  boots: "50 294 100 74",
  cap: "50 16 100 60",
  beanie: "52 4 96 70",
  sunglasses: "56 58 88 40",
  "round-glasses": "56 58 88 40",
  crossbody: "50 118 90 128",
  tote: "120 214 62 74",
};

export function GarmentArt({ product }: { product: FashionProduct }) {
  return (
    <svg viewBox={cropBoxes[product.kind]} className={styles.garmentArt} aria-hidden="true">
      <GarmentLayer product={product} />
    </svg>
  );
}

const SKIN_DETAIL = "#e9967a";

/** Each worn layer is keyed by product id so swapping an item replays the pop-in animation. */
function Worn({ item }: { item?: FashionProduct }) {
  if (!item) return null;
  return (
    <g key={item.id} className={styles.wornLayer}>
      <GarmentLayer product={item} />
    </g>
  );
}

export function Avatar({ outfit, skin, label }: { outfit: Outfit; skin: string; label: string }) {
  const skinShadow = shade(skin, -0.12);
  return (
    <svg viewBox="0 0 200 400" className={styles.avatar} role="img" aria-label={label}>
      <ellipse cx={100} cy={372} rx={62} ry={9} className={styles.floorShadow} />
      <g className={styles.avatarBody}>
        {/* legs + feet */}
        <line x1={86} y1={240} x2={86} y2={346} stroke={skin} strokeWidth={24} strokeLinecap="round" />
        <line x1={114} y1={240} x2={114} y2={346} stroke={skin} strokeWidth={24} strokeLinecap="round" />
        <ellipse cx={84} cy={354} rx={14} ry={8} fill={skinShadow} />
        <ellipse cx={116} cy={354} rx={14} ry={8} fill={skinShadow} />
        {/* base layer so the avatar is never undressed */}
        <path d="M68,232 L132,232 L132,262 L104,262 L100,254 L96,262 L68,262 Z" fill="#d9d4ca" />

        <Worn item={outfit.bottom} />
        <Worn item={outfit.shoes} />

        {/* arms */}
        <line {...ARM_L} stroke={skin} strokeWidth={20} strokeLinecap="round" />
        <line {...ARM_R} stroke={skin} strokeWidth={20} strokeLinecap="round" />
        <rect x={91} y={104} width={18} height={22} rx={6} fill={skinShadow} />
        <path d={TORSO} fill="#ece9e2" />
        <path d="M80,124 Q100,150 120,124" fill="none" stroke="#d9d4ca" strokeWidth={3} />

        <Worn item={outfit.top} />
        <Worn item={outfit.outer} />

        {/* hands sit above sleeves */}
        <circle cx={49} cy={233} r={10.5} fill={skin} />
        <circle cx={151} cy={233} r={10.5} fill={skin} />

        <Worn item={outfit.bag} />

        {/* head */}
        <circle cx={60} cy={78} r={8} fill={skinShadow} />
        <circle cx={140} cy={78} r={8} fill={skinShadow} />
        <circle cx={100} cy={72} r={40} fill={skin} />
        <path d="M60,74 Q56,28 100,28 Q144,28 140,74 Q134,52 114,48 Q100,60 76,52 Q64,60 60,74 Z" fill="#3b2a20" />
        <g className={styles.eyes}>
          <circle cx={86} cy={79} r={4.6} fill="#2b211c" />
          <circle cx={114} cy={79} r={4.6} fill="#2b211c" />
          <circle cx={87.6} cy={77.4} r={1.5} fill="#fff" />
          <circle cx={115.6} cy={77.4} r={1.5} fill="#fff" />
        </g>
        <path d="M80,67 Q86,64 92,67" fill="none" stroke="#3b2a20" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M108,67 Q114,64 120,67" fill="none" stroke="#3b2a20" strokeWidth={2.4} strokeLinecap="round" />
        <ellipse cx={77} cy={92} rx={6.5} ry={4} fill={SKIN_DETAIL} opacity={0.35} />
        <ellipse cx={123} cy={92} rx={6.5} ry={4} fill={SKIN_DETAIL} opacity={0.35} />
        <path d="M91,95 Q100,104 109,95" fill="none" stroke="#7a3e2e" strokeWidth={2.6} strokeLinecap="round" />

        <Worn item={outfit.glasses} />
        <Worn item={outfit.hat} />
      </g>
    </svg>
  );
}
