'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Convierte un texto en formato MM:SS a número total de segundos.
 * Ejemplo: "42:15" -> 2535
 */
function parseMMSSASegundos(texto: string): number | null {
  const limpio = texto.trim()
  if (!limpio) return null

  if (limpio.includes(':')) {
    const partes = limpio.split(':')
    if (partes.length === 2) {
      const m = parseInt(partes[0], 10)
      const s = parseInt(partes[1], 10)
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
        return m * 60 + s
      }
    }
  } else {
    const num = parseInt(limpio, 10)
    if (!isNaN(num) && num > 0) return num
  }
  return null
}

function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Arrancar la simulación:
 * Condición estricta: Solo permitido si heats_liberados === true.
 */
export async function arrancarSimulacion(simulacionId: string) {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Validar que la simulación exista y tenga heats_liberados === true
    const { data: sim, error: errFetch } = await supabaseAdmin
      .from('simulaciones')
      .select('id, heats_liberados, estado')
      .eq('id', simulacionId)
      .single()

    if (errFetch || !sim) {
      return { success: false, error: 'Simulación no encontrada.' }
    }

    if (!sim.heats_liberados) {
      return {
        success: false,
        error: 'No se puede arrancar la competición. Debes liberar los heats a los atletas primero.'
      }
    }

    // 2. Cambiar estado a EN_CURSO
    const { error: errUpdate } = await supabaseAdmin
      .from('simulaciones')
      .update({ estado: 'EN_CURSO' })
      .eq('id', simulacionId)

    if (errUpdate) throw errUpdate

    revalidatePath('/admin/carrera')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/heats')
    revalidatePath('/admin/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return { success: true }
  } catch (err: any) {
    console.error('[arrancarSimulacion] Excepción:', err)
    return { success: false, error: err.message || 'Error al iniciar la carrera.' }
  }
}

/**
 * Finalizar la simulación
 */
export async function finalizarSimulacion(simulacionId: string) {
  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('simulaciones')
      .update({ estado: 'FINALIZADA' })
      .eq('id', simulacionId)

    if (error) throw error

    revalidatePath('/admin/carrera')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/heats')
    revalidatePath('/admin/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return { success: true }
  } catch (err: any) {
    console.error('[finalizarSimulacion] Excepción:', err)
    return { success: false, error: err.message || 'Error al finalizar la carrera.' }
  }
}

/**
 * Guardar tiempo oficial de competición para un atleta (Registro ultra-rápido en vivo)
 */
export async function guardarTiempoResultado(
  simulacionId: string,
  usuarioId: string,
  tiempoTexto: string
) {
  try {
    const segundos = parseMMSSASegundos(tiempoTexto)
    if (segundos === null || segundos <= 0) {
      return {
        success: false,
        error: 'Ingresa un tiempo válido en formato MM:SS (ej. 42:30).'
      }
    }

    const supabaseAdmin = getAdminClient()

    // Verificar si ya existe en participantes_simulacion
    const { data: existente } = await supabaseAdmin
      .from('participantes_simulacion')
      .select('id')
      .eq('simulacion_id', simulacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (existente?.id) {
      const { error } = await supabaseAdmin
        .from('participantes_simulacion')
        .update({
          tiempo_resultado_segundos: segundos,
          asistio: true
        })
        .eq('id', existente.id)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('participantes_simulacion')
        .insert({
          simulacion_id: simulacionId,
          usuario_id: usuarioId,
          tiempo_resultado_segundos: segundos,
          asistio: true
        })

      if (error) throw error
    }

    revalidatePath('/admin/carrera')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')

    return {
      success: true,
      segundos,
      formateado: formatSegundosAMM_SS(segundos)
    }
  } catch (err: any) {
    console.error('[guardarTiempoResultado] Excepción:', err)
    return { success: false, error: err.message || 'Error al guardar el tiempo.' }
  }
}
