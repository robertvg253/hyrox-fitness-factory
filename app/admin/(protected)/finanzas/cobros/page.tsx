'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/utils/supabase/client'
import { Loader2, DollarSign, RefreshCw, AlertCircle, CheckCircle2, X, Info, Search } from 'lucide-react'
import { getFinanzasData, anularCobro } from './actions'
import { useTenant } from '../../components/TenantProvider'
import ModalDetallesOrden from '@/components/admin/ModalDetallesOrden'
import ModalCobroManual from '@/components/admin/ModalCobroManual'

export default function FinanzasPage() {
  const { activeSede } = useTenant()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [ordenesPorConciliar, setOrdenesPorConciliar] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConciliating, setIsConciliating] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState<boolean>(false)
  const [selectedOrdenDetalle, setSelectedOrdenDetalle] = useState<any>(null)
  
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [isCobroManualOpen, setIsCobroManualOpen] = useState(false)
  const [toast, setToast] = useState<{type: 'success'|'error', msg: string} | null>(null)
  
  const [proxyHealth, setProxyHealth] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING' | 'IDLE'>('IDLE')

  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroMetodo, setFiltroMetodo] = useState('TODOS')
  const [searchNombre, setSearchNombre] = useState('')
  const [searchReferencia, setSearchReferencia] = useState('')
  const [minPrice, setMinPrice] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [responsableFilter, setResponsableFilter] = useState('')
  const [resetTrigger, setResetTrigger] = useState(0)

  const checkProxyHealth = async () => {
    setProxyHealth('CHECKING')
    try {
      const res = await fetch('/api/finanzas/proxy-health')
      const data = await res.json()
      setProxyHealth(data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE')
    } catch {
      setProxyHealth('OFFLINE')
    }
  }

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadData = async () => {
    if (!activeSede?.id) return
    setIsLoading(true)
    
    try {
      const data = await getFinanzasData(activeSede.id, {
        page,
        pageSize: 25,
        searchNombre,
        searchReferencia,
        estado: filtroEstado,
        metodo: filtroMetodo,
        minPrice,
        maxPrice,
        responsable: responsableFilter
      })
      setUsuarios(data.usuarios)
      setOrdenes(data.ordenes)
      setOrdenesPorConciliar(data.ordenesPorConciliar)
      setTotalPages(data.totalPages || 1)
      if (data.currentPage && data.currentPage !== page) {
        setPage(data.currentPage)
      }
    } catch (error) {
      console.error('Error fetching data from Server Action:', error)
    }

    setIsLoading(false)
  }

  // Reload data when filters that shouldn't require 'Enter' change, or when page/reset changes
  useEffect(() => {
    if (activeSede?.id) {
      loadData()
    }
  }, [activeSede?.id, page, filtroEstado, filtroMetodo, resetTrigger])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) {
      setToast({ type: 'error', msg: 'Por favor selecciona un usuario.' })
      return
    }
    setIsCobroManualOpen(true)
  }

  const handleCobroManualSuccess = () => {
    setToast({ type: 'success', msg: 'Cobro emitido exitosamente.' })
    setSelectedUser('')
    setIsModalOpen(false)
    setIsCobroManualOpen(false)
    loadData()
  }

  const handleConciliar = async (ordenId: string, accion: 'APROBAR' | 'RECHAZAR') => {
    setIsConciliating(ordenId)
    try {
      const res = await fetch('/api/finanzas/conciliar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden_id: ordenId,
          accion,
          admin_id: 'admin-123' // TODO: Integrar ID real del administrador
        })
      })

      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', msg: data.message })
        loadData()
      } else {
        setToast({ type: 'error', msg: data.error || 'Error al conciliar la orden.' })
      }
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Error de conexión.' })
    } finally {
      setIsConciliating(null)
    }
  }

  const openCancelModal = (ordenId: string) => {
    setSelectedOrderToCancel(ordenId)
    setCancelReason('')
  }

  const handleAnularOrden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderToCancel) return
    
    if (cancelReason.trim() === '') {
      setToast({ type: 'error', msg: 'Debes introducir un motivo válido para anular.' })
      return
    }

    setIsCanceling(true)
    try {
      const res = await anularCobro(selectedOrderToCancel, cancelReason)
      if (res.success) {
        setToast({ type: 'success', msg: res.summary || 'Orden anulada con éxito.' })
        setSelectedOrderToCancel(null)
        setCancelReason('')
        loadData()
      } else {
        setToast({ type: 'error', msg: res.error || 'Error al anular orden.' })
      }
    } catch (error: any) {
      setToast({ type: 'error', msg: 'Error inesperado.' })
    } finally {
      setIsCanceling(false)
    }
  }

  // Estado derivado para el resumen del usuario
  const selectedUserDetails = usuarios.find(u => u.id === selectedUser)
  const hasActiveSubscription = selectedUserDetails?.suscripciones 
    ? (Array.isArray(selectedUserDetails.suscripciones) 
        ? selectedUserDetails.suscripciones.some((s: any) => s.estado?.toUpperCase() === 'ACTIVO') 
        : selectedUserDetails.suscripciones.estado?.toUpperCase() === 'ACTIVO')
    : false

  const isMissingContactInfo = selectedUserDetails ? (!selectedUserDetails.telefono || !selectedUserDetails.cedula_rif) : false

  // Client-side filtering is removed, we use 'ordenes' directly since it's already filtered server-side.
  const ordenesFiltradas = ordenes;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1)
      loadData()
    }
  }

  const handleSearchClick = () => {
    setPage(1)
    loadData()
  }

  const handleResetFilters = () => {
    setSearchNombre('')
    setSearchReferencia('')
    setResponsableFilter('')
    setMinPrice('')
    setMaxPrice('')
    setFiltroEstado('TODOS')
    setFiltroMetodo('TODOS')
    setPage(1)
    setResetTrigger(prev => prev + 1)
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl shadow-lg border backdrop-blur-xl flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' : 'bg-red-950/90 border-red-500/30 text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="font-medium text-sm">{toast.msg}</p>
        </div>
      )}

      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">Panel Financiero</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={checkProxyHealth}
            disabled={proxyHealth === 'CHECKING'}
            title="Clic para verificar conexión con R4"
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-80"
          >
            {proxyHealth === 'CHECKING' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                <span className="text-zinc-400">Verificando...</span>
              </>
            ) : proxyHealth === 'ONLINE' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-emerald-400">Conexión: Estable</span>
              </>
            ) : proxyHealth === 'OFFLINE' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-red-400 font-bold">Alerta: Proxy Caído</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                <span className="text-zinc-400">Proxy: Sin verificar</span>
              </>
            )}
          </button>
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCobroManualOpen(true)}
            className="flex items-center gap-2 bg-brand-primary text-black font-bold px-4 py-2 rounded-lg hover:bg-white transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Emitir Cobro Manual
          </button>
        </div>
      </header>

      {/* Sección Pagos por Conciliar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          Pagos por Conciliar
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Monto / Método</th>
                <th className="pb-3 font-medium">Referencia</th>
                <th className="pb-3 font-medium">Responsable</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading && ordenesPorConciliar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Cargando pagos pendientes...
                  </td>
                </tr>
              ) : ordenesPorConciliar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 bg-zinc-900/30">
                    No hay pagos pendientes por conciliar.
                  </td>
                </tr>
              ) : (
                ordenesPorConciliar.map((orden) => {
                  const metadata = orden.metadata || {}
                  const isMixto = metadata.metodo_pago === 'MIXTO'
                  const desglosados = metadata.pagos_desglosados || []

                  return (
                    <tr key={orden.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-4 text-zinc-300">
                        {new Date(orden.created_at).toLocaleString('es-VE', { 
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="py-4 text-white font-medium">
                        {orden.usuarios?.nombre_completo || 'Desconocido'}
                        <div className="text-xs text-zinc-500 font-normal mt-0.5">{orden.usuarios?.telefono}</div>
                      </td>
                      <td className="py-4 text-zinc-300">
                        <div className="font-bold text-white flex items-center gap-2">
                          ${orden.monto}
                          <button 
                            onClick={() => setSelectedOrdenDetalle(orden)}
                            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-[#02D7E5] transition-colors"
                            title="Ver detalles"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-[#02D7E5] font-medium mt-0.5">
                          {isMixto ? 'MÚLTIPLES' : metadata.metodo_pago}
                        </div>
                      </td>
                      <td className="py-4 text-zinc-300 font-mono text-xs">
                        {metadata.referencia || '-'}
                      </td>
                      <td className="py-4 text-zinc-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{metadata.responsable_nombre || '-'}</span>
                          {metadata.origin === 'self-service' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-500 text-[9px] font-bold uppercase tracking-wider shadow-sm">
                              Atleta
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleConciliar(orden.id, 'RECHAZAR')}
                            disabled={isConciliating !== null}
                            className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                          >
                            {isConciliating === orden.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            Rechazar
                          </button>
                          <button
                            onClick={() => handleConciliar(orden.id, 'APROBAR')}
                            disabled={isConciliating !== null}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                          >
                            {isConciliating === orden.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Aprobar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bitácora de Órdenes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Bitácora de Órdenes</h2>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 hover:text-white border border-zinc-700/50 rounded-lg transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-end w-full">
             <div className="flex flex-col gap-1 w-full">
               <div className="relative w-full">
                 <input
                   type="text"
                   placeholder="Buscar Atleta..."
                   value={searchNombre}
                   onChange={(e) => setSearchNombre(e.target.value)}
                   onKeyDown={handleKeyDown}
                   className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent pl-9 pr-24 px-3 py-2 text-sm"
                 />
                 <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                   <span className="text-[10px] font-medium border border-zinc-700 bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-400">↵ Enter</span>
                 </div>
               </div>
             </div>

             <div className="flex flex-col gap-1 w-full">
               <div className="relative w-full">
                 <input
                   type="text"
                   placeholder="Nº de Referencia..."
                   value={searchReferencia}
                   onChange={(e) => setSearchReferencia(e.target.value)}
                   onKeyDown={handleKeyDown}
                   className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent pl-9 pr-24 px-3 py-2 text-sm"
                 />
                 <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                   <span className="text-[10px] font-medium border border-zinc-700 bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-400">↵ Enter</span>
                 </div>
               </div>
             </div>
             
             <div className="flex flex-col gap-1 w-full">
               <div className="relative w-full">
                 <input
                   type="text"
                   placeholder="Responsable..."
                   value={responsableFilter}
                   onChange={(e) => setResponsableFilter(e.target.value)}
                   onKeyDown={handleKeyDown}
                   className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent pl-9 pr-24 px-3 py-2 text-sm"
                 />
                 <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                   <span className="text-[10px] font-medium border border-zinc-700 bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-400">↵ Enter</span>
                 </div>
               </div>
             </div>

             <div className="flex items-center gap-2 w-full">
               <input 
                 type="number"
                 placeholder="Mín ($)"
                 value={minPrice}
                 onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))}
                 onKeyDown={handleKeyDown}
                 className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent px-3 py-2 text-sm"
               />
               <span className="text-zinc-500 text-sm">-</span>
               <input 
                 type="number"
                 placeholder="Máx ($)"
                 value={maxPrice}
                 onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                 onKeyDown={handleKeyDown}
                 className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent px-3 py-2 text-sm"
               />
             </div>
             
             <div className="flex gap-2 w-full">
               <select 
                 value={filtroEstado} 
                 onChange={(e) => {
                   setFiltroEstado(e.target.value);
                   setPage(1);
                 }}
                 className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent px-3 py-2 text-sm cursor-pointer"
               >
                 <option value="TODOS">Estado</option>
                 <option value="POR_CONCILIAR">Pendiente</option>
                 <option value="CONCILIADOS">Conciliado</option>
                 <option value="RECHAZADO">Rechazado</option>
               </select>

               <select 
                 value={filtroMetodo} 
                 onChange={(e) => {
                   setFiltroMetodo(e.target.value);
                   setPage(1);
                 }}
                 className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent px-3 py-2 text-sm cursor-pointer"
               >
                 <option value="TODOS">Método</option>
                 <option value="ZELLE">Zelle</option>
                 <option value="EFECTIVO">Efectivo</option>
                 <option value="PAGO_MOVIL">Pago Móvil</option>
                 <option value="COBRO_MOVIL">Cobro Móvil</option>
                 <option value="POS">POS</option>
                 <option value="MIXTO">Mixto</option>
               </select>
             </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium text-right">Detalles / Responsable</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading && ordenes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Cargando historial...
                  </td>
                </tr>
              ) : ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500">
                      <Search className="w-8 h-8 mb-3 text-zinc-600" />
                      <p className="text-base font-medium text-zinc-400">No se encontraron cobros con estos filtros</p>
                      <p className="text-sm mt-1">Intenta ajustando tu búsqueda o cambiando los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map((orden) => (
                  <tr key={orden.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="py-4 text-zinc-300">
                      {new Date(orden.created_at).toLocaleString('es-VE', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </td>
                    <td className="py-4 text-white font-medium">
                      {orden.usuarios?.nombre_completo || 'Desconocido'}
                    </td>
                    <td className="py-4 text-zinc-300">
                      ${orden.monto} {orden.moneda}
                    </td>
                    <td className="py-4">
                      {orden.estado === 'APROBADO' ? (
                        orden.metadata?.conciliado_por_nombre ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> Aprobado Conciliado
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> Aprobado Automático
                          </span>
                        )
                      ) : orden.estado === 'RECHAZADO' && orden.metadata?.rechazado_por_nombre?.includes('Centinela') ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 border border-zinc-700 flex items-center gap-1 w-max">
                          <AlertCircle className="w-3 h-3" /> Vencido Auto
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max ${
                          orden.estado === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                          orden.estado === 'ENVIADO' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          orden.estado === 'ERROR' || orden.estado === 'RECHAZADO' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {orden.estado}
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      {orden.metadata?.provider === 'MANUAL' ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-[#02D7E5]">{orden.metadata.metodo_pago}</span>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="text-[10px] text-zinc-400">
                              {orden.estado === 'RECHAZADO' 
                                ? orden.metadata.rechazado_por_nombre 
                                : (orden.metadata.conciliado_por_nombre || orden.metadata.responsable_nombre)}
                            </span>
                            {orden.metadata.origin === 'self-service' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-500 text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                Atleta
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-zinc-500">{orden.r4_transaction_id || 'R4 Auto'}</span>
                      )}
                    </td>
                    <td className="py-4 text-right flex items-center justify-end gap-2">
                      {orden.estado === 'APROBADO' && (
                        <button 
                          onClick={() => openCancelModal(orden.id)}
                          className="px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors"
                          title="Anular orden aprobada"
                        >
                          Anular Cobro
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedOrdenDetalle(orden)}
                        className="inline-flex items-center justify-center p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-[#02D7E5] transition-colors"
                        title="Ver Detalles"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
            <span className="text-sm text-zinc-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || isLoading}
                className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || isLoading}
                className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {isCobroManualOpen && (
        <ModalCobroManual
          isOpen={isCobroManualOpen}
          onClose={() => setIsCobroManualOpen(false)}
          usuarios={usuarios}
          onSuccess={handleCobroManualSuccess}
        />
      )}
      {selectedOrderToCancel && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => !isCanceling && setSelectedOrderToCancel(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-zinc-800 z-[70] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Anular Orden</h2>
                  <p className="text-xs text-red-400/80 mt-0.5">Operación destructiva contable</p>
                </div>
              </div>
              <button 
                onClick={() => !isCanceling && setSelectedOrderToCancel(null)} 
                className="text-zinc-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form id="form-anular" onSubmit={handleAnularOrden} className="p-6 flex flex-col flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Motivo de anulación (Auditoría) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder='Ej. "Pago presencial en efectivo, error del cajero al registrar monto"'
                  className="w-full bg-black/40 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-sm min-h-[120px] resize-none"
                  disabled={isCanceling}
                  autoFocus
                />
              </div>
              <div className="mt-4 text-xs text-zinc-500 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <p className="font-semibold text-zinc-300 mb-1">Impacto de la anulación:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>El ingreso monetario será revocado contablemente.</li>
                  <li>El tiempo adelantado a la suscripción será revertido.</li>
                  <li>Se guardará el registro exacto de quién, cuándo y por qué ejecutó la anulación.</li>
                </ul>
              </div>
            </form>

            <div className="p-6 border-t border-zinc-800 bg-zinc-900">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderToCancel(null)}
                  disabled={isCanceling}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="form-anular"
                  disabled={isCanceling || !cancelReason.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {isCanceling ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Anulación'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ModalDetallesOrden
        isOpen={!!selectedOrdenDetalle}
        onClose={() => setSelectedOrdenDetalle(null)}
        orden={selectedOrdenDetalle}
      />
    </main>
  )
}
