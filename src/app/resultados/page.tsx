import type { Metadata } from "next";
import ResultsBoard from "@/components/ResultsBoard";

export const metadata: Metadata = {
  title: "Resultados · Prospectiva LinkTic",
  description: "Panorama de respuestas de la actividad de prospectiva",
};

export default function Resultados() {
  return <ResultsBoard />;
}
