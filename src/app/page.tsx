import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="lk-accent-bar h-1.5" />
        <div className="flex flex-col items-center gap-6 px-8 py-12 text-center">
          <Image
            src="/linktic_logo.png"
            alt="LinkTic — evolucionamos contigo"
            width={220}
            height={140}
            priority
            className="h-auto w-52"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Actividad de prospectiva
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              El acceso a cada sección de la actividad se realiza únicamente
              mediante el enlace directo compartido por el equipo organizador.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">evolucionamos contigo</p>
    </main>
  );
}
