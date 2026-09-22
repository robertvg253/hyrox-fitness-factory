'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/utils/supabase/client'
import { MetodoPago } from '@/src/types'
import { obtenerPlanesDisponibles, crearSuscripcionYOrden } from '@/app/admin/(protected)/planes/actions'
import { Loader2, X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface ModalAsignarPlanProps {
  isOpen: boolean
  onClose: () => void
  usuarioId: string
  usuarioNombre: string
  sedeId: string | null
  onSuccess: () => void
}

interface PagoDesglosadoForm {
  metodo: MetodoPago
  monto: number
  titular: string
  correo: string
  banco: string
  referencia: string
}

const METODOS_OPCIONES: { value: MetodoPago, label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'PUNTO_DE_VENTA', label: 'Punto de Venta' },
  { value: 'COBRO_MOVIL', label: 'Cobro Móvil (Automático)' },
]

export default function ModalAsignarPlan({ isOpen, onClose, usuarioId, usuarioNombre, sedeId, onSuccess }: ModalAsignarPlanProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [planes, setPlanes] = useState<any[]>([])
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null)
  
  const [isMixto, setIsMixto] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [isWaitingPayment, setIsWaitingPayment] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const defaultPago: PagoDesglosadoForm = { metodo: 'EFECTIVO', monto: 0, titular: '', correo: '', banco: '', referencia: '' }
  
  const [pago1, setPago1] = useState<PagoDesglosadoForm>(defaultPago)
  const [pago2, setPago2] = useState<PagoDesglosadoForm>(defaultPago)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedPlan(null)
      setIsMixto(false)
      setError(null)
      setIsWaitingPayment(false)
      setPendingOrderId(null)
      fetchPlanes()
    }
  }, [isOpen, sedeId])

  useEffect(() => {
    if (!isWaitingPayment || !pendingOrderId) return;
    
    const supabase = createClient();
    const channel = supabase.channel(`orden-update-${pendingOrderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ordenes_cobro',
        filter: `id=eq.${pendingOrderId}`
      }, (payload) => {
        const estado = payload.new.estado;
        if (estado === 'PAGADA') {
          toast.success('Cobro exitoso. Suscripción activada.');
          onSuccess();
          onClose();
        } else if (estado === 'RECHAZADA' || estado === 'FALLIDA') {
          toast.error('El cobro fue rechazado. Verifique y reintente.');
          setIsWaitingPayment(false);
          setPendingOrderId(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [isWaitingPayment, pendingOrderId, onSuccess, onClose])

  useEffect(() => {
    if (selectedPlan) {
      setPago1({ ...defaultPago, monto: selectedPlan.precio_usd })
      setPago2({ ...defaultPago, monto: 0 })
    }
  }, [selectedPlan])

  const fetchPlanes = async () => {
    setLoadingPlanes(true)
    try {
      const res = await obtenerPlanesDisponibles(sedeId)
      if (res.success) {
        // Ordenar en frontend ya que quitamos el order del backend
        const planesOrdenados = (res.data || []).sort((a: any, b: any) => a.precio_usd - b.precio_usd)
        setPlanes(planesOrdenados)
      } else {
        setPlanes([])
      }
    } catch (err) {
      toast.error('Error cargando planes')
    } finally {
      setLoadingPlanes(false)
    }
  }

  if (!isOpen) return null

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan)
    setStep(2)
  }

  const handleValidacion = () => {
    if (!selectedPlan) throw new Error("Debe seleccionar un plan.")
    const precioPlan = selectedPlan.precio_usd
    const total = pago1.monto + (isMixto ? pago2.monto : 0)
    
    if (total < precioPlan) {
      throw new Error(`El monto total ($${total}) no puede ser menor al precio del plan ($${precioPlan}).`)
    }

    const validarCampos = (p: PagoDesglosadoForm, index: number) => {
      if (p.metodo === 'ZELLE') {
        if (!p.titular.trim()) throw new Error(`[Pago ${index}] El Nombre Titular es obligatorio para Zelle.`)
        if (!p.correo.trim()) throw new Error(`[Pago ${index}] El Correo es obligatorio para Zelle.`)
        if (!p.referencia.trim()) throw new Error(`[Pago ${index}] La referencia es obligatoria para Zelle.`)
      }
      if (p.metodo === 'PAGO_MOVIL' || p.metodo === 'TRANSFERENCIA') {
        if (!p.banco.trim()) throw new Error(`[Pago ${index}] El Banco es obligatorio.`)
        if (!p.titular.trim()) throw new Error(`[Pago ${index}] Cédula/Teléfono es obligatorio.`)
        if (!p.referencia.trim()) throw new Error(`[Pago ${index}] La referencia es obligatoria.`)
      }
    }

    validarCampos(pago1, 1)
    if (isMixto) {
      if (pago2.monto <= 0) throw new Error("El monto del Método 2 debe ser mayor a 0.")
      validarCampos(pago2, 2)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingSubmit(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const responsableId = session?.user?.id || 'sin-id'
      const responsableNombre = session?.user?.user_metadata?.name || session?.user?.email || 'Usuario Desconocido'

      handleValidacion()

      const pagos_desglosados = []
      
      const cleanPago = (p: PagoDesglosadoForm) => ({
        metodo: p.metodo,
        monto: p.monto,
        titular: p.titular.trim() || undefined,
        correo: p.correo.trim() || undefined,
        banco: p.banco.trim() || undefined,
        referencia: p.referencia.trim() || undefined,
      })

      pagos_desglosados.push(cleanPago(pago1))
      if (isMixto) pagos_desglosados.push(cleanPago(pago2))

      const totalMonto = pagos_desglosados.reduce((acc, p) => acc + p.monto, 0)
      const metodoPrincipal = isMixto ? 'MIXTO' : pago1.metodo

      const res = await crearSuscripcionYOrden({
        usuario_id: usuarioId,
        plan_id: selectedPlan.id,
        monto: totalMonto,
        metodo_pago: metodoPrincipal,
        referencia: isMixto ? 'MÚLTIPLES' : (pagos_desglosados[0].referencia || ''),
        pagos_desglosados,
        responsable_id: responsableId,
        responsable_nombre: responsableNombre
      })

      if (!res.success) throw new Error(res.error)

      if (res.type === 'API_PENDING') {
        setPendingOrderId(res.ordenId)
        setIsWaitingPayment(true)
        return
      }

      toast.success('Suscripción y pago registrados exitosamente')
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  // --- RENDERS --- //
  const renderCamposDinamicos = (pago: PagoDesglosadoForm, setPago: React.Dispatch<React.SetStateAction<PagoDesglosadoForm>>, labelPrefix: string) => (
      <div className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10">
        <h3 className="text-sm font-semibold text-[#02D7E5]">{labelPrefix}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Monto ($)</label>
            <input 
              type="number" required min="0" step="0.01"
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
              value={pago.monto || ''}
              onChange={e => setPago({ ...pago, monto: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Método</label>
            <select 
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
              value={pago.metodo}
              onChange={e => setPago({ ...pago, metodo: e.target.value as MetodoPago })}
            >
              {METODOS_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        {pago.metodo === 'ZELLE' && (
          <div className="grid grid-cols-1 gap-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre Titular <span className="text-red-400">*</span></label>
                <input type="text" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.titular} onChange={e => setPago({ ...pago, titular: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Correo <span className="text-red-400">*</span></label>
                <input type="email" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.correo} onChange={e => setPago({ ...pago, correo: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia (últimos 6) <span className="text-red-400">*</span></label>
              <input type="text" required
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                value={pago.referencia} onChange={e => setPago({ ...pago, referencia: e.target.value })}
              />
            </div>
          </div>
        )}

        {(pago.metodo === 'PAGO_MOVIL' || pago.metodo === 'TRANSFERENCIA') && (
          <div className="grid grid-cols-1 gap-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Banco <span className="text-red-400">*</span></label>
                <input type="text" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.banco} onChange={e => setPago({ ...pago, banco: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Cédula / Teléfono <span className="text-red-400">*</span></label>
                <input type="text" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.titular} onChange={e => setPago({ ...pago, titular: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia (últimos 6) <span className="text-red-400">*</span></label>
              <input type="text" required
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                value={pago.referencia} onChange={e => setPago({ ...pago, referencia: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0">
        
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Asignar Plan
              </h2>
              <p className="text-sm text-zinc-400 mt-1">{usuarioNombre}</p>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isWaitingPayment ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <Loader2 className="w-16 h-16 text-[#02D7E5] animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Procesando Cobro Móvil</h3>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                    Enviando cobro a R4. Esperando pago del atleta...
                  </p>
                </div>
              </div>
            ) : step === 1 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Selecciona un Plan</h3>
                {loadingPlanes ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 text-[#02D7E5] animate-spin" />
                  </div>
                ) : planes.length === 0 ? (
                  <p className="text-zinc-500 text-center p-4">No hay planes disponibles para esta sede.</p>
                ) : (
                  <div className="grid gap-3">
                    {planes.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan)}
                        className="flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 rounded-xl transition-all group text-left"
                      >
                        <div>
                          <p className="font-bold text-white group-hover:text-[#02D7E5] transition-colors">{plan.nombre}</p>
                          <p className="text-sm text-zinc-400">{plan.frecuencia} meses</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-400">${plan.precio_usd}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form id="pago-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-zinc-900/80 rounded-xl border border-[#02D7E5]/20">
                  <div>
                    <p className="text-sm text-zinc-400">Plan Seleccionado</p>
                    <p className="font-bold text-white">{selectedPlan.nombre}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                     <p className="font-bold text-[#02D7E5] text-lg">${selectedPlan.precio_usd}</p>
                     <button type="button" onClick={() => setStep(1)} className="text-xs text-zinc-500 hover:text-white underline">Cambiar</button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-white/5">
                  <span className="text-sm font-medium text-white">Pago en múltiples métodos</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isMixto} onChange={() => setIsMixto(!isMixto)} />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#02D7E5]"></div>
                  </label>
                </div>

                {renderCamposDinamicos(pago1, setPago1, isMixto ? 'MÉTODO 1' : 'DETALLES DEL PAGO')}
                {isMixto && renderCamposDinamicos(pago2, setPago2, 'MÉTODO 2')}

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="p-6 border-t border-white/10 bg-zinc-900">
             {isWaitingPayment ? null : step === 2 ? (
               <>
                 <div className="flex justify-between items-center mb-4">
                   <span className="text-sm text-zinc-400">Total a procesar:</span>
                   <span className={`text-xl font-bold ${(pago1.monto + (isMixto ? pago2.monto : 0)) < (selectedPlan?.precio_usd || 0) ? 'text-red-400' : 'text-emerald-400'}`}>
                     ${(pago1.monto + (isMixto ? pago2.monto : 0)).toFixed(2)}
                   </span>
                 </div>
                 <div className="flex gap-3">
                   <button type="button" onClick={() => setStep(1)} disabled={loadingSubmit} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
                     Volver
                   </button>
                   <button type="submit" form="pago-form" disabled={loadingSubmit} className="flex-[2] flex items-center justify-center gap-2 py-3 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold rounded-lg transition-colors disabled:opacity-50">
                     {loadingSubmit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar y Activar'}
                   </button>
                 </div>
               </>
             ) : step === 1 ? (
               <button type="button" onClick={onClose} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors">
                 Cancelar
               </button>
             ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
