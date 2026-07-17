export type Categoria = "pregunta_1" | "pregunta_2" | "pregunta_3";

export type Pregunta = {
  numero: 1 | 2 | 3;
  texto: string;
  /** Color categórico validado (CVD-safe) para la gráfica de resultados */
  color: string;
};

export const PREGUNTAS: Record<Categoria, Pregunta> = {
  pregunta_1: { numero: 1, texto: "¿En qué somos buenos?", color: "#2a78d6" },
  pregunta_2: { numero: 2, texto: "¿Qué nos guía?", color: "#008300" },
  pregunta_3: { numero: 3, texto: "¿Cuáles son nuestros dolores?", color: "#e87ba4" },
};

export const CATEGORIAS: Categoria[] = ["pregunta_1", "pregunta_2", "pregunta_3"];
