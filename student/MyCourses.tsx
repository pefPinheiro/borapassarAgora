
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface CourseEnrollment {
  id: string;
  progress: number;
  last_access: string;
  courses: {
    id: string;
    title: string;
    banner_url: string;
    area: string;
    is_notice_open: boolean;
  }
}

const MyCourses: React.FC = () => {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) setUserName(profile.full_name.split(' ')[0]);

      const { data: enrolls, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          progress,
          last_access,
          courses (
            id,
            title,
            banner_url,
            area,
            is_notice_open
          )
        `)
        .eq('profile_id', user.id)
        .eq('status', 'Ativo');

      if (error) throw error;
      setEnrollments(enrolls as any || []);
    } catch (e) {
      console.error('Error fetching student data:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-1000">

      {/* High-Contrast Vibrant Header */}
      <header className="relative py-16 px-12 bg-slate-900 rounded-[60px] border border-white/5 shadow-2xl overflow-hidden group">
        <div className="absolute top-[-20%] right-[-10%] size-96 bg-[#137fec] rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
        <div className="absolute bottom-[-10%] left-[-5%] size-80 bg-[#ff3b9a] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-700"></div>

        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-12">
          <div className="space-y-4 text-center xl:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-4">
              <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Sua conta está ativa</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.85]">
              Fala, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#137fec] to-[#ff3b9a]">{userName || 'Guerreiro'}!</span>
            </h1>
            <p className="text-slate-400 font-medium text-xl leading-relaxed italic pr-10">Mantenha o foco. O progresso é a única regra.</p>
          </div>

          <div className="flex gap-6 bg-white/5 backdrop-blur-2xl p-8 rounded-[40px] border border-white/10 shadow-inner">
            <div className="flex flex-col items-center px-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Trilhas Ativas</span>
              <span className="text-4xl font-black text-[#137fec]">{enrollments.length}</span>
            </div>
            <div className="w-px h-14 bg-white/10 self-center"></div>
            <div className="flex flex-col items-center px-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Média Global</span>
              <span className="text-4xl font-black text-[#ff3b9a]">
                {enrollments.length > 0
                  ? Math.min(100, Math.round(enrollments.reduce((acc, curr) => acc + curr.progress, 0) / enrollments.length))
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Course Tracking Section */}
      <section>
        <div className="flex items-end justify-between mb-10 px-6">
          <div className="space-y-2">
            <h2 className="text-[11px] font-black text-[#ff3b9a] uppercase tracking-[0.5em]">Controle de Estudo</h2>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Suas Jornadas</h3>
          </div>
          <Link to="/aluno/catalogo" className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#137fec] transition-all group">
            Catálogo Completo
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 bg-slate-50 rounded-[60px] border border-slate-100 animate-pulse"></div>
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="py-24 bg-white rounded-[80px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center p-12 transition-all hover:border-[#137fec]/30">
            <div className="size-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 mb-8 border border-slate-50 shadow-inner">
              <span className="material-symbols-outlined text-5xl font-black">rocket_launch</span>
            </div>
            <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Nenhuma trilha encontrada</h4>
            <p className="text-slate-400 font-medium text-lg italic max-w-sm mt-4">Sua farda está esperando. Comece hoje mesmo escolhendo seu curso.</p>
            <Link to="/aluno/catalogo" className="mt-12 px-14 py-6 bg-[#ff3b9a] text-white rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all">Começar Agora</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {enrollments.map(enroll => (
              <Link key={enroll.id} to={`/aluno/curso/${enroll.courses.id}`} className="group bg-white rounded-[60px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-[0_40px_100px_-20px_rgba(19,127,236,0.15)] transition-all duration-700 flex flex-col h-full relative">
                <div className="h-56 overflow-hidden relative p-4">
                  <div className="size-full rounded-[48px] overflow-hidden shadow-2xl transition-all duration-700 group-hover:rounded-[32px]">
                    <img src={enroll.courses.banner_url || 'https://images.unsplash.com/photo-1454165833767-027ffea9e77b?q=80&w=1470&auto=format&fit=crop'} className="size-full object-cover transition-transform duration-1000 group-hover:scale-110" />

                    {enroll.courses.is_notice_open && (
                      <div className="absolute top-6 left-6 z-20">
                        <div className="bg-emerald-500 text-white px-5 py-2.5 rounded-[18px] font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center gap-2 animate-bounce">
                          <span className="size-1.5 bg-white rounded-full animate-pulse"></span>
                          Edital Aberto
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <span className="bg-white text-slate-900 px-10 py-4 rounded-[20px] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl scale-90 group-hover:scale-100 transition-all">Retomar Estudo</span>
                    </div>
                  </div>
                </div>

                <div className="p-10 flex flex-col flex-1 gap-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[#137fec] bg-[#137fec]/10 px-4 py-1.5 rounded-full uppercase tracking-widest">{enroll.courses.area}</span>
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest italic">{formatDate(enroll.last_access)}</span>
                  </div>

                  <h4 className="font-black text-2xl text-slate-900 leading-[1.1] uppercase tracking-tighter italic group-hover:text-[#ff3b9a] transition-colors">{enroll.courses.title}</h4>

                  <div className="mt-auto pt-8 space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] italic">
                      <span className="text-slate-400">Seu Progresso Atual</span>
                      <span className="text-[#137fec]">{Math.min(100, enroll.progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden border border-slate-100">
                      <div className="bg-gradient-to-r from-[#137fec] to-[#3b82f6] h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(19,127,236,0.3)]" style={{ width: `${Math.min(100, enroll.progress)}%` }}></div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Modern Banner Ad / Special Feature */}
      <section className="relative bg-[#ff3b9a] rounded-[70px] p-16 overflow-hidden text-white group">
        <div className="absolute top-[-50%] right-[-10%] size-[600px] bg-white rounded-full blur-[150px] opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="space-y-8 flex-1 text-center lg:text-left">
            <span className="bg-white text-[#ff3b9a] text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.3em] mb-4 inline-block shadow-2xl shadow-white/20">New Feature</span>
            <h3 className="text-5xl md:text-7xl font-black italic leading-[0.85] tracking-tighter uppercase">Suas Dúvidas <br /> <span className="text-white">Respondidas.</span></h3>
            <p className="text-pink-100 font-medium text-xl max-w-xl italic">Acesse o Suporte e tire suas dúvidas para ter melhor aproveitamento da plataforma.</p>
            <button onClick={() => navigate('/aluno/suporte')} className="px-14 py-7 bg-slate-900 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.3em] hover:scale-110 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 mx-auto lg:mx-0">
              Chamar Suporte
              <span className="material-symbols-outlined font-black">forum</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 shrink-0 hidden lg:grid">
            {[
              { icon: 'update', label: 'Update Diário' },
              { icon: 'done_all', label: 'Questões OK' },
              { icon: 'verified', label: 'Certificado' },
              { icon: 'psychology', label: 'Monitoria AI' }
            ].map((box, i) => (
              <div key={i} className="size-40 bg-white/10 backdrop-blur-3xl rounded-[40px] border border-white/20 flex flex-col items-center justify-center text-center gap-3 hover:bg-white/20 transition-all border-dashed">
                <span className="material-symbols-outlined text-4xl">{box.icon}</span>
                <p className="text-[9px] font-black uppercase tracking-widest">{box.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyCourses;
