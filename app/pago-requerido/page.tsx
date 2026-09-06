export default function PagoRequeridoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
      <div className="max-w-xl text-center space-y-8 bg-gray-900 p-12 rounded-2xl border border-red-900 shadow-2xl">
        <h1 className="text-3xl font-bold text-white tracking-tight uppercase">Acceso Denegado</h1>
        
        <p className="text-2xl font-bold text-red-500 leading-relaxed bg-red-950/30 p-6 rounded-lg border border-red-900/50">
          ESTADO: INACTIVO. Tu suscripción ha vencido. Realiza el pago para desbloquear el acceso.
        </p>

        <div className="pt-6">
          <button className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-colors text-lg">
            Proceder al Pago
          </button>
        </div>
      </div>
    </div>
  )
}
