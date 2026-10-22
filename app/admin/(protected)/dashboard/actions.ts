'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Instancia admin para garantizar mutaciones sin bloqueo de políticas RLS restrictivas en el panel administrativo
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * 1. Crear Nueva Simulación
 */
export async function crearSimulacion(nombrePersonalizado?: string) {
  try {
    const supabaseAdmin = getAdminClient()

    // Si no se envía nombre, generar correlativo automático
    let nombreFinal = nombrePersonalizado?.trim()
    if (!nombreFinal) {
      const { count } = await supabaseAdmin
        .from('simulaciones')
        .select('*', { count: 'exact', head: true })
      
      const correlativo = (count ?? 0) + 1
      nombreFinal = `Simulación ${correlativo}`
    }

    const { data, error } = await supabaseAdmin
      .from('simulaciones')
      .insert({
        nombre: nombreFinal,
        estado: 'PENDIENTE',
        tabla_liberada: false
      })
      .select()
      .single()

    if (error) {
      console.error('[crearSimulacion] Error:', error)
      return { success: false, error: 'Error al crear la simulación: ' + error.message }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')
    return { success: true, data }
  } catch (err: any) {
    console.error('[crearSimulacion] Excepción:', err)
    return { success: false, error: err.message || 'Error inesperado al crear simulación.' }
  }
}

/**
 * 2. Cambiar Estado de la Simulación ('PENDIENTE' -> 'EN_CURSO' -> 'FINALIZADA')
 */
export async function cambiarEstadoSimulacion(
  simulacionId: string,
  nuevoEstado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA'
) {
  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('simulaciones')
      .update({ estado: nuevoEstado })
      .eq('id', simulacionId)

    if (error) {
      console.error('[cambiarEstadoSimulacion] Error:', error)
      return { success: false, error: 'Error al actualizar el estado: ' + error.message }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')
    return { success: true, estado: nuevoEstado }
  } catch (err: any) {
    console.error('[cambiarEstadoSimulacion] Excepción:', err)
    return { success: false, error: err.message || 'Error inesperado al cambiar estado.' }
  }
}

/**
 * 3. Toggle de Liberar / Ocultar Tabla de Posiciones
 */
export async function toggleTablaLiberada(simulacionId: string, liberar: boolean) {
  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('simulaciones')
      .update({ tabla_liberada: liberar })
      .eq('id', simulacionId)

    if (error) {
      console.error('[toggleTablaLiberada] Error:', error)
      return { success: false, error: 'Error al cambiar visibilidad de la tabla: ' + error.message }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')
    return { success: true, tabla_liberada: liberar }
  } catch (err: any) {
    console.error('[toggleTablaLiberada] Excepción:', err)
    return { success: false, error: err.message || 'Error inesperado al modificar visibilidad.' }
  }
}

/**
 * 4. Asignar Heat a un Atleta
 */
export async function asignarHeatAtleta(
  simulacionId: string,
  usuarioId: string,
  heat: string,
  promedioPrevioSegundos?: number
) {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Verificar si ya existe fila para este atleta en esta simulación
    const { data: existente } = await supabaseAdmin
      .from('participantes_simulacion')
      .select('id')
      .eq('simulacion_id', simulacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (existente?.id) {
      // Actualizar heat
      const { error: updErr } = await supabaseAdmin
        .from('participantes_simulacion')
        .update({
          heat_asignado: heat || null
        })
        .eq('id', existente.id)

      if (updErr) throw updErr
    } else {
      // Insertar nuevo registro de participante
      const { error: insErr } = await supabaseAdmin
        .from('participantes_simulacion')
        .insert({
          simulacion_id: simulacionId,
          usuario_id: usuarioId,
          heat_asignado: heat || null,
          promedio_previo_segundos: promedioPrevioSegundos || null,
          asistio: true
        })

      if (insErr) throw insErr
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')
    return { success: true, heat }
  } catch (err: any) {
    console.error('[asignarHeatAtleta] Excepción:', err)
    return { success: false, error: err.message || 'Error al asignar el heat.' }
  }
}

/**
 * 5. Guardar Tiempo de Resultado Final (MM:SS convertido a segundos)
 */
export async function guardarTiempoResultado(
  simulacionId: string,
  usuarioId: string,
  tiempoFormatoMMSS: string
) {
  try {
    const supabaseAdmin = getAdminClient()

    // Parsear MM:SS a segundos enteros
    const partes = tiempoFormatoMMSS.trim().split(':')
    if (partes.length !== 2) {
      return { success: false, error: 'Formato de tiempo inválido. Usa MM:SS.' }
    }

    const minutos = parseInt(partes[0], 10)
    const segundos = parseInt(partes[1], 10)

    if (isNaN(minutos) || isNaN(segundos) || minutos < 0 || segundos < 0 || segundos >= 60) {
      return { success: false, error: 'Tiempo inválido. Los segundos deben ser entre 00 y 59.' }
    }

    const totalSegundos = minutos * 60 + segundos
    if (totalSegundos <= 0) {
      return { success: false, error: 'El tiempo total debe ser mayor a 0.' }
    }

    // Verificar si ya existe participante
    const { data: existente } = await supabaseAdmin
      .from('participantes_simulacion')
      .select('id')
      .eq('simulacion_id', simulacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (existente?.id) {
      const { error: updErr } = await supabaseAdmin
        .from('participantes_simulacion')
        .update({
          tiempo_resultado_segundos: totalSegundos,
          asistio: true
        })
        .eq('id', existente.id)

      if (updErr) throw updErr
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('participantes_simulacion')
        .insert({
          simulacion_id: simulacionId,
          usuario_id: usuarioId,
          tiempo_resultado_segundos: totalSegundos,
          asistio: true
        })

      if (insErr) throw insErr
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/competicion')
    return { success: true, segundos: totalSegundos }
  } catch (err: any) {
    console.error('[guardarTiempoResultado] Excepción:', err)
    return { success: false, error: err.message || 'Error al guardar el tiempo.' }
  }
}
