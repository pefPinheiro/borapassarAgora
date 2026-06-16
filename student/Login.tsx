
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');

      if (redirect) {
        navigate(redirect);
      } else {
        navigate('/aluno/meus-cursos');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login. Verifique suas credenciais.');
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
      {/* Lado Esquerdo - Vibrant & Futuristic */}
      <div className="hidden lg:flex lg:w-3/5 bg-slate-900 items-center justify-center p-24 relative overflow-hidden">
        {/* Neon Animated Background */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#137fec] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ff3b9a] rounded-full blur-[150px] opacity-10 animate-pulse animation-delay-2000"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05]"></div>

        <div className="relative z-10 space-y-16 max-w-xl">
          <Link to="/">
            <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-14 w-auto invert brightness-0" />
          </Link>

          <div className="space-y-8">
            <h1 className="text-8xl font-black text-white leading-[0.8] tracking-tighter italic uppercase">
              O futuro <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#137fec] to-[#ff3b9a]">começa aqui.</span>
            </h1>
            <p className="text-2xl text-slate-400 font-medium leading-relaxed italic">
              Acesse a maior plataforma de estudos focada em alto desempenho.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff3b9a]">
                <span className="material-symbols-outlined font-black">auto_stories</span>
              </div>
              <p className="text-sm font-black text-white/80 uppercase tracking-widest italic">Apostilas Interativas 100% Online</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#137fec]">
                <span className="material-symbols-outlined font-black">speed</span>
              </div>
              <p className="text-sm font-black text-white/80 uppercase tracking-widest italic">Controle de Estudo e Progresso</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito - Modern & Clean Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-10 bg-white relative">
        <div className="absolute top-10 right-10 hidden lg:block">
          <Link to="/" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#ff3b9a] transition-colors">Voltar para Início</Link>
        </div>

        <div className="w-full max-w-sm space-y-12 animate-in slide-in-from-right-10 duration-700">
          <div className="text-center lg:text-left space-y-4">
            <div className="flex lg:hidden items-center justify-center mb-10">
              <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-10 w-auto" />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Entrar no Portal</h2>
            <div className="h-1.5 w-12 bg-[#ff3b9a] rounded-full mx-auto lg:mx-0"></div>
          </div>

          {error && (
            <div className="p-5 bg-red-50 border border-red-100 rounded-[24px] flex items-center gap-4 text-red-600 text-xs font-black uppercase tracking-tight animate-in zoom-in-95">
              <span className="material-symbols-outlined font-black">report</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">E-mail Cadastrado</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#137fec] transition-colors">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full h-16 pl-14 pr-6 bg-slate-50 border border-slate-200 rounded-[24px] font-black text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sua Senha</label>
                  <a href="#" className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-[#ff3b9a]">Esqueceu?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#ff3b9a] transition-colors">lock</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-16 pl-14 pr-6 bg-slate-50 border border-slate-200 rounded-[24px] font-black text-slate-900 focus:bg-white focus:border-[#ff3b9a] focus:ring-8 focus:ring-[#ff3b9a]/5 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-18 bg-slate-900 text-white rounded-[28px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-[#137fec] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 py-6"
            >
              {loading ? (
                <div className="size-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Acessar Painel
                  <span className="material-symbols-outlined font-black">bolt</span>
                </>
              )}
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[9px] uppercase font-black text-slate-300 tracking-[0.3em] bg-white px-6">Fast Connect</div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full h-16 flex items-center justify-center gap-4 bg-white border border-slate-200 rounded-[24px] hover:bg-slate-50 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-[#137fec]"
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

          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8">
            Novo por aqui? <Link to={`/cadastro${location.search}`} className="text-[#ff3b9a] hover:underline">Crie sua conta</Link>
          </p>
        </div>
      </div>

      <style>{`
         .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
};

export default Login;
