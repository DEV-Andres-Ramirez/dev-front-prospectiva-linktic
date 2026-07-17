"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { agruparRespuestas, type Cluster, type Respuesta } from "@/lib/clustering";
import { CATEGORIAS, PREGUNTAS, type Categoria } from "@/lib/preguntas";

/* ————— Nube de ideas —————
   Empaquetado orgánico de círculos: cada burbuja es una idea, las
   respuestas similares se funden en una sola burbuja más grande y un
   contador indica cuántas veces se mencionó. Se ve una pregunta a la
   vez, elegida con el selector. */

/* Tinta interior por color de serie (según luminancia del relleno) */
const INK_SOBRE: Record<string, string> = {
  "#2a78d6": "#ffffff",
  "#008300": "#ffffff",
  "#e87ba4": "#43102a",
};

/* Degradado sutil por categoría: centro apenas más claro del mismo tono */
const GRADIENTE: Record<Categoria, [string, string]> = {
  pregunta_1: ["#4189e0", "#2a78d6"],
  pregunta_2: ["#1e941e", "#008300"],
  pregunta_3: ["#eb92b3", "#e87ba4"],
};

type BurbujaPack = { cluster: Cluster; x: number; y: number; r: number };

/**
 * Empaquetado en espiral: la idea más mencionada al centro y el resto
 * acomodándose alrededor sin chocar; al final todo se escala al lienzo.
 */
function empaquetar(clusters: Cluster[], w: number, h: number): BurbujaPack[] {
  if (clusters.length === 0 || w <= 0) return [];
  const maxC = clusters[0].total;
  const radioDe = (c: number) =>
    40 + (maxC <= 1 ? 0 : ((Math.sqrt(c) - 1) / (Math.sqrt(maxC) - 1)) * 45);

  const colocadas: BurbujaPack[] = [];
  clusters.forEach((cluster, i) => {
    const r = radioDe(cluster.total);
    if (i === 0) {
      colocadas.push({ cluster, x: 0, y: 0, r });
      return;
    }
    const anguloBase = i * 2.39996; // ángulo áureo: reparte direcciones
    for (let paso = 1; paso < 4000; paso++) {
      const rad = paso * 3;
      const ang = anguloBase + paso * 0.35;
      const x = rad * Math.cos(ang);
      const y = rad * Math.sin(ang);
      if (colocadas.every((o) => Math.hypot(x - o.x, y - o.y) >= r + o.r + 6)) {
        colocadas.push({ cluster, x, y, r });
        return;
      }
    }
    colocadas.push({ cluster, x: 0, y: 0, r });
  });

  const minX = Math.min(...colocadas.map((b) => b.x - b.r));
  const maxX = Math.max(...colocadas.map((b) => b.x + b.r));
  const minY = Math.min(...colocadas.map((b) => b.y - b.r));
  const maxY = Math.max(...colocadas.map((b) => b.y + b.r));
  const margen = 14;
  const s = Math.min(
    (w - 2 * margen) / (maxX - minX),
    (h - 2 * margen) / (maxY - minY),
    2
  );
  const dx = (w - (maxX - minX) * s) / 2 - minX * s;
  const dy = (h - (maxY - minY) * s) / 2 - minY * s;
  return colocadas.map((b) => ({
    cluster: b.cluster,
    x: b.x * s + dx,
    y: b.y * s + dy,
    r: b.r * s,
  }));
}

/** Parte la etiqueta en líneas que quepan dentro de la burbuja, o null si no cabe */
function partirEtiqueta(
  texto: string,
  r: number,
  fs: number,
  permitirGuion: boolean
): string[] | null {
  const porLinea = Math.max(3, Math.floor((r * 1.8) / (fs * 0.62)));
  const maxLineas = Math.max(1, Math.floor((r * 1.3) / (fs * 1.15)));
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (candidata.length <= porLinea) {
      actual = candidata;
      continue;
    }
    if (actual) lineas.push(actual);
    if (palabra.length <= porLinea) {
      actual = palabra;
      continue;
    }
    // Palabra más larga que la línea: solo se parte con guion como último recurso
    if (!permitirGuion) return null;
    let resto = palabra;
    while (resto.length > porLinea) {
      lineas.push(`${resto.slice(0, porLinea - 1)}-`);
      resto = resto.slice(porLinea - 1);
    }
    actual = resto;
  }
  if (actual) lineas.push(actual);
  return lineas.length <= maxLineas ? lineas : null;
}

