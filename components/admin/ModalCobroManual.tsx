'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/src/utils/supabase/client'
import { MetodoPago } from '@/src/types'

interface ModalCobroManualProps {
  isOpen: boolean;
  onClose: () => void;
  suscripcionId: string;
  precioPlan: number;
  onSuccess: () => void;
}

interface PagoDesglosadoForm {
  metodo: MetodoPago;
  monto: number;
  titular: string;
  correo: string;
  banco: string;
  referencia: string;
}

const METODOS_OPCIONES: { value: MetodoPago, label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'PUNTO_DE_VENTA', label: 'Punto de Venta' },
];

export default function ModalCobroManual({ isOpen, onClose, suscripcionId, precioPlan, onSuccess }: ModalCobroManualProps) {
  const [isMixto, setIsMixto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPago: PagoDesglosadoForm = { metodo: 'EFECTIVO', monto: precioPlan, titular: '', correo: '', banco: '', referencia: '' };
  
  const [pago1, setPago1] = useState<PagoDesglosadoForm>(defaultPago);
  const [pago2, setPago2] = useState<PagoDesglosadoForm>({ ...defaultPago, monto: 0 });

  useEffect(() => {
    if (isOpen) {
      setPago1({ ...defaultPago, monto: precioPlan });
      setPago2({ ...defaultPago, monto: 0 });
      setIsMixto(false);
      setError(null);
    }
  }, [isOpen, precioPlan]);

  if (!isOpen) return null;

  const handleValidacion = () => {
    const total = pago1.monto + (isMixto ? pago2.monto : 0);
    if (total < precioPlan) {
      throw new Error(`El monto total ($${total}) no puede ser menor al precio del plan ($${precioPlan}).`);
    }

    const validarCampos = (p: PagoDesglosadoForm, index: number) => {
      if (p.metodo === 'ZELLE') {
        if (!p.titular.trim()) throw new Error(`[Pago ${index}] El Nombre Titular es obligatorio para Zelle.`);
        if (!p.correo.trim()) throw new Error(`[Pago ${index}] El Correo es obligatorio para Zelle.`);
        if (!p.referencia.trim()) throw new Error(`[Pago ${index}] La referencia es obligatoria para Zelle.`);
      }
      if (p.metodo === 'PAGO_MOVIL' || p.metodo === 'TRANSFERENCIA') {
        if (!p.banco.trim()) throw new Error(`[Pago ${index}] El Banco es obligatorio.`);
        if (!p.titular.trim()) throw new Error(`[Pago ${index}] Cédula/Teléfono es obligatorio.`);
        if (!p.referencia.trim()) throw new Error(`[Pago ${index}] La referencia es obligatoria.`);
      }
    };

    validarCampos(pago1, 1);
    if (isMixto) {
      if (pago2.monto <= 0) throw new Error("El monto del Método 2 debe ser mayor a 0.");
      validarCampos(pago2, 2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const responsableId = session?.user?.id || 'sin-id';
      const responsableNombre = session?.user?.user_metadata?.name || session?.user?.email || 'Usuario Desconocido';

      handleValidacion();

      const pagos_desglosados = [];
      
      const cleanPago = (p: PagoDesglosadoForm) => ({
        metodo: p.metodo,
        monto: p.monto,
        titular: p.titular.trim() || undefined,
        correo: p.correo.trim() || undefined,
        banco: p.banco.trim() || undefined,
        referencia: p.referencia.trim() || undefined,
      });

      pagos_desglosados.push(cleanPago(pago1));
      if (isMixto) {
        pagos_desglosados.push(cleanPago(pago2));
      }

      const totalMonto = pagos_desglosados.reduce((acc, p) => acc + p.monto, 0);
      const metodoPrincipal = isMixto ? 'MIXTO' : pago1.metodo;

      const payload = {
        suscripcion_id: suscripcionId,
        monto: totalMonto,
        metodo_pago: metodoPrincipal,
        referencia: isMixto ? 'MÚLTIPLES' : pagos_desglosados[0].referencia,
        pagos_desglosados: pagos_desglosados,
        responsable_id: responsableId,
        responsable_nombre: responsableNombre
      };

      const res = await fetch('/api/finanzas/cobro-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar el pago.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCamposDinamicos = (
    pago: PagoDesglosadoForm, 
    setPago: React.Dispatch<React.SetStateAction<PagoDesglosadoForm>>,
    labelPrefix: string
  ) => {
    return (
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
              {METODOS_OPCIONES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0">
        
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Renovación Manual</h2>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <p className="text-sm text-zinc-400 mt-1">Precio sugerido: <span className="text-white font-medium">${precioPlan}</span></p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <form id="pago-form" onSubmit={handleSubmit} className="space-y-6">
              
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
          </div>

          <div className="p-6 border-t border-white/10 bg-zinc-900">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-zinc-400">Total a procesar:</span>
              <span className={`text-xl font-bold ${(pago1.monto + (isMixto ? pago2.monto : 0)) < precioPlan ? 'text-red-400' : 'text-emerald-400'}`}>
                ${(pago1.monto + (isMixto ? pago2.monto : 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button" onClick={onClose} disabled={loading}
                className="flex-1 py-3 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit" form="pago-form" disabled={loading}
                className="flex-1 py-3 bg-[#02D7E5] hover:bg-[#02a9b4] text-black text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
