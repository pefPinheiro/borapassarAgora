
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import RelaxHub from './relax/RelaxHub';
import MillionChallenge from './relax/MillionChallenge';
import TrophyRoom from './relax/TrophyRoom';

const StudentLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasNewNotices, setHasNewNotices] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    if (user) {
      const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
      if (data) {
        setUserName(data.full_name);
        setAvatarUrl(data.avatar_url);
        checkNewNotices(user.id);
      }
    }
    setLoading(false);
  };

  // ... (checkNewNotices and handleClearNotices remain same)

  const checkNewNotices = async (userId: string) => {
    try {
      // Busca cursos matriculados
      const { data: enrolls } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('profile_id', userId);

      if (!enrolls || enrolls.length === 0) return;
      const courseIds = enrolls.map(e => e.course_id);

      // Busca notificações recentes desses cursos
      const { data: notices } = await supabase
        .from('course_notices')
        .select('id, created_at')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

      if (notices && notices.length > 0) {
        const lastSeen = localStorage.getItem(`last_notice_seen_${userId}`);
        const mostRecent = notices[0].created_at;

        if (!lastSeen || new Date(mostRecent) > new Date(lastSeen)) {
          setHasNewNotices(true);
        }
      }
    } catch (e) {
      console.error('Error checking notices:', e);
    }
  };

  const handleClearNotices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`last_notice_seen_${user.id}`, new Date().toISOString());
      setHasNewNotices(false);
    }
  };

  const baseItems = [
    { icon: 'explore', label: 'Catálogo', path: '/aluno/catalogo' },
    {icon: 'quiz', label: 'Questões', path: '/aluno/questoes' },
    { icon: 'school', label: 'Professores', path: '/aluno/professores' },
    { icon: 'support_agent', label: 'Suporte', path: '/aluno/suporte' },
    { icon: 'help', label: 'Perguntas', path: '/aluno/faq' },
  ];

  const menuItems = isLoggedIn ? [
    { icon: 'grid_view', label: 'Início', path: '/aluno/meus-cursos' },
    ...baseItems
  ] : baseItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      {/* Modern Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-100 flex flex-col shrink-0 hidden xl:flex overflow-y-auto no-scrollbar">
        <div className="p-10 pb-12">
          <div className="flex items-center">
            <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-12 w-auto" />
          </div>
        </div>

        <nav className="px-6 space-y-3">
          <p className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Portal do Aluno</p>
          {menuItems.map(item => (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-4 px-5 py-4 rounded-[24px] transition-all duration-300 group ${isActive(item.path)
                ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/10 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <span className={`material-symbols-outlined transition-colors ${isActive(item.path) ? 'text-[#ff3b9a]' : 'group-hover:text-[#137fec]'}`}>{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              {isActive(item.path) && <div className="ml-auto size-1.5 bg-[#ff3b9a] rounded-full"></div>}
            </Link>
          ))}
        </nav>

        <div className="px-6 py-4">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-[24px] text-red-500 hover:bg-red-50 transition-all duration-300 group"
            >
              <span className="material-symbols-outlined group-hover:rotate-180 transition-transform">logout</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Sair da Conta</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="w-full flex items-center gap-4 px-5 py-4 rounded-[24px] text-[#137fec] hover:bg-blue-50 transition-all duration-300 group"
            >
              <span className="material-symbols-outlined">login</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Fazer Login</span>
            </Link>
          )}
        </div>

        <div className="p-8 border-t border-slate-50">
          <div className="p-6 bg-slate-50 rounded-[32px] space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#ff3b9a]">
                <span className="material-symbols-outlined text-xl">psychology</span>
              </div>
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Mentor AI</p>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">Bora Passar Agora! A sua Ferramenta completa.</p>
          </div>

          <div className="flex flex-col items-center gap-3 mt-8 mb-6 border-b border-slate-100 pb-6">
            <Link to="/quem-somos" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors">Quem Somos</Link>
            <Link to="/termos" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors">Termos e Privacidade</Link>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-1.5 opacity-20 filter grayscale">
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">Dev by</span>
              <img src="/bcode_logo.png" alt="Bcode" className="h-2 w-auto" />
            </div>
            <p className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.2em]">&copy; 2026 Bora Passar Agora</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Modern Dynamic Header */}
        <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 xl:px-12 shrink-0 z-50">
          <div className="xl:hidden flex items-center gap-4">
            <img src="/bora_passar_logo.png" alt="Logo" className="h-8 w-auto" />
          </div>

          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full group">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#137fec] transition-colors">search_insights</span>
              <input
                className="w-full h-12 pl-14 pr-6 bg-slate-50 border border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none"
                placeholder="Pesquisar em seus materiais..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            <button
              onClick={handleClearNotices}
              className="relative size-12 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined">notifications</span>
              {hasNewNotices && <span className="absolute top-2.5 right-2.5 size-2.5 bg-[#ff3b9a] rounded-full border-2 border-white animate-pulse"></span>}
            </button>

            <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>

            <Link to="/aluno/config" className="flex items-center gap-4 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black leading-none uppercase tracking-widest">{userName || 'Guerreiro'}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest group-hover:text-[#ff3b9a] transition-colors">Elite Member</p>
              </div>
              <div className="size-12 rounded-[18px] bg-white border-2 border-slate-100 overflow-hidden group-hover:border-[#137fec] transition-all duration-500 shadow-sm relative flex items-center justify-center">
                <img src={avatarUrl || "/bora_passar_logo.png"} alt="User" className={`size-full ${avatarUrl ? 'object-cover' : 'object-contain p-2 opacity-80'}`} />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#137fec]/5 to-transparent"></div>
              </div>
            </Link>
          </div>
        </header>

        {/* Viewport Content */}
        <div className="flex-1 overflow-y-auto p-10 xl:p-12 no-scrollbar bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Navigation Dock */}
      <nav className="xl:hidden fixed bottom-6 inset-x-6 h-20 bg-slate-900/90 backdrop-blur-2xl rounded-[32px] border border-white/10 flex items-center justify-around px-4 z-[100] shadow-2xl">
        {menuItems.map(item => (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center gap-1.5 transition-all ${isActive(item.path) ? 'text-white scale-110' : 'text-slate-500'}`}
          >
            <span className={`material-symbols-outlined ${isActive(item.path) ? 'text-[#ff3b9a]' : ''}`}>{item.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </Link>
        ))}
      </nav>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default StudentLayout;
