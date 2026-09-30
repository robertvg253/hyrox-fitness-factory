'use client'

import { useState, useEffect } from 'react'
import { useTenant } from '../../components/TenantProvider'
import { getDashboardFinanzasData } from './actions'
import { Loader2, DollarSign, ArrowRight, AlertCircle, CheckCircle2, TrendingUp, CreditCard } from 'lucide-react'
import Link from 'next/link'

type Timeframe = 'HOY' | '3_DIAS' | 'SEMANA' | 'MES' | 'TRIMESTRE'

export default function FinanzasDashboard() {
  const { activeSede } = useTenant()
  const [timeframe, setTimeframe] = useState<Timeframe>('TRIMESTRE')
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!activeSede?.id) return
    let isMounted = true
    setIsLoading(true)

    getDashboardFinanzasData(activeSede.id, timeframe).then((res) => {
      if (isMounted && !res.error) {
        setData(res)
        setIsLoading(false)
      }
    })

    return () => { isMounted = false }
  }, [activeSede?.id, timeframe])

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard Financiero</h1>
          <p className="text-zinc-400 mt-1">Resumen gerencial de cobros y conciliaciones</p>
        </div>

        {/* Filtro de Tiempo */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {[
            { id: 'HOY', label: 'Hoy' },
            { id: '3_DIAS', label: 'Últimos 3 días' },
            { id: 'SEMANA', label: 'Esta Semana' },
            { id: 'MES', label: 'Este Mes' },
            { id: 'TRIMESTRE', label: 'Trimestre' }
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id as Timeframe)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === tf.id 
                  ? 'bg-zinc-800 text-[#02D7E5]' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#02D7E5]" />
          <p>Calculando KPIs...</p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Ingresos y Breakdown (Ocupa 2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* KPI Cards */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48 text-emerald-500" />
              </div>
              <div className="relative z-10">
                <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-2">Ingreso Total (Aprobado)</h3>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-black text-white">${data.kpis?.conciliadosMonto?.toFixed(2) || '0.00'}</span>
                  <span className="text-zinc-500 font-medium text-lg">({data.kpis?.conciliados || 0} cobros)</span>
                </div>
              </div>
            </div>

            {/* Breakdown por Metodo */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-[#02D7E5]" />
                Desglose de Ingresos por Método
              </h2>
              
              <div className="space-y-6">
                {Object.entries(data.desgloseMetodos || {}).map(([metodo, monto]: [string, any]) => {
                  if (monto === 0) return null
                  
                  const percentage = data.kpis.conciliadosMonto > 0 ? (monto / data.kpis.conciliadosMonto) * 100 : 0;
                  
                  // Colors logic
                  let colorClass = 'bg-zinc-500';
                  let textClass = 'text-zinc-400';
                  if (metodo === 'Zelle') { colorClass = 'bg-purple-500'; textClass = 'text-purple-400'; }
                  else if (metodo === 'Cobro Móvil') { colorClass = 'bg-blue-500'; textClass = 'text-blue-400'; }
                  else if (metodo === 'Efectivo') { colorClass = 'bg-emerald-500'; textClass = 'text-emerald-400'; }
                  else if (metodo === 'Punto de Venta') { colorClass = 'bg-orange-500'; textClass = 'text-orange-400'; }
                  else if (metodo === 'Mixto') { colorClass = 'bg-pink-500'; textClass = 'text-pink-400'; }
                  else { colorClass = 'bg-indigo-500'; textClass = 'text-indigo-400'; } // For any other dynamically extracted method

                  return (
                    <div key={metodo} className="flex flex-col">
                      <div className="flex justify-between items-end mb-2">
                        <span className={`text-sm font-bold uppercase tracking-wider ${textClass}`}>{metodo}</span>
                        <div className="text-right">
                          <span className="text-xl font-black text-white">${monto.toFixed(2)}</span>
                          <span className="text-xs text-zinc-500 ml-2 font-medium">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5">
                        <div 
                          className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
                {Object.values(data.desgloseMetodos || {}).every(m => m === 0) && (
                  <div className="py-12 text-center text-zinc-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No hay ingresos aprobados en este periodo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Atención Requerida (Ocupa 1/3) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-yellow-500/20 rounded-3xl p-8 shadow-xl relative overflow-hidden group h-full flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <AlertCircle className="w-32 h-32 text-yellow-500" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-yellow-500 mb-6">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="font-bold tracking-wide uppercase text-sm">Atención Requerida</h3>
                </div>
                
                <p className="text-zinc-400 text-sm mb-2">Pagos por Conciliar en el periodo</p>
                <div className="text-5xl font-black text-white mb-6">
                  {data.kpis?.porConciliar || 0}
                </div>
                
                <div className="mt-auto">
                  <Link 
                    href="/admin/finanzas/cobros" 
                    className="flex w-full items-center justify-center gap-2 py-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-bold rounded-xl transition-colors border border-yellow-500/20"
                  >
                    Ir a Conciliar Pagos <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
