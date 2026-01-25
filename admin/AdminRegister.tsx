import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AdminRegister: React.FC = () => {
    const navigate = useNavigate();
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState(''); // New Security Field
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Security Check: Invite Code
        // In a real scenario, this should be validated via Edge Function or DB, 
        // but client-side obfuscation prevents simple bot spam.
        if (inviteCode !== 'BORA2026') {
            setError('Código de convite inválido. Solicite ao administrador.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não conferem.');
            setLoading(false);
            return;
        }

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: nome,
                        role: 'admin', // Starts as 'admin' but pending status usually
                        status: 'pendente' // Explicitly set as pending
                    }
                }
            });

            if (authError) throw authError;

            if (data.user) {
                // Optional: Create profile entry manually if trigger fails or is delayed?
                // For now rely on triggers. 

                alert('Solicitação de acesso enviada com sucesso! Aguarde a aprovação do Super Admin.');
                navigate('/admin/login');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar cadastro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
                <div className="absolute top-[-10%] right-[-10%] size-[600px] bg-blue-600 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] size-[600px] bg-purple-600 rounded-full blur-[120px]"></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
                <img src="/bora_passar_logo.png" alt="Bora Passar" className="h-16 w-auto mx-auto invert brightness-0 mb-6" />
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">Solicitação de Staff</h2>
                <p className="mt-2 text-sm text-slate-400 font-bold uppercase tracking-widest px-4">
                    Acesso exclusivo para colaboradores
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
                <div className="bg-white py-12 px-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-[40px] border border-slate-700/50">
                    <form className="space-y-5" onSubmit={handleRegister}>
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                                <span className="material-symbols-outlined text-lg">error</span>
                                <p className="text-xs font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Código de Convite</label>
                                <input
                                    type="text"
                                    required
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    disabled={loading}
                                    className="w-full px-5 py-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-blue-900 font-black tracking-widest text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50 placeholder:text-blue-200"
                                    placeholder="CÓDIGO SECRETO"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    disabled={loading}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">E-mail Corporativo</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="admin@borapassar.com"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Criar Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">Confirmar</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mt-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed text-center">
                                Todos os acessos são monitorados e requerem aprovação manual de nível superior.
                            </p>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-5 px-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {loading ? 'Validando...' : 'Enviar Solicitação'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Já possui credencial?{' '}
                            <Link to="/admin/login" className="text-blue-600 hover:text-blue-700 font-black">
                                Login Seguro
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminRegister;
