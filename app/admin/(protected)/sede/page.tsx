"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, AlertCircle, Pencil, Trash2, X, Plus } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { useTenant } from "../components/TenantProvider";

const formSchema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  especialidad: z.string().optional(),
  email: z.string().email({ message: "Email inválido" }).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface Instructor {
  id: string;
  nombre: string;
  especialidad?: string | null;
  email?: string | null;
  sede_id: string;
}

export default function SedePage() {
  const { activeSede } = useTenant();
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      especialidad: "",
      email: "",
    },
  });

  const fetchSessionAndRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch user role from 'usuarios' table
      const { data: userData, error: userError } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", user.id)
        .single();
        
      if (!userError && userData) {
        setUserRole(userData.rol);
        setCanManage(userData.rol === "SUPERADMIN" || userData.rol === "ADMIN");
      }
    } catch (err) {
      console.error("Error fetching user role", err);
    }
  };

  const fetchInstructores = async () => {
    if (!activeSede) return;
    
    setIsFetching(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("instructores")
        .select("*")
        .eq("sede_id", activeSede.id)
        .order("nombre", { ascending: true });

      if (fetchError) throw fetchError;
      setInstructores(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar el staff");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchSessionAndRole();
  }, []);

  useEffect(() => {
    fetchInstructores();
  }, [activeSede?.id]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar a este instructor?')) return;
    
    try {
      const { error } = await supabase.from('instructores').delete().eq('id', id);
      if (error) throw error;
      setInstructores(prev => prev.filter(inst => inst.id !== id));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el instructor');
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!activeSede) {
      setError("No hay una sede activa seleccionada");
      return;
    }
    
    setError(null);
    try {
      const { error } = await supabase.from("instructores").insert([
        {
          nombre: values.nombre,
          especialidad: values.especialidad || null,
          email: values.email || null,
          sede_id: activeSede.id,
        },
      ]);

      if (error) throw error;
      
      setIsDrawerOpen(false);
      reset();
      await fetchInstructores();

    } catch (err: any) {
      setError(err.message || "Error al guardar el instructor");
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-12 text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-wide mb-2">Sede: {activeSede?.nombre || "Sin Selección"}</h1>
            <p className="text-gray-400">Gestiona los instructores y staff operativo de esta sucursal.</p>
          </div>
          
          {/* Renderizado Condicional RBAC */}
          {canManage && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              disabled={!activeSede}
              className="bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-semibold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)] whitespace-nowrap flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Instructor
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg backdrop-blur-xl">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* Tabla Instructores */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xl font-bold">Instructores y Staff Operativo</h2>
            {isFetching && <Loader2 className="w-5 h-5 text-[#02D7E5] animate-spin" />}
          </div>

          <div className="p-0">
            {!isFetching && instructores.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-500 h-[300px]">
                <p className="text-lg">No hay instructores asignados a esta sede.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/20">
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Especialidad</th>
                      <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Email</th>
                      {canManage && <th className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {instructores.map((inst) => (
                      <tr key={inst.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6 font-medium text-white">{inst.nombre}</td>
                        <td className="py-4 px-6 text-gray-400">{inst.especialidad || "-"}</td>
                        <td className="py-4 px-6 text-gray-400">{inst.email || "-"}</td>
                        {canManage && (
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => handleDelete(inst.id)} title="Eliminar">
                                <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400 transition-colors cursor-pointer" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Drawer para Insertar */}
      {canManage && (
        <div 
          className={`fixed inset-0 z-50 transition-opacity duration-300 ${
            isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          
          <div 
            className={`absolute inset-y-0 right-0 w-full max-w-md bg-[#050505]/90 backdrop-blur-3xl border-l border-white/10 p-6 sm:p-8 shadow-2xl transform transition-transform duration-300 flex flex-col ${
              isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold">Nuevo Instructor</h2>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Nombre *</label>
                <input
                  {...register("nombre")}
                  type="text"
                  placeholder="Ej. Carlos Entrenador"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] transition-all"
                />
                {errors.nombre && <p className="text-red-400 text-xs mt-2">{errors.nombre.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Especialidad</label>
                <input
                  {...register("especialidad")}
                  type="text"
                  placeholder="Ej. CrossTraining, Boxeo"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="ejemplo@fitnessfactory.com"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#02D7E5] transition-all"
                />
                {errors.email && <p className="text-red-400 text-xs mt-2">{errors.email.message}</p>}
              </div>

              <div className="pt-6 mt-auto">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#02D7E5] hover:bg-[#02b8c4] text-black font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(2,215,229,0.3)] hover:shadow-[0_0_25px_rgba(2,215,229,0.5)]"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Guardar Instructor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
