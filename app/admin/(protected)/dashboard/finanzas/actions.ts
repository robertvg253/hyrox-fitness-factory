'use server'

import { createClient } from '@supabase/supabase-js'

export async function getFinanzasData(sedeId: string) {
  if (!sedeId) return { usuarios: [], ordenes: [] }
  // Usamos el Service Role para bypassear RLS y obtener la data en el panel administrativo
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Obtener usuarios con sus suscripciones
  const { data: usersData, error: usersErr } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, cedula_rif, telefono, suscripciones(estado)')
    .eq('sede_id', sedeId)
    .order('nombre_completo')

  if (usersErr) {
    console.error('[Admin Finanzas] Error fetching usuarios:', usersErr)
  }

  // Mostrar todos los usuarios para cobros manuales sin importar estado
  const usuariosList = usersData || []

  // 2. Obtener la bitácora sin filtros que excluyan
  const { data: ordersData, error: ordersErr } = await supabase
    .from('ordenes_cobro')
    .select('id, monto, moneda, estado, created_at, r4_transaction_id, usuarios!inner(nombre_completo, sede_id)')
    .eq('usuarios.sede_id', sedeId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (ordersErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_cobro:', ordersErr)
  }

  return {
    usuarios: usuariosList,
    ordenes: ordersData || []
  }
}
