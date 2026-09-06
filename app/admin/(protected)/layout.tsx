import Sidebar from './components/Sidebar'
import { TenantProvider } from './components/TenantProvider'
import { createClient } from '@/src/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const activeSedeId = cookieStore.get('active_sede')?.value

  // Fetch sedes en el servidor
  const { data: sedes } = await supabase
    .from('sedes')
    .select('id, nombre')
    .order('nombre', { ascending: true })

  const sedesList = sedes || []
  let initialActiveSede = null

  if (activeSedeId && sedesList.length > 0) {
    initialActiveSede = sedesList.find(s => s.id === activeSedeId) || null
  }

  return (
    <TenantProvider initialSedes={sedesList} initialActiveSede={initialActiveSede}>
      <div className="flex h-screen w-full overflow-hidden font-sans relative text-white">
        {/* Fondo Fotográfico Fijo */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/images/admin-bg.png")' }}
        />
        
        {/* Capa de Contraste (Overlay) - Ligeramente más clara para que el Glassmorphism se note */}
        <div className="fixed inset-0 z-0 bg-black/40" />

        {/* Contenido Principal */}
        <div className="relative z-10 flex h-full w-full">
          <Sidebar />
          <main className="flex-1 overflow-y-auto relative bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
