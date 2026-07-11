"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Home, RefreshCw, Send, Sparkles, Ticket } from "lucide-react";
import styles from "./JesterNotFound.module.css";

const glitchTiles = [
  {
    id: "spark",
    label: "Spark",
    hint: "A tiny portal hiccup.",
    Icon: Sparkles,
  },
  {
    id: "ticket",
    label: "Ticket",
    hint: "A booking tried to escape.",
    Icon: Ticket,
  },
  {
    id: "loop",
    label: "Loop",
    hint: "This route is doing laps.",
    Icon: RefreshCw,
  },
  {
    id: "launch",
    label: "Launch",
    hint: "Aim it back home.",
    Icon: Send,
  },
] as const;

type GlitchId = (typeof glitchTiles)[number]["id"];

export default function JesterNotFound() {
  const router = useRouter();
  const [caughtGlitches, setCaughtGlitches] = useState<GlitchId[]>([]);
  const [countdown, setCountdown] = useState(5);
  const hasRedirectedRef = useRef(false);
  const isComplete = caughtGlitches.length === glitchTiles.length;

  const statusText = useMemo(() => {
    if (isComplete) return "Portal locked. Sending you home.";
    const remaining = glitchTiles.length - caughtGlitches.length;
    return `${remaining} glitch${remaining === 1 ? "" : "es"} left to catch.`;
  }, [caughtGlitches.length, isComplete]);

  useEffect(() => {
    if (!isComplete) return;

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isComplete]);

  useEffect(() => {
    if (!isComplete || countdown > 0 || hasRedirectedRef.current) return;

    hasRedirectedRef.current = true;
    router.push("/");
  }, [countdown, isComplete, router]);

  function catchGlitch(id: GlitchId) {
    setCaughtGlitches((current) => {
      if (current.includes(id) || current.length === glitchTiles.length) {
        return current;
      }

      return [...current, id];
    });
  }

  return (
    <main className={styles.page} aria-labelledby="not-found-title">
      <div className={styles.gridBackdrop} aria-hidden="true" />
      <div className={styles.sparkField} aria-hidden="true">
        <span className={styles.sparkOne} />
        <span className={styles.sparkTwo} />
        <span className={styles.sparkThree} />
        <span className={styles.sparkFour} />
      </div>

      <header className={styles.header}>
        <Link href="/" className={styles.logoLink} aria-label="VRena home">
          <Image
            src="/brand/vrena-logo-full-light.svg"
            alt="VRena"
            width={176}
            height={36}
            priority
            className={styles.logoLight}
          />
          <Image
            src="/brand/vrena-logo-full-dark.svg"
            alt=""
            width={176}
            height={36}
            priority
            aria-hidden="true"
            className={styles.logoDark}
          />
        </Link>
      </header>

      <section className={styles.stage} aria-describedby="not-found-status">
        <div className={styles.portalWrap} aria-hidden="true">
          <div className={styles.portalRing}>
            <div className={styles.portalCore} />
          </div>
        </div>

        <p className={styles.errorCode}>404</p>
        <h1 id="not-found-title" className={styles.title}>
          Wrong portal. Nice aim.
        </h1>
        <p className={styles.copy}>
          This route blinked, bowed, and vanished. Catch the glitches to open a clean
          path back to the arena.
        </p>

        <div className={styles.gameShell}>
          <div className={styles.gameHeader}>
            <h2>Catch the glitches</h2>
            <span id="not-found-status" aria-live="polite">
              {statusText}
            </span>
          </div>

          <div className={styles.tileGrid} data-complete={isComplete ? "true" : "false"}>
            {glitchTiles.map(({ id, label, hint, Icon }, index) => {
              const isCaught = caughtGlitches.includes(id);

              return (
                <button
                  key={id}
                  type="button"
                  className={styles.glitchTile}
                  data-caught={isCaught ? "true" : "false"}
                  data-glitch-id={id}
                  data-testid={`not-found-glitch-${id}`}
                  data-tone={index}
                  onClick={() => catchGlitch(id)}
                  disabled={isCaught || isComplete}
                  aria-pressed={isCaught}
                >
                  <span className={styles.glitchAura} aria-hidden="true" />
                  <span className={styles.glitchSweep} aria-hidden="true" />
                  <span className={styles.glitchFragments} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.glitchBurst} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.glitchIcon}>
                    <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className={styles.glitchLabel}>{isCaught ? "Caught" : label}</span>
                  <span className={styles.glitchHint}>{hint}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.progressRow} aria-hidden="true">
            {glitchTiles.map(({ id }) => (
              <span
                key={id}
                className={styles.progressDot}
                data-active={caughtGlitches.includes(id) ? "true" : "false"}
              />
            ))}
          </div>
        </div>

        <div className={styles.returnDock} data-ready={isComplete ? "true" : "false"}>
          <div className={styles.countdownBlock}>
            <span>Portal opens in</span>
            <strong data-testid="not-found-countdown">{isComplete ? countdown : "--"}</strong>
          </div>
          <Link href="/" className={styles.homeButton} data-testid="not-found-home-link">
            <Home size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>Home</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
