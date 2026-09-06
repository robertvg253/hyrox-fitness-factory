export default function DashboardPage() {
  return (
    <div className="p-8">
      <header className="mb-8">
        {/* Título Destacado en Bold + Italic */}
        <h1 className="text-3xl font-bold italic text-white">
          Dashboard General
        </h1>
        <p className="text-gray-400 mt-2 font-normal">
          Bienvenido al panel administrativo de Fitness Factory.
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-glass-bg border border-glass-border rounded-xl p-6 backdrop-blur-sm">
          {/* Título Estándar en Bold */}
          <h2 className="text-xl font-bold text-white mb-2">
            Estado del Sistema
          </h2>
          <p className="text-gray-300 font-normal">
            La infraestructura visual global "Floating Glass Canvas" y la tipografía Rubik han sido integradas con éxito.
          </p>
        </div>
      </div>
    </div>
  )
}
