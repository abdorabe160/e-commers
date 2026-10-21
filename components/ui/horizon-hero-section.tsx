"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { SocialIcon } from "@/components/icons";
import { profile } from "@/lib/portfolio-data";

gsap.registerPlugin(ScrollTrigger);

const titles: Record<number, string> = {
  0: "HORIZON",
  1: "COSMOS",
  2: "INFINITY",
};

const subtitles: Record<number, { line1: string; line2: string }> = {
  0: {
    line1: "Where vision meets reality,",
    line2: "we shape the future of tomorrow",
  },
  1: {
    line1: "Beyond the boundaries of imagination,",
    line2: "lies the universe of possibilities",
  },
  2: {
    line1: "In the space between thought and creation,",
    line2: "we find the essence of true innovation",
  },
};

const totalSections = 2;

const cameraPositions = [
  { x: 0, y: 30, z: 300 },
  { x: 0, y: 40, z: -50 },
  { x: 0, y: 50, z: -700 },
];

type ThreeRefs = {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  composer: EffectComposer | null;
  bloomPass: UnrealBloomPass | null;
  stars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[];
  nebula: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  mountains: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[];
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null;
  animationId: number | null;
  targetCameraX?: number;
  targetCameraY?: number;
  targetCameraZ?: number;
  locations: number[];
};

const splitTitle = (text: string) =>
  text.split("").map((char, i) => (
    <span key={i} className="title-char" aria-hidden="true">
      {char}
    </span>
  ));

