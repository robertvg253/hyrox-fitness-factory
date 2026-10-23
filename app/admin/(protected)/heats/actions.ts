'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Auto-asignar Heats a todos los atletas de una simulación:
 * 1. Agrupa a los atletas participantes por su categoria_id.
 * 2. Ordena a los atletas por su tiempo promedio histórico dentro de su categoría (los más rápidos primero).
 * 3. Divide cada categoría en subgrupos (chunks) de máximo 10 atletas.
 * 4. Genera y asigna nombres de Heat dinámicos y secuenciales que incluyen la categoría
 *    (ej: "Heat 1 - Individual Femenino", "Heat 2 - Individual Femenino", "Heat 3 - Duplas Masculino").
 * 5. Persiste en public.participantes_simulacion.
 */
export async function autoAsignarHeats(simulacionId: string) {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Obtener todas las categorías
    const { data: categorias, error: errCategorias } = await supabaseAdmin
      .from('categorias')
      .select('id, nombre, tipo')
      .order('nombre', { ascending: true })

    if (errCategorias) throw errCategorias
    if (!categorias || categorias.length === 0) {
      return { success: false, error: 'No hay categorías configuradas en el sistema.' }
    }
    const defaultCatId = categorias[0].id
    const catMap = new Map(categorias.map((c) => [c.id, c]))

    // 2. Obtener participantes existentes en participantes_simulacion
    const { data: participantesExistentes } = await supabaseAdmin
      .from('participantes_simulacion')
      .select('id, usuario_id, categoria_id, heat_asignado')
      .eq('simulacion_id', simulacionId)

    const partMap = new Map<string, { id: string; categoria_id: string | null }>()
    participantesExistentes?.forEach((p) => {
      if (p.usuario_id) {
        partMap.set(p.usuario_id, { id: p.id, categoria_id: p.categoria_id })
      }
    })

    // 3. Obtener todos los atletas registrados en public.usuarios
    const { data: usuariosAtletas, error: errAtletas } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombres, cedula, email')
      .ilike('rol', 'atleta')

    if (errAtletas) throw errAtletas
    const atletasUsuarios = usuariosAtletas || []

    if (atletasUsuarios.length === 0 && (!participantesExistentes || participantesExistentes.length === 0)) {
      return { success: false, error: 'No hay atletas participantes en el sistema.' }
    }

    // 4. Preinscripciones para resolver categoria_id por email en caso de que esté nula
    const { data: preinscripciones } = await supabaseAdmin
      .from('preinscripciones')
      .select('email, categoria_id, partner_email')

    const emailToCat = new Map<string, string>()
    preinscripciones?.forEach((pre) => {
      if (pre.email && pre.categoria_id) {
        emailToCat.set(pre.email.toLowerCase().trim(), pre.categoria_id)
      }
      if (pre.partner_email && pre.categoria_id) {
        emailToCat.set(pre.partner_email.toLowerCase().trim(), pre.categoria_id)
      }
    })

    // 5. Obtener todos los tiempos históricos para calcular promedios
    const { data: todosTiempos, error: errTiempos } = await supabaseAdmin
      .from('tiempos_historicos')
      .select('usuario_id, tiempo_segundos')

    if (errTiempos) throw errTiempos

    const tiemposMap = new Map<string, number[]>()
    todosTiempos?.forEach((t) => {
      if (t.usuario_id && typeof t.tiempo_segundos === 'number' && t.tiempo_segundos > 0) {
        const list = tiemposMap.get(t.usuario_id) || []
        list.push(t.tiempo_segundos)
        tiemposMap.set(t.usuario_id, list)
      }
    })

    // 6. Mapear cada participante con su tiempo promedio y su categoría
    interface ParticipanteProcesado {
      id?: string
      usuarioId: string
      nombres: string
      cedula?: string
      categoriaId: string
      categoriaNombre: string
      promedioSegundos: number
    }

    // Agrupar a los atletas participantes por su categoria_id
    const gruposPorCategoria = new Map<string, ParticipanteProcesado[]>()
    categorias.forEach((c) => gruposPorCategoria.set(c.id, []))

    // Combinar atletas de usuarios y participantes
    const processedUserIds = new Set<string>()

    for (const u of atletasUsuarios) {
      processedUserIds.add(u.id)
      const part = partMap.get(u.id)
      const tests = tiemposMap.get(u.id) || []
      const suma = tests.reduce((acc, v) => acc + v, 0)
      const promSec = tests.length > 0 ? Math.round(suma / tests.length) : 0

      let catId: string = defaultCatId
      if (part?.categoria_id && catMap.has(part.categoria_id)) {
        catId = part.categoria_id
      } else if (u.email) {
        const found = emailToCat.get(u.email.toLowerCase().trim())
        if (found && catMap.has(found)) {
          catId = found
        }
      }
      const cat = catMap.get(catId) || categorias[0]

      const item: ParticipanteProcesado = {
        id: part?.id,
        usuarioId: u.id,
        nombres: u.nombres || 'Atleta Sin Nombre',
        cedula: u.cedula || undefined,
        categoriaId: catId,
        categoriaNombre: cat.nombre,
        promedioSegundos: promSec,
      }

      const lista = gruposPorCategoria.get(catId) || []
      lista.push(item)
      gruposPorCategoria.set(catId, lista)
    }

    // 7. Ordenar por tiempo promedio dentro de su categoría (los más rápidos primero: menor promedio)
    // y dividir en subgrupos (chunks) de máximo 10 atletas.
    // Generar y asignar nombres de Heat dinámicos y secuenciales que incluyan la categoría.
    let heatCounter = 1
    const CHUNK_SIZE = 10
    const upserts: Array<{
      id?: string
      simulacion_id: string
      usuario_id: string
      categoria_id: string
      heat_asignado: string
      promedio_previo_segundos: number | null
      asistio: boolean
    }> = []

    for (const cat of categorias) {
      const atletasDeCat = gruposPorCategoria.get(cat.id) || []
      if (atletasDeCat.length === 0) continue

      // Ordenar: más rápidos primero (menor promedioSegundos > 0).
      // Atletas sin tiempo (0) van al final de la categoría.
      atletasDeCat.sort((a, b) => {
        if (!a.promedioSegundos && b.promedioSegundos) return 1
        if (a.promedioSegundos && !b.promedioSegundos) return -1
        if (a.promedioSegundos !== b.promedioSegundos) {
          return a.promedioSegundos - b.promedioSegundos
        }
        return a.nombres.localeCompare(b.nombres)
      })

      // Dividir en chunks de máximo 10
      for (let i = 0; i < atletasDeCat.length; i += CHUNK_SIZE) {
        const chunk = atletasDeCat.slice(i, i + CHUNK_SIZE)
        const heatNombre = `Heat ${heatCounter} - ${toTitleCase(cat.nombre)}`
        heatCounter++

        for (const atleta of chunk) {
          upserts.push({
            id: atleta.id,
            simulacion_id: simulacionId,
            usuario_id: atleta.usuarioId,
            categoria_id: atleta.categoriaId,
            heat_asignado: heatNombre,
            promedio_previo_segundos: atleta.promedioSegundos || null,
            asistio: true,
          })
        }
      }
    }

    // 8. Persistir en la base de datos (public.participantes_simulacion)
    for (const item of upserts) {
      if (item.id) {
        await supabaseAdmin
          .from('participantes_simulacion')
          .update({
            heat_asignado: item.heat_asignado,
            promedio_previo_segundos: item.promedio_previo_segundos,
            categoria_id: item.categoria_id,
          })
          .eq('id', item.id)
      } else {
        const { data: existente } = await supabaseAdmin
          .from('participantes_simulacion')
          .select('id')
          .eq('simulacion_id', item.simulacion_id)
          .eq('usuario_id', item.usuario_id)
          .maybeSingle()

        if (existente?.id) {
          await supabaseAdmin
            .from('participantes_simulacion')
            .update({
              heat_asignado: item.heat_asignado,
              promedio_previo_segundos: item.promedio_previo_segundos,
              categoria_id: item.categoria_id,
            })
            .eq('id', existente.id)
        } else {
          await supabaseAdmin.from('participantes_simulacion').insert({
            simulacion_id: item.simulacion_id,
            usuario_id: item.usuario_id,
            categoria_id: item.categoria_id,
            heat_asignado: item.heat_asignado,
            promedio_previo_segundos: item.promedio_previo_segundos,
            asistio: true,
          })
        }
      }
    }

    revalidatePath('/admin/heats')
    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return {
      success: true,
      totalAsignados: upserts.length,
      totalHeats: heatCounter - 1,
    }
  } catch (err: any) {
    console.error('[autoAsignarHeats] Excepción:', err)
    return { success: false, error: err.message || 'Error al auto-asignar heats.' }
  }
}

