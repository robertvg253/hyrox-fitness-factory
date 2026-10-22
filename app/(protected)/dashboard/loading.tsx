export default function DashboardLoading() {
  return (
    <main className="pb-12 px-4 pt-4 space-y-6 max-w-md mx-auto animate-pulse">
      {/* 1. Header con Saludo Skeleton */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-white/5 shrink-0" />
          <div className="space-y-2">
            <div className="h-2.5 w-24 bg-zinc-800/70 rounded-full" />
            <div className="h-5 w-36 bg-zinc-800 rounded-lg" />
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-white/5 shrink-0" />
      </header>

      {/* 2. Tarjeta Bento: Rendimiento y Tests Skeleton */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950/80 border border-white/10 p-5 space-y-4 shadow-xl">
        {/* Métricas Superiores (Promedio y Mejor Marca PR) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-16 bg-zinc-800 rounded-full" />
              <div className="w-6 h-6 rounded-lg bg-zinc-800/60" />
            </div>
            <div className="h-7 w-20 bg-zinc-800 rounded-md" />
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-16 bg-zinc-800 rounded-full" />
              <div className="w-6 h-6 rounded-lg bg-zinc-800/60" />
            </div>
            <div className="h-7 w-20 bg-zinc-800 rounded-md" />
          </div>
        </div>

        {/* Desglose de Tests Header */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="h-3 w-36 bg-zinc-800 rounded-full" />
            <div className="h-3 w-12 bg-zinc-800/60 rounded-full" />
          </div>

          {/* Grid de 4 Tests Skeleton */}
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-between"
              >
                <div className="space-y-1.5">
                  <div className="h-2.5 w-12 bg-zinc-800/70 rounded-full" />
                  <div className="h-4 w-16 bg-zinc-800 rounded-md" />
                </div>
                <div className="w-7 h-7 rounded-xl bg-zinc-800/60" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Hero Banner Skeleton */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950/80 border border-white/10 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-zinc-800 rounded-full" />
          <div className="h-3 w-16 bg-zinc-800/60 rounded-full" />
        </div>

        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-zinc-800 rounded-lg" />
          <div className="h-3 w-full bg-zinc-800/60 rounded" />
          <div className="h-3 w-2/3 bg-zinc-800/60 rounded" />
        </div>

        <div className="pt-2">
          <div className="h-12 w-44 rounded-2xl bg-zinc-800" />
        </div>
      </section>
    </main>
  )
}
