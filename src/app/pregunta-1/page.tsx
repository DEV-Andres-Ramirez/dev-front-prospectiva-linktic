import type { Metadata } from "next";
import QuestionFlow from "@/components/QuestionFlow";
import { PREGUNTAS } from "@/lib/preguntas";

export const metadata: Metadata = {
  title: `Pregunta 1 · Prospectiva LinkTic`,
  description: PREGUNTAS.pregunta_1.texto,
};

export default function Pregunta1() {
  return <QuestionFlow categoria="pregunta_1" />;
}
