'use server'

import { createClient } from '@supabase/supabase-js'

export async function getFinanzasData(sedeId: string) {
  if (!sedeId) return { usuarios: [], ordenes: [], ordenesPorConciliar: [] }
  // Usamos el Service Role para bypassear RLS y obtener la data en el panel administrativo
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Obtener usuarios con sus suscripciones y planes
  const { data: usersData, error: usersErr } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, cedula_rif, telefono, suscripciones(estado, planes(sedes))')
    .order('nombre_completo')

  if (usersErr) {
    console.error('[Admin Finanzas] Error fetching usuarios:', usersErr)
  }

  // Mostrar usuarios filtrando por las sedes de su plan activo
  const usuariosList = (usersData || []).filter(u => {
    if (!u.suscripciones || u.suscripciones.length === 0) return false;
    return u.suscripciones.some((sub: any) => {
      const sedes = sub.planes?.sedes;
      if (!sedes || sedes.length === 0) return true; // Asumimos globalidad si está vacío o null
      return sedes.includes(sedeId);
    });
  });

  // 2. Obtener la bitácora evaluando sedes del plan
  const { data: rawOrdersData, error: ordersErr } = await supabase
    .from('ordenes_cobro')
    .select('id, monto, moneda, estado, metadata, created_at, r4_transaction_id, r4_bank_reference, usuarios(nombre_completo), suscripciones(planes(sedes))')
    .order('created_at', { ascending: false })
    .limit(100) // Traemos un pool mayor para filtrar localmente

  if (ordersErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_cobro:', ordersErr)
  }

  const ordersData = (rawOrdersData || []).filter((ord: any) => {
    const sedes = ord.suscripciones?.planes?.sedes;
    if (!sedes || sedes.length === 0) return true;
    return sedes.includes(sedeId);
  }).slice(0, 20);

  if (ordersErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_cobro:', ordersErr)
  }

  // 3. Obtener pagos pendientes por conciliar
  const { data: rawConciliarData, error: conciliarErr } = await supabase
    .from('ordenes_cobro')
    .select('id, monto, moneda, estado, metadata, created_at, usuarios(nombre_completo, telefono), suscripciones(planes(sedes))')
    .eq('estado', 'POR_CONCILIAR')
    .order('created_at', { ascending: false })

  if (conciliarErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_por_conciliar:', conciliarErr)
  }

  const ordenesPorConciliar = (rawConciliarData || []).filter((ord: any) => {
    const sedes = ord.suscripciones?.planes?.sedes;
    if (!sedes || sedes.length === 0) return true;
    return sedes.includes(sedeId);
  });

  return {
    usuarios: usuariosList,
    ordenes: ordersData || [],
    ordenesPorConciliar
  }
}
