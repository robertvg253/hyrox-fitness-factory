import { createClient } from '@supabase/supabase-js'
import { AlertCircle, CheckCircle2, Webhook } from 'lucide-react'

// Forzar renderizado dinámico para ver los webhooks en tiempo real sin caché
export const dynamic = 'force-dynamic'

export default async function WebhooksLogPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Consultar los webhooks más recientes
  const { data: webhooks, error } = await supabase
    .from('webhooks_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[Webhooks Auditoría] Error fetching data:', error)
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Webhook className="w-8 h-8 text-brand-primary" />
          Auditoría de Webhooks
        </h1>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="pb-3 font-medium whitespace-nowrap">Fecha / Hora</th>
                <th className="pb-3 font-medium">Origen</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Payload (JSON)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {!webhooks || webhooks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500">
                    No se encontraron registros de webhooks en la base de datos.
                  </td>
                </tr>
              ) : (
                webhooks.map((hook) => (
                  <tr key={hook.id} className="hover:bg-zinc-800/20 transition-colors align-top">
                    <td className="py-4 text-zinc-300 whitespace-nowrap pt-5">
                      {new Date(hook.created_at).toLocaleString('es-VE', { 
                        day: '2-digit', month: 'short', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </td>
                    <td className="py-4 pt-5">
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                        {hook.origen}
                      </span>
                    </td>
                    <td className="py-4 pt-5">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 w-max rounded-md text-xs font-bold uppercase tracking-wider ${
                        hook.processed 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      }`}>
                        {hook.processed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {hook.processed ? 'PROCESADO' : 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="py-4 w-full">
                      <details className="group">
                        <summary className="cursor-pointer text-brand-primary font-medium text-xs hover:underline mb-2 select-none pt-1">
                          Ver JSON Completo
                        </summary>
                        <pre className="bg-black/50 p-4 rounded-lg border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto max-h-96 overflow-y-auto mt-2">
                          {JSON.stringify(hook.payload, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
