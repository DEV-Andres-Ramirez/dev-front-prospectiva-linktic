"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PREGUNTAS, type Categoria } from "@/lib/preguntas";

const MAX_RESPUESTA = 50;

/** Solo letras (con tildes y Ñ) y espacios, siempre en mayúsculas */
function limpiarRespuesta(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑ ]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/, "")
    .slice(0, MAX_RESPUESTA);
}

type Paso = "bienvenida" | "pregunta" | "guardado";

export default function QuestionFlow({ categoria }: { categoria: Categoria }) {
  const pregunta = PREGUNTAS[categoria];
  const [paso, setPaso] = useState<Paso>("bienvenida");
  const [respuesta, setRespuesta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = respuesta.trim();
    if (texto.length === 0 || guardando) return;
    setGuardando(true);
    setError(null);
    const { error: err } = await supabase.from("respuestas_prospectiva").insert({
      respuesta: texto,
      categoria,
    });
    setGuardando(false);
    if (err) {
      setError("No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    setPaso("guardado");
  };

  const otraRespuesta = () => {
    setRespuesta("");
    setError(null);
    setPaso("pregunta");
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      {/* Fondo decorativo animado */}
      <div
        aria-hidden="true"
        className="lk-blob -top-24 -left-24 h-80 w-80"
        style={{ background: "#29c3f4" }}
      />
      <div
        aria-hidden="true"
        className="lk-blob -bottom-32 -right-20 h-96 w-96"
        style={{ background: "#23a844", animationDelay: "-4.5s" }}
      />

      <div className="lk-anim relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-black/5 backdrop-blur-sm">
        <div className="lk-accent-bar h-1.5" />

        <div className="px-6 pb-8 pt-7 sm:px-8">
          <header className="flex items-center justify-between gap-4">
            <Image
              src="/linktic_logo.png"
              alt="LinkTic"
              width={130}
              height={83}
              priority
              className="h-auto w-28"
            />
            <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Pregunta {pregunta.numero} de 3
            </span>
          </header>

          {paso === "bienvenida" && (
            <div className="mt-8">
              <h1 className="lk-anim lk-text-gradient text-3xl font-bold tracking-tight">
                ¡Hola, Linkers!
              </h1>
              <p className="lk-anim lk-delay-1 mt-4 text-base font-medium text-slate-700">
                Qué bueno tenerlos aquí.
              </p>
              <p className="lk-anim lk-delay-2 mt-4 text-sm leading-relaxed text-slate-600">
                Hoy queremos detenernos por un momento para mirar más allá del
                día a día y pensar juntos en el futuro de LinkTIC. Queremos
                conocer su visión, escuchar sus perspectivas y descubrir qué
                creen que nos hace únicos como organización.
              </p>
              <p className="lk-anim lk-delay-3 mt-4 text-sm leading-relaxed text-slate-600">
                Más que un ejercicio de planeación, este es un espacio para
                construir, cuestionar e imaginar el futuro que queremos crear
                juntos.
              </p>
              <button
                type="button"
                onClick={() => setPaso("pregunta")}
                className="lk-button lk-anim lk-delay-4 mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white"
              >
                Comenzar
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          )}

          {paso === "pregunta" && (
            <form onSubmit={guardar} className="mt-8">
              <div className="lk-anim lk-accent-bar h-1 w-12 rounded-full" />
              <h1 className="lk-anim lk-delay-1 lk-text-gradient mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {pregunta.texto}
              </h1>
              <p className="lk-anim lk-delay-2 mt-3 text-sm text-slate-500">
                Escribe tu respuesta en una palabra o una frase corta.
              </p>

              <div className="lk-anim lk-delay-3">
                <label
                  htmlFor="respuesta"
                  className="mt-6 block text-sm font-medium text-slate-700"
                >
                  Tu respuesta
                </label>
                <input
                  id="respuesta"
                  type="text"
                  value={respuesta}
                  onChange={(e) => setRespuesta(limpiarRespuesta(e.target.value))}
                  placeholder="ESCRIBE TU RESPUESTA"
                  maxLength={MAX_RESPUESTA}
                  autoComplete="off"
                  autoFocus
                  className="mt-2 h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-semibold tracking-wide outline-none transition-all duration-200 placeholder:text-base placeholder:font-normal placeholder:tracking-normal focus:border-lk-blue focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,143,216,0.15)]"
                />
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Solo letras, sin números ni caracteres especiales.
                  </p>
                  <p className="shrink-0 text-xs tabular-nums text-slate-400">
                    {respuesta.length}/{MAX_RESPUESTA}
                  </p>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="lk-anim mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={respuesta.trim().length === 0 || guardando}
                className="lk-button lk-anim lk-delay-4 mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
              >
                {guardando ? "Guardando…" : "Guardar respuesta"}
              </button>
            </form>
          )}

          {paso === "guardado" && (
            <div className="mt-8 flex flex-col items-center text-center">
              <span className="lk-pop flex h-16 w-16 items-center justify-center rounded-full bg-lk-green/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8"
                  fill="none"
                  stroke="var(--lk-green-deep)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path className="lk-check" d="M4 12.5l5 5L20 6.5" />
                </svg>
              </span>
              <h1 className="lk-anim lk-delay-1 mt-5 text-xl font-semibold tracking-tight">
                ¡Respuesta guardada!
              </h1>
              <p className="lk-anim lk-delay-2 mt-2 text-sm text-slate-500">
                Registramos tu respuesta:
              </p>
              <p className="lk-anim lk-delay-2 mt-3 w-full wrap-break-word rounded-xl bg-slate-50 px-4 py-3 text-base font-semibold tracking-wide">
                {respuesta.trim()}
              </p>
              <button
                type="button"
                onClick={otraRespuesta}
                className="lk-button lk-anim lk-delay-3 mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
              >
                Registrar otra respuesta
              </button>
              <p className="lk-anim lk-delay-4 mt-4 text-xs text-slate-400">
                Puedes registrar tantas ideas como quieras.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="relative z-10 mt-6 text-xs text-slate-400">
        evolucionamos contigo
      </p>
    </main>
  );
}
