"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { agruparRespuestas, type Cluster, type Respuesta } from "@/lib/clustering";
import { CATEGORIAS, PREGUNTAS, type Categoria } from "@/lib/preguntas";

/* ————— Diseño de la gráfica —————
   Plano cartesiano compartido: eje X = número de menciones (magnitud),
   eje Y = tres carriles, uno por pregunta. Cada burbuja agrupa las
   respuestas similares; su posición y su área codifican las menciones. */

const ML = 18;
const MR = 18;
const LABEL_FONT = 11;
const LABEL_H = 14;
const INK = "#334155";

/* Tinta interior por color de serie (según luminancia del relleno) */
const INK_SOBRE: Record<string, string> = {
  "#2a78d6": "#ffffff",
  "#008300": "#ffffff",
  "#e87ba4": "#43102a",
};

type Burbuja = { cluster: Cluster; cx: number; dy: number; r: number };

type Etiqueta = {
  x: number;
  y: number;
  texto: string;
  anchor: "start" | "end";
};

type Caja = { x1: number; y1: number; x2: number; y2: number };

const intersecta = (a: Caja, b: Caja) =>
  a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

function calcularCarril(clusters: Cluster[], w: number, maxX: number) {
  const innerW = w - ML - MR;
  const rMin = w < 480 ? 11 : 13;
  const rMax = w < 480 ? 22 : 30;
  const escalaR = (c: number) =>
    maxX <= 1
      ? rMin
      : rMin + ((Math.sqrt(c) - 1) / (Math.sqrt(maxX) - 1)) * (rMax - rMin);
  const escalaX = (c: number) => ML + (c / (maxX + 0.5)) * innerW;

  const burbujas: Burbuja[] = [];
  for (const cluster of clusters) {
    const r = escalaR(cluster.total);
    const cx = Math.min(Math.max(escalaX(cluster.total), ML + r), w - MR - r);
    let dy = 0;
    for (let paso = 0; paso < 400; paso++) {
      const cand = paso === 0 ? 0 : ((paso % 2 === 1 ? 1 : -1) * Math.ceil(paso / 2)) * 14;
      const choca = burbujas.some(
        (b) => Math.hypot(cx - b.cx, cand - b.dy) < r + b.r + 6
      );
      if (!choca) {
        dy = cand;
        break;
      }
    }
    burbujas.push({ cluster, cx, dy, r });
  }

  /* Etiquetas directas: junto a la burbuja, saltando las que chocan
     (el tooltip y la tabla las cubren) */
  const cajasBurbujas: Caja[] = burbujas.map((b) => ({
    x1: b.cx - b.r,
    y1: b.dy - b.r,
    x2: b.cx + b.r,
    y2: b.dy + b.r,
  }));
  const cajasEtiquetas: Caja[] = [];
  const etiquetas: (Etiqueta | null)[] = burbujas.map((b, i) => {
    const texto = b.cluster.etiqueta;
    const wTxt = texto.length * (LABEL_FONT * 0.62) + 6;
    const candidatos: { x1: number; anchor: "start" | "end" }[] = [
      { x1: b.cx + b.r + 6, anchor: "start" },
      { x1: b.cx - b.r - 6 - wTxt, anchor: "end" },
    ];
    for (const c of candidatos) {
      const caja: Caja = {
        x1: c.x1,
        y1: b.dy - LABEL_H / 2,
        x2: c.x1 + wTxt,
        y2: b.dy + LABEL_H / 2,
      };
      if (caja.x1 < 2 || caja.x2 > w - 2) continue;
      const choca =
        cajasBurbujas.some((cb, j) => j !== i && intersecta(caja, cb)) ||
        cajasEtiquetas.some((cb) => intersecta(caja, cb));
      if (!choca) {
        cajasEtiquetas.push(caja);
        return {
          x: c.anchor === "start" ? caja.x1 : caja.x2,
          y: b.dy,
          texto,
          anchor: c.anchor,
        };
      }
    }
    return null;
  });

  const mitad = Math.max(
    48,
    ...burbujas.map((b) => Math.abs(b.dy) + b.r + 12)
  );
  return { burbujas, etiquetas, mitad };
}

type Tip = {
  cluster: Cluster;
  categoria: Categoria;
  x: number;
  y: number;
  wrapW: number;
};

