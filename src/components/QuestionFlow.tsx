"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PREGUNTAS, type Categoria } from "@/lib/preguntas";

const MAX_RESPUESTA = 50;
const MAX_NOMBRE = 60;

/** Solo letras (con tildes y Ñ) y espacios, siempre en mayúsculas */
function limpiarRespuesta(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑ ]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/, "")
    .slice(0, MAX_RESPUESTA);
}

function limpiarNombre(valor: string): string {
  return valor
    .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/, "")
    .slice(0, MAX_NOMBRE);
}

type Paso = "nombre" | "pregunta" | "guardado";

export default function QuestionFlow({ categoria }: { categoria: Categoria }) {
  const pregunta = PREGUNTAS[categoria];
  const [paso, setPaso] = useState<Paso>("nombre");
  const [nombre, setNombre] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length === 0) return;
    setPaso("pregunta");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = respuesta.trim();
    if (texto.length === 0 || guardando) return;
    setGuardando(true);
    setError(null);
    const { error: err } = await supabase.from("respuestas_prospectiva").insert({
      nombre: nombre.trim(),
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
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

          {paso === "nombre" && (
            <form onSubmit={ingresar} className="mt-8">
              <h1 className="text-xl font-semibold tracking-tight">
                Actividad de prospectiva
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Antes de comenzar, cuéntanos quién eres.
              </p>
              <label htmlFor="nombre" className="mt-6 block text-sm font-medium text-slate-700">
                Tu nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(limpiarNombre(e.target.value))}
                placeholder="Escribe tu nombre"
                autoComplete="name"
                autoFocus
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-lk-blue focus:bg-white focus:ring-2 focus:ring-lk-blue/25"
              />
              <button
                type="submit"
                disabled={nombre.trim().length === 0}
                className="lk-button mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
              >
                Ingresar
              </button>
            </form>
          )}

          {paso === "pregunta" && (
            <form onSubmit={guardar} className="mt-8">
              <p className="text-sm text-slate-500">
                Hola, <span className="font-medium text-slate-700">{nombre.trim()}</span>
              </p>
              <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">
                {pregunta.texto}
              </h1>

              <label htmlFor="respuesta" className="mt-6 block text-sm font-medium text-slate-700">
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
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-medium tracking-wide outline-none transition placeholder:font-normal placeholder:tracking-normal focus:border-lk-blue focus:bg-white focus:ring-2 focus:ring-lk-blue/25"
              />
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Solo letras, sin números ni caracteres especiales.
                </p>
                <p className="shrink-0 text-xs tabular-nums text-slate-400">
                  {respuesta.length}/{MAX_RESPUESTA}
                </p>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={respuesta.trim().length === 0 || guardando}
                className="lk-button mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
              >
                {guardando ? "Guardando…" : "Guardar respuesta"}
              </button>
            </form>
          )}

          {paso === "guardado" && (
            <div className="mt-8 flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lk-green/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="var(--lk-green-deep)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </span>
              <h1 className="mt-5 text-xl font-semibold tracking-tight">
                ¡Respuesta guardada!
              </h1>
              <p className="mt-2 text-sm text-slate-500">Registramos tu respuesta:</p>
              <p className="mt-3 w-full wrap-break-word rounded-xl bg-slate-50 px-4 py-3 text-base font-semibold tracking-wide">
                {respuesta.trim()}
              </p>
              <button
                type="button"
                onClick={otraRespuesta}
                className="lk-button mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
              >
                Registrar otra respuesta
              </button>
              <p className="mt-4 text-xs text-slate-400">
                Puedes registrar tantas ideas como quieras.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">evolucionamos contigo</p>
    </main>
  );
}
