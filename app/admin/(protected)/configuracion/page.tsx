import { createClient } from '@/src/utils/supabase/server'
import ConfiguracionClient from './ConfiguracionClient'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = await createClient()

  // 1. Obtener lista de usuarios del staff (donde rol sea diferente a 'ATLETA')
  const { data: staffUsers, error: staffErr } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, cedula_rif, rol, sede_id, sedes(id, nombre)')
    .neq('rol', 'ATLETA')
    .order('created_at', { ascending: false })

  if (staffErr) {
    console.error('[ConfiguracionPage] Error cargando staff:', staffErr)
  }

  // 2. Obtener lista de sedes para el modal de asignación
  const { data: sedes, error: sedesErr } = await supabase
    .from('sedes')
    .select('id, nombre')
    .order('nombre', { ascending: true })

  if (sedesErr) {
    console.error('[ConfiguracionPage] Error cargando sedes:', sedesErr)
  }

  return (
    <ConfiguracionClient
      initialStaff={(staffUsers as any) || []}
      sedes={sedes || []}
    />
  )
}
