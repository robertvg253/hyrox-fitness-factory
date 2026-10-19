import Sidebar from './components/Sidebar'
import { TenantProvider } from './components/TenantProvider'
import { createClient } from '@/src/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { canAccessAdminPanel } from '@/src/utils/permissions'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Verificación de sesión y permisos RBAC en el servidor
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol, nombre_completo, email')
    .eq('id', user.id)
    .single()

  const rol = (usuario?.rol || '').toUpperCase()

  // Si es ATLETA o no tiene rol de staff, expulsarlo a su panel público
  if (!canAccessAdminPanel(rol)) {
    redirect('/dashboard')
  }

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
        
        {/* Capa de Contraste (Overlay) */}
        <div className="fixed inset-0 z-0 bg-black/40" />

        {/* Contenido Principal */}
        <div className="relative z-10 flex h-full w-full">
          <Sidebar 
            initialRole={rol}
            initialName={usuario?.nombre_completo || 'Administrador'}
            initialEmail={usuario?.email || user.email || ''}
          />
          <main className="flex-1 overflow-y-auto relative bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
