'use server'

import { createClient } from '@supabase/supabase-js'

export async function getMasterKPIs() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 0. Obtener Contexto del Usuario
  const { createClient: createServerClient } = await import('@/src/utils/supabase/server')
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  const { data: adminProfile } = await supabase.from('usuarios').select('rol, sede_id').eq('id', user?.id).single()
  const userRol = adminProfile?.rol || 'ADMIN'
  const userSedeId = adminProfile?.sede_id || null

  // 1. Variación Intermensual
  const today = new Date()
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)

  // Ventas Mes Actual
  const { data: currentMonthOrders } = await supabase
    .from('ordenes_cobro')
    .select('monto, estado, suscripciones(planes(sedes)), usuarios(metadata)')
    .gte('created_at', startOfCurrentMonth.toISOString())

  const approvedCurrentOrders = (currentMonthOrders || []).filter(o => o.estado === 'APROBADO' || o.estado === 'APROBADO AUTOMATICO')
  const annulledCurrentOrders = (currentMonthOrders || []).filter(o => o.estado === 'ANULADO')

  // Ventas Mes Anterior
  const { data: lastMonthOrders } = await supabase
    .from('ordenes_cobro')
    .select('monto')
    .gte('created_at', startOfLastMonth.toISOString())
    .lte('created_at', endOfLastMonth.toISOString())
    .in('estado', ['APROBADO', 'APROBADO AUTOMATICO'])

  const currentMonthTotal = approvedCurrentOrders.reduce((acc: number, curr: any) => acc + curr.monto, 0)
  const lastMonthTotal = (lastMonthOrders || []).reduce((acc: number, curr: any) => acc + curr.monto, 0)
  
  let variation = 0
  if (lastMonthTotal > 0) {
    variation = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
  } else if (currentMonthTotal > 0) {
    variation = 100
  }

  // 2. Participación por Sede
  const salesBySede: Record<string, number> = {}
  let totalSales = 0
  
  // Obtener nombres de sedes
  const { data: sedesData } = await supabase.from('sedes').select('id, nombre')
  const sedeNames = (sedesData || []).reduce((acc: any, sede: any) => {
    acc[sede.id] = sede.nombre
    return acc
  }, {})

  approvedCurrentOrders.forEach((ord: any) => {
    const sedesIds = ord.suscripciones?.planes?.sedes || []
    const sedeId = sedesIds[0]
    if (sedeId) {
      salesBySede[sedeId] = (salesBySede[sedeId] || 0) + ord.monto
      totalSales += ord.monto
    }
  })

  const participation = Object.entries(salesBySede).map(([sedeId, monto]) => ({
    id: sedeId,
    name: sedeNames[sedeId] || 'Desconocida',
    monto,
    percentage: totalSales > 0 ? (monto / totalSales) * 100 : 0
  })).sort((a, b) => b.monto - a.monto)

  // 3. Tasa de Retención
  // Contamos usuarios únicos que tengan al menos 1 suscripción en estado 'ACTIVO'
  const { data: activeUsers } = await supabase
    .from('usuarios')
    .select('id, suscripciones!inner(estado)')
    .eq('suscripciones.estado', 'ACTIVO');

  const activeUnique = new Set((activeUsers || []).map((u: any) => u.id)).size;
    
  // Total de clientes (excluimos prospectos y roles administrativos puros si aplican, o simplemente los que tengan etiqueta_lead = null)
  const { count: totalUsersCountRaw } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .is('etiqueta_lead', null); // Excluir leads

  const totalUsersCount = totalUsersCountRaw || 0;
  const retentionRate = totalUsersCount > 0 ? (activeUnique / totalUsersCount) * 100 : 0;

  // 4. KPI 8: Ingreso Neto Real
  const totalAnulado = annulledCurrentOrders.reduce((acc, curr) => acc + curr.monto, 0)
  const neto = currentMonthTotal - totalAnulado

  // 5. KPI 5: Embudo de Conversión (Clase de Prueba)
  let conversion = { leads: 0, converted: 0, rate: 0 }
  const { data: planesPrueba } = await supabase.from('planes').select('id').ilike('nombre', '%prueba%')
  const planesPruebaIds = (planesPrueba || []).map(p => p.id)
  
  if (planesPruebaIds.length > 0) {
    const { data: leads } = await supabase.from('suscripciones').select('usuario_id').in('plan_id', planesPruebaIds)
    const leadsIds = (leads || []).map(l => l.usuario_id)
    conversion.leads = leadsIds.length
    
    if (conversion.leads > 0) {
      // Filtrar a mano o con query
      const { data: converted } = await supabase.from('ordenes_cobro')
        .select('usuario_id')
        .in('usuario_id', leadsIds)
        .in('estado', ['APROBADO', 'APROBADO AUTOMATICO'])
      
      const uniqueConverted = new Set((converted || []).map(c => c.usuario_id)).size
      conversion.converted = uniqueConverted
      conversion.rate = (uniqueConverted / conversion.leads) * 100
    }
  }

  // 6. KPI 4: ROI Redes Sociales
  const ingresosRedes = approvedCurrentOrders.filter((ord: any) => {
    const meta = ord.usuarios?.metadata || {}
    const origen = (meta.origen || meta.origen_captacion || '').toLowerCase()
    return origen.includes('redes') || origen.includes('instagram') || origen.includes('meta') || origen.includes('facebook')
  }).reduce((acc, curr) => acc + curr.monto, 0)

  return {
    userCtx: { rol: userRol, sedeId: userSedeId },
    revenue: {
      current: currentMonthTotal,
      last: lastMonthTotal,
      variation
    },
    netRevenue: {
      bruto: currentMonthTotal,
      anulado: totalAnulado,
      neto
    },
    participation,
    retention: {
      active: activeUnique,
      total: totalUsersCount,
      rate: retentionRate
    },
    conversion,
    roi: {
      ingresosRedes
    }
  }
}
