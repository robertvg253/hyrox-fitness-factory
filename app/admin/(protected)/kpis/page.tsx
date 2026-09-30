'use client'

import { useEffect, useState } from 'react'
import { getMasterKPIs } from './actions'
import { Loader2, TrendingUp, TrendingDown, Users, PieChart, Activity, DollarSign, Filter, Target, BarChart3 } from 'lucide-react'

export default function MasterKPIDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAllSedes, setShowAllSedes] = useState(false)
  const [metaAdsExpense, setMetaAdsExpense] = useState<number>(0)

  useEffect(() => {
    let isMounted = true
    getMasterKPIs().then((res) => {
      if (isMounted) {
        setData(res)
        setLoading(false)
      }
    })
    return () => { isMounted = false }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#02D7E5]" />
        <p>Cargando Indicadores Master...</p>
      </div>
    )
  }

  const { revenue, participation, retention, netRevenue, conversion, roi, userCtx } = data
  const isPositive = revenue.variation >= 0
  const isSuperOrGerente = userCtx.rol === 'SUPERADMIN' || userCtx.rol === 'GERENTE'

  const currentSedeParticipation = participation.find((p: any) => p.id === userCtx.sedeId) || { name: 'Mi Sede', monto: 0, percentage: 0 }
  const displayedParticipation = showAllSedes ? participation : [currentSedeParticipation]

  const roiMultiplier = metaAdsExpense > 0 ? (roi.ingresosRedes / metaAdsExpense).toFixed(1) : '0.0'

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Indicadores (KPIs)</h1>
        <p className="text-zinc-400 mt-1">Panel de control y salud del ecosistema</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI 1: Variación Intermensual de Ventas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Activity className="w-32 h-32 text-[#02D7E5]" />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-6">Crecimiento Mensual</h3>
            
            <div className="flex items-end gap-3 mb-4">
              <span className="text-5xl font-black text-white">${revenue.current.toFixed(0)}</span>
              <span className="text-zinc-500 text-lg mb-1">vs ${revenue.last.toFixed(0)}</span>
            </div>
            
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{revenue.variation.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* KPI 8: Ingreso Neto Real */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-6">Ingreso Neto (Mes Actual)</h3>
            
            <div className="flex items-end gap-3 mb-4">
              <span className="text-5xl font-black text-emerald-400">${netRevenue.neto.toFixed(0)}</span>
            </div>
            
            <div className="text-sm text-zinc-400 flex flex-col gap-1">
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>Bruto:</span>
                <span className="text-white font-bold">${netRevenue.bruto.toFixed(0)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Anulaciones:</span>
                <span className="text-red-400 font-bold">-${netRevenue.anulado.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Tasa de Retención */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-32 h-32 text-indigo-500" />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-6">Tasa de Retención</h3>
            
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-6xl font-black text-white">{retention.rate.toFixed(0)}%</span>
            </div>
            
            <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5 mb-4">
              <div 
                className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                style={{ width: `${retention.rate}%` }}
              ></div>
            </div>

            <p className="text-sm text-zinc-500">
              <strong className="text-white">{retention.active}</strong> activos de <strong className="text-white">{retention.total}</strong> registrados.
            </p>
          </div>
        </div>

        {/* KPI 2: Participación de Ventas por Sede */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <PieChart className="w-32 h-32 text-orange-500" />
          </div>
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400">Ventas por Sede (Mes Actual)</h3>
              {isSuperOrGerente && (
                <button
                  onClick={() => setShowAllSedes(!showAllSedes)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-bold">{showAllSedes ? 'Ver Mi Sede' : 'Ver Todas'}</span>
                </button>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              {displayedParticipation.map((sede: any, idx: number) => {
                const colors = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500']
                const color = colors[idx % colors.length]
                
                return (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-bold text-zinc-300 truncate mr-2">{sede.name}</span>
                      <div className="text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-white">${sede.monto.toFixed(0)}</span>
                        <span className="text-xs text-zinc-500 ml-2">{sede.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5">
                      <div 
                        className={`h-full ${color} transition-all duration-1000 ease-out`}
                        style={{ width: `${sede.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
              
              {(!displayedParticipation || displayedParticipation.length === 0 || displayedParticipation[0].monto === 0) && (
                <div className="flex items-center justify-center h-full text-zinc-500 min-h-[100px] bg-black/10 rounded-2xl border border-white/5">
                  <p className="text-sm font-bold uppercase tracking-widest">Sin ventas este mes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI 5: Embudo de Conversión */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="w-32 h-32 text-pink-500" />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-6">Conversión (Clase de Prueba)</h3>
            
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-6xl font-black text-white">{conversion.rate.toFixed(0)}%</span>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5">
                  <div className="h-full bg-zinc-600 transition-all" style={{ width: '100%' }}></div>
                </div>
                <span className="text-sm font-bold text-zinc-300 whitespace-nowrap">{conversion.leads} Prospectos</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5">
                  <div className="h-full bg-pink-500 transition-all" style={{ width: `${conversion.rate}%` }}></div>
                </div>
                <span className="text-sm font-bold text-pink-400 whitespace-nowrap">{conversion.converted} Compras</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: ROI de Redes Sociales */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <BarChart3 className="w-32 h-32 text-[#02D7E5]" />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="font-bold tracking-wide uppercase text-sm text-zinc-400 mb-6">ROI Redes Sociales (Mes Actual)</h3>
            
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-6xl font-black text-[#02D7E5]">{roiMultiplier}x</span>
              <span className="text-zinc-500 font-bold uppercase text-sm tracking-wide">Multiplicador</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Ingresos Redes</p>
                <p className="text-xl font-bold text-white">${roi.ingresosRedes.toFixed(0)}</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Gasto Ads ($)</p>
                <input 
                  type="number"
                  value={metaAdsExpense || ''}
                  onChange={(e) => setMetaAdsExpense(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-transparent text-xl font-bold text-white border-b border-zinc-700 focus:border-[#02D7E5] outline-none transition-colors pb-1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