/** Mejor tamaño de fuente con el que la etiqueta cabe: primero sin partir palabras */
function ajustarEtiqueta(texto: string, r: number) {
  const ideal = Math.round(Math.max(8, Math.min(15, r / 2.8)));
  for (const permitirGuion of [false, true]) {
    for (let fs = ideal; fs >= 8; fs--) {
      const lineas = partirEtiqueta(texto, r, fs, permitirGuion);
      if (lineas) return { lineas, fs };
    }
  }
  return null;
}

type Tip = {
  cluster: Cluster;
  x: number;
  y: number;
  wrapW: number;
};

export default function ResultsBoard() {
  const [filas, setFilas] = useState<Respuesta[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [seleccion, setSeleccion] = useState<Categoria>("pregunta_1");
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);
  const medidorRef = useRef<HTMLDivElement>(null);
  const envoltorioRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("respuestas_prospectiva")
      .select("id,respuesta,categoria")
      .order("id", { ascending: true });
    if (!error && data) {
      setFilas(data as Respuesta[]);
      setFallo(false);
    } else {
      setFallo(true);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 10000);
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  useEffect(() => {
    const el = medidorRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entradas) =>
      setAncho(Math.floor(entradas[0].contentRect.width))
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const porCategoria = useMemo(() => {
    const mapa = new Map<Categoria, Cluster[]>();
    for (const cat of CATEGORIAS) {
      mapa.set(
        cat,
        agruparRespuestas((filas ?? []).filter((f) => f.categoria === cat))
      );
    }
    return mapa;
  }, [filas]);

  const totalIdeas = useMemo(() => {
    let n = 0;
    for (const clusters of porCategoria.values()) n += clusters.length;
    return n;
  }, [porCategoria]);

  const pregunta = PREGUNTAS[seleccion];
  const clustersSel = porCategoria.get(seleccion) ?? [];
  const respuestasSel = clustersSel.reduce((s, c) => s + c.total, 0);
  const alto = ancho < 480 ? 400 : 480;

  const burbujas = useMemo(
    () => empaquetar(clustersSel, ancho, alto),
    [clustersSel, ancho, alto]
  );

  const mostrarTip = (el: Element, cluster: Cluster) => {
    const envoltorio = envoltorioRef.current;
    if (!envoltorio) return;
    const rb = el.getBoundingClientRect();
    const rw = envoltorio.getBoundingClientRect();
    setTip({
      cluster,
      x: rb.left + rb.width / 2 - rw.left,
      y: rb.top - rw.top,
      wrapW: rw.width,
    });
  };

  const ocultarTip = () => {
    setHover(null);
    setTip(null);
  };

  const cargando = filas === null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <header className="lk-anim flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image
            src="/linktic_logo.png"
            alt="LinkTic"
            width={120}
            height={76}
            priority
            className="h-auto w-24 sm:w-28"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Resultados de la actividad
            </h1>
            <p className="text-sm text-slate-500">
              Prospectiva estratégica · panorama de respuestas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Se actualiza cada 10 s</span>
          <button
            type="button"
            onClick={cargar}
            className="h-9 rounded-lg bg-white px-4 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-black/10 transition hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>
      </header>

      {fallo && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          No pudimos actualizar los datos. Se muestra la última información disponible.
        </p>
      )}

      {/* Indicadores */}
      <section className="lk-anim lk-delay-1 mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { etiqueta: "Respuestas", valor: filas?.length ?? 0 },
          { etiqueta: "Ideas agrupadas", valor: totalIdeas },
        ].map((kpi) => (
          <div
            key={kpi.etiqueta}
            className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/5 sm:px-5"
          >
            <p className="text-xs text-slate-500 sm:text-sm">{kpi.etiqueta}</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl">
              {cargando ? "—" : kpi.valor}
            </p>
          </div>
        ))}
      </section>

      {/* Selector de pregunta */}
      <div className="lk-anim lk-delay-2 mt-6 flex flex-wrap gap-2" role="group" aria-label="Elegir pregunta">
        {CATEGORIAS.map((cat) => {
          const p = PREGUNTAS[cat];
          const activa = seleccion === cat;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={activa}
              onClick={() => {
                setSeleccion(cat);
                ocultarTip();
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                activa
                  ? "scale-105 shadow-md"
                  : "bg-white text-slate-600 ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
              }`}
              style={
                activa
                  ? { backgroundColor: p.color, color: INK_SOBRE[p.color] }
                  : undefined
              }
            >
              {!activa && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              )}
              {p.texto}
            </button>
          );
        })}
      </div>

      {/* Nube de ideas */}
      <section className="lk-anim lk-delay-3 mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="lk-accent-bar h-1" />
        <div
          ref={envoltorioRef}
          className="relative px-4 pb-6 pt-5 sm:px-6"
          onKeyDown={(e) => {
            if (e.key === "Escape") ocultarTip();
          }}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full transition-colors duration-300"
              style={{ backgroundColor: pregunta.color }}
            />
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              {pregunta.texto}
            </h2>
            {!cargando && (
              <span className="text-xs tabular-nums text-slate-400">
                {respuestasSel} {respuestasSel === 1 ? "respuesta" : "respuestas"} ·{" "}
                {clustersSel.length} {clustersSel.length === 1 ? "idea" : "ideas"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
            Cada burbuja es una idea: las respuestas similares se agrupan y el
            contador indica cuántas veces se mencionó. Toca una burbuja para ver
            el detalle.
          </p>

          <div
            ref={medidorRef}
            className="mt-4 overflow-hidden rounded-2xl bg-slate-50/80 ring-1 ring-slate-100"
          >
            {cargando && (
              <p className="py-24 text-center text-sm text-slate-400">
                Cargando respuestas…
              </p>
            )}

            {!cargando && ancho > 0 && burbujas.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <span className="h-14 w-14 rounded-full border-2 border-dashed border-slate-300" />
                <p className="text-sm font-medium text-slate-500">
                  Aún no hay respuestas para esta pregunta.
                </p>
                <p className="text-xs text-slate-400">
                  Las burbujas aparecerán aquí en tiempo real.
                </p>
              </div>
            )}

            {!cargando && ancho > 0 && burbujas.length > 0 && (
              <svg
                key={seleccion}
                width={ancho}
                height={alto}
                className="block"
                role="img"
                aria-label={`Nube de ideas para: ${pregunta.texto}`}
              >
                <defs>
                  <radialGradient id={`lk-grad-${seleccion}`} cx="32%" cy="28%" r="80%">
                    <stop offset="0%" stopColor={GRADIENTE[seleccion][0]} />
                    <stop offset="100%" stopColor={GRADIENTE[seleccion][1]} />
                  </radialGradient>
                </defs>

                {burbujas.map((b, i) => {
                  const activa = hover === i;
                  const etiqueta = ajustarEtiqueta(b.cluster.etiqueta, b.r);
                  const ink = INK_SOBRE[pregunta.color] ?? "#ffffff";
                  const badge = b.cluster.total > 1;
                  const rBadge = Math.min(14, Math.max(10, b.r * 0.28));
                  const bx = b.x + b.r * 0.76;
                  const by = b.y - b.r * 0.76;
                  return (
                    <g key={`${b.cluster.etiqueta}-${i}`}>
                      <g
                        className="lk-bubble-in"
                        style={{ animationDelay: `${Math.min(i * 45, 700)}ms` }}
                      >
                        <g
                          className="lk-bob"
                          style={{
                            animationDuration: `${6 + (i % 5)}s`,
                            animationDelay: `${-((i * 0.9) % 6)}s`,
                          }}
                        >
                          <g
                            style={{
                              transformBox: "fill-box",
                              transformOrigin: "center",
                              transform: activa ? "scale(1.06)" : "scale(1)",
                              transition: "transform 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                              filter: activa
                                ? "drop-shadow(0 8px 14px rgba(15, 23, 42, 0.28))"
                                : "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.12))",
                            }}
                          >
                            <circle
                              cx={b.x}
                              cy={b.y}
                              r={b.r}
                              fill={`url(#lk-grad-${seleccion})`}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                            {etiqueta && (
                              <text
                                textAnchor="middle"
                                fontSize={etiqueta.fs}
                                fontWeight={600}
                                fill={ink}
                                style={{ pointerEvents: "none" }}
                              >
                                {etiqueta.lineas.map((linea, j) => (
                                  <tspan
                                    key={j}
                                    x={b.x}
                                    y={
                                      b.y +
                                      etiqueta.fs * 0.36 +
                                      (j - (etiqueta.lineas.length - 1) / 2) *
                                        etiqueta.fs *
                                        1.15
                                    }
                                  >
                                    {linea}
                                  </tspan>
                                ))}
                              </text>
                            )}
                            {badge && (
                              <g>
                                <circle
                                  cx={bx}
                                  cy={by}
                                  r={rBadge}
                                  fill="#ffffff"
                                  stroke={pregunta.color}
                                  strokeWidth={1.5}
                                />
                                <text
                                  x={bx}
                                  y={by + 3.5}
                                  textAnchor="middle"
                                  fontSize={rBadge >= 12 ? 11 : 10}
                                  fontWeight={700}
                                  fill="#0f172a"
                                >
                                  {b.cluster.total}
                                </text>
                              </g>
                            )}
                          </g>
                        </g>
                      </g>
                    </g>
                  );
                })}

                {/* Zonas de interacción (más grandes que la marca) */}
                {burbujas.map((b, i) => (
                  <circle
                    key={i}
                    cx={b.x}
                    cy={b.y}
                    r={Math.max(b.r + 6, 24)}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${b.cluster.etiqueta}: ${b.cluster.total} ${
                      b.cluster.total === 1 ? "mención" : "menciones"
                    }`}
                    className="cursor-pointer outline-none focus-visible:stroke-slate-400 focus-visible:stroke-2"
                    onPointerEnter={(ev) => {
                      setHover(i);
                      mostrarTip(ev.currentTarget, b.cluster);
                    }}
                    onPointerLeave={ocultarTip}
                    onFocus={(ev) => {
                      setHover(i);
                      mostrarTip(ev.currentTarget, b.cluster);
                    }}
                    onBlur={ocultarTip}
                  />
                ))}
              </svg>
            )}
          </div>

          {/* Tooltip */}
          {tip && (
            <div
              className="pointer-events-none absolute z-10 w-max max-w-70 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg"
              style={{
                left: Math.min(Math.max(tip.x, 140), tip.wrapW - 140),
                top: tip.y - 10,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="wrap-break-word text-sm font-semibold">
                {tip.cluster.etiqueta}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {tip.cluster.total}{" "}
                {tip.cluster.total === 1 ? "mención" : "menciones"} ·{" "}
                {pregunta.texto}
              </p>
              {tip.cluster.variantes.length > 0 && (
                <div className="mt-2 border-t border-white/15 pt-2">
                  <p className="text-xs text-slate-400">Incluye también:</p>
                  {tip.cluster.variantes.slice(0, 8).map((v) => (
                    <p key={v} className="wrap-break-word text-xs leading-5 text-slate-200">
                      {v}
                    </p>
                  ))}
                  {tip.cluster.variantes.length > 8 && (
                    <p className="text-xs text-slate-400">
                      +{tip.cluster.variantes.length - 8} más
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Vista de tabla (accesible; la card seleccionada se resalta) */}
      <section className="lk-anim lk-delay-4 mt-6 grid gap-4 lg:grid-cols-3">
        {CATEGORIAS.map((cat) => {
          const p = PREGUNTAS[cat];
          const clusters = porCategoria.get(cat) ?? [];
          const activa = seleccion === cat;
          return (
            <div
              key={cat}
              role="button"
              tabIndex={0}
              aria-pressed={activa}
              onClick={() => {
                setSeleccion(cat);
                ocultarTip();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSeleccion(cat);
                  ocultarTip();
                }
              }}
              className={`cursor-pointer overflow-hidden rounded-2xl bg-white text-left shadow-sm outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-slate-400 ${
                activa
                  ? "-translate-y-1 shadow-lg ring-2"
                  : "ring-1 ring-black/5 opacity-75 hover:-translate-y-0.5 hover:opacity-100 hover:shadow-md"
              }`}
              style={activa ? { ["--tw-ring-color" as string]: p.color } : undefined}
            >
              <div
                className="h-1 transition-opacity duration-300"
                style={{ backgroundColor: p.color, opacity: activa ? 1 : 0.25 }}
              />
              <div className="flex items-center justify-between gap-2 px-5 pt-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <h2 className="text-sm font-semibold">{p.texto}</h2>
                </div>
                {activa && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: p.color,
                      color: INK_SOBRE[p.color],
                    }}
                  >
                    En pantalla
                  </span>
                )}
              </div>
              <div className="mt-2 px-5 pb-5">
                {clusters.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">Sin respuestas aún.</p>
                ) : (
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[78%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">Idea</th>
                        <th className="py-2 text-right font-medium">Menciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clusters.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100 align-top">
                          <td className="py-2.5 pr-3">
                            <p className="wrap-break-word font-medium">{c.etiqueta}</p>
                            {c.variantes.length > 0 && (
                              <p className="mt-0.5 wrap-break-word text-xs text-slate-400">
                                Incluye: {c.variantes.join(", ")}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {c.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <p className="mt-8 text-center text-xs text-slate-400">
        evolucionamos contigo
      </p>
    </main>
  );
}
