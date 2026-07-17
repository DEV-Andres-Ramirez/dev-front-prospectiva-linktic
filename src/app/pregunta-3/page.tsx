import type { Metadata } from "next";
import QuestionFlow from "@/components/QuestionFlow";
import { PREGUNTAS } from "@/lib/preguntas";

export const metadata: Metadata = {
  title: `Pregunta 3 · Prospectiva LinkTic`,
  description: PREGUNTAS.pregunta_3.texto,
};

export default function Pregunta3() {
  return <QuestionFlow categoria="pregunta_3" />;
}
