'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/src/utils/supabase/server'

export async function getDashboardFinanzasData(sedeId: string, timeframe: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const supabaseAuth = await createServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: userProfile } = await supabaseAdmin
    .from('usuarios')
    .select('rol, sedes_id')
    .eq('id', user.id)
    .single()

  const rol = userProfile?.rol
  const isGlobalAdmin = rol === 'SUPERADMIN' || rol === 'GERENTE'
  const targetSede = isGlobalAdmin ? sedeId : userProfile?.sedes_id

  let dateFilter = new Date()
  if (timeframe === 'HOY') {
    dateFilter.setHours(0, 0, 0, 0)
  } else if (timeframe === '3_DIAS') {
    dateFilter.setDate(dateFilter.getDate() - 3)
  } else if (timeframe === 'SEMANA') {
    dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    dateFilter.setHours(0, 0, 0, 0)
  } else if (timeframe === 'MES') {
    dateFilter.setDate(1)
    dateFilter.setHours(0, 0, 0, 0)
  } else if (timeframe === 'TRIMESTRE') {
    dateFilter.setMonth(dateFilter.getMonth() - 3)
  }

  // Límite estricto de seguridad: 3 meses máximo
  const maxLimit = new Date()
  maxLimit.setMonth(maxLimit.getMonth() - 3)
  if (dateFilter < maxLimit) {
    dateFilter = maxLimit
  }

  // Get all orders from the timeframe
  const { data: rawOrders, error } = await supabaseAdmin
    .from('ordenes_cobro')
    .select('id, monto, estado, metadata, created_at, suscripciones(planes(sedes))')
    .gte('created_at', dateFilter.toISOString())
    .in('estado', ['APROBADO', 'APROBADO AUTOMATICO', 'POR_CONCILIAR', 'PENDIENTE'])

  if (error) {
    console.error('[Dashboard Finanzas] Error fetching data:', error)
    return { error: error.message }
  }

  // Filter by sede (using RBAC enforced targetSede)
  const orders = (rawOrders || []).filter((ord: any) => {
    const sedes = ord.suscripciones?.planes?.sedes
    if (!sedes || sedes.length === 0) return true
    if (!targetSede) return true // if global admin and no sede selected
    return sedes.includes(targetSede)
  })

  // Calculate KPIs
  let conciliados = 0
  let conciliadosMonto = 0
  let porConciliar = 0

  const desgloseMetodos: Record<string, number> = {}

  orders.forEach((ord: any) => {
    if (ord.estado === 'POR_CONCILIAR' || ord.estado === 'PENDIENTE') {
      porConciliar++
      return
    }

    // APROBADO / APROBADO AUTOMATICO
    conciliados++
    conciliadosMonto += ord.monto

    // Method breakdown
    const meta = ord.metadata || {}
    let metodo = meta.metodo_pago || meta.provider || 'DESCONOCIDO'
    
    // Retrocompatibilidad
    if (meta.provider === 'R4' || meta.provider === 'MIXTO_R4' || meta.provider === 'PAGO_MOVIL' || meta.metodo_pago === 'COBRO_MOVIL') {
      metodo = 'Cobro Móvil'
    } else if (metodo === 'MIXTO') {
      metodo = 'Mixto'
    } else if (metodo === 'ZELLE' || meta.provider === 'ZELLE') {
      metodo = 'Zelle'
    } else if (metodo === 'POS' || metodo === 'PUNTO_VENTA') {
      metodo = 'Punto de Venta'
    } else if (metodo === 'EFECTIVO') {
      metodo = 'Efectivo'
    }

    desgloseMetodos[metodo] = (desgloseMetodos[metodo] || 0) + ord.monto
  })

  return {
    kpis: {
      conciliados,
      conciliadosMonto,
      porConciliar
    },
    desgloseMetodos
  }
}
