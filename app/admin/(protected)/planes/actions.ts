'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCaracasMidnightUTC } from '@/src/utils/timezone'
import { emitirCobroR4 } from '@/src/services/r4-service'

export async function obtenerPlanesDisponibles(sedeId: string | null) {
  const supabase = await createClient()

  // Extraer todos los planes sin filtros (excepto los de precio 0 que son internos)
  const { data: planes, error } = await supabase
    .from('planes')
    .select('*')
    .gt('precio_usd', 0)

  console.log("=== DEBUG PLANES ===")
  console.log("Sede ID buscada:", sedeId)
  console.log("Error de BD:", error)
  console.log("Data cruda:", planes)
  console.log("====================")

  if (error) {
    console.error('Error fetching planes:', error)
    return { success: false, data: [] }
  }

  const planesDisponibles = (planes || []).filter((plan: any) => {
    const estaActivo = plan.estado === 'ACTIVO'
    const perteneceASede = plan.sedes && Array.isArray(plan.sedes) && plan.sedes.includes(sedeId)
    return estaActivo && perteneceASede
  })

  return { success: true, data: planesDisponibles }
}

export async function crearSuscripcionYOrden(payload: {
  usuario_id: string,
  plan_id: string,
  monto: number,
  metodo_pago: string,
  referencia: string,
  pagos_desglosados: any[],
  responsable_id: string,
  responsable_nombre: string
}) {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Calcular Fecha de Corte (1 mes a partir de hoy)
    const hoy = getCaracasMidnightUTC(0)
    const nuevaFechaCorte = new Date(hoy)
    nuevaFechaCorte.setUTCMonth(nuevaFechaCorte.getUTCMonth() + 1)

    const isCobroMovil = payload.metodo_pago === 'COBRO_MOVIL'
    
    // ==========================================
    // RESOLUCIÓN DE CONFLICTOS (RACE CONDITION)
    // ==========================================
    if (!isCobroMovil) {
      // Si es un pago manual/presencial, buscamos si el usuario dejó un cobro móvil flotando
      const { data: ordenesPendientes } = await supabaseAdmin
        .from('ordenes_cobro')
        .select('id, metadata')
        .eq('usuario_id', payload.usuario_id)
        .eq('estado', 'PENDIENTE')
        
      if (ordenesPendientes && ordenesPendientes.length > 0) {
        for (const orden of ordenesPendientes) {
          const nuevaMetadata = {
            ...(orden.metadata || {}),
            anulacion_motivo: 'Anulada automáticamente por pago presencial posterior',
            anulacion_fecha: new Date().toISOString()
          }
          await supabaseAdmin
            .from('ordenes_cobro')
            .update({ 
              estado: 'CANCELADO',
              metadata: nuevaMetadata
            })
            .eq('id', orden.id)
            
          console.log(`[Resolución Conflictos] Orden pendiente ${orden.id} anulada por nuevo pago presencial.`)
        }
      }
    }

    const estadoSuscripcion = isCobroMovil ? 'INACTIVO' : 'ACTIVO'

    // 2. Insertar Suscripción
    const { data: nuevaSuscripcion, error: subError } = await supabaseAdmin
      .from('suscripciones')
      .insert({
        usuario_id: payload.usuario_id,
        plan_id: payload.plan_id,
        estado: estadoSuscripcion,
        fecha_corte: nuevaFechaCorte.toISOString(),
      })
      .select('id')
      .single()

    if (subError) throw new Error('Error al crear la suscripción: ' + subError.message)

    // 3. Insertar Orden de Cobro
    const estadoOrden = isCobroMovil ? 'PENDIENTE' : 'POR_CONCILIAR'
    
    const metadata = {
      origin: 'asignacion-plan-manual',
      timestamp: new Date().toISOString(),
      responsable_id: payload.responsable_id,
      responsable_nombre: payload.responsable_nombre,
      metodo_pago: payload.metodo_pago,
      referencia: payload.referencia || undefined,
      pagos_desglosados: payload.pagos_desglosados || undefined,
      provider: isCobroMovil ? 'R4' : 'MANUAL',
      plan_id: payload.plan_id
    }

    const { data: nuevaOrden, error: ordError } = await supabaseAdmin
      .from('ordenes_cobro')
      .insert({
        suscripcion_id: nuevaSuscripcion.id,
        usuario_id: payload.usuario_id,
        monto: payload.monto,
        moneda: 'USD',
        estado: estadoOrden,
        metadata
      })
      .select('id')
      .single()

    if (ordError) {
      // Rollback de la suscripción
      await supabaseAdmin.from('suscripciones').delete().eq('id', nuevaSuscripcion.id)
      throw new Error('Error al registrar la orden de cobro: ' + ordError.message)
    }

    if (isCobroMovil) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('telefono, nombre_completo, cedula_rif')
        .eq('id', payload.usuario_id)
        .single()
        
      if (!usuario) {
        throw new Error('Usuario no encontrado para procesar cobro móvil')
      }

      try {
        const r4Result = await emitirCobroR4({
          monto: payload.monto,
          nombre: usuario.nombre_completo,
          cedula: usuario.cedula_rif,
          telefono: usuario.telefono,
          order_id: nuevaOrden.id
        })

        if (!r4Result.success) {
          throw new Error('Error en respuesta de R4: ' + (r4Result.error || 'Desconocido'))
        }
      } catch (err: any) {
        console.error('[crearSuscripcionYOrden] Fallo al emitir cobro R4:', err)
        // Rollback: Marcar orden como ERROR (y borrar suscripcion inactiva si queremos, o dejarla)
        await supabaseAdmin.from('ordenes_cobro').update({ estado: 'ERROR' }).eq('id', nuevaOrden.id)
        return { success: false, error: "Error al comunicar con el banco." }
      }

      return { success: true, type: 'API_PENDING', ordenId: nuevaOrden.id }
    }

    return { success: true, type: 'MANUAL', ordenId: nuevaOrden.id, suscripcionId: nuevaSuscripcion.id }
  } catch (error: any) {
    console.error('[crearSuscripcionYOrden] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function obtenerSedesParaSelect() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.from('sedes').select('id, nombre').order('nombre')
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] }
  }
}

export async function upsertPlan(payload: {
  id?: string
  nombre: string
  descripcion?: string
  precio_usd: number
  estado: string
  sedes: string[]
  tipo: 'TIEMPO' | 'SESIONES'
  sesiones_total: number | null
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
          sedes: payload.sedes,
          tipo: payload.tipo,
          sesiones_total: payload.sesiones_total,
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
          sedes: payload.sedes,
          tipo: payload.tipo,
          sesiones_total: payload.sesiones_total
        })
      if (error) throw error
    }
    return { success: true }
  } catch (err: any) {
    console.error('Error upsertPlan:', err)
    return { success: false, error: err.message }
  }
}