/**
 * Publicar / Ocultar heats a los atletas (Estado Draft / Liberado)
 */
export async function liberarHeats(simulacionId: string, liberar: boolean = true) {
  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('simulaciones')
      .update({ heats_liberados: liberar })
      .eq('id', simulacionId)

    if (error) throw error

    revalidatePath('/admin/heats')
    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return {
      success: true,
      heats_liberados: liberar,
    }
  } catch (err: any) {
    console.error('[liberarHeats] Excepción:', err)
    return { success: false, error: err.message || 'Error al actualizar visibilidad de heats.' }
  }
}

/**
 * Actualizar heat individual (Drag & Drop en tablero Kanban)
 */
export async function actualizarHeatAtleta(
  simulacionId: string,
  usuarioId: string,
  nuevoHeat: string | null
) {
  try {
    const supabaseAdmin = getAdminClient()

    const { data: existente } = await supabaseAdmin
      .from('participantes_simulacion')
      .select('id')
      .eq('simulacion_id', simulacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (existente?.id) {
      const { error } = await supabaseAdmin
        .from('participantes_simulacion')
        .update({ heat_asignado: nuevoHeat })
        .eq('id', existente.id)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('participantes_simulacion')
        .insert({
          simulacion_id: simulacionId,
          usuario_id: usuarioId,
          heat_asignado: nuevoHeat,
          asistio: true,
        })

      if (error) throw error
    }

    revalidatePath('/admin/heats')
    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return { success: true }
  } catch (err: any) {
    console.error('[actualizarHeatAtleta] Excepción:', err)
    return { success: false, error: err.message || 'Error al actualizar heat.' }
  }
}
