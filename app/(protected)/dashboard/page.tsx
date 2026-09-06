import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Bell, CalendarPlus, Dumbbell, CreditCard, TrendingUp, ArrowRight, Lock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Protección redundante en el componente (ya cubierto por middleware)
  if (!user) {
    redirect('/login')
  }

  // Leer estado del usuario y sus suscripciones desde la nueva estructura
  const { data: usuario } = await supabase
    .from('usuarios')
    .select(`
      rol,
      suscripciones (
        estado,
        fecha_vencimiento
      )
    `)
    .eq('id', user.id)
    .single()

  // Extracción segura (asumiendo que puede devolver un arreglo)
  const suscripciones = usuario?.suscripciones || []
  const suscripcionActiva = Array.isArray(suscripciones) ? suscripciones[0] : suscripciones

  const estado = (suscripcionActiva?.estado || '').toUpperCase()
  const fechaVencimientoBD = suscripcionActiva?.fecha_vencimiento
  
  let estaVencido = false

  if (estado === 'VENCIDO' || !estado) {
    estaVencido = true
  } else if (estado === 'ACTIVO') {
    if (!fechaVencimientoBD) {
      estaVencido = true 
    } else {
      const fechaVencimiento = new Date(fechaVencimientoBD)
      const ahora = new Date()
      if (fechaVencimiento < ahora) {
        estaVencido = true
      }
    }
  }

  // Renderizado Condicional: Cuenta Inactiva (Degradación Elegante)
  if (estaVencido) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-zinc-950/80 p-8 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
          {/* Subtle Glow Background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-brand-primary/10 blur-[50px] rounded-full pointer-events-none"></div>
          
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8 text-zinc-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">Suscripción Inactiva</h1>
          
          <p className="text-zinc-400 text-sm leading-relaxed px-2">
            Para reservar clases y acceder a todas las funciones de tu ecosistema, necesitas una membresía activa.
          </p>

          <div className="pt-4">
            <button className="w-full py-4 bg-brand-primary text-zinc-950 font-bold rounded-2xl shadow-lg shadow-brand-primary/20 hover:opacity-90 transition-all text-lg flex items-center justify-center gap-2">
              Activar Membresía
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Nombre del usuario desde el email o metadatos
  const userName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Atleta'

  // Renderizado Condicional: Dashboard Normal Operativo (NUEVO UI)
  return (
    <main className="p-6 space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700">
            {/* Avatar placeholder */}
            <img 
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop" 
              alt="Avatar" 
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400">Buenos días,</p>
            <h1 className="text-2xl font-bold text-white tracking-tight capitalize">{userName}</h1>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Hero Card */}
      <section>
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
          <div className="absolute -right-10 -top-10 opacity-5">
             <Dumbbell className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">Tu Próxima Clase</h2>
            <p className="text-3xl font-black text-white mb-1 tracking-tight">CrossTraining</p>
            <p className="text-brand-primary font-medium">Hoy, 6:00 PM</p>
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section>
        <div className="flex justify-between items-center px-2">
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <CalendarPlus className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Agendar</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <Dumbbell className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Rutina</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Pagos</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white group-hover:border-brand-primary group-hover:text-brand-primary transition-all shadow-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Progreso</span>
          </button>
        </div>
      </section>

      {/* Disciplinas */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 tracking-tight">Explora nuestras disciplinas</h3>
        
        <div className="space-y-4">
          {/* Featured Card */}
          <div className="relative h-48 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
            <img 
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop"
              alt="CrossTraining"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full p-5 flex justify-between items-end">
              <div>
                <p className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-1">Featured</p>
                <h4 className="text-xl font-bold text-white">CrossTraining Avanzado</h4>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-zinc-950 shadow-lg">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Grid Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative h-40 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
              <img 
                src="https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=500&auto=format&fit=crop"
                alt="Funcional"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <h4 className="text-lg font-bold text-white">Funcional</h4>
              </div>
            </div>

            <div className="relative h-40 rounded-3xl overflow-hidden group cursor-pointer border border-zinc-800 shadow-xl">
              <img 
                src="https://images.unsplash.com/photo-1599058945522-28d584b6f4ff?q=80&w=500&auto=format&fit=crop"
                alt="Musculación"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <h4 className="text-lg font-bold text-white">Musculación</h4>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
