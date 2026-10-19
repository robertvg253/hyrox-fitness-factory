'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Smartphone, Building2, Wallet, CheckCircle2, AlertCircle, Camera, Clock } from 'lucide-react'
import { createClient } from '@/src/utils/supabase/client'

export default function CheckoutClient({ plan, user, metodosPago, ordenPrevia }: { plan: any, user: any, metodosPago?: any, ordenPrevia?: any }) {
  const router = useRouter()
  const supabase = createClient()
  
  type CheckoutStep = 'SELECCION' | 'RESUMEN' | 'ENVIANDO' | 'STANDBY' | 'EXITO' | 'ERROR' | 'INFO_MANUAL' | 'FORM_MANUAL' | 'ENVIANDO_MANUAL' | 'EXITO_MANUAL'

  const getInitialStep = (): CheckoutStep => {
    if (!ordenPrevia) return 'SELECCION';
    switch (ordenPrevia.estado) {
      case 'POR_CONCILIAR':
      case 'PENDIENTE':
        return 'EXITO_MANUAL';
      case 'PAGADA':
      case 'APROBADA':
      case 'ACTIVO':
        return 'EXITO';
      case 'RECHAZADA':
      case 'ANULADA':
      case 'ERROR':
        return 'ERROR';
      default:
        return 'SELECCION';
    }
  }

  const [step, setStep] = useState<CheckoutStep>(getInitialStep())
  const [metodo, setMetodo] = useState<'COBRO_MOVIL' | 'ZELLE' | 'PAGO_MOVIL' | ''>('')
  const [ordenId, setOrdenId] = useState<string | null>(ordenPrevia?.id || null)
  const [errorMsg, setErrorMsg] = useState(ordenPrevia?.estado === 'RECHAZADA' || ordenPrevia?.estado === 'ANULADA' ? 'Tu pago fue rechazado. Intenta de nuevo.' : '')

  // Form states manual
  const [nombreTitular, setNombreTitular] = useState('')
  const [correoZelle, setCorreoZelle] = useState('')
  const [referencia, setReferencia] = useState('')
  const [telefonoOrigen, setTelefonoOrigen] = useState('')
  const [bancoOrigen, setBancoOrigen] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [isCargandoArchivo, setIsCargandoArchivo] = useState(false)

  // Efecto de Realtime para STANDBY
  useEffect(() => {
    if (step === 'STANDBY' && ordenId) {
      const channel = supabase
        .channel(`orden_${ordenId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ordenes_cobro',
            filter: `id=eq.${ordenId}`
          },
          (payload) => {
            const newEstado = payload.new.estado
            if (newEstado === 'PAGADA' || newEstado === 'POR_CONCILIAR') {
              setStep('EXITO')
            } else if (newEstado === 'ERROR' || newEstado === 'RECHAZADO') {
              setErrorMsg('El pago fue rechazado o hubo un error.')
              setStep('ERROR')
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [step, ordenId, supabase])

  const handleSelectMetodo = (m: 'COBRO_MOVIL' | 'ZELLE' | 'PAGO_MOVIL') => {
    setMetodo(m)
    if (m === 'COBRO_MOVIL') {
      setStep('RESUMEN')
    } else {
      setStep('INFO_MANUAL')
    }
  }

  const handleEnviarCobro = async () => {
    setStep('ENVIANDO')
    setErrorMsg('')
    
    try {
      // Formatear payload para la API (usando usuario_id y plan_id explícitamente como en la Fase 14.1)
      const payload = {
        usuario_id: user.id,
        plan_id: plan.id,
        monto: plan.precio_usd,
        metodo_pago: 'COBRO_MOVIL',
        referencia: 'S/R',
        pagos_desglosados: [
          {
            metodo: 'COBRO_MOVIL',
            monto: plan.precio_usd,
            referencia: 'S/R',
          }
        ],
        responsable_id: user.id,
        responsable_nombre: user.nombre_completo,
      }

      const res = await fetch('/api/finanzas/cobro-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Fallo al procesar el pago')
      }

      if (data.orden_id) {
        setOrdenId(data.orden_id)
        setStep('STANDBY')
      } else {
        throw new Error('No se recibió el ID de la orden')
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión')
      setStep('ERROR')
    }
  }

  const handleEnviarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep('ENVIANDO_MANUAL')
    setErrorMsg('')
    
    try {
      const formData = new FormData()
      formData.append('usuario_id', user.id)
      formData.append('plan_id', plan.id)
      formData.append('monto', plan.precio_usd.toString())
      formData.append('metodo_pago', metodo)
      formData.append('responsable_id', user.id)
      formData.append('responsable_nombre', user.nombre_completo)
      formData.append('origin', 'self-service')
      
      const refFinal = metodo === 'ZELLE' ? (correoZelle || 'S/R') : referencia
      formData.append('referencia', refFinal)
      
      const desglosado = {
        metodo,
        monto: plan.precio_usd,
        referencia: refFinal,
        banco: metodo === 'PAGO_MOVIL' ? bancoOrigen : undefined,
        titular: metodo === 'ZELLE' ? nombreTitular : undefined,
        telefono: metodo === 'PAGO_MOVIL' ? telefonoOrigen : undefined
      }
      formData.append('pagos_desglosados', JSON.stringify([desglosado]))

      if (archivo) {
        formData.append('comprobante', archivo)
      }

      // El endpoint debe estar preparado para recibir FormData o se adaptará en la siguiente fase.
      // Si el backend no soporta FormData todavía, fallará gracefully.
      const res = await fetch('/api/finanzas/cobro-manual', {
        method: 'POST',
        body: formData // No seteamos Content-Type, el navegador lo hace (multipart/form-data con boundary)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Error al reportar pago manual')
      }

      setStep('EXITO_MANUAL')

    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión')
      setStep('ERROR')
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center mb-8 relative">
        {(step === 'SELECCION' || step === 'RESUMEN' || step === 'ERROR' || step === 'INFO_MANUAL' || step === 'FORM_MANUAL') && (
          <button 
            onClick={() => step === 'SELECCION' ? router.push('/dashboard/suscripcion/nueva') : setStep('SELECCION')}
            className="absolute left-0 p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-xl font-bold text-center w-full">
          {step === 'SELECCION' ? 'Método de Pago' : 
           (step === 'RESUMEN' || step === 'INFO_MANUAL' || step === 'FORM_MANUAL') ? 'Reportar Pago' : 
           step === 'STANDBY' ? 'Esperando Pago' :
           (step === 'EXITO' || step === 'EXITO_MANUAL') ? '¡Pago Exitoso!' : 'Procesando Pago'}
        </h1>
      </header>

      <div className="max-w-md mx-auto">
        {step === 'SELECCION' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Opciones de Pago */}
            <div 
              onClick={() => handleSelectMetodo('COBRO_MOVIL')}
              className="bg-zinc-900 border border-[#02D7E5]/50 hover:bg-zinc-800 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-[#02D7E5] text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                Recomendado
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#02D7E5]/20 flex items-center justify-center text-[#02D7E5]">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Cobro Móvil Automático</h3>
                  <p className="text-xs text-zinc-400">Descuento automático de tu cuenta</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => handleSelectMetodo('ZELLE')}
              className="bg-zinc-900 border border-zinc-800 hover:border-[#02D7E5]/50 hover:bg-zinc-800 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-[#02D7E5]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Zelle</h3>
                  <p className="text-xs text-zinc-400">Transferencia en USD</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => handleSelectMetodo('PAGO_MOVIL')}
              className="bg-zinc-900 border border-zinc-800 hover:border-[#02D7E5]/50 hover:bg-zinc-800 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-[#02D7E5]">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Pago Móvil Tradicional</h3>
                  <p className="text-xs text-zinc-400">Reporte manual con recibo</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESUMEN' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <span className="text-zinc-400">Plan</span>
                <span className="font-bold text-white uppercase">{plan.nombre}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <span className="text-zinc-400">Monto a pagar</span>
                <span className="font-black text-[#02D7E5] text-xl">${plan.precio_usd}</span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-zinc-400">Teléfono Afiliado</span>
                <span className="font-medium text-white">{user.telefono || 'No registrado'}</span>
              </div>
              {!user.telefono && (
                <p className="text-xs text-red-400 text-right">Debes tener un teléfono registrado para este método.</p>
              )}
            </div>
            
            <button
              onClick={handleEnviarCobro}
              disabled={!user.telefono}
              className="w-full py-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)] disabled:opacity-50"
            >
              Enviar cobro automático
            </button>
          </div>
        )}

        {step === 'INFO_MANUAL' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                Datos para {metodo === 'ZELLE' ? 'Zelle' : 'Pago Móvil'}
              </h2>
              {metodo === 'ZELLE' ? (
                <>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">Correo</span>
                    <span className="font-medium text-white select-all">
                      {metodosPago?.zelle?.correo || 'No configurado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-zinc-400">Titular</span>
                    <span className="font-medium text-white">
                      {metodosPago?.zelle?.titular || 'No configurado'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">Teléfono</span>
                    <span className="font-medium text-white select-all">
                      {metodosPago?.pago_movil?.telefono || 'No configurado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">RIF</span>
                    <span className="font-medium text-white select-all">
                      {metodosPago?.pago_movil?.cedula || 'No configurado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-zinc-400">Banco</span>
                    <span className="font-medium text-white">
                      {metodosPago?.pago_movil?.banco || 'No configurado'}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center border-t border-zinc-800 pt-4 mt-4">
                <span className="text-zinc-400">Monto a pagar</span>
                <span className="font-black text-[#02D7E5] text-xl">${plan.precio_usd}</span>
              </div>
            </div>
            
            <button
              onClick={() => setStep('FORM_MANUAL')}
              className="w-full py-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)]"
            >
              Ya transferí, registrar pago
            </button>
          </div>
        )}

        {step === 'FORM_MANUAL' && (
          <form onSubmit={handleEnviarManual} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white mb-2">Detalles del Pago</h2>
              
              {metodo === 'ZELLE' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Nombre del Titular (Zelle)</label>
                    <input 
                      type="text" 
                      required
                      value={nombreTitular}
                      onChange={e => setNombreTitular(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#02D7E5]"
                      placeholder="Ej. Juan Perez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Correo Zelle de Origen</label>
                    <input 
                      type="email" 
                      required
                      value={correoZelle}
                      onChange={e => setCorreoZelle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#02D7E5]"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Referencia (Últimos 4 o 6 dígitos)</label>
                    <input 
                      type="text" 
                      required
                      value={referencia}
                      onChange={e => setReferencia(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#02D7E5]"
                      placeholder="1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Teléfono de Origen</label>
                    <input 
                      type="text" 
                      required
                      value={telefonoOrigen}
                      onChange={e => setTelefonoOrigen(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#02D7E5]"
                      placeholder="0414-1234567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Banco de Origen</label>
                    <input 
                      type="text" 
                      required
                      value={bancoOrigen}
                      onChange={e => setBancoOrigen(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#02D7E5]"
                      placeholder="Banesco"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Captura de Pantalla</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    required
                    onChange={e => {
                      const file = e.target.files?.[0] || null
                      if (file) {
                        setIsCargandoArchivo(true)
                        setTimeout(() => {
                          setArchivo(file)
                          setIsCargandoArchivo(false)
                        }, 500)
                      } else {
                        setArchivo(null)
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  <div className={`w-full bg-zinc-950 border transition-all rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-2 ${
                    isCargandoArchivo 
                      ? 'border-[#02D7E5]/50 shadow-[0_0_15px_rgba(2,215,229,0.2)]'
                      : archivo 
                        ? 'border-solid border-[#02D7E5] bg-[#02D7E5]/5' 
                        : 'border-dashed border-zinc-800 hover:border-zinc-700'
                  }`}>
                    {isCargandoArchivo ? (
                      <Loader2 className="w-8 h-8 text-[#02D7E5] animate-spin" />
                    ) : archivo ? (
                      <CheckCircle2 className="w-8 h-8 text-[#02D7E5]" />
                    ) : (
                      <Camera className="w-8 h-8 text-zinc-500" />
                    )}
                    
                    <span className={`text-sm font-medium ${archivo && !isCargandoArchivo ? 'text-white' : 'text-zinc-400'}`}>
                      {isCargandoArchivo ? 'Procesando...' : archivo ? archivo.name : 'Toca para subir la captura'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)]"
            >
              Reportar Pago
            </button>
          </form>
        )}

        {(step === 'ENVIANDO' || step === 'ENVIANDO_MANUAL') && (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 animate-in fade-in duration-300">
            <Loader2 className="w-12 h-12 text-[#02D7E5] animate-spin" />
            <p className="text-lg font-bold text-white">Enviando solicitud...</p>
            <p className="text-zinc-400 text-sm">Conectando de forma segura.</p>
          </div>
        )}

        {step === 'STANDBY' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#02D7E5]/10 flex items-center justify-center border-4 border-dashed border-[#02D7E5] animate-[spin_4s_linear_infinite]" />
              <Smartphone className="w-8 h-8 text-[#02D7E5] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Solicitud Enviada</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Revisa el <span className="font-bold text-white">WhatsApp</span> en tu teléfono celular para confirmar y completar el pago.
              </p>
              <p className="text-xs text-zinc-500 mt-4">
                Esta pantalla se actualizará automáticamente.
              </p>
              
              <button 
                onClick={() => setStep('SELECCION')}
                className="mt-6 text-sm text-zinc-400 hover:text-white underline decoration-zinc-600 transition-colors"
              >
                ¿No te llegó el mensaje? Probar otro método
              </button>
            </div>
          </div>
        )}

        {step === 'EXITO' && (
          <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500 mt-10">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-black text-white">Pago Verificado</h2>
            <p className="text-zinc-400">Tu suscripción está activa. ¡Listo para entrenar!</p>
            
            <button
              onClick={() => router.push('/dashboard/reservas')}
              className="w-full mt-6 py-4 bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(2,215,229,0.3)]"
            >
              Ir a mis reservas
            </button>
          </div>
        )}

        {step === 'EXITO_MANUAL' && (
          <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500 mt-10">
            <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mb-2">
              <Clock className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-3xl font-black text-white">Esperando Confirmación</h2>
            <p className="text-zinc-400">Tu pago está siendo validado por nuestro equipo.</p>
            
            <button
              onClick={() => router.push('/dashboard/reservas')}
              className="w-full mt-6 py-4 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
            >
              Ir a mis reservas
            </button>
          </div>
        )}

        {step === 'ERROR' && (
          <div className="bg-red-950/30 border border-red-500/50 rounded-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Pago Rechazado</h2>
              <p className="text-zinc-400 text-sm">
                {errorMsg || 'Hubo un problema al verificar tu pago. Por favor, intenta nuevamente.'}
              </p>
            </div>
            <div className="w-full space-y-3 mt-4">
              <button
                onClick={() => {
                  setOrdenId(null)
                  setStep('SELECCION')
                }}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
              >
                Intentar de nuevo
              </button>
              <button
                className="w-full py-3 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl transition-all"
              >
                Contactar soporte
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
