import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, AlertCircle, ArrowLeft } from 'lucide-react'
import LeaderboardPublicoClient, { AtletaPublicoItem } from './LeaderboardPublicoClient'
import { Categoria } from '@/src/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return 'DNF'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default async function LeaderboardPublicoPage({ params }: PageProps) {
  const resolvedParams = await params
  const { id } = resolvedParams

  if (!id) {
    redirect('/dashboard/competicion')
  }

  // 1. Validar autenticación de usuario
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Cliente administrativo para lectura íntegra de competidores (evita restricciones de RLS cruzado)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Obtener la simulación solicitada
  const { data: simulacion, error: simError } = await supabaseAdmin
    .from('simulaciones')
    .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
    .eq('id', id)
    .maybeSingle()

  if (simError || !simulacion) {
    return (
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <Link
          href="/dashboard/competicion"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Competición</span>
        </Link>
        <div className="p-6 rounded-3xl bg-zinc-950 border border-white/10 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Simulación no encontrada</h1>
          <p className="text-xs text-zinc-400">
            La jornada o simulación solicitada no existe o no se encuentra disponible.
          </p>
        </div>
      </div>
    )
  }

  // 4. Obtener categorías oficiales del sistema (id, nombre, tipo sin genero)
  const { data: categoriasData } = await supabaseAdmin
    .from('categorias')
    .select('id, nombre, tipo')
    .order('nombre', { ascending: true })

  const categorias: Categoria[] = (categoriasData || []) as Categoria[]
  const catMap = new Map(categorias.map((c) => [c.id, c]))

  // 5. Consultar los participantes de la simulación con JOIN relacional
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
    .eq('simulacion_id', simulacion.id)

  if (partError) {
    console.error('[LeaderboardPublicoPage] Error en consulta de participantes:', partError)
  }

  // Mapa de respaldo por si el JOIN a usuarios no resuelve nombres
  const userIds = (participantes || []).map((p) => p.usuario_id).filter(Boolean)
  const usuariosMap = new Map<string, { id: string; nombres: string; cedula?: string }>()
  if (userIds.length > 0) {
    const { data: directUsers } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombres, cedula')
      .in('id', userIds)
    directUsers?.forEach((u) => usuariosMap.set(u.id, u))
  }

  // 6. Normalización defensiva de items para el cliente móvil
  const items: AtletaPublicoItem[] = (participantes || []).map((p: any) => {
    const catRel = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias
    const usrRel = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios

    const catId = p.categoria_id || catRel?.id || null
    const catObj = catId ? catMap.get(catId) || catRel : catRel

    const usrFallback = p.usuario_id ? usuariosMap.get(p.usuario_id) : null
    const nombreAtleta = usrRel?.nombres || usrFallback?.nombres || 'Atleta Sin Nombre'

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

    const resultadoSec =
      typeof p.tiempo_resultado_segundos === 'number' && p.tiempo_resultado_segundos > 0
        ? p.tiempo_resultado_segundos
        : null

    return {
      id: p.id,
      usuarioId: p.usuario_id,
      dorsal: p.dorsal || null,
      nombres: nombreAtleta,
      partnerNombres: p.partner_nombres ? p.partner_nombres.trim() : null,
      categoriaId: catId ? catId.trim() : null,
      categoriaNombre: categoriaNombre || 'General',
      categoriaTipo: categoriaTipo,
      tiempoResultadoSegundos: resultadoSec,
      tiempoResultadoMMSS: formatSegundosAMM_SS(resultadoSec),
    }
  })

  return (
    <LeaderboardPublicoClient
      simulacion={{
        id: simulacion.id,
        nombre: simulacion.nombre,
        estado: simulacion.estado,
        tabla_liberada: Boolean(simulacion.tabla_liberada),
      }}
      categorias={categorias}
      items={items}
      currentUserId={user.id}
    />
  )
}
