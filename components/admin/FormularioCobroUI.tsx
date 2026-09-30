import { MetodoPago } from '@/src/types'

export interface PagoDesglosadoForm {
  metodo: MetodoPago;
  monto: number;
  titular: string;
  correo: string;
  banco: string;
  referencia: string;
}

const METODOS_OPCIONES: { value: MetodoPago, label: string }[] = [
  { value: 'COBRO_MOVIL', label: 'Cobro Móvil (R4 Automático)' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil (Manual)' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'PUNTO_DE_VENTA', label: 'Punto de Venta' },
];

interface FormularioCobroUIProps {
  isMixto: boolean;
  setIsMixto: (val: boolean) => void;
  pago1: PagoDesglosadoForm;
  setPago1: React.Dispatch<React.SetStateAction<PagoDesglosadoForm>>;
  pago2: PagoDesglosadoForm;
  setPago2: React.Dispatch<React.SetStateAction<PagoDesglosadoForm>>;
  precioPlan: number;
}

export function FormularioCobroUI({ isMixto, setIsMixto, pago1, setPago1, pago2, setPago2, precioPlan }: FormularioCobroUIProps) {
  const renderCamposDinamicos = (
    pago: PagoDesglosadoForm, 
    setPago: React.Dispatch<React.SetStateAction<PagoDesglosadoForm>>,
    labelPrefix: string,
    isMontoLocked: boolean
  ) => {
    return (
      <div className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10">
        <h3 className="text-sm font-semibold text-[#02D7E5]">{labelPrefix}</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Monto ($)</label>
            <input 
              type="number" required min="0.01" step="0.01"
              disabled={isMontoLocked}
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5] disabled:opacity-50 disabled:cursor-not-allowed"
              value={pago.monto || ''}
              onChange={e => setPago(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Método</label>
            <select 
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
              value={pago.metodo}
              onChange={e => setPago(prev => ({ ...prev, metodo: e.target.value as MetodoPago }))}
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
                  value={pago.titular} onChange={e => setPago(prev => ({ ...prev, titular: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Correo <span className="text-red-400">*</span></label>
                <input type="email" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.correo} onChange={e => setPago(prev => ({ ...prev, correo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia (últimos 6) <span className="text-red-400">*</span></label>
              <input type="text" required
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                value={pago.referencia} onChange={e => setPago(prev => ({ ...prev, referencia: e.target.value }))}
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
                  value={pago.banco} onChange={e => setPago(prev => ({ ...prev, banco: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Cédula / Teléfono <span className="text-red-400">*</span></label>
                <input type="text" required
                  className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                  value={pago.titular} onChange={e => setPago(prev => ({ ...prev, titular: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia (últimos 6) <span className="text-red-400">*</span></label>
              <input type="text" required
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
                value={pago.referencia} onChange={e => setPago(prev => ({ ...prev, referencia: e.target.value }))}
              />
            </div>
          </div>
        )}

        {(pago.metodo === 'PUNTO_DE_VENTA') && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-zinc-400 mb-1">Número de Lote / Recibo <span className="text-red-400">*</span></label>
            <input type="text" required
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg p-2 focus:ring-[#02D7E5] focus:border-[#02D7E5]"
              value={pago.referencia} onChange={e => setPago(prev => ({ ...prev, referencia: e.target.value }))}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white">Pago en Múltiples Métodos</h3>
          <p className="text-xs text-zinc-400">Permite registrar una parte en efectivo y otra en digital.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isMixto}
          onClick={() => {
            setIsMixto(!isMixto);
            if (!isMixto) {
              setPago1(prev => ({ ...prev, monto: precioPlan }));
              setPago2(prev => ({ ...prev, monto: 0 }));
            }
          }}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMixto ? 'bg-[#02D7E5]' : 'bg-zinc-700'}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMixto ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="space-y-4">
        {renderCamposDinamicos(pago1, setPago1, isMixto ? "MÉTODO 1 (Principal)" : "DETALLES DEL PAGO", false)}
        {isMixto && renderCamposDinamicos(pago2, setPago2, "MÉTODO 2", false)}
      </div>

      <div className="bg-black/30 p-4 rounded-xl border border-white/10 flex justify-between items-center mt-6">
        <span className="text-sm font-medium text-zinc-400">Total a procesar:</span>
        <span className={`text-xl font-black ${Math.abs((pago1.monto + (isMixto ? pago2.monto : 0)) - precioPlan) > 0.01 ? 'text-red-400' : 'text-[#02D7E5]'}`}>
          ${(pago1.monto + (isMixto ? pago2.monto : 0)).toFixed(2)}
        </span>
      </div>
    </div>
  )
}
