import type { Categoria } from "./preguntas";

export type Respuesta = {
  id: number;
  respuesta: string;
  categoria: Categoria;
};

export type Cluster = {
  /** Variante más frecuente del grupo, usada como etiqueta */
  etiqueta: string;
  total: number;
  miembros: Respuesta[];
  /** Variantes distintas a la etiqueta agrupadas dentro del cluster */
  variantes: string[];
};

const STOPWORDS = new Set([
  "EL", "LA", "LOS", "LAS", "UN", "UNA", "UNOS", "UNAS",
  "DE", "DEL", "AL", "EN", "Y", "O", "QUE", "CON", "POR", "PARA",
  "NUESTRO", "NUESTRA", "NUESTROS", "NUESTRAS", "SER", "MUY",
]);

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-ZÑ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave de comparación: sin acentos, sin stopwords */
function clave(texto: string): string {
  const tokens = normalizar(texto)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return tokens.join(" ") || normalizar(texto);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Dos respuestas se consideran la misma idea si sus claves son casi iguales */
function sonSimilares(a: string, b: string): boolean {
  if (a === b) return true;
  const max = Math.max(a.length, b.length);
  if (max <= 3) return false;
  const d = levenshtein(a, b);
  if (max <= 5) return d <= 1;
  if (max <= 9) return d <= 2;
  return 1 - d / max >= 0.75;
}

/**
 * Agrupa respuestas similares (misma idea escrita distinto: plurales,
 * errores de tipeo, artículos) dentro de una misma categoría.
 */
export function agruparRespuestas(respuestas: Respuesta[]): Cluster[] {
  const claves = respuestas.map((r) => clave(r.respuesta));
  const padre = respuestas.map((_, i) => i);

  const buscar = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]];
      i = padre[i];
    }
    return i;
  };
  const unir = (a: number, b: number) => {
    const ra = buscar(a);
    const rb = buscar(b);
    if (ra !== rb) padre[rb] = ra;
  };

  for (let i = 0; i < respuestas.length; i++) {
    for (let j = i + 1; j < respuestas.length; j++) {
      if (sonSimilares(claves[i], claves[j])) unir(i, j);
    }
  }

  const grupos = new Map<number, Respuesta[]>();
  respuestas.forEach((r, i) => {
    const raiz = buscar(i);
    const grupo = grupos.get(raiz);
    if (grupo) grupo.push(r);
    else grupos.set(raiz, [r]);
  });

  const clusters: Cluster[] = [];
  for (const miembros of grupos.values()) {
    const frecuencia = new Map<string, number>();
    for (const m of miembros) {
      const texto = m.respuesta.trim();
      frecuencia.set(texto, (frecuencia.get(texto) ?? 0) + 1);
    }
    let etiqueta = miembros[0].respuesta.trim();
    let mejor = 0;
    for (const [texto, veces] of frecuencia) {
      if (veces > mejor || (veces === mejor && texto.length < etiqueta.length)) {
        etiqueta = texto;
        mejor = veces;
      }
    }
    const variantes = [...frecuencia.keys()].filter((t) => t !== etiqueta);
    clusters.push({ etiqueta, total: miembros.length, miembros, variantes });
  }

  return clusters.sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta));
}
