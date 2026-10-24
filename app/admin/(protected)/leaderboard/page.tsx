import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LeaderboardOficialClient, { AtletaLeaderboardItem } from './LeaderboardOficialClient'
import { ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react'
import { Categoria } from '@/src/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDiferencia(diffSec: number | null): string {
  if (diffSec === null) return '—'
  const absVal = Math.abs(diffSec)
  const m = Math.floor(absVal / 60)
  const s = absVal % 60
  const formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  if (diffSec < 0) return `-${formatted}`
  if (diffSec > 0) return `+${formatted}`
  return '00:00'
}

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // 1. Validar autenticación de administrador
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 2. Cliente con permisos de administración (Service Role) para evitar bloqueos por RLS
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Obtener simulación activa o más reciente
  const { data: simulacionReciente } = await supabaseAdmin
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 4. Obtener todas las categorías oficiales
  const { data: categoriasData } = await supabaseAdmin
    .from('categorias')
    .select('id, nombre, tipo')
    .order('nombre', { ascending: true })

  const categorias: Categoria[] = (categoriasData || []) as Categoria[]
  const catMap = new Map(categorias.map((c) => [c.id, c]))

  // 5. Obtener tiempos históricos para calcular promedios previos de respaldo
  const { data: todosTiempos } = await supabaseAdmin
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

  // 6. Consultar directamente los participantes de la simulación activa con JOIN a categorias y usuarios
  let rawItems: AtletaLeaderboardItem[] = []

  if (simulacionReciente?.id) {
    const { data: participantes, error: partError } = await supabaseAdmin
      .from('participantes_simulacion')
      .select(`
        id,
        simulacion_id,
        usuario_id,
        dorsal,
        heat_asignado,
        salida_asignada,
        tiempo_resultado_segundos,
        promedio_previo_segundos,
        partner_nombres,
        categoria_id,
        categorias:categoria_id (
          id,
          nombre,
          tipo
        ),
        usuarios:usuario_id (
          id,
          nombres,
          cedula,
          email
        )
      `)
      .eq('simulacion_id', simulacionReciente.id)

    if (partError) {
      console.error('[LeaderboardPage] Error en consulta de participantes_simulacion:', partError)
    }

    // Mapa de usuarios de respaldo por si el join de Supabase falla silenciosamente
    const userIds = (participantes || []).map((p) => p.usuario_id).filter(Boolean)
    const usuariosMap = new Map<string, { id: string; nombres: string; cedula?: string }>()
    if (userIds.length > 0) {
      const { data: directUsers } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombres, cedula')
        .in('id', userIds)
      directUsers?.forEach((u) => usuariosMap.set(u.id, u))
    }

    rawItems = (participantes || []).map((p: any) => {
      // Extracción defensiva ante posibles arrays u objetos según vista de Supabase
      const catRel = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias
      const usrRel = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios

      const catId = p.categoria_id || catRel?.id || null
      const catObj = catId ? catMap.get(catId) || catRel : catRel

      const usrFallback = p.usuario_id ? usuariosMap.get(p.usuario_id) : null
      const nombreAtleta = usrRel?.nombres || usrFallback?.nombres || 'Atleta Sin Nombre'
      const cedulaAtleta = usrRel?.cedula || usrFallback?.cedula || undefined

      // Nombre y Tipo de Categoría extraídos directamente del objeto anidado o mapa de respaldo
      const categoriaNombre = (catRel?.nombre || catObj?.nombre || '').trim() || null
      const tipoRaw = (catRel?.tipo || catObj?.tipo || '').toLowerCase().trim()
      const nombreNorm = (categoriaNombre || '').toLowerCase().trim()

      let categoriaTipo: 'individual' | 'dupla' = 'individual'
      if (
        tipoRaw === 'dupla' ||
        tipoRaw === 'duplas' ||
        nombreNorm.includes('dupla') ||
        Boolean(p.partner_nombres?.trim())
      ) {
        categoriaTipo = 'dupla'
      } else {
        categoriaTipo = 'individual'
      }

      // Cálculo de promedio: usar promedio_previo_segundos de la fila o calcular desde historial
      const tests = p.usuario_id ? tiemposMap.get(p.usuario_id) || [] : []
      const suma = tests.reduce((acc, v) => acc + v, 0)
      const promCalculado = tests.length > 0 ? Math.round(suma / tests.length) : 0
      const promSec =
        typeof p.promedio_previo_segundos === 'number' && p.promedio_previo_segundos > 0
          ? p.promedio_previo_segundos
          : promCalculado

      const resultadoSec =
        typeof p.tiempo_resultado_segundos === 'number' && p.tiempo_resultado_segundos > 0
          ? p.tiempo_resultado_segundos
          : null

      const diff = resultadoSec !== null && promSec > 0 ? resultadoSec - promSec : null

      return {
        id: p.id,
        usuarioId: p.usuario_id,
        dorsal: p.dorsal || null,
        posicion: null,
        nombres: nombreAtleta,
        partnerNombres: p.partner_nombres ? p.partner_nombres.trim() : null,
        cedula: cedulaAtleta,
        categoriaId: catId ? catId.trim() : null,
        categoriaNombre: categoriaNombre,
        categoriaTipo: categoriaTipo,
        heatAsignado: p.heat_asignado ? p.heat_asignado.trim() : 'Sin Asignar',
        salidaAsignada: p.salida_asignada ? p.salida_asignada.trim() : null,
        promedioSegundos: promSec,
        promedioMMSS: formatSegundosAMM_SS(promSec),
        tiempoResultadoSegundos: resultadoSec,
        tiempoResultadoMMSS: resultadoSec ? formatSegundosAMM_SS(resultadoSec) : null,
        diferenciaSegundos: diff,
        diferenciaTexto: formatDiferencia(diff),
      }
    })
  }

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
            <span className="px-2.5 py-0.5 rounded-lg bg-[#02D7E5]/10 border border-[#02D7E5]/30 text-[#02D7E5] font-bold text-[10px] uppercase tracking-widest">
              Leaderboard Oficial
            </span>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Leaderboard Oficial de Competición
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Clasificaciones segmentadas por categoría y tablas generales (Overalls) con publicación de resultados a usuarios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-[#02D7E5]" />
            <span>Clasificación Oficial</span>
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
              Debes registrar una simulación y anotar tiempos en el módulo de Competición para generar el Leaderboard.
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
        <LeaderboardOficialClient
          simulacion={{
            id: simulacionReciente.id,
            nombre: simulacionReciente.nombre,
            estado: simulacionReciente.estado,
            tabla_liberada: Boolean(simulacionReciente.tabla_liberada),
          }}
          categorias={categorias}
          items={rawItems}
        />
      )}
    </div>
  )
}
