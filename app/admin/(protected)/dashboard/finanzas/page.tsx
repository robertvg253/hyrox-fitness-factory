'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/utils/supabase/client'
import { Loader2, DollarSign, RefreshCw, AlertCircle, CheckCircle2, X, Info } from 'lucide-react'
import { getFinanzasData } from './actions'
import { useTenant } from '../../components/TenantProvider'
import ModalDetallesOrden from '@/components/admin/ModalDetallesOrden'

export default function FinanzasPage() {
  const { activeSede } = useTenant()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [ordenesPorConciliar, setOrdenesPorConciliar] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConciliating, setIsConciliating] = useState<string | null>(null)
  const [selectedOrdenDetalle, setSelectedOrdenDetalle] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [monto, setMonto] = useState('30.00')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{type: 'success'|'error', msg: string} | null>(null)
  
  const [proxyHealth, setProxyHealth] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING')

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

  const loadData = async () => {
    if (!activeSede?.id) return
    setIsLoading(true)
    
    try {
      const data = await getFinanzasData(activeSede.id)
      setUsuarios(data.usuarios)
      setOrdenes(data.ordenes)
      setOrdenesPorConciliar(data.ordenesPorConciliar)
    } catch (error) {
      console.error('Error fetching data from Server Action:', error)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    if (activeSede?.id) {
      loadData()
    }
  }, [activeSede?.id])

  useEffect(() => {
    checkProxyHealth()
    const interval = setInterval(checkProxyHealth, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !monto) {
      setToast({ type: 'error', msg: 'Por favor selecciona un usuario y un monto.' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/cobros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: selectedUser, monto: parseFloat(monto), sede_id: activeSede?.id })
      })

      let data: any;
      try {
        data = await res.json()
      } catch (e) {
        data = { error: `HTTP Error: ${res.status} ${res.statusText}` }
      }

      if (res.ok) {
        setToast({ type: 'success', msg: 'Cobro emitido exitosamente.' })
        setSelectedUser('')
        setMonto('30.00')
        setIsModalOpen(false)
        loadData()
      } else {
        setToast({ type: 'error', msg: data.error || 'Error al emitir el cobro.' })
      }
    } catch (error: any) {
      setToast({ type: 'error', msg: error?.message || 'Error de conexión al servidor.' })
    } finally {
      setIsSubmitting(false)
    }
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

  // Estado derivado para el resumen del usuario
  const selectedUserDetails = usuarios.find(u => u.id === selectedUser)
  const hasActiveSubscription = selectedUserDetails?.suscripciones 
    ? (Array.isArray(selectedUserDetails.suscripciones) 
        ? selectedUserDetails.suscripciones.some((s: any) => s.estado?.toUpperCase() === 'ACTIVO') 
        : selectedUserDetails.suscripciones.estado?.toUpperCase() === 'ACTIVO')
    : false

  const isMissingContactInfo = selectedUserDetails ? (!selectedUserDetails.telefono || !selectedUserDetails.cedula_rif) : false

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
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium">
            {proxyHealth === 'CHECKING' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                <span className="text-zinc-400">Verificando R4...</span>
              </>
            ) : proxyHealth === 'ONLINE' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-emerald-400">Conexión R4: Estable</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-red-400 font-bold">Alerta: Proxy R4 Caído</span>
              </>
            )}
          </div>
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
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
                        {metadata.responsable_nombre || '-'}
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
        <h2 className="text-xl font-bold text-white mb-6">Bitácora de Órdenes (En Vivo)</h2>
        
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
              ) : ordenes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No hay órdenes registradas.
                  </td>
                </tr>
              ) : (
                ordenes.map((orden) => (
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
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        orden.estado === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        orden.estado === 'ENVIADO' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        orden.estado === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        orden.estado === 'ERROR' || orden.estado === 'RECHAZADO' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {orden.estado}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {orden.metadata?.provider === 'MANUAL' ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-[#02D7E5]">{orden.metadata.metodo_pago}</span>
                          <span className="text-[10px] text-zinc-400">
                            {orden.estado === 'RECHAZADO' ? orden.metadata.rechazado_por_nombre : (orden.metadata.conciliado_por_nombre || orden.metadata.responsable_nombre)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-zinc-500">{orden.r4_transaction_id || 'R4 Auto'}</span>
                      )}
                    </td>
                    <td className="py-4 text-right">
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
      </div>

      {/* Slide-over Modal para Emitir Cobro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay oscuro */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          {/* Panel derecho */}
          <div className="relative w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-brand-primary" />
                Emitir Cobro Manual
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Usuario de la Sede</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-primary transition-colors"
                  disabled={isLoading || isSubmitting}
                >
                  <option value="">Selecciona un usuario...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo} (V-{u.cedula_rif})
                    </option>
                  ))}
                </select>
              </div>

              {/* Resumen Dinámico del Usuario */}
              {selectedUserDetails && (
                <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="text-zinc-500">Teléfono:</span>
                    <span className="font-mono">{selectedUserDetails.telefono || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="text-zinc-500">Cédula:</span>
                    <span className="font-mono">V-{selectedUserDetails.cedula_rif}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="text-zinc-500">Suscripción:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${
                      hasActiveSubscription 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {hasActiveSubscription ? 'ACTIVA' : 'INACTIVA / NINGUNA'}
                    </span>
                  </div>
                  {!hasActiveSubscription && (
                    <div className="mt-3 text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 flex gap-2 items-start leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Este cobro no renovará tiempo automáticamente ya que no hay suscripción activa, pero será registrado exitosamente en su historial.</p>
                    </div>
                  )}
                  {isMissingContactInfo && (
                    <div className="mt-3 text-xs text-red-500/80 bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex gap-2 items-start leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Faltan datos de contacto requeridos para emitir el cobro</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-brand-primary transition-colors text-xl font-medium"
                    placeholder="30.00"
                    disabled={isLoading || isSubmitting}
                  />
                </div>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || !selectedUser || isMissingContactInfo}
                  className="w-full bg-brand-primary text-black font-bold rounded-xl py-4 hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ModalDetallesOrden
        isOpen={!!selectedOrdenDetalle}
        onClose={() => setSelectedOrdenDetalle(null)}
        orden={selectedOrdenDetalle}
      />
    </main>
  )
}
