import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RegistroTiemposCarreraClient, { AtletaCarrera } from './RegistroTiemposCarreraClient'
import { Timer, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default async function CarreraPage() {
  const supabase = await createClient()

  // 1. Validar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 2. Obtener simulación activa o más reciente
  const { data: simulacionReciente } = await supabase
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Obtener todos los atletas registrados
  const { data: usuariosAtletas } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, rol')
    .ilike('rol', 'atleta')
    .order('creado_en', { ascending: false })

  const atletasList = usuariosAtletas || []

  // 4. Obtener tiempos históricos para calcular promedios
  const { data: todosTiempos } = await supabase
    .from('tiempos_historicos')
    .select('usuario_id, tiempo_segundos')

  const tiemposMap = new Map<string, number[]>()
  todosTiempos?.forEach((t) => {
    if (t.usuario_id && typeof t.tiempo_segundos === 'number' && t.tiempo_segundos > 0) {
      const list = tiemposMap.get(t.usuario_id) || []
      list.push(t.tiempo_segundos)
      tiemposMap.set(t.usuario_id, list)
    }
  })

  // 5. Obtener participantes de la simulación activa
  const partMap = new Map<
    string,
    { heat_asignado: string | null; tiempo_resultado_segundos: number | null }
  >()

  if (simulacionReciente?.id) {
    const { data: participantes } = await supabase
      .from('participantes_simulacion')
      .select('usuario_id, heat_asignado, tiempo_resultado_segundos')
      .eq('simulacion_id', simulacionReciente.id)

    participantes?.forEach((p) => {
      if (p.usuario_id) {
        partMap.set(p.usuario_id, {
          heat_asignado: p.heat_asignado,
          tiempo_resultado_segundos: p.tiempo_resultado_segundos,
        })
      }
    })
  }

  // 6. Mapear a formato AtletaCarrera
  const atletasCarrera: AtletaCarrera[] = atletasList.map((atleta) => {
    const tests = tiemposMap.get(atleta.id) || []
    const suma = tests.reduce((acc, v) => acc + v, 0)
    const promSec = tests.length > 0 ? Math.round(suma / tests.length) : 0
    const part = partMap.get(atleta.id)

    const resultadoSec = part?.tiempo_resultado_segundos ?? null

    return {
      id: atleta.id,
      nombres: atleta.nombres || 'Atleta Sin Nombre',
      cedula: atleta.cedula || undefined,
      heatAsignado: part?.heat_asignado || 'Sin Asignar',
      promedioSegundos: promSec,
      promedioMMSS: formatSegundosAMM_SS(promSec),
      tiempoResultadoSegundos: resultadoSec,
      tiempoResultadoMMSS: resultadoSec ? formatSegundosAMM_SS(resultadoSec) : null,
    }
  })

  // Ordenar atletas de MENOR a MAYOR promedio (más rápidos primero)
  atletasCarrera.sort((a, b) => {
    if (!a.promedioSegundos && b.promedioSegundos) return 1
    if (a.promedioSegundos && !b.promedioSegundos) return -1
    if (a.promedioSegundos !== b.promedioSegundos) {
      return a.promedioSegundos - b.promedioSegundos
    }
    return a.nombres.localeCompare(b.nombres)
  })

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header de la Vista */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Dashboard</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
              Día de Competición
            </span>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Gestión de Carrera y Registro de Tiempos
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Control de largada de la simulación y carga en vivo de los tiempos oficiales por heat.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-[#02D7E5]" />
            <span>Jueces y Cronometraje</span>
          </div>
        </div>
      </header>

      {/* Alerta si no hay simulación activa */}
      {!simulacionReciente ? (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-bold text-white text-sm">No hay ninguna simulación registrada</p>
            <p className="text-zinc-400">
              Debes crear una simulación desde el Dashboard para poder arrancar la competición y anotar los tiempos de los atletas.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                Ir al Dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <RegistroTiemposCarreraClient
          simulacion={{
            id: simulacionReciente.id,
            nombre: simulacionReciente.nombre,
            estado: simulacionReciente.estado,
            heats_liberados: Boolean(simulacionReciente.heats_liberados),
          }}
          atletas={atletasCarrera}
        />
      )}
    </div>
  )
}