export default function ResultsBoard() {
  const [filas, setFilas] = useState<Respuesta[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [ancho, setAncho] = useState(0);
  const medidorRef = useRef<HTMLDivElement>(null);
  const envoltorioRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("respuestas_prospectiva")
      .select("id,nombre,respuesta,categoria")
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

  const maxX = useMemo(() => {
    let m = 2;
    for (const clusters of porCategoria.values()) {
      for (const c of clusters) m = Math.max(m, c.total);
    }
    return m;
  }, [porCategoria]);

  const participantes = useMemo(() => {
    const set = new Set<string>();
    for (const f of filas ?? []) set.add(f.nombre.trim().toUpperCase());
    return set.size;
  }, [filas]);

  const totalIdeas = useMemo(() => {
    let n = 0;
    for (const clusters of porCategoria.values()) n += clusters.length;
    return n;
  }, [porCategoria]);

  const ticks = useMemo(() => {
    const paso = maxX > 10 ? Math.ceil(maxX / 8) : 1;
    const t: number[] = [];
    for (let v = 0; v <= maxX; v += paso) t.push(v);
    return t;
  }, [maxX]);

  const escalaX = useCallback(
    (c: number) => ML + (c / (maxX + 0.5)) * (ancho - ML - MR),
    [ancho, maxX]
  );

  const mostrarTip = (
    el: Element,
    cluster: Cluster,
    categoria: Categoria
  ) => {
    const envoltorio = envoltorioRef.current;
    if (!envoltorio) return;
    const rb = el.getBoundingClientRect();
    const rw = envoltorio.getBoundingClientRect();
    setTip({
      cluster,
      categoria,
      x: rb.left + rb.width / 2 - rw.left,
      y: rb.top - rw.top,
      wrapW: rw.width,
    });
  };

  const cargando = filas === null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
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
          <span className="text-xs text-slate-400">
            Se actualiza cada 10 s
          </span>
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
      <section className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { etiqueta: "Participantes", valor: participantes },
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

      {/* Gráfica */}
      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="lk-accent-bar h-1" />
        <div
          ref={envoltorioRef}
          className="relative px-4 pb-6 pt-5 sm:px-6"
          onKeyDown={(e) => {
            if (e.key === "Escape") setTip(null);
          }}
        >
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            Mapa de ideas
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
            Cada burbuja agrupa respuestas similares. Cuanto más a la derecha y
            más grande, más veces fue mencionada la idea.
          </p>

          <div ref={medidorRef} className="mt-5">
            {cargando && (
              <p className="py-12 text-center text-sm text-slate-400">
                Cargando respuestas…
              </p>
            )}

            {!cargando && ancho > 0 && (
              <div>
                {CATEGORIAS.map((cat) => {
                  const pregunta = PREGUNTAS[cat];
                  const clusters = porCategoria.get(cat) ?? [];
                  const respuestasCat = clusters.reduce((s, c) => s + c.total, 0);
                  const { burbujas, etiquetas, mitad } = calcularCarril(
                    clusters,
                    ancho,
                    maxX
                  );
                  const alto = mitad * 2;
                  return (
                    <div key={cat} className="border-b border-slate-100 last:border-b-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-4">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full"
                          style={{ backgroundColor: pregunta.color }}
                        />
                        <h3 className="text-sm font-semibold">{pregunta.texto}</h3>
                        <span className="text-xs tabular-nums text-slate-400">
                          {respuestasCat}{" "}
                          {respuestasCat === 1 ? "respuesta" : "respuestas"}
                        </span>
                      </div>

                      {clusters.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">
                          Aún no hay respuestas para esta pregunta.
                        </p>
                      ) : (
                        <svg
                          width={ancho}
                          height={alto}
                          className="mt-1 block"
                          role="img"
                          aria-label={`Ideas para: ${pregunta.texto}`}
                        >
                          {ticks.map((t) => (
                            <line
                              key={t}
                              x1={escalaX(t)}
                              x2={escalaX(t)}
                              y1={0}
                              y2={alto}
                              stroke={t === 0 ? "#dbe1e8" : "#edf0f4"}
                              strokeWidth={1}
                            />
                          ))}
                          {burbujas.map((b, i) => {
                            const id = `${cat}-${i}`;
                            const activa = hover === id;
                            return (
                              <g key={id}>
                                <circle
                                  cx={b.cx}
                                  cy={mitad + b.dy}
                                  r={b.r}
                                  fill={pregunta.color}
                                  stroke="#ffffff"
                                  strokeWidth={2}
                                  opacity={activa ? 0.85 : 1}
                                />
                                {b.r >= 15 &&
                                  String(b.cluster.total).length * 8 <= b.r && (
                                    <text
                                      x={b.cx}
                                      y={mitad + b.dy + 4}
                                      textAnchor="middle"
                                      fontSize={12}
                                      fontWeight={600}
                                      fill={INK_SOBRE[pregunta.color] ?? "#ffffff"}
                                    >
                                      {b.cluster.total}
                                    </text>
                                  )}
                              </g>
                            );
                          })}
                          {etiquetas.map((e, i) =>
                            e ? (
                              <text
                                key={i}
                                x={e.x}
                                y={mitad + e.y + 4}
                                textAnchor={e.anchor}
                                fontSize={LABEL_FONT}
                                fontWeight={500}
                                fill={INK}
                                stroke="#ffffff"
                                strokeWidth={3}
                                paintOrder="stroke"
                              >
                                {e.texto}
                              </text>
                            ) : null
                          )}
                          {/* Zonas de interacción (más grandes que la marca) */}
                          {burbujas.map((b, i) => {
                            const id = `${cat}-${i}`;
                            return (
                              <circle
                                key={id}
                                cx={b.cx}
                                cy={mitad + b.dy}
                                r={Math.max(b.r + 8, 24)}
                                fill="transparent"
                                tabIndex={0}
                                role="img"
                                aria-label={`${b.cluster.etiqueta}: ${b.cluster.total} ${
                                  b.cluster.total === 1 ? "mención" : "menciones"
                                }`}
                                className="cursor-pointer outline-none focus-visible:stroke-slate-400 focus-visible:stroke-2"
                                onPointerEnter={(ev) => {
                                  setHover(id);
                                  mostrarTip(ev.currentTarget, b.cluster, cat);
                                }}
                                onPointerLeave={() => {
                                  setHover(null);
                                  setTip(null);
                                }}
                                onFocus={(ev) => {
                                  setHover(id);
                                  mostrarTip(ev.currentTarget, b.cluster, cat);
                                }}
                                onBlur={() => {
                                  setHover(null);
                                  setTip(null);
                                }}
                              />
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  );
                })}

                {/* Eje X compartido */}
                <svg width={ancho} height={40} className="block" aria-hidden="true">
                  <line
                    x1={ML}
                    x2={ancho - MR}
                    y1={1}
                    y2={1}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                  {ticks.map((t) => (
                    <text
                      key={t}
                      x={escalaX(t)}
                      y={16}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#8a93a1"
                      className="tabular-nums"
                    >
                      {t}
                    </text>
                  ))}
                  <text
                    x={ancho / 2}
                    y={34}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#8a93a1"
                  >
                    Número de menciones
                  </text>
                </svg>
              </div>
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
                {PREGUNTAS[tip.categoria].texto}
              </p>
              <div className="mt-2 border-t border-white/15 pt-2">
                {tip.cluster.miembros.slice(0, 8).map((m) => (
                  <p key={m.id} className="wrap-break-word text-xs leading-5 text-slate-200">
                    <span className="text-slate-400">{m.nombre.trim()}</span>{" "}
                    — {m.respuesta.trim()}
                  </p>
                ))}
                {tip.cluster.miembros.length > 8 && (
                  <p className="text-xs text-slate-400">
                    +{tip.cluster.miembros.length - 8} más
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Vista de tabla (accesible, sin depender del color ni del tooltip) */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {CATEGORIAS.map((cat) => {
          const pregunta = PREGUNTAS[cat];
          const clusters = porCategoria.get(cat) ?? [];
          return (
            <div
              key={cat}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
            >
              <div className="flex items-center gap-2 px-5 pt-4">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pregunta.color }}
                />
                <h2 className="text-sm font-semibold">{pregunta.texto}</h2>
              </div>
              <div className="mt-2 overflow-x-auto px-5 pb-5">
                {clusters.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">Sin respuestas aún.</p>
                ) : (
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[50%]" />
                      <col className="w-[12%]" />
                      <col className="w-[38%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">Idea</th>
                        <th
                          className="py-2 pr-3 text-right font-medium"
                          title="Menciones"
                        >
                          Nº
                        </th>
                        <th className="py-2 font-medium">Personas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clusters.map((c, i) => {
                        const personas = [
                          ...new Set(c.miembros.map((m) => m.nombre.trim())),
                        ].join(", ");
                        return (
                          <tr key={i} className="border-t border-slate-100 align-top">
                            <td className="py-2.5 pr-3">
                              <p className="wrap-break-word font-medium">{c.etiqueta}</p>
                              {c.variantes.length > 0 && (
                                <p className="mt-0.5 wrap-break-word text-xs text-slate-400">
                                  Incluye: {c.variantes.join(", ")}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">
                              {c.total}
                            </td>
                            <td className="wrap-break-word py-2.5 text-xs leading-5 text-slate-500">
                              {personas}
                            </td>
                          </tr>
                        );
                      })}
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
