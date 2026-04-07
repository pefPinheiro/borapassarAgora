import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname.includes(path);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/admin/login');
      } else {
        setUser(user);
        // Buscar perfil para verificar status
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(prof);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/admin/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  // Definição dos Grupos e Itens do Menu com IDs de Permissão
  const menuGroups = [
    {
      id: 'conteudo',
      label: 'Gestão de Conteúdo',
      icon: 'layers',
      items: [
        { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
        { id: 'cursos', icon: 'auto_stories', label: 'Cursos', path: '/admin/cursos' },
        { id: 'apostilas', icon: 'description', label: 'Apostilas', path: '/admin/apostilas' },
        { id: 'simulados', icon: 'assignment', label: 'Simulados', path: '/admin/simulados' },
        { id: 'cadernos', icon: 'menu_book', label: 'Cadernos', path: '/admin/cadernos' }, // Using menu_book icon
        { id: 'questoes', icon: 'quiz', label: 'Questões', path: '/admin/questoes' },
        { id: 'disciplinas', icon: 'menu_book', label: 'Disciplinas', path: '/admin/disciplinas' },
        { id: 'assuntos', icon: 'topic', label: 'Assuntos', path: '/admin/assuntos' },
        { id: 'bancas', icon: 'account_balance', label: 'Bancas', path: '/admin/bancas' },
      ]
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: 'account_balance_wallet',
      items: [
        { id: 'vendas', icon: 'payments', label: 'Vendas', path: '/admin/vendas' },
        { id: 'custos', icon: 'trending_up', label: 'Custos', path: '/admin/custos' },
        { id: 'pagamentos', icon: 'receipt_long', label: 'Pagamentos', path: '/admin/pagamentos' },
        { id: 'balanco', icon: 'analytics', label: 'Balanço Geral', path: '/admin/balanco' },
        { id: 'investidores', icon: 'volunteer_activism', label: 'Investidores', path: '/admin/investidores' },
      ]
    },
    {
      id: 'administracao',
      label: 'Administração',
      icon: 'admin_panel_settings',
      items: [
        { id: 'colaboradores', icon: 'badge', label: 'Colaboradores', path: '/admin/colaboradores' },
        { id: 'professores', icon: 'school', label: 'Professores', path: '/admin/professores' },
      ]
    },
    {
      id: 'suporte',
      label: 'Suporte',
      icon: 'support_agent',
      items: [
        { id: 'inscricoes', icon: 'person_add', label: 'Inscrições', path: '/admin/inscricoes' },
        { id: 'faq', icon: 'help', label: 'FAQ', path: '/admin/faq' },
        { id: 'chat', icon: 'chat', label: 'Chat', path: '/admin/chat' },
      ]
    }
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(group => {
      if (group.items.some(item => isActive(item.path))) {
        initial[group.id] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper para verificar permissão
  const hasAccess = (moduleId: string) => {
    if (!profile) return false;
    if (profile.role === 'super') return true; // Super Admin vê tudo
    const allowed = profile.allowed_modules || [];
    return allowed.includes(moduleId);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/bora_passar_logo.png" alt="Carregando..." className="h-10 w-auto animate-pulse" />
          <div className="h-1 w-32 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-1/2 animate-[loading_1s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>
    );
  }

  // BLOQUEIO DE ACESSO PARA PENDENTES
  // (Ou se não tiver role definida/permitida)
  if (profile && (profile.status === 'pendente' || (profile.status !== 'active' && profile.status !== 'Ativo'))) {
    // Nota: status pode vir misturado (Legacy), checando ambos por segurança
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 text-center space-y-8 animate-in zoom-in-95 duration-300">
          <div className="size-24 bg-amber-50 rounded-[32px] flex items-center justify-center mx-auto text-amber-500">
            <span className="material-symbols-outlined text-5xl">pending_actions</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Acesso Pendente</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Sua solicitação está sendo revisada. O <strong>Super Administrador</strong> precisa liberar seu acesso antes que você possa visualizar o painel.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Status atual: {String(profile.status).toUpperCase()}</p>
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const role = profile?.role || user?.user_metadata?.role || 'admin';
  const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Admin';

  return (
    <div className="flex min-h-screen bg-[#f6f7f8] font-sans">
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-[#dbe0e6] flex flex-col h-screen sticky top-0 hidden lg:flex">
        <div className="p-8 flex items-center gap-3 shrink-0">
          <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto no-scrollbar">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(item => hasAccess(item.id));

            // Se não tem itens visíveis no grupo, não renderiza o grupo
            if (visibleItems.length === 0) return null;

            const isOpen = openGroups[group.id];
            const hasActiveItem = visibleItems.some(item => isActive(item.path));

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isOpen || hasActiveItem ? 'bg-slate-50 text-[#137fec]' : 'text-[#617589] hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[22px]">{group.icon}</span>
                    <span className="text-sm font-bold">{group.label}</span>
                  </div>
                  <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-11 pr-2 space-y-1 mt-1 border-l-2 border-slate-100 ml-6">
                    {visibleItems.map((item) => (
                      <Link
                        key={item.label}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${isActive(item.path)
                          ? 'bg-blue-50 text-[#137fec] shadow-sm'
                          : 'text-[#617589] hover:text-[#111418] hover:bg-slate-50'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] opacity-70">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-50 bg-slate-50/50">
          <div className="flex gap-4 justify-center">
            <Link to="/quem-somos" className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest">Quem Somos</Link>
            <Link to="/termos" className="text-[10px) font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest">Termos</Link>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4 opacity-30 invert brightness-0 grayscale">
            <span className="text-[8px] font-black uppercase tracking-[0.2em]">Technology by</span>
            <img src="/bcode_logo.png" alt="Bcode" className="h-2.5 w-auto" />
          </div>
          <p className="text-center text-[8px] text-slate-300 font-bold mt-3 uppercase tracking-[0.2em]">&copy; 2026 Bora Passar Agora</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-[#f0f2f4] px-10 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <h2 className="text-[#111418] text-xl font-bold tracking-tight">Painel Administrativo</h2>
            <div className="relative w-96 hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#617589]">search</span>
              <input
                className="w-full bg-[#f0f2f4] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#137fec]/20 placeholder:text-[#617589]"
                placeholder="Buscar cadastros, transações..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {hasAccess('mail') && (
                <Link to="/admin/mail" className="p-2.5 bg-[#f0f2f4] rounded-xl text-[#111418] hover:bg-gray-200 transition-colors">
                  <span className="material-symbols-outlined">mail</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="p-2.5 bg-[#fef2f2] rounded-xl text-red-600 hover:bg-red-100 transition-colors"
                title="Sair do Sistema"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
            <div className="h-8 w-[1px] bg-gray-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-[#111418]">{fullName}</p>
                <div className="flex items-center justify-end gap-1.5 ring-1 ring-amber-100 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5">
                  <span className="material-symbols-outlined text-[10px] text-amber-600 font-bold">workspace_premium</span>
                  <p className="text-[9px] text-amber-600 font-black uppercase tracking-wider">
                    {role === 'super' ? 'Super Administrador' : (profile?.job_title || 'Colaborador')}
                  </p>
                </div>
              </div>

              <Link
                to="/admin/config"
                className="size-8 flex items-center justify-center bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all"
                title="Configurações de Perfil"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </Link>

              <div
                className="size-11 rounded-xl bg-cover bg-center border-2 border-white shadow-md transition-transform hover:scale-105"
                style={{ backgroundImage: `url('${profile?.avatar_url || 'https://picsum.photos/100/100?random=1'}')` }}
              ></div>
            </div>
          </div>
        </header>

        <div className="p-10 flex-1 overflow-y-auto bg-[#f8fafc]">
          <div className="max-w-[1400px] mx-auto">
            {(() => {
              // 1. Flatten all menu items to find match
              const allItems = menuGroups.flatMap(g => g.items);

              // 2. Find the module corresponding to current path
              // We sort by path length desc to match most specific path first (though here they are mostly distinct)
              const currentModule = allItems
                .sort((a, b) => b.path.length - a.path.length)
                .find(item => location.pathname.startsWith(item.path));

              // 3. Special Routes whitelist (Config is always allowed for logged users)
              const isWhitelisted = location.pathname.includes('/admin/config') || location.pathname.includes('/admin/mail');

              // 4. Check Access
              // If it matches a module, check permission. If not module and not whitelist, we might allow or block.
              // Assuming stricter approach: if it looks like a module path but not allowed -> Block.
              // If it's a sub-route of a module, it's covered by step 2.

              const isAllowed = !currentModule || hasAccess(currentModule.id) || isWhitelisted;

              if (!isAllowed) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in zoom-in-95">
                    <div className="size-24 bg-red-50 text-red-500 rounded-[32px] flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-5xl">lock</span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Acesso Negado</h2>
                      <p className="text-slate-500 font-medium max-w-md mx-auto">
                        Você não tem permissão para acessar o módulo <strong>{currentModule?.label}</strong>.
                        Solicite acesso ao Super Administrador.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/admin/dashboard')}
                      className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                    >
                      Voltar ao Dashboard
                    </button>
                  </div>
                );
              }

              return <Outlet />;
            })()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
