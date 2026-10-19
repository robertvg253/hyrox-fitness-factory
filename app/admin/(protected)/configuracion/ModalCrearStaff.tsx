'use client'

import { useState } from 'react'
import { X, Loader2, UserPlus, Shield, Building, Mail, Lock, CreditCard } from 'lucide-react'
import { crearMiembroStaff } from './actions'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  sedes: { id: string; nombre: string }[]
  onSuccess: () => void
}

export default function ModalCrearStaff({ isOpen, onClose, sedes, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [cedulaTipo, setCedulaTipo] = useState('V')
  const [cedulaNum, setCedulaNum] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<'RECEPCIONISTA' | 'GERENTE_SEDE' | 'GERENTE'>('RECEPCIONISTA')
  const [sedeId, setSedeId] = useState(sedes[0]?.id || '')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre.trim() || !apellido.trim() || !cedulaNum.trim() || !email.trim() || !password || !sedeId) {
      return toast.error('Por favor completa todos los campos requeridos.')
    }

    if (password.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres.')
    }

    setLoading(true)
    try {
      const fullCedula = `${cedulaTipo}${cedulaNum.trim().replace(/\D/g, '')}`
      const res = await crearMiembroStaff({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cedula: fullCedula,
        email: email.trim().toLowerCase(),
        password,
        rol,
        sedeId
      })

      if (res.success) {
        toast.success('Miembro del staff creado exitosamente.')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error || 'Error al crear miembro del staff.')
      }
    } catch {
      toast.error('Error inesperado de conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0e0e11] border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow decorativo sutil */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#02D7E5]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#02D7E5]/10 border border-[#02D7E5]/20 text-[#02D7E5]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Nuevo Miembro del Staff</h2>
              <p className="text-xs text-gray-400 mt-0.5">Asigna credenciales y permisos por sede</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre y Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Nombre
              </label>
              <input
                required
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Ana"
                disabled={loading}
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Apellido
              </label>
              <input
                required
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Ej. Mendoza"
                disabled={loading}
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
              />
            </div>
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Cédula / RIF
            </label>
            <div className="flex gap-2">
              <select
                value={cedulaTipo}
                onChange={(e) => setCedulaTipo(e.target.value)}
                disabled={loading}
                className="w-[80px] bg-black/40 border border-white/10 text-white text-sm rounded-xl px-3 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors appearance-none text-center cursor-pointer font-bold"
              >
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="J">J</option>
                <option value="G">G</option>
              </select>
              <input
                required
                type="text"
                value={cedulaNum}
                onChange={(e) => setCedulaNum(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                disabled={loading}
                className="flex-1 bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
              />
            </div>
          </div>

          {/* Email Real */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#02D7E5]" /> Correo Electrónico Real
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana.mendoza@fitnessfactory.com"
              disabled={loading}
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#02D7E5]" /> Contraseña de Acceso
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              disabled={loading}
              className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors"
            />
          </div>

          {/* Rol y Sede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#02D7E5]" /> Rol en Sistema
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as any)}
                disabled={loading}
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors appearance-none cursor-pointer"
              >
                <option value="RECEPCIONISTA">RECEPCIONISTA</option>
                <option value="GERENTE_SEDE">GERENTE DE SEDE</option>
                <option value="GERENTE">GERENTE GENERAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#02D7E5]" /> Sede Asignada
              </label>
              <select
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
                disabled={loading}
                className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#02D7E5] transition-colors appearance-none cursor-pointer"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-bold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#02D7E5] hover:bg-[#02D7E5]/90 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(2,215,229,0.2)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Miembro'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
