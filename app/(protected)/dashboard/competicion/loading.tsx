export default function CompeticionLoading() {
  return (
    <main className="pb-12 px-4 pt-4 space-y-6 max-w-md mx-auto animate-pulse">
      {/* 1. Header de Sección Skeleton */}
      <header className="space-y-2">
        <div className="h-2.5 w-24 bg-zinc-800/70 rounded-full" />
        <div className="h-7 w-52 bg-zinc-800 rounded-lg" />
        <div className="h-3 w-64 bg-zinc-800/60 rounded" />
      </header>

      {/* 2. Tarjeta Destacada: Categoría / Heat Asignado Skeleton */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950/80 border border-white/10 p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="h-3 w-28 bg-zinc-800/70 rounded-full mt-1" />
          <div className="h-5 w-36 bg-zinc-800 rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-zinc-800/60 rounded" />
            <div className="h-9 w-32 bg-zinc-800 rounded-xl" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0" />
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="h-3 w-full bg-zinc-800/60 rounded" />
          <div className="h-3 w-4/5 bg-zinc-800/60 rounded" />
        </div>
      </section>

      {/* 3. Bento Card: Detalles del Evento Skeleton */}
      <section className="space-y-3">
        <div className="h-3 w-32 bg-zinc-800/70 rounded-full px-1" />

        <div className="p-5 rounded-3xl bg-zinc-950/80 border border-white/10 space-y-4 shadow-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-16 bg-zinc-800/70 rounded-full" />
                <div className="h-4 w-40 bg-zinc-800 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
