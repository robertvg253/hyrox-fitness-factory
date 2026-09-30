import { createClient } from '@supabase/supabase-js'
import UsuariosClient from './UsuariosClient'
import { Users as UsersIcon } from 'lucide-react'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const cookieStore = await cookies()
  const activeSedeId = cookieStore.get('active_sede')?.value || null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Realizamos el fetch con un JOIN nativo de Supabase
  // Traemos usuarios, sus suscripciones y las órdenes de cobro para saber si hay pagos en tránsito.
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nombre_completo,
      telefono,
      etiqueta_lead,
      suscripciones (
        id,
        estado,
        fecha_corte,
        sesiones_restantes,
        planes (
          id,
          nombre,
          precio_usd,
          sedes
        ),
        ordenes_cobro (
          id,
          estado,
          created_at
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching usuarios:', error)
  }

  // Transformar los datos si es necesario (el tipado y los nulos se manejan en el cliente)
  const safeUsuarios = usuarios || []

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#02D7E5]/10 rounded-lg">
              <UsersIcon className="w-6 h-6 text-[#02D7E5]" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Directorio de Usuarios</h2>
          </div>
          <p className="text-zinc-400">
            Gestiona a los clientes, monitorea el estado de sus suscripciones y revisa cobros en tránsito.
          </p>
        </div>
      </div>

      <UsuariosClient initialUsuarios={safeUsuarios as any} activeSedeId={activeSedeId} />
    </div>
  )
}
