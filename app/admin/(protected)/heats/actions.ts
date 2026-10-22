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

/**
 * Auto-asignar Heats a todos los atletas de una simulación:
 * 1. Separa a los atletas en dos arreglos:
 *    - Incompletos (< 4 tests): Asignados directamente a 'Heat 1'.
 *    - Completos (4 tests exactos): Ordenados por tiempo promedio de MAYOR a MENOR (más lentos primero).
 * 2. Divide a los "Completos" en 6 chunks usando Math.ceil(completos.length / 6).
 *    - Chunk 1 -> 'Heat 1', Chunk 2 -> 'Heat 2', ..., Chunk 6 -> 'Heat 6'.
 * 3. Persiste en public.participantes_simulacion.
 */
export async function autoAsignarHeats(simulacionId: string) {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Obtener todos los atletas registrados en public.usuarios
    const { data: usuariosAtletas, error: errAtletas } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombres, cedula')
      .ilike('rol', 'atleta')

    if (errAtletas) throw errAtletas
    const atletas = usuariosAtletas || []
    if (atletas.length === 0) {
      return { success: false, error: 'No hay atletas registrados en el sistema.' }
    }

    // 2. Obtener todos los tiempos históricos
    const { data: todosTiempos, error: errTiempos } = await supabaseAdmin
      .from('tiempos_historicos')
      .select('usuario_id, numero_test, tiempo_segundos')

    if (errTiempos) throw errTiempos

    const tiemposMap = new Map<string, number[]>()
    todosTiempos?.forEach((t) => {
      if (t.usuario_id && typeof t.tiempo_segundos === 'number' && t.tiempo_segundos > 0) {
        const list = tiemposMap.get(t.usuario_id) || []
        list.push(t.tiempo_segundos)
        tiemposMap.set(t.usuario_id, list)
      }
    })

    // 3. Separar en dos arreglos: Incompletos (< 4 tests) y Completos (4 tests exactos)
    interface AtletaConTests {
      id: string
      nombres: string
      cedula?: string
      totalTests: number
      promedioSegundos: number
    }

    const incompletos: AtletaConTests[] = []
    const completos: AtletaConTests[] = []

    atletas.forEach((atleta) => {
      const tests = tiemposMap.get(atleta.id) || []
      const suma = tests.reduce((acc, v) => acc + v, 0)
      const promSec = tests.length > 0 ? Math.round(suma / tests.length) : 0

      const item: AtletaConTests = {
        id: atleta.id,
        nombres: atleta.nombres,
        cedula: atleta.cedula,
        totalTests: tests.length,
        promedioSegundos: promSec,
      }

      if (tests.length === 4) {
        completos.push(item)
      } else {
        incompletos.push(item)
      }
    })

    // Ordenar "Completos" de MENOR a MAYOR (los más rápidos primero -> Heat 1)
    completos.sort((a, b) => a.promedioSegundos - b.promedioSegundos)

    // 4. Armar los registros a persistir
    const rowsToUpsert: Array<{
      simulacion_id: string
      usuario_id: string
      heat_asignado: string
      promedio_previo_segundos: number | null
      asistio: boolean
    }> = []

    // Regla matemática para Completos (4 tests exactos):
    // Dividir en 6 chunks usando Math.ceil(completos.length / 6)
    // Chunk 1 (mejores tiempos) -> Heat 1 ... Chunk 6 (peores tiempos) -> Heat 6
    if (completos.length > 0) {
      const chunkSize = Math.max(1, Math.ceil(completos.length / 6))

      completos.forEach((atleta, index) => {
        // Chunk 0 -> Heat 1, Chunk 1 -> Heat 2, ..., Chunk 5 -> Heat 6
        const chunkIndex = Math.floor(index / chunkSize)
        const heatNumero = Math.min(6, chunkIndex + 1)

        rowsToUpsert.push({
          simulacion_id: simulacionId,
          usuario_id: atleta.id,
          heat_asignado: `Heat ${heatNumero}`,
          promedio_previo_segundos: atleta.promedioSegundos || null,
          asistio: true,
        })
      })
    }

    // Regla estricta para Incompletos (< 4 tests): Penalizados directamente al 'Heat 6' (el más lento)
    for (const atleta of incompletos) {
      rowsToUpsert.push({
        simulacion_id: simulacionId,
        usuario_id: atleta.id,
        heat_asignado: 'Heat 6',
        promedio_previo_segundos: atleta.promedioSegundos || null,
        asistio: true,
      })
    }

    // 5. Guardar en public.participantes_simulacion
    for (const row of rowsToUpsert) {
      const { data: existente } = await supabaseAdmin
        .from('participantes_simulacion')
        .select('id')
        .eq('simulacion_id', simulacionId)
        .eq('usuario_id', row.usuario_id)
        .maybeSingle()

      if (existente?.id) {
        await supabaseAdmin
          .from('participantes_simulacion')
          .update({
            heat_asignado: row.heat_asignado,
            promedio_previo_segundos: row.promedio_previo_segundos,
          })
          .eq('id', existente.id)
      } else {
        await supabaseAdmin
          .from('participantes_simulacion')
          .insert(row)
      }
    }

    revalidatePath('/admin/heats')
    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return {
      success: true,
      totalAsignados: rowsToUpsert.length,
      completosCount: completos.length,
      incompletosCount: incompletos.length,
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
