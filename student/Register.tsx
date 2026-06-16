
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const params = new URLSearchParams(location.search);
                const redirect = params.get('redirect');
                navigate(redirect || '/aluno/meus-cursos', { replace: true });
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                const params = new URLSearchParams(location.search);
                const redirect = params.get('redirect');
                navigate(redirect || '/aluno/meus-cursos', { replace: true });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [navigate, location]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (email !== confirmEmail) {
            setError('Os e-mails informados não coincidem.');
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas informadas não coincidem.');
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: 'student'
                    },
                    emailRedirectTo: `${window.location.origin}/aluno/meus-cursos`
                }
            });

            if (error) throw error;

            // Se o usuário foi criado (Supabase costuma enviar e-mail de confirmação por padrão)
            setShowSuccessPopup(true);
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar cadastro.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/aluno/meus-cursos`
                }
            });
            if (error) throw error;
        } catch (err: any) {
            setError('Erro ao iniciar login com Google.');
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans overflow-hidden">
            {/* Success Popup Overlay */}
            {showSuccessPopup && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white p-10 rounded-[40px] shadow-3xl max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="size-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-4xl font-black">mark_email_read</span>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Quase lá!</h2>
                            <p className="text-slate-500 font-medium">Enviamos um link de confirmação para o seu e-mail. <br /><strong>Acesse sua caixa de entrada</strong> para ativar sua conta.</p>
                        </div>
                        <button
                            onClick={() => navigate('/login' + location.search)}
                            className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-[#137fec] transition-all"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Lado Esquerdo */}
            <div className="hidden lg:flex lg:w-3/5 bg-slate-900 items-center justify-center p-24 relative overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#137fec] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ff3b9a] rounded-full blur-[150px] opacity-10 animate-pulse animation-delay-2000"></div>

                <div className="relative z-10 space-y-16 max-w-xl">
                    <Link to="/">
                        <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-14 w-auto invert brightness-0" />
                    </Link>

                    <div className="space-y-8">
                        <h1 className="text-8xl font-black text-white leading-[0.8] tracking-tighter italic uppercase">
                            Crie sua <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#137fec] to-[#ff3b9a]">conta agora.</span>
                        </h1>
                        <p className="text-2xl text-slate-400 font-medium leading-relaxed italic">
                            Comece sua jornada rumo à aprovação com a melhor tecnologia.
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-2/5 flex items-center justify-center p-10 bg-white relative overflow-y-auto">
                <div className="w-full max-w-sm space-y-8 py-10 animate-in slide-in-from-right-10 duration-700">
                    <div className="text-center lg:text-left space-y-4">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Novo Cadastro</h2>
                        <div className="h-1.5 w-12 bg-[#ff3b9a] rounded-full mx-auto lg:mx-0"></div>
                    </div>

                    {error && (
                        <div className="p-5 bg-red-50 border border-red-100 rounded-[24px] flex items-center gap-4 text-red-600 text-xs font-black uppercase tracking-tight">
                            <span className="material-symbols-outlined font-black">report</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Nome Completo</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="Ex: João da Silva"
                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[24px] font-black text-slate-900 outline-none focus:border-[#137fec] focus:bg-white transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[24px] font-black text-slate-900 outline-none focus:border-[#137fec] focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Confirmar E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={confirmEmail}
                                    onChange={e => setConfirmEmail(e.target.value)}
                                    placeholder="Repita seu e-mail"
                                    className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[24px] font-black text-slate-900 outline-none focus:border-[#137fec] focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[20px] font-black text-slate-900 outline-none focus:border-[#ff3b9a] focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Confirmar Senha</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[20px] font-black text-slate-900 outline-none focus:border-[#ff3b9a] focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-[#137fec] transition-all disabled:opacity-50"
                        >
                            {loading ? 'Criando Conta...' : 'Criar minha conta'}
                        </button>
                    </form>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <div className="relative flex justify-center text-[8px] font-black text-slate-300 uppercase tracking-widest bg-white px-4">Ou se preferir</div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full h-16 flex items-center justify-center gap-4 bg-white border border-slate-200 rounded-[24px] hover:bg-slate-50 font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                    >
                        <svg className="size-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            <path d="M1 1h22v22H1z" fill="none" />
                        </svg>
                        Entrar com Google
                    </button>

                    <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Já tem conta? <Link to={`/login${location.search}`} className="text-[#ff3b9a] hover:underline">Entre aqui</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
