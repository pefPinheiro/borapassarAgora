import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Redireciona para o Dashboard
            navigate('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <img src="/bora_passar_logo.png" alt="Bora Passar" className="h-16 w-auto mx-auto invert brightness-0 mb-6" />
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">Console Administrativo</h2>
                <p className="mt-2 text-sm text-slate-400 font-bold uppercase tracking-widest">
                    Acesse as configurações do sistema
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-12 px-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[40px] border border-slate-700/10">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                                <span className="material-symbols-outlined text-lg">error</span>
                                <p className="text-xs font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">E-mail Administrativo</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="admin@borapassar.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Chave de Acesso</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded-lg cursor-pointer" />
                                <label className="ml-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">Lembrar</label>
                            </div>
                            <div className="text-xs uppercase font-black text-blue-600 hover:text-blue-700 cursor-pointer tracking-widest">
                                Recuperar Acesso
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-5 px-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {loading ? 'Carregando...' : 'Entrar no Dashboard'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Solicitar acesso à equipe?{' '}
                            <Link to="/admin/cadastro" className="text-blue-600 hover:text-blue-700 font-black">
                                Registrar-se
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
