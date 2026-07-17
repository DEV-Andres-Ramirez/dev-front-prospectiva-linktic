import type { Metadata } from "next";
import QuestionFlow from "@/components/QuestionFlow";
import { PREGUNTAS } from "@/lib/preguntas";

export const metadata: Metadata = {
  title: `Pregunta 2 · Prospectiva LinkTic`,
  description: PREGUNTAS.pregunta_2.texto,
};

export default function Pregunta2() {
  return <QuestionFlow categoria="pregunta_2" />;
}