export const Component = () => {
  const containerRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  const smoothCameraPos = useRef({ x: 0, y: 30, z: 100 });

  const [currentSection, setCurrentSection] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const threeRefs = useRef<ThreeRefs>({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    bloomPass: null,
    stars: [],
    nebula: null,
    mountains: [],
    atmosphere: null,
    animationId: null,
    locations: [],
  });

  // Initialize Three.js
  useEffect(() => {
    const refs = threeRefs.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const getSize = () => ({
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    });

    const initThree = () => {
      const { width, height } = getSize();

      refs.scene = new THREE.Scene();
      refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025);

      refs.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
      refs.camera.position.z = 100;
      refs.camera.position.y = 20;

      refs.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      refs.renderer.setSize(width, height, false);
      refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      refs.renderer.toneMappingExposure = 0.5;

      refs.composer = new EffectComposer(refs.renderer);
      refs.composer.addPass(new RenderPass(refs.scene, refs.camera));

      refs.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.8,
        0.4,
        0.85
      );
      refs.composer.addPass(refs.bloomPass);

      createStarField(refs.scene);
      createNebula(refs.scene);
      createMountains(refs.scene);
      createAtmosphere(refs.scene);
      refs.locations = refs.mountains.map((m) => m.position.z);
    };

    const createStarField = (scene: THREE.Scene) => {
      const starCount = 5000;

      for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let j = 0; j < starCount; j++) {
          const radius = 200 + Math.random() * 800;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);

          positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[j * 3 + 2] = radius * Math.cos(phi);

          const color = new THREE.Color();
          const colorChoice = Math.random();
          if (colorChoice < 0.7) {
            color.setHSL(0, 0, 0.8 + Math.random() * 0.2);
          } else if (colorChoice < 0.9) {
            color.setHSL(0.08, 0.5, 0.8);
          } else {
            color.setHSL(0.6, 0.5, 0.8);
          }

          colors[j * 3] = color.r;
          colors[j * 3 + 1] = color.g;
          colors[j * 3 + 2] = color.b;

          sizes[j] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            depth: { value: i },
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            uniform float depth;

            void main() {
              vColor = color;
              vec3 pos = position;

              float angle = time * 0.05 * (1.0 - depth * 0.3);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              pos.xy = rot * pos.xy;

              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_PointSize = size * (300.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;

            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, opacity);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
        refs.stars.push(stars);
      }
    };

    const createNebula = (scene: THREE.Scene) => {
      const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x4f46e5) },
          color2: { value: new THREE.Color(0xa855f7) },
          opacity: { value: 0.3 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vElevation;
          uniform float time;

          void main() {
            vUv = uv;
            vec3 pos = position;

            float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
            pos.z += elevation;
            vElevation = elevation;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color1;
          uniform vec3 color2;
          uniform float opacity;
          uniform float time;
          varying vec2 vUv;
          varying float vElevation;

          void main() {
            float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
            vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);

            float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
            alpha *= 1.0 + vElevation * 0.01;

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.z = -1050;
      nebula.rotation.x = 0;
      scene.add(nebula);
      refs.nebula = nebula;
    };

    const createMountains = (scene: THREE.Scene) => {
      const layers = [
        { distance: -50, height: 60, color: 0x16161f, opacity: 1 },
        { distance: -100, height: 80, color: 0x12121c, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x1c1a33, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x26224a, opacity: 0.4 },
      ];

      layers.forEach((layer, index) => {
        const points: THREE.Vector2[] = [];
        const segments = 50;

        for (let i = 0; i <= segments; i++) {
          const x = (i / segments - 0.5) * 1000;
          const y =
            Math.sin(i * 0.1) * layer.height +
            Math.sin(i * 0.05) * layer.height * 0.5 +
            Math.random() * layer.height * 0.2 -
            100;
          points.push(new THREE.Vector2(x, y));
        }

        points.push(new THREE.Vector2(5000, -300));
        points.push(new THREE.Vector2(-5000, -300));

        const shape = new THREE.Shape(points);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide,
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.z = layer.distance;
        mountain.position.y = layer.distance;
        mountain.userData = { baseZ: layer.distance, index };
        scene.add(mountain);
        refs.mountains.push(mountain);
      });
    };

    const createAtmosphere = (scene: THREE.Scene) => {
      const geometry = new THREE.SphereGeometry(600, 32, 32);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float time;

          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;

            float pulse = sin(time * 2.0) * 0.1 + 0.9;
            atmosphere *= pulse;

            gl_FragColor = vec4(atmosphere, intensity * 0.25);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      const atmosphere = new THREE.Mesh(geometry, material);
      scene.add(atmosphere);
      refs.atmosphere = atmosphere;
    };

    const animate = () => {
      refs.animationId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      refs.stars.forEach((starField) => {
        starField.material.uniforms.time.value = time;
      });

      if (refs.nebula) {
        refs.nebula.material.uniforms.time.value = time * 0.5;
      }

      if (
        refs.camera &&
        refs.targetCameraX !== undefined &&
        refs.targetCameraY !== undefined &&
        refs.targetCameraZ !== undefined
      ) {
        const smoothingFactor = 0.05;
        const pos = smoothCameraPos.current;

        pos.x += (refs.targetCameraX - pos.x) * smoothingFactor;
        pos.y += (refs.targetCameraY - pos.y) * smoothingFactor;
        pos.z += (refs.targetCameraZ - pos.z) * smoothingFactor;

        const floatX = Math.sin(time * 0.1) * 2;
        const floatY = Math.cos(time * 0.15) * 1;

        refs.camera.position.x = pos.x + floatX;
        refs.camera.position.y = pos.y + floatY;
        refs.camera.position.z = pos.z;
        refs.camera.lookAt(0, 10, -600);
      }

      refs.mountains.forEach((mountain, i) => {
        const parallaxFactor = 1 + i * 0.5;
        mountain.position.x = Math.sin(time * 0.1) * 2 * parallaxFactor;
        mountain.position.y = 50 + Math.cos(time * 0.15) * 1 * parallaxFactor;
      });

      refs.composer?.render();
    };

    const start = () => {
      if (refs.animationId === null && refs.composer) animate();
    };

    const stop = () => {
      if (refs.animationId !== null) {
        cancelAnimationFrame(refs.animationId);
        refs.animationId = null;
      }
    };

    try {
      initThree();
      start();
    } catch (error) {
      console.warn("[HorizonHero] WebGL unavailable, skipping the 3D scene.", error);
    }

    setIsReady(true);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    });
    visibilityObserver.observe(container);

    const handleResize = () => {
      if (!refs.camera || !refs.renderer || !refs.composer) return;
      const { width, height } = getSize();
      refs.camera.aspect = width / height;
      refs.camera.updateProjectionMatrix();
      refs.renderer.setSize(width, height, false);
      refs.composer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      stop();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", handleResize);

      refs.stars.forEach((starField) => {
        starField.geometry.dispose();
        starField.material.dispose();
      });

      refs.mountains.forEach((mountain) => {
        mountain.geometry.dispose();
        mountain.material.dispose();
      });

      [refs.nebula, refs.atmosphere].forEach((mesh) => {
        mesh?.geometry.dispose();
        mesh?.material.dispose();
      });

      refs.bloomPass?.dispose();
      refs.composer?.dispose();
      refs.renderer?.dispose();

      Object.assign(refs, {
        scene: null,
        camera: null,
        renderer: null,
        composer: null,
        bloomPass: null,
        stars: [],
        nebula: null,
        mountains: [],
        atmosphere: null,
        locations: [],
      });
    };
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (!isReady) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        // Motion is always on for this site (owner's choice): the OS
        // reduced-motion preference is intentionally not consulted.
        always: "(min-width: 1px)",
      },
      () => {
        gsap.set([menuRef.current, introRef.current, scrollProgressRef.current], {
          visibility: "visible",
        });

        const tl = gsap.timeline();

        if (menuRef.current) {
          tl.from(menuRef.current, {
            x: -100,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
          });
        }

        tl.from(
          ".hero-eyebrow",
          { y: 20, opacity: 0, duration: 0.8, ease: "power3.out" },
          "-=0.6"
        );

        if (titleRef.current) {
          tl.from(
            titleRef.current.querySelectorAll(".title-char"),
            {
              y: 200,
              opacity: 0,
              duration: 1.5,
              stagger: 0.05,
              ease: "power4.out",
            },
            "-=0.5"
          );
        }

        if (subtitleRef.current) {
          tl.from(
            subtitleRef.current.querySelectorAll(".subtitle-line"),
            {
              y: 50,
              opacity: 0,
              duration: 1,
              stagger: 0.2,
              ease: "power3.out",
            },
            "-=0.8"
          );
        }

        if (scrollProgressRef.current) {
          tl.from(
            scrollProgressRef.current,
            { opacity: 0, y: 50, duration: 1, ease: "power2.out" },
            "-=0.5"
          );
        }

        gsap.to(introRef.current, {
          yPercent: -18,
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: introRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.utils
          .toArray<HTMLElement>(".content-section[data-section]:not([data-section='0'])")
          .forEach((section) => {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: section,
                  start: "top 70%",
                  toggleActions: "play none none reverse",
                },
              })
              .from(section.querySelectorAll(".title-char"), {
                y: 120,
                opacity: 0,
                duration: 1.1,
                stagger: 0.04,
                ease: "power4.out",
              })
              .from(
                section.querySelectorAll(".subtitle-line"),
                { y: 30, opacity: 0, duration: 0.9, stagger: 0.15, ease: "power3.out" },
                "-=0.8"
              );
          });
      },
      containerRef.current ?? undefined
    );

    return () => {
      mm.revert();
    };
  }, [isReady]);

  // Scroll handling
  useEffect(() => {
    const container = containerRef.current;
    const viewport = viewportRef.current;
    if (!container || !viewport) return;

    let frame = 0;

    const handleScroll = () => {
      frame = 0;
      const { current: refs } = threeRefs;

      const scrollable = container.offsetHeight - viewport.offsetHeight;
      const scrolled = -container.getBoundingClientRect().top;
      const progress =
        scrollable > 0 ? Math.min(Math.max(scrolled / scrollable, 0), 1) : 0;

      container.style.setProperty("--hero-progress", progress.toFixed(4));

      const newSection = Math.floor(progress * totalSections);
      setCurrentSection(newSection);

      const totalProgress = progress * totalSections;
      const sectionProgress = totalProgress % 1;

      const currentPos = cameraPositions[newSection] || cameraPositions[0];
      const nextPos = cameraPositions[newSection + 1] || currentPos;

      refs.targetCameraX = currentPos.x + (nextPos.x - currentPos.x) * sectionProgress;
      refs.targetCameraY = currentPos.y + (nextPos.y - currentPos.y) * sectionProgress;
      refs.targetCameraZ = currentPos.z + (nextPos.z - currentPos.z) * sectionProgress;

      refs.mountains.forEach((mountain, i) => {
        if (progress > 0.7) {
          mountain.position.z = 600000;
        }
        if (progress < 0.7) {
          mountain.position.z = refs.locations[i];
        }
      });

      if (refs.nebula && refs.mountains[3]) {
        refs.nebula.position.z = refs.mountains[3].position.z;
      }
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(handleScroll);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    handleScroll();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      id="home"
      aria-label="Introduction"
      className="hero-container"
    >
      <div ref={viewportRef} className="hero-viewport">
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
        <div className="hero-fade" aria-hidden="true" />
        <div
          className="hero-backdrop"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 80%)",
          }}
        />

        {/* Side menu */}
        <nav
          ref={menuRef}
          aria-label="Social links"
          className="side-menu"
          style={{ visibility: "hidden" }}
        >
          {profile.socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="side-menu-link"
            >
              <SocialIcon label={social.label} className="size-[18px]" />
            </a>
          ))}
          <span className="side-menu-line" aria-hidden="true" />
          <span className="vertical-text">{profile.role}</span>
        </nav>

        {/* Scroll progress indicator */}
        <div
          ref={scrollProgressRef}
          className="scroll-progress"
          aria-hidden="true"
          style={{ visibility: "hidden" }}
        >
          <div className="scroll-text">SCROLL</div>
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
          <div className="section-counter">
            {String(currentSection).padStart(2, "0")} /{" "}
            {String(totalSections).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Scroll sections */}
      <div className="scroll-sections">
        {[...Array(totalSections + 1)].map((_, i) => {
          if (i === 0) {
            return (
              <div key={i} data-section={i} className="content-section">
                <div
                  ref={introRef}
                  className="hero-content"
                  style={{ visibility: "hidden" }}
                >
                  <p className="hero-eyebrow">
                    {profile.name} &middot; {profile.yearsOfExperience} years of
                    craft
                  </p>
                  <h1 ref={titleRef} className="hero-title">
                    <span className="sr-only">{titles[i]}</span>
                    {splitTitle(titles[i])}
                  </h1>
                  <div ref={subtitleRef} className="hero-subtitle">
                    <p className="subtitle-line">{subtitles[i].line1}</p>
                    <p className="subtitle-line">{subtitles[i].line2}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={i} data-section={i} className="content-section">
              <div className="hero-content">
                <p className="hero-title">
                  <span className="sr-only">{titles[i]}</span>
                  {splitTitle(titles[i])}
                </p>
                <div className="hero-subtitle">
                  <p className="subtitle-line">{subtitles[i].line1}</p>
                  <p className="subtitle-line">{subtitles[i].line2}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export { Component as HorizonHeroSection };
