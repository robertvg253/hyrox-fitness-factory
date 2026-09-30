'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/utils/supabase/client'
import { Loader2, PlusCircle, X } from 'lucide-react'
import { asignarPlan } from '@/app/admin/(protected)/usuarios/actions'
import { FormularioCobroUI, PagoDesglosadoForm } from './FormularioCobroUI'

interface ModalAsignarPlanProps {
  isOpen: boolean;
  onClose: () => void;
  usuarioId: string;
  usuarioNombre: string;
  sedeId: string | null;
  onSuccess: () => void;
}

export default function ModalAsignarPlan({ isOpen, onClose, usuarioId, usuarioNombre, sedeId, onSuccess }: ModalAsignarPlanProps) {
  const [planes, setPlanes] = useState<any[]>([])
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2 state
  const defaultPago: PagoDesglosadoForm = { metodo: 'EFECTIVO', monto: 0, titular: '', correo: '', banco: '', referencia: '' };
  const [isMixto, setIsMixto] = useState(false);
  const [pago1, setPago1] = useState<PagoDesglosadoForm>(defaultPago);
  const [pago2, setPago2] = useState<PagoDesglosadoForm>({ ...defaultPago, monto: 0 });

  useEffect(() => {
    if (isOpen) {
      loadPlanes()
      setSelectedPlan('')
      setError(null)
      setStep(1)
      setIsMixto(false)
      setPago1(defaultPago)
      setPago2({ ...defaultPago, monto: 0 })
    }
  }, [isOpen])

  const loadPlanes = async () => {
    setLoadingPlanes(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('planes')
        .select('id, nombre, precio_usd, tipo, sesiones_total, sedes')
        .eq('estado', 'ACTIVO')
        .gt('precio_usd', 0)
        .order('precio_usd', { ascending: true })
      
      if (error) throw error
      
      // Filtrar por sede (opcional si son globales)
      const planesFiltrados = (data || []).filter(p => {
        if (!p.sedes || p.sedes.length === 0) return true
        if (sedeId && p.sedes.includes(sedeId)) return true
        return false
      })

      setPlanes(planesFiltrados)
    } catch (err: any) {
      console.error(err)
      setError('Error al cargar catálogo de planes.')
    } finally {
      setLoadingPlanes(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan) {
      setError('Debes seleccionar un plan.')
      return
    }

    if (step === 1) {
      const planElegido = planes.find(p => p.id === selectedPlan)
      if (planElegido) {
        setPago1({ ...defaultPago, monto: planElegido.precio_usd })
      }
      setStep(2)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const planData = planes.find(p => p.id === selectedPlan)

      // Validaciones locales antes de procesar
      const total = pago1.monto + (isMixto ? pago2.monto : 0);
      if (Math.abs(total - planData.precio_usd) > 0.01) {
        setError(`La suma de los pagos ($${total}) debe ser exactamente igual al precio del plan ($${planData.precio_usd}).`)
        setIsSubmitting(false)
        return
      }

      // 1. Asignar el Plan (Crea Suscripción INACTIVA)
      const res = await asignarPlan(usuarioId, selectedPlan, sedeId)
      if (!res.success || !res.data) {
        setError(res.error || 'Fallo interno al asignar.')
        setIsSubmitting(false)
        return
      }

      const newSubId = res.data.id

      // 2. Registrar el Cobro Manual
      const cleanPago = (p: PagoDesglosadoForm) => ({
        metodo: p.metodo,
        monto: p.monto,
        titular: p.titular.trim() || undefined,
        correo: p.correo.trim() || undefined,
        banco: p.banco.trim() || undefined,
        referencia: p.referencia.trim() || undefined,
      });

      const pagos_desglosados = [];
      pagos_desglosados.push(cleanPago(pago1));
      if (isMixto) {
        pagos_desglosados.push(cleanPago(pago2));
      }

      const metodoPrincipal = isMixto ? 'MIXTO' : pago1.metodo;

      const cobroPayload = {
        suscripcion_id: newSubId,
        monto: total,
        metodo_pago: metodoPrincipal,
        referencia: isMixto ? 'MÚLTIPLES' : pagos_desglosados[0].referencia || 'S/R',
        pagos_desglosados: pagos_desglosados,
        responsable_id: 'admin', // Podríamos extraerlo de la sesión, pero el webhook o el admin-endpoint lo manejará
        responsable_nombre: 'Administrador'
      }

      const cobroRes = await fetch('/api/finanzas/cobro-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cobroPayload)
      })

      const cobroData = await cobroRes.json()

      if (!cobroRes.ok) {
        setError(cobroData.error || 'Plan asignado, pero falló el cobro manual.')
        // Opcionalmente no cerramos el modal para que el usuario pueda reintentar o verlo
      } else {
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      setError('Error de conexión con el servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedPlanData = planes.find(p => p.id === selectedPlan)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Asignar Plan
              </h2>
              <p className="text-sm text-zinc-400 mt-1">{usuarioNombre}</p>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-thin scrollbar-thumb-white/10">
            {step === 1 ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Selecciona un Plan Comercial</label>
                {loadingPlanes ? (
                  <div className="h-24 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {planes.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlan(p.id)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          selectedPlan === p.id 
                            ? 'bg-[#02D7E5]/10 border-[#02D7E5] shadow-[0_0_15px_rgba(2,215,229,0.15)]' 
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <h3 className={`font-bold ${selectedPlan === p.id ? 'text-[#02D7E5]' : 'text-white'}`}>
                            {p.nombre}
                          </h3>
                          <span className={`font-black ${selectedPlan === p.id ? 'text-[#02D7E5]' : 'text-white'}`}>
                            ${p.precio_usd.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {p.tipo === 'SESIONES' ? `${p.sesiones_total} Sesiones` : 'Tiempo (Mensual)'}
                        </p>
                      </button>
                    ))}
                    {planes.length === 0 && (
                      <div className="text-center p-4 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-500 text-sm">
                        No hay planes comerciales disponibles en esta sede.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <FormularioCobroUI 
                  isMixto={isMixto} 
                  setIsMixto={setIsMixto} 
                  pago1={pago1} 
                  setPago1={setPago1} 
                  pago2={pago2} 
                  setPago2={setPago2} 
                  precioPlan={selectedPlanData?.precio_usd || 0} 
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-6 mt-auto border-t border-white/10">
              {step === 2 && (
                <button
                  type="button" onClick={() => setStep(1)} disabled={isSubmitting}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Atrás
                </button>
              )}
              {step === 1 && (
                <button
                  type="button" onClick={onClose} disabled={isSubmitting}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit" disabled={isSubmitting || !selectedPlan || (step === 2 && Math.abs((pago1.monto + (isMixto ? pago2.monto : 0)) - (selectedPlanData?.precio_usd || 0)) > 0.01)}
                className={`flex-[1.5] py-3 text-black font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
                  step === 1 ? 'bg-[#02D7E5] hover:bg-[#02D7E5]/90 shadow-[#02D7E5]/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === 1 ? 'Continuar' : 'Confirmar y Cobrar')}
              </button>
            </div>
          </form>

        </div>
      </div>
    </>
  )
}
