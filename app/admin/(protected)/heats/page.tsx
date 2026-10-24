import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TableroKanbanHeats, { AtletaKanban } from './TableroKanbanHeats'
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

export default async function HeatsPage() {
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

  // 3. Obtener todas las categorías del sistema
  const { data: categoriasData } = await supabase
    .from('categorias')
    .select('id, nombre, tipo')
    .order('nombre', { ascending: true })

  const categorias: Categoria[] = (categoriasData || []) as Categoria[]
  const catMap = new Map(categorias.map((c) => [c.id, c]))

  // 4. Obtener todos los atletas registrados en public.usuarios
  const { data: usuariosAtletas } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, rol, email')
    .ilike('rol', 'atleta')
    .order('creado_en', { ascending: false })

  const atletasList = usuariosAtletas || []

  // 5. Obtener tiempos históricos para calcular promedios
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

  // 6. Obtener participantes de la simulación activa para conocer su categoría, heat actual y dorsal
  const partMap = new Map<string, { id: string; heat_asignado: string | null; categoria_id: string | null; dorsal: string | null }>()
  if (simulacionReciente?.id) {
    const { data: participantes } = await supabase
      .from('participantes_simulacion')
      .select('id, usuario_id, heat_asignado, categoria_id, dorsal')
      .eq('simulacion_id', simulacionReciente.id)

    participantes?.forEach((p) => {
      if (p.usuario_id) {
        partMap.set(p.usuario_id, {
          id: p.id,
          heat_asignado: p.heat_asignado,
          categoria_id: p.categoria_id,
          dorsal: p.dorsal || null,
        })
      }
    })
  }

  // 7. Mapear a formato AtletaKanban
  const atletasKanban: AtletaKanban[] = atletasList.map((atleta) => {
    const tests = tiemposMap.get(atleta.id) || []
    const suma = tests.reduce((acc, v) => acc + v, 0)
    const promSec = tests.length > 0 ? Math.round(suma / tests.length) : 0
    const part = partMap.get(atleta.id)

    const catId = part?.categoria_id || null
    const cat = catId ? catMap.get(catId) : null

    return {
      id: part?.id || atleta.id,
      usuarioId: atleta.id,
      dorsal: part?.dorsal || null,
      nombres: atleta.nombres || 'Atleta Sin Nombre',
      cedula: atleta.cedula || undefined,
      categoriaId: catId,
      categoriaNombre: cat?.nombre || null,
      categoriaTipo: cat?.tipo || null,
      promedioSegundos: promSec,
      promedioMMSS: formatSegundosAMM_SS(promSec),
      heatAsignado: part?.heat_asignado || null,
    }
  })

  // Ordenar atletas de MENOR a MAYOR promedio (más rápidos primero)
  atletasKanban.sort((a, b) => {
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
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] uppercase tracking-widest">
              Módulo de Competición
            </span>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Gestión y Asignación Dinámica de Heats
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Tablero interactivo Drag & Drop para organizar a los atletas en Heats dinámicos de máximo 10 participantes por categoría.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-[#02D7E5]" />
            <span>Modo Administrador</span>
          </div>
        </div>
      </header>

      {/* Alerta si no hay simulación activa */}
      {!simulacionReciente && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-bold text-white text-sm">No hay ninguna simulación registrada</p>
            <p className="text-zinc-400">
              Debes crear una simulación desde el Dashboard para poder asociar y persistir los heats asignados a los atletas.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                Ir a Crear Simulación
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tablero Kanban */}
      <TableroKanbanHeats
        simulacion={
          simulacionReciente
            ? {
                id: simulacionReciente.id,
                nombre: simulacionReciente.nombre,
                estado: simulacionReciente.estado,
                heats_liberados: Boolean(simulacionReciente.heats_liberados),
              }
            : null
        }
        categorias={categorias}
        atletas={atletasKanban}
      />
    </div>
  )
}
