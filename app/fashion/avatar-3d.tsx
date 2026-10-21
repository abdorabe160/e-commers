"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Footprints, Hand, Loader2, Minus, PersonStanding, Plus, RotateCw, ShoppingBag, Users, X } from "lucide-react";
import type { FashionProduct, Slot } from "@/lib/fashion-products";
import { Avatar, type Outfit } from "./avatar";
import type { BodyType, CharacterScene, PickEvent, Stance } from "./three/character-scene";
import styles from "./fashion.module.css";

const stances: { value: Stance; label: string }[] = [
  { value: "relaxed", label: "وقفة عادية" },
  { value: "hip", label: "إيد على الوسط" },
  { value: "pockets", label: "إيد في الجيب" },
];

const priceFormatter = new Intl.NumberFormat("ar-EG");

type Props = {
  outfit: Outfit;
  skin: string;
  label: string;
  onRemove: (slot: Slot) => void;
  onAdd: (product: FashionProduct) => void;
};

export default function Avatar3D({ outfit, skin, label, onRemove, onAdd }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CharacterScene | null>(null);
  const [failed, setFailed] = useState(false);
  const [stance, setStance] = useState(0);
  const [walking, setWalking] = useState(false);
  const [pick, setPick] = useState<PickEvent>(null);
  const [body, setBody] = useState<BodyType>("male");
  const [loading, setLoading] = useState(true);
  // the scene loads asynchronously; it starts from the latest props, not the first render's
  const latest = useRef({ outfit, skin });
  useEffect(() => {
    latest.current = { outfit, skin };
  });

  useEffect(() => {
    let cancelled = false;
    let scene: CharacterScene | null = null;
    import("./three/character-scene")
      .then(({ CharacterScene }) => {
        if (cancelled || !hostRef.current) return;
        scene = new CharacterScene(hostRef.current);
        scene.onPick = setPick;
        scene.onLoading = setLoading;
        sceneRef.current = scene;
        scene.setOutfit(latest.current.outfit);
        scene.setSkin(latest.current.skin);
        scene.setBody("male").catch(() => setFailed(true));
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setOutfit(outfit);
  }, [outfit]);

  useEffect(() => {
    sceneRef.current?.setSkin(skin);
  }, [skin]);

  useEffect(() => {
    if (!pick) return;
    const timer = setTimeout(() => setPick(null), 5000);
    return () => clearTimeout(timer);
  }, [pick]);

  if (failed) return <Avatar outfit={outfit} skin={skin} label={label} />;

  const picked = pick ? outfit[pick.slot] : undefined;
  const nextStance = () => {
    const i = (stance + 1) % stances.length;
    setStance(i);
    sceneRef.current?.setStance(stances[i].value);
  };
  const switchBody = () => {
    const next: BodyType = body === "male" ? "female" : "male";
    setBody(next);
    setPick(null);
    sceneRef.current?.setBody(next).catch(() => setFailed(true));
  };
  const toggleWalk = () => {
    setWalking((w) => {
      sceneRef.current?.setWalking(!w);
      return !w;
    });
  };

  return (
    <div className={styles.avatar3d}>
      <div ref={hostRef} className={styles.canvasHost} role="img" aria-label={label} />

      <div className={styles.stageControls}>
        <button type="button" onClick={() => sceneRef.current?.spin()}>
          <RotateCw size={14} /> لفّة
        </button>
        <button type="button" onClick={() => sceneRef.current?.wave()}>
          <Hand size={14} /> سلّم
        </button>
        <button type="button" onClick={toggleWalk} aria-pressed={walking} data-active={walking || undefined}>
          <Footprints size={14} /> {walking ? "وقّف" : "امشي"}
        </button>
        <button type="button" onClick={switchBody} title="بدّل الموديل">
          <Users size={14} /> {body === "male" ? "موديل رجالي" : "موديل حريمي"}
        </button>
        <button type="button" onClick={nextStance} title="غيّر الوقفة">
          <PersonStanding size={14} /> {stances[stance].label}
        </button>
      </div>

      <div className={styles.zoomControls}>
        <button type="button" onClick={() => sceneRef.current?.zoomBy(0.75, 1.2)} aria-label="تكبير">
          <Plus size={15} />
        </button>
        <button type="button" onClick={() => sceneRef.current?.zoomBy(1.35)} aria-label="تصغير">
          <Minus size={15} />
        </button>
      </div>

      {pick && picked && (
        <div
          className={styles.pickCard}
          style={{ left: `clamp(8px, ${pick.x - 110}px, calc(100% - 228px))`, top: `clamp(8px, ${pick.y - 120}px, calc(100% - 140px))` }}
          role="dialog"
          aria-label={picked.name}
        >
          <span className={styles.pickThumb}>
            <Image src={picked.image} alt="" fill sizes="44px" className={styles.photo} />
          </span>
          <div className={styles.pickInfo}>
            <strong>{picked.name}</strong>
            <span>{priceFormatter.format(picked.price)} ج.م · {picked.colorName}</span>
            <div className={styles.pickActions}>
              <button type="button" onClick={() => { onAdd(picked); setPick(null); }}>
                <ShoppingBag size={13} /> للسلة
              </button>
              <button type="button" onClick={() => { onRemove(picked.slot); setPick(null); }}>
                <X size={13} /> اقلعه
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.stageLoading} role="status">
          <Loader2 size={22} className={styles.spin} /> بنجهّز الموديل…
        </div>
      )}

      <p className={styles.stageHint}>اسحب للّف · دوس على أي قطعة عليها · اعمل زووم بالعجلة أو دبل كليك</p>
    </div>
  );
}
