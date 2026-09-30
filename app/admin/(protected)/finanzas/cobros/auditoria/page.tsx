import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatCaracasDateTime } from '@/src/utils/timezone'

// Fuerza el renderizado en el servidor en cada petición (no cacheado)
export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Obtener los últimos 100 eventos
  const { data: eventos, error } = await supabase
    .from('bitacora_eventos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  // Mapeo manual para obtener "Usuario Afectado" según la entidad
  const usuariosAfectadosMap: Record<string, string> = {}
  
  if (eventos && eventos.length > 0) {
    const ordenesIds = eventos.filter(e => e.entidad === 'ordenes_cobro').map(e => e.entidad_id)
    const suscripcionesIds = eventos.filter(e => e.entidad === 'suscripciones').map(e => e.entidad_id)
    const usuariosIds = eventos.filter(e => e.entidad === 'usuarios').map(e => e.entidad_id)

    if (ordenesIds.length > 0) {
      const { data: ordenesData } = await supabase
        .from('ordenes_cobro')
        .select('id, usuarios(nombre_completo)')
        .in('id', ordenesIds)
      ordenesData?.forEach((o: any) => {
        if (o.usuarios?.nombre_completo) usuariosAfectadosMap[o.id] = o.usuarios.nombre_completo
      })
    }

    if (suscripcionesIds.length > 0) {
      const { data: subsData } = await supabase
        .from('suscripciones')
        .select('id, usuarios(nombre_completo)')
        .in('id', suscripcionesIds)
      subsData?.forEach((s: any) => {
        if (s.usuarios?.nombre_completo) usuariosAfectadosMap[s.id] = s.usuarios.nombre_completo
      })
    }

    if (usuariosIds.length > 0) {
      const { data: usersData } = await supabase
        .from('usuarios')
        .select('id, nombre_completo')
        .in('id', usuariosIds)
      usersData?.forEach((u: any) => {
        if (u.nombre_completo) usuariosAfectadosMap[u.id] = u.nombre_completo
      })
    }
  }

  // Utilidad para asignar colores a los badges de las acciones
  const getActionColor = (accion: string) => {
    switch (accion) {
      case 'EMISION_COBRO':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'PAGO_REGISTRADO':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'PAGO_APROBADO':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'RENOVACION_ESTADO':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'PAGO_INCOMPLETO':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'ERROR_COBRO':
      case 'SUSCRIPCION_VENCIDA_CON_INCIDENCIA':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'SUSCRIPCION_VENCIDA':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'CREACION_USUARIO':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'SISTEMA_INICIADO':
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href="/admin/dashboard/finanzas" 
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a Finanzas
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Bitácora de Auditoría</h2>
          <p className="text-zinc-400">
            Registro universal de eventos y operaciones del motor de facturación (Últimos 100).
          </p>
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-black/20">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b [&_tr]:border-zinc-800">
              <tr className="border-b transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Fecha / Hora</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Acción</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Usuario Afectado</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Entidad</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">ID Entidad</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Detalles (JSON)</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {error ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-red-500">
                    Error cargando la bitácora: {error.message}
                  </td>
                </tr>
              ) : eventos?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-500">
                    No hay eventos registrados en la bitácora.
                  </td>
                </tr>
              ) : (
                eventos?.map((evento: any) => (
                  <tr 
                    key={evento.id || evento.created_at + evento.entidad_id} 
                    className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                  >
                    <td className="p-4 align-middle whitespace-nowrap text-zinc-300">
                      {formatCaracasDateTime(evento.created_at)}
                    </td>
                    <td className="p-4 align-top">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getActionColor(evento.accion)}`}>
                        {evento.accion}
                      </span>
                    </td>
                    <td className="p-4 align-top text-white font-medium">
                      {usuariosAfectadosMap[evento.entidad_id] || <span className="text-zinc-500">-</span>}
                    </td>
                    <td className="p-4 align-top text-zinc-400">
                      {evento.entidad}
                    </td>
                    <td className="p-4 align-top font-mono text-xs text-zinc-400">
                      {evento.entidad_id}
                    </td>
                    <td className="p-4 align-top">
                      {evento.detalles && Object.keys(evento.detalles).length > 0 ? (
                        <details className="cursor-pointer group">
                          <summary className="text-xs font-medium text-blue-400 hover:text-blue-300 select-none flex items-center gap-1">
                            Ver Detalles
                            {evento.detalles.admin_nombre && <span className="text-zinc-400 font-normal">({evento.detalles.admin_nombre})</span>}
                          </summary>
                          <pre className="mt-2 p-3 rounded bg-zinc-950/50 border border-zinc-800 text-[10px] text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(evento.detalles, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
