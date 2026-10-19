'use client'

import { formatCaracasDate } from '@/src/utils/timezone'
import { Info, X } from 'lucide-react'

interface ModalDetallesOrdenProps {
  isOpen: boolean
  onClose: () => void
  orden: any
}

export default function ModalDetallesOrden({ isOpen, onClose, orden }: ModalDetallesOrdenProps) {
  if (!isOpen || !orden) return null

  const metadata = orden.metadata || {}
  const desglosados = metadata.pagos_desglosados || []
  const isMixto = metadata.metodo_pago === 'MIXTO'
  const isManual = metadata.provider === 'MANUAL'
  const isR4 = !isManual || orden.r4_transaction_id

  const formatStatus = (status: string) => {
    switch(status) {
      case 'PENDIENTE': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'POR_CONCILIAR': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'APROBADO': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'ENVIADO': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'RECHAZADO': case 'ERROR': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      default: return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0">
        
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-[#02D7E5]" />
              Detalles de la Orden
            </h2>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            
            {/* Sección 1: Información General */}
            <div className="bg-black/30 rounded-xl p-5 border border-zinc-800/50">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#02D7E5]"></span>
                Información General
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs text-zinc-500 mb-1">ID de Orden</dt>
                  <dd className="text-zinc-300 font-mono text-xs">{orden.id.split('-')[0]}...</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 mb-1">Estado</dt>
                  <dd>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${formatStatus(orden.estado)}`}>
                      {orden.estado}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 mb-1">Fecha de Creación</dt>
                  <dd className="text-zinc-300 font-medium">
                    {new Date(orden.created_at).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 mb-1">Monto Total</dt>
                  <dd className="text-white font-bold">${orden.monto} {orden.moneda}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500 mb-1">Origen / Provider</dt>
                  <dd className="text-zinc-300 font-medium">{isManual ? 'Recepción (Manual)' : 'Pasarela R4'}</dd>
                </div>
              </dl>
            </div>

            {/* Sección 2: Origen de los Fondos */}
            <div className="bg-black/30 rounded-xl p-5 border border-zinc-800/50">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Origen de los Fondos
              </h3>
              
              {isR4 ? (
                <dl className="grid grid-cols-1 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500 mb-1">R4 Transaction ID</dt>
                    <dd className="text-zinc-300 font-mono">{orden.r4_transaction_id || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 mb-1">R4 Bank Reference</dt>
                    <dd className="text-zinc-300 font-mono">{orden.r4_bank_reference || metadata.r4_raw?.bank_reference || 'N/A'}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    <div>
                      <dt className="text-xs text-zinc-500 mb-1">Creado en Recepción por</dt>
                      <dd className="text-zinc-300 font-medium">{metadata.responsable_nombre || metadata.responsable_id || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500 mb-1">Método Principal</dt>
                      <dd className="text-[#02D7E5] font-bold">{metadata.metodo_pago}</dd>
                    </div>
                  </dl>

                  {/* Desglose Manual */}
                  {desglosados.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {desglosados.map((pago: any, idx: number) => (
                        <div key={idx} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50 text-sm">
                          <div className="font-medium text-white mb-2 pb-2 border-b border-zinc-700/50 flex justify-between">
                            <span>{isMixto ? `Método ${idx + 1}: ${pago.metodo}` : pago.metodo}</span>
                            <span className="text-[#02D7E5]">${pago.monto}</span>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-zinc-400 text-xs">
                            {pago.titular && <div><dt className="text-zinc-500">Titular/Doc:</dt> <dd className="text-zinc-300">{pago.titular}</dd></div>}
                            {pago.correo && <div><dt className="text-zinc-500">Correo:</dt> <dd className="text-zinc-300">{pago.correo}</dd></div>}
                            {pago.banco && <div><dt className="text-zinc-500">Banco:</dt> <dd className="text-zinc-300">{pago.banco}</dd></div>}
                            {pago.referencia && <div className="col-span-2"><dt className="text-zinc-500">Ref:</dt> <dd className="text-zinc-300 font-mono">{pago.referencia}</dd></div>}
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50 text-sm mt-4">
                      <dl className="grid grid-cols-2 gap-3 text-zinc-400 text-xs">
                        <div><dt className="text-zinc-500 mb-0.5">Referencia</dt> <dd className="text-zinc-300 font-mono">{metadata.referencia || 'N/A'}</dd></div>
                      </dl>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sección Comprobante Adjunto (Condicional) */}
            {metadata.comprobante_url && (
              <div className="bg-black/30 rounded-xl p-5 border border-zinc-800/50">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#02D7E5]"></span>
                  Comprobante Adjunto
                </h3>
                <div className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center p-2 min-h-[150px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={metadata.comprobante_url} 
                    alt="Comprobante de pago" 
                    className="max-h-[300px] w-auto object-contain rounded-md"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <a 
                    href={metadata.comprobante_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[10px] font-bold uppercase tracking-wider text-[#02D7E5] hover:text-[#02D7E5]/80 transition-colors flex items-center gap-1"
                  >
                    Abrir en pestaña nueva ↗
                  </a>
                </div>
              </div>
            )}

            {/* Sección 3: Auditoría de Conciliación (Condicional) */}
            {(metadata.conciliado_por_nombre || metadata.rechazado_por_nombre || metadata.fecha_corte_anterior) && (
              <div className="bg-black/30 rounded-xl p-5 border border-zinc-800/50">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  Auditoría de Conciliación
                </h3>
                <dl className="grid grid-cols-1 gap-y-4 text-sm">
                  {metadata.conciliado_por_nombre && (
                    <div>
                      <dt className="text-xs text-zinc-500 mb-1">Aprobado / Conciliado por</dt>
                      <dd className="text-emerald-400 font-medium">{metadata.conciliado_por_nombre}</dd>
                    </div>
                  )}
                  {metadata.rechazado_por_nombre && (
                    <div>
                      <dt className="text-xs text-zinc-500 mb-1">Rechazado por</dt>
                      <dd className="text-red-400 font-medium">{metadata.rechazado_por_nombre}</dd>
                    </div>
                  )}
                  {metadata.fecha_corte_anterior && (
                    <div>
                      <dt className="text-xs text-zinc-500 mb-1">Fecha de Corte Anterior (Registro Histórico)</dt>
                      <dd className="text-zinc-300 font-medium">{formatCaracasDate(metadata.fecha_corte_anterior)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Sección 4: Auditoría de Anulación (Condicional) */}
            {metadata.anulacion && (
              <div className="bg-red-500/5 rounded-xl p-5 border border-red-500/20">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  Auditoría de Anulación
                </h3>
                <dl className="grid grid-cols-1 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs text-red-400/70 mb-1">Anulado por</dt>
                    <dd className="text-white font-medium">{metadata.anulacion.responsable_nombre} <span className="text-zinc-400 font-normal">({metadata.anulacion.responsable_email})</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-red-400/70 mb-1">Fecha</dt>
                    <dd className="text-zinc-300 font-medium">{new Date(metadata.anulacion.fecha).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-red-400/70 mb-1">Motivo</dt>
                    <dd className="text-zinc-300 italic">"{metadata.anulacion.motivo}"</dd>
                  </div>
                </dl>
              </div>
            )}

          </div>

          <div className="p-6 border-t border-white/10 bg-zinc-900">
             <button onClick={onClose} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-lg transition-colors">
               Cerrar Panel
             </button>
          </div>
        </div>
      </div>
    </>
  )
}
