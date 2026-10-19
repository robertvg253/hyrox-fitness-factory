import { createClient as createAdminClient } from '@supabase/supabase-js'
import { formatCaracasDate } from '@/src/utils/timezone'
import { Calendar, User, Activity } from 'lucide-react'
import { redirect } from 'next/navigation'
import ClientTables from './ClientTables'
import EditFechaCorte from './EditFechaCorte'
import BotonPagoManual from './BotonPagoManual'
import { createClient } from '@/src/utils/supabase/server'

export const dynamic = 'force-dynamic';

export default async function PerfilUsuarioAdmin({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  if (!id) {
    redirect('/admin/usuarios');
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const supabaseAuth = await createClient();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  let currentUserRole = 'RECEPCIONISTA';

  if (authUser) {
    const { data: adminUser } = await supabaseAdmin.from('usuarios').select('rol').eq('id', authUser.id).single();
    if (adminUser) currentUserRole = adminUser.rol;
  }

  // Fetch Usuario with Sede
  const { data: usuario, error: userError } = await supabaseAdmin
    .from('usuarios')
    .select(`
      *,
      sedes(nombre)
    `)
    .eq('id', id)
    .single();

  if (userError || !usuario) {
    console.error('Error fetching user:', userError);
    return <div className="p-8 text-center text-red-500 font-bold">Error: Usuario no encontrado</div>;
  }

  // Fetch Latest Subscription
  const { data: suscripciones } = await supabaseAdmin
    .from('suscripciones')
    .select(`
      *,
      planes(nombre, tipo, sesiones_total, precio_usd)
    `)
    .eq('usuario_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
    
  const subReciente = suscripciones?.[0] || null;
  const subActiva = subReciente?.estado === 'ACTIVO' ? subReciente : null;

  // Fetch Reservas
  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select(`
      id,
      estado_reserva,
      asistio_fisicamente,
      created_at,
      modificado_por,
      fecha_modificacion,
      clases_programadas(
        fecha_hora_inicio,
        nombre_clase,
        disciplinas(nombre)
      )
    `)
    .eq('usuario_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch Ordenes
  const { data: ordenes } = await supabaseAdmin
    .from('ordenes_cobro')
    .select(`
      id,
      created_at,
      estado,
      monto,
      metadata
    `)
    .eq('usuario_id', id)
    .order('created_at', { ascending: false });

  // Map user names for "Modificado Por"
  const modificadoPorIds = [...new Set(reservas?.map(r => r.modificado_por).filter(Boolean))];
  let modificadoresMap: Record<string, string> = {};
  
  if (modificadoPorIds.length > 0) {
    const { data: modificadores } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre_completo')
      .in('id', modificadoPorIds);
      
    if (modificadores) {
      modificadoresMap = modificadores.reduce((acc: any, mod: any) => {
        acc[mod.id] = mod.nombre_completo;
        return acc;
      }, {});
    }
  }

  // Calculate Presentismo (Presenteeism)
  const pastReservas = reservas?.filter(r => {
    const rawClase = r.clases_programadas;
    const clase = Array.isArray(rawClase) ? rawClase[0] : rawClase;
    if (!clase?.fecha_hora_inicio) return false;
    return new Date(clase.fecha_hora_inicio) < new Date();
  }) || [];

  const totalPast = pastReservas.length;
  const totalAsistencias = pastReservas.filter(r => r.asistio_fisicamente).length;
  const presentismo = totalPast > 0 ? Math.round((totalAsistencias / totalPast) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* HEADER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{usuario.nombre_completo}</h1>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${subActiva ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {subActiva ? 'ACTIVO' : 'INACTIVO'}
            </span>
            {usuario.etiqueta_lead && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {usuario.etiqueta_lead}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA (Suscripción y Actividad) */}
        <div className="lg:col-span-1 space-y-6">
          {/* SUSCRIPCION */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-zinc-400" />
              Suscripción Actual
            </h2>
            {subActiva ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-400">Plan</p>
                  <p className="text-base font-medium text-white">
                    {subActiva.planes?.nombre || 'Plan Desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Vencimiento</p>
                  <EditFechaCorte 
                    suscripcionId={subActiva.id} 
                    fechaCorteActual={subActiva.fecha_corte} 
                    currentUserRole={currentUserRole} 
                  />
                </div>
                {subActiva.planes?.tipo === 'SESIONES' && (
                  <div>
                    <p className="text-sm text-zinc-400 mb-2">Sesiones Utilizadas vs Disponibles</p>
                    <div className="flex justify-between items-center text-sm font-medium mb-1 text-zinc-300">
                      <span>{(subActiva.planes.sesiones_total || 0) - (subActiva.sesiones_restantes || 0)} Usadas</span>
                      <span>{subActiva.sesiones_restantes || 0} Restantes</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, Math.max(0, (((subActiva.planes.sesiones_total || 0) - (subActiva.sesiones_restantes || 0)) / (subActiva.planes.sesiones_total || 1)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">No tiene plan activo.</p>
            )}

            {subReciente && (
              <BotonPagoManual 
                suscripcionId={subReciente.id} 
                precioPlan={Array.isArray(subReciente.planes) ? subReciente.planes[0]?.precio_usd || 30 : subReciente.planes?.precio_usd || 30} 
              />
            )}
          </div>

          {/* ACTIVIDAD / PRESENTISMO */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-400" />
              Actividad (Presentismo)
            </h2>
            <div className="text-center py-4">
              <div className="text-4xl font-black text-white mb-2">{presentismo}%</div>
              <p className="text-sm text-zinc-400 mb-4">De {totalPast} clases pasadas reservadas</p>
              
              <div className="w-full bg-zinc-800 rounded-full h-3 mb-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${presentismo >= 75 ? 'bg-emerald-500' : presentismo >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                  style={{ width: `${presentismo}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (Información Personal) */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm h-full">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              Información Personal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Email</p>
                <p className="text-base font-medium text-white">{usuario.email || 'N/A'}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Teléfono</p>
                <p className="text-base font-medium text-white">{usuario.telefono || 'N/A'}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Cédula / RIF</p>
                <p className="text-base font-medium text-white">{usuario.cedula_rif || 'N/A'}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Fecha de Nacimiento</p>
                <p className="text-base font-medium text-white">{usuario.fecha_nacimiento ? formatCaracasDate(usuario.fecha_nacimiento) : 'N/A'}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Género</p>
                <p className="text-base font-medium text-white">{usuario.genero || 'N/A'}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Sede</p>
                <p className="text-base font-medium text-white">{Array.isArray(usuario.sedes) ? usuario.sedes[0]?.nombre : (usuario.sedes?.nombre || 'N/A')}</p>
              </div>
              <div className="pb-4 sm:pb-0 sm:border-b-0 border-b border-zinc-800/50">
                <p className="text-sm text-zinc-400 mb-1">Fecha de Ingreso</p>
                <p className="text-base font-medium text-white">{usuario.created_at ? formatCaracasDate(usuario.created_at) : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClientTables reservas={reservas || []} ordenes={ordenes || []} modificadoresMap={modificadoresMap} />
    </div>
  )
}
