import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PanelControlSimulacion from './PanelControlSimulacion'
import { ShieldCheck, Flame, Users, ArrowRight, Timer, Trophy } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // 1. Validar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 2. Consulta 1: Simulación más reciente o activa
  const { data: simulacionReciente } = await supabase
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Consulta 2: Atletas registrados
  const { count: totalAtletas } = await supabase
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
    .ilike('rol', 'atleta')

  // 4. Consulta 3: Participantes de la simulación activa
  let totalAsignados = 0
  let totalTiemposRegistrados = 0

  if (simulacionReciente?.id) {
    const { data: participantes } = await supabase
      .from('participantes_simulacion')
      .select('heat_asignado, tiempo_resultado_segundos')
      .eq('simulacion_id', simulacionReciente.id)

    if (participantes) {
      totalAsignados = participantes.filter((p) => Boolean(p.heat_asignado)).length
      totalTiemposRegistrados = participantes.filter(
        (p) => typeof p.tiempo_resultado_segundos === 'number' && p.tiempo_resultado_segundos > 0
      ).length
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Principal del Dashboard */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#02D7E5]/10 border border-[#02D7E5]/30 text-[#02D7E5] font-bold text-[10px] uppercase tracking-widest">
              Hyrox Race Director
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Centro de Control de Competición
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión en tiempo real del ciclo de la simulación y publicación de resultados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-[#02D7E5]" />
            <span>Modo Administrador</span>
          </div>
        </div>
      </header>

      {/* Panel Superior: Control de Estado de la Simulación y Métricas */}
      <PanelControlSimulacion
        simulacion={simulacionReciente}
        totalAtletas={totalAtletas ?? 0}
        totalAsignados={totalAsignados}
        totalTiemposRegistrados={totalTiemposRegistrados}
      />

      {/* Accesos Directos a los Módulos de Operación */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/carrera"
          className="group p-5 rounded-3xl bg-zinc-950/70 border border-white/10 hover:border-emerald-500/50 transition-all shadow-xl flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Timer className="w-6 h-6 text-emerald-400" />
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
              Día de Competición
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Largada oficial y registro de tiempos en vivo por heat.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/leaderboard"
          className="group p-5 rounded-3xl bg-zinc-950/70 border border-white/10 hover:border-[#02D7E5]/50 transition-all shadow-xl flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-[#02D7E5]/10 border border-[#02D7E5]/30 flex items-center justify-center text-[#02D7E5] group-hover:scale-105 transition-transform">
              <Trophy className="w-6 h-6 text-[#02D7E5]" />
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-[#02D7E5] group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white group-hover:text-[#02D7E5] transition-colors">
              Leaderboard Oficial
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Clasificación general y publicación de tabla a usuarios.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/heats"
          className="group p-5 rounded-3xl bg-zinc-950/70 border border-white/10 hover:border-amber-500/50 transition-all shadow-xl flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6 text-amber-400" />
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
              Gestión de Heats
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Asignación automática y tablero Drag & Drop del Heat 1 al 6.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/atletas"
          className="group p-5 rounded-3xl bg-zinc-950/70 border border-white/10 hover:border-[#02D7E5]/50 transition-all shadow-xl flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6 text-zinc-300" />
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white group-hover:text-[#02D7E5] transition-colors">
              Directorio de Atletas
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Consulta de competidores, promedios y mejores marcas (PR).
            </p>
          </div>
        </Link>
      </section>
    </div>
  )
}
