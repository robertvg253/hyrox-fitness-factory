'use server'

import { createClient } from '@/src/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function obtenerTodosLosPlanes() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('planes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Cruzar arreglos de UUID de sedes con sus nombres
    const { data: todasLasSedes } = await supabase.from('sedes').select('id, nombre')
    
    const sedesMap = (todasLasSedes || []).reduce((acc: any, s: any) => {
      acc[s.id] = s.nombre
      return acc
    }, {})

    const planesMapeados = (data || []).map((plan: any) => ({
      ...plan,
      nombres_sedes: (plan.sedes || []).map((id: string) => sedesMap[id] || 'Sede Eliminada')
    }))

    return { success: true, data: planesMapeados }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function obtenerSedesParaSelect() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.from('sedes').select('id, nombre').order('nombre')
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function upsertPlan(payload: {
  id?: string
  nombre: string
  descripcion?: string
  precio_usd: number
  estado: string
  frecuencia: number
  sedes: string[]
}) {
  const supabase = await createClient()
  
  try {
    if (payload.id) {
      const { error } = await supabase
        .from('planes')
        .update({
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          precio_usd: payload.precio_usd,
          estado: payload.estado,
          frecuencia: payload.frecuencia,
          sedes: payload.sedes,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.id)
      
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('planes')
        .insert({
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          precio_usd: payload.precio_usd,
          estado: payload.estado,
          frecuencia: payload.frecuencia,
          sedes: payload.sedes
        })
      
      if (error) throw error
    }

    revalidatePath('/admin/catalogo/planes')
    return { success: true }
  } catch (err: any) {
    console.error('Error upsertPlan:', err)
    return { success: false, error: err.message }
  }
}

export async function cambiarEstadoPlan(id: string, nuevoEstado: string) {
  const supabase = await createClient()
  try {
    const { error } = await supabase
      .from('planes')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', id)
      
    if (error) throw error
    revalidatePath('/admin/catalogo/planes')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
