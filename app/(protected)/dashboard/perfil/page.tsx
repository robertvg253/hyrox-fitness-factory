import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import { User, Phone, Calendar, CreditCard, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'

export default async function PerfilAtletaPage() {
  const supabase = await createClient()

  // 1. Obtener la sesión estrictamente protegida
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Extraer datos del usuario y sus suscripciones asegurando el RLS implícito
  const { data: perfil, error } = await supabase
    .from('usuarios')
    .select(`
      nombre_completo,
      telefono,
      email,
      suscripciones (
        estado,
        fecha_corte
      )
    `)
    .eq('id', user.id)
    .single()

  if (error || !perfil) {
    console.error('[Perfil] Error obteniendo datos:', error)
    redirect('/dashboard')
  }

  // Manejo seguro del array de suscripciones
  const suscripcionesArray = Array.isArray(perfil.suscripciones) 
    ? perfil.suscripciones 
    : [perfil.suscripciones].filter(Boolean)

  const suscripcionActiva = suscripcionesArray.find((s: any) => s.estado === 'ACTIVO') || suscripcionesArray[0]
  const estado = (suscripcionActiva?.estado || 'INACTIVO').toUpperCase()
  const fechaCorte = suscripcionActiva?.fecha_corte 
    ? new Date(suscripcionActiva.fecha_corte).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No disponible'

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold tracking-wide">Mi Perfil</h1>
      </header>

      <main className="p-4 space-y-8">
        {/* Avatar y Datos Personales */}
        <section className="flex flex-col items-center justify-center pt-8 pb-4">
          <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-brand-primary flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(2,215,229,0.2)]">
            <User className="w-10 h-10 text-brand-primary" />
          </div>
          <h2 className="text-2xl font-bold text-center tracking-wide">
            {perfil.nombre_completo || 'Atleta'}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {perfil.email || 'Sin correo registrado'}
          </p>
        </section>

        {/* Tarjeta de Membresía */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold px-1">
            Membresía
          </h3>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            {/* Elemento decorativo */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-primary/10 rounded-full blur-2xl" />
            
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-primary/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="font-semibold tracking-wide">Suscripción Actual</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest border ${
                estado === 'ACTIVO' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {estado}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">Próximo Vencimiento</p>
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <p className="text-lg font-semibold tracking-wide">{fechaCorte}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Información de Contacto */}
        <section className="space-y-4">
          <h3 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold px-1">
            Contacto
          </h3>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-zinc-500" />
                <span className="text-sm text-zinc-300">Teléfono Móvil</span>
              </div>
              <span className="text-sm font-medium">{perfil.telefono || 'No registrado'}</span>
            </div>
          </div>
        </section>

        {/* Botón de Cerrar Sesión */}
        <LogoutButton />
      </main>
    </div>
  )
}
