import Sidebar from './components/Sidebar'
import { TenantProvider } from './components/TenantProvider'
import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Verificación de sesión con supabase.auth.getUser() para máxima seguridad
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 2. Consulta directa del rol en public.usuarios (sin caché en Server Component)
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, rol, nombres, email')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !usuario) {
    console.error('[AdminLayout] Error consultando rol de usuario:', error)
    redirect('/dashboard')
  }

  const rol = (usuario.rol || '').toLowerCase().trim()

  // 3. Si el rol !== 'admin', redirige inmediatamente a /dashboard
  if (rol !== 'admin') {
    redirect('/dashboard')
  }

  // 4. Si el rol === 'admin', permite el renderizado del children
  return (
    <TenantProvider initialSedes={[]} initialActiveSede={null}>
      <div className="flex h-screen w-full overflow-hidden font-sans relative text-white bg-black">
        {/* Fondo Fotográfico Fijo */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 pointer-events-none"
          style={{ backgroundImage: 'url("/images/admin-bg.png")' }}
        />
        
        {/* Capa de Contraste (Overlay) */}
        <div className="fixed inset-0 z-0 bg-black/75 pointer-events-none" />

        {/* Contenido Principal */}
        <div className="relative z-10 flex h-full w-full">
          <Sidebar 
            initialRole={rol}
            initialName={usuario?.nombres || 'Administrador'}
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
