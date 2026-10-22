export default function PerfilLoading() {
  return (
    <main className="pb-16 px-4 pt-4 space-y-6 max-w-md mx-auto animate-pulse">
      {/* 1. Header con Navegación Skeleton */}
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0" />
        <div className="space-y-1.5">
          <div className="h-2.5 w-24 bg-zinc-800/70 rounded-full" />
          <div className="h-5 w-36 bg-zinc-800 rounded-lg" />
        </div>
      </header>

      {/* 2. Tarjeta Bento Principal: Atleta & Credencial Skeleton */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950/80 border border-white/10 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-28 bg-zinc-800/80 rounded-full" />
            <div className="h-5 w-40 bg-zinc-800 rounded-md" />
            <div className="h-3 w-20 bg-zinc-800/60 rounded" />
          </div>
        </div>
      </section>

      {/* 3. Grid Bento: Datos Personales Oficiales Skeleton */}
      <section className="space-y-3">
        <div className="h-3 w-44 bg-zinc-800/70 rounded-full px-1" />

        <div className="grid grid-cols-2 gap-3">
          {/* Tarjeta Cédula */}
          <div className="p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-24 bg-zinc-800/60 rounded" />
              <div className="h-4 w-20 bg-zinc-800 rounded" />
            </div>
          </div>

          {/* Tarjeta Talla */}
          <div className="p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-20 bg-zinc-800/60 rounded" />
              <div className="h-4 w-16 bg-zinc-800 rounded" />
            </div>
          </div>

          {/* Tarjeta Correo */}
          <div className="col-span-2 p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-24 bg-zinc-800/60 rounded" />
              <div className="h-3.5 w-44 bg-zinc-800 rounded" />
            </div>
          </div>

          {/* Tarjeta Teléfono */}
          <div className="col-span-2 p-4 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-28 bg-zinc-800/60 rounded" />
              <div className="h-3.5 w-32 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Botón de Cerrar Sesión Skeleton */}
      <div className="pt-2">
        <div className="w-full h-14 rounded-3xl bg-zinc-900/60 border border-zinc-800" />
      </div>
    </main>
  )
}
