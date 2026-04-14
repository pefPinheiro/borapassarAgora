import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [teacherData, setTeacherData] = useState<any>(null);

  // Dashboard Data State
  const [data, setData] = useState({
    recentCourses: [] as any[],
    recentApostilas: [] as any[],
    recentSimulados: [] as any[],
    recentNotebooks: [] as any[],
    totalQuestions: 0,
    sales: { today: 0, month: 0, recent: [] as any[] },
    costs: [] as any[],
    payments: [] as any[], // Professional Payments
    balance: { totalRevenue: 0, totalCosts: 0, net: 0 },
    investors: { recent: [] as any[], totalPaid: 0 },
    enrollments: [] as any[],
    recentChats: [] as any[]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/admin/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);

      // Fetch teacher specific info if applicable
      const { data: teacher } = await supabase
        .from('teachers')
        .select('*')
        .eq('linked_profile_id', user.id)
        .maybeSingle();
      
      if (teacher) {
        const { data: discs } = await supabase
          .from('disciplinas')
          .select('name')
          .in('id', teacher.disciplines_ids || []);
        setTeacherData({ ...teacher, disciplines: discs || [] });
      }

      const isSuperOrAdmin = profile.role === 'super' || profile.role === 'admin';
      const isFin = profile.role === 'super' || profile.view_finance === true;

      // 1. Cursos Recentes
      const { data: recentCourses } = await supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(5);

      // 2. Apostilas Recentes
      const { data: recentApostilas } = await supabase.from('apostilas').select('*').order('created_at', { ascending: false }).limit(5);

      // 3. Simulados Recentes
      const { data: recentSimulados } = await supabase.from('simulados').select('*').order('created_at', { ascending: false }).limit(5);

      // 4. Cadernos Recentes
      const { data: recentNotebooks } = await supabase.from('notebooks').select('*').order('created_at', { ascending: false }).limit(5);

      // 5. Total de Questões
      const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });

      // 6. Vendas (Financeiro)
      let salesData = { today: 0, month: 0, recent: [] as any[] };
      let costsData = [] as any[];
      let paymentsData = [] as any[];
      let balanceData = { totalRevenue: 0, totalCosts: 0, net: 0 };
      let investorsData = { recent: [] as any[], totalPaid: 0 };

      if (isFin) {
        const today = new Date().toISOString().split('T')[0];
        const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        // Vendas Hoje
        const { data: salesToday } = await supabase.from('enrollments').select('amount_paid').gte('created_at', today);
        const totalToday = salesToday?.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0) || 0;

        // Vendas Mês
        const { data: salesMonth } = await supabase.from('enrollments').select('amount_paid').gte('created_at', firstDayMonth);
        const totalMonth = salesMonth?.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0) || 0;

        // Vendas Recentes
        const { data: recentSales } = await supabase.from('enrollments')
          .select('*, profiles(full_name), courses(title)')
          .order('created_at', { ascending: false }).limit(5);

        salesData = { today: totalToday, month: totalMonth, recent: recentSales || [] };

        // 7. Custos
        const { data: recentCosts } = await supabase.from('costs').select('*').order('created_at', { ascending: false }).limit(5);
        costsData = recentCosts || [];

        // Total Costs Month (Approx for balance)
        const { data: costsMonth } = await supabase.from('costs').select('amount').gte('payment_date', firstDayMonth);
        const totalCostsVal = costsMonth?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;

        // 8. Pagamentos (Professional)
        const { data: recentPayments } = await supabase.from('professional_payments')
          .select('*, profiles:user_id(full_name)')
          .order('created_at', { ascending: false }).limit(5);
        paymentsData = recentPayments || [];

        // 9. Balanço (Simples Mês Atual)
        balanceData = { totalRevenue: totalMonth, totalCosts: totalCostsVal, net: totalMonth - totalCostsVal };

        // 10. Investidores (Baseado em professional_payments type='Dividendo')
        const { data: recentInv } = await supabase.from('professional_payments')
          .select('*, profiles:user_id(full_name)')
          .eq('type', 'Dividendo')
          .order('created_at', { ascending: false })
          .limit(5);

        investorsData = { recent: recentInv || [], totalPaid: 0 }; // Calc total needed separately if rigorous
      }

      // 11. Inscrições Recentes (Enrollments sem dados financeiros explícitos, focado em aluno)
      const { data: recentEnrollments } = await supabase.from('enrollments')
        .select('created_at, profiles(full_name, email), courses(title)')
        .order('created_at', { ascending: false })
        .limit(5);

      // 12. Chat (Tickets Recentes)
      const { data: recentChats } = await supabase.from('support_tickets')
        .select('*, profiles:student_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);


      setData({
        recentCourses: recentCourses || [],
        recentApostilas: recentApostilas || [],
        recentSimulados: recentSimulados || [],
        recentNotebooks: recentNotebooks || [],
        totalQuestions: totalQuestions || 0,
        sales: salesData,
        costs: costsData,
        payments: paymentsData,
        balance: balanceData,
        investors: investorsData,
        enrollments: recentEnrollments || [],
        recentChats: recentChats || []
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  if (loading) return <div className="p-10 flex justify-center"><div className="size-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div></div>;

  // Se o usuário for Professor, mostra a Cartilha (Tutorial)
  if (userProfile?.role === 'teacher') {
    return <ProfessorTutorial teacher={teacherData} profile={userProfile} />;
  }

  const isFin = userProfile?.role === 'super' || userProfile?.view_finance === true;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic">Dashboard Geral</h1>
          <p className="text-slate-500 font-bold text-sm">Visão panorâmica da plataforma</p>
        </div>
        <button onClick={fetchDashboardData} className="p-2 bg-white border rounded-xl hover:bg-slate-50 text-slate-500"><span className="material-symbols-outlined">refresh</span></button>
      </div>

      {/* BLOCO 1: CONTEÚDO (Cursos, Apostilas, Simulados, Cadernos, Questões) */}
      <section className="space-y-6">
        <h3 className="text-lg font-black text-slate-800 uppercase border-l-4 border-[#137fec] pl-3">Conteúdo & Acervo</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Resumo Numérico Rápido */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase">Total Questões</span>
            <p className="text-3xl font-black text-[#137fec]">{data.totalQuestions}</p>
          </div>
          {/* Outros cards podem ser adicionados aqui se precisar de contadores totais */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* 1. Cursos Recentes */}
          <DashboardCard title="Cursos Recentes" icon="school" color="blue">
            {data.recentCourses.length === 0 ? <EmptyState /> : (
              <ul className="space-y-3">
                {data.recentCourses.map(c => (
                  <ListItem key={c.id} title={c.title} subtitle={formatDate(c.created_at)} />
                ))}
              </ul>
            )}
          </DashboardCard>

          {/* 2. Apostilas Recentes */}
          <DashboardCard title="Apostilas Recentes" icon="library_books" color="purple">
            {data.recentApostilas.length === 0 ? <EmptyState /> : (
              <ul className="space-y-3">
                {data.recentApostilas.map(a => (
                  <ListItem key={a.id} title={a.title} subtitle={formatDate(a.created_at)} />
                ))}
              </ul>
            )}
          </DashboardCard>

          {/* 3. Simulados Recentes */}
          <DashboardCard title="Simulados Recentes" icon="timer" color="emerald">
            {data.recentSimulados.length === 0 ? <EmptyState /> : (
              <ul className="space-y-3">
                {data.recentSimulados.map(s => (
                  <ListItem key={s.id} title={s.title} subtitle={`${s.duration} min • ${formatDate(s.created_at)}`} />
                ))}
              </ul>
            )}
          </DashboardCard>

          {/* 4. Cadernos Recentes */}
          <DashboardCard title="Cadernos Recentes" icon="menu_book" color="amber">
            {data.recentNotebooks.length === 0 ? <EmptyState /> : (
              <ul className="space-y-3">
                {data.recentNotebooks.map(n => (
                  <ListItem key={n.id} title={n.title} subtitle={formatDate(n.created_at)} />
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      </section>

      {/* BLOCO 2: FINANCEIRO (Vendas, Custos, Pagamentos, Balanço, Investidores) */}
      {isFin && (
        <section className="space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase border-l-4 border-emerald-500 pl-3">Financeiro & Administrativo</h3>

          {/* 9. Balanço Geral (Resumido) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-500 text-white p-6 rounded-3xl shadow-lg shadow-emerald-500/20">
              <p className="text-emerald-100 text-xs font-black uppercase tracking-widest mb-1">Receita (Mês)</p>
              <p className="text-3xl font-black">{formatCurrency(data.balance.totalRevenue)}</p>
            </div>
            <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-lg shadow-rose-500/20">
              <p className="text-rose-100 text-xs font-black uppercase tracking-widest mb-1">Despesas (Mês)</p>
              <p className="text-3xl font-black">{formatCurrency(data.balance.totalCosts)}</p>
            </div>
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg shadow-slate-900/20">
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Resultado Líquido</p>
              <p className={`text-3xl font-black ${data.balance.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(data.balance.net)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 6. Vendas */}
            <DashboardCard title="Vendas Recentes" icon="payments" color="emerald">
              <div className="mb-4 flex gap-4 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl">
                <div><span className="block text-emerald-600">Hoje</span> {formatCurrency(data.sales.today)}</div>
                <div className="w-px bg-slate-200"></div>
                <div><span className="block text-blue-600">Mês</span> {formatCurrency(data.sales.month)}</div>
              </div>
              {data.sales.recent.length === 0 ? <EmptyState /> : (
                <ul className="space-y-3">
                  {data.sales.recent.map((s: any) => (
                    <li key={s.id} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{s.profiles?.full_name || 'Aluno'}</span>
                        <span className="text-[10px] text-slate-400">{s.courses?.title}</span>
                      </div>
                      <span className="font-black text-emerald-600">{formatCurrency(s.amount_paid)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>

            {/* 7. Custos */}
            <DashboardCard title="Últimos Custos" icon="money_off" color="rose">
              {data.costs.length === 0 ? <EmptyState /> : (
                <ul className="space-y-3">
                  {data.costs.map((c: any) => (
                    <li key={c.id} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{c.description}</span>
                        <span className="text-[10px] text-slate-400">{c.category}</span>
                      </div>
                      <span className="font-black text-rose-600">- {formatCurrency(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>

            {/* 8. Pagamentos e 10. Investidores (Mixed or separate depending on space) */}
            <DashboardCard title="Pagamentos / Investidores" icon="account_balance" color="blue">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Colaboradores & Estornos</p>
                  {data.payments.length === 0 ? <p className="text-xs text-slate-400 italic">Sem registros</p> : (
                    <ul className="space-y-2">
                      {data.payments.map((p: any) => (
                        <li key={p.id} className="flex justify-between text-xs">
                          <span className="text-slate-700 truncate w-32">{p.profiles?.full_name}</span>
                          <span className="font-bold text-slate-900">{formatCurrency(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Investidores (Dividendos)</p>
                  {data.investors.recent.length === 0 ? <p className="text-xs text-slate-400 italic">Sem registros</p> : (
                    <ul className="space-y-2">
                      {data.investors.recent.map((inv: any) => (
                        <li key={inv.id} className="flex justify-between text-xs">
                          <span className="text-slate-700 truncate w-32">{inv.profiles?.full_name}</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(inv.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </DashboardCard>

          </div>
        </section>
      )}

      {/* BLOCO 3: COMUNIDADE (Inscrições, Chat) */}
      <section className="space-y-6">
        <h3 className="text-lg font-black text-slate-800 uppercase border-l-4 border-purple-500 pl-3">Comunidade & Suporte</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 11. Inscrições Recentes */}
          <DashboardCard title="Últimas Inscrições" icon="person_add" color="indigo">
            {data.enrollments.length === 0 ? <EmptyState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] text-slate-400 uppercase font-black">
                    <tr><th className="pb-2">Aluno</th><th className="pb-2">Curso</th><th className="pb-2 text-right">Data</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.enrollments.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 font-bold text-slate-700">{e.profiles?.full_name}</td>
                        <td className="py-2 text-xs text-slate-500">{e.courses?.title}</td>
                        <td className="py-2 text-xs text-slate-400 text-right">{formatDate(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>

          {/* 13. Chat Recentes */}
          <DashboardCard title="Suporte / Chat (Recentes)" icon="chat" color="purple">
            {data.recentChats.length === 0 ? <EmptyState /> : (
              <ul className="space-y-3">
                {data.recentChats.map((t: any) => (
                  <li key={t.id} className="flex justify-between items-center group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`size-2 rounded-full ${t.status === 'Aberto' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{t.subject}</p>
                        <p className="text-[10px] text-slate-400">{t.profiles?.full_name} • {formatDate(t.created_at)}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      </section>

    </div>
  );
};

// --- COMPONENTES DA CARTILHA DO PROFESSOR ---

const ProfessorTutorial: React.FC<{ teacher: any; profile: any }> = ({ teacher, profile }) => {
  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Header da Cartilha */}
      <div className="text-center space-y-4 max-w-4xl mx-auto mb-16">
        <div className="size-24 bg-blue-50 text-blue-600 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-sm">
          <span className="material-symbols-outlined text-5xl">school</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tight">Bem-vindo, {teacher?.name || profile?.full_name}!</h1>
        
        {/* Disciplinas em destaque */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {teacher?.disciplines?.map((d: any, i: number) => (
            <span key={i} className="px-4 py-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
              {d.name}
            </span>
          ))}
          {(!teacher?.disciplines || teacher.disciplines.length === 0) && (
             <span className="px-4 py-2 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest italic border border-slate-200">
               Aguardando atribuição de disciplinas
             </span>
          )}
        </div>

        <p className="text-slate-500 font-medium text-lg pt-4">
          Preparamos este guia didático para você dominar todas as ferramentas da nossa plataforma.
          O objetivo é facilitar o seu trabalho e potencializar o aprendizado dos seus alunos.
        </p>
      </div>

      <nav className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <a href="#modulo-questoes" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-blue-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-blue-500 group-hover:scale-110 transition-transform">quiz</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Questões</span>
        </a>
        <a href="#modulo-cadernos" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-amber-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-amber-500 group-hover:scale-110 transition-transform">menu_book</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Cadernos</span>
        </a>
        <a href="#modulo-simulados" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-emerald-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-emerald-500 group-hover:scale-110 transition-transform">assignment</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Simulados</span>
        </a>
        <a href="#modulo-apostilas" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-purple-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-purple-500 group-hover:scale-110 transition-transform">description</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Apostilas</span>
        </a>
      </nav>

      {/* SEÇÃO: QUESTÕES */}
      <GuideSection id="modulo-questoes" title="Guia do Professor: Módulo de Questões" icon="quiz" color="blue">
        <div className="space-y-8">
          <p className="text-slate-600 leading-relaxed font-medium">
            Bem-vindo ao coração pedagógico da nossa plataforma! O módulo de Questões é onde você gerencia e cria o conteúdo acadêmico que dará vida às apostilas, simulados e aos nossos jogos (modo Relax).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-800 uppercase">1. O Banco de Questões</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Nesta tela, você visualiza todo o acervo disponível. Você pode filtrar questões por banca, disciplina, dificuldade e muito mais.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> <strong>Tipos:</strong> Bancas oficiais, inéditas, simulados ou Modo Relax.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> <strong>Formatos:</strong> Múltipla escolha (4 ou 5 alternativas) e Certo/Errado.</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-600">visibility</span>
                <p className="text-sm font-black text-blue-900 uppercase">Visualização e o uso do ID</p>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Ao clicar no ícone de Visualizar (o "olhinho"), você abre uma prévia da questão.
                <strong> Testar:</strong> Você pode responder para conferir a experiência do aluno.
                <strong> Copiar ID:</strong> Função vital! Clique para obter o código único e vinculá-lo a uma Apostila ou Simulado.
              </p>
            </div>
          </div>

          <div className="p-8 bg-amber-50 rounded-[32px] border-2 border-dashed border-amber-200 text-center space-y-4">
            <div className="size-12 bg-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined">stars</span>
            </div>
            <h4 className="text-xl font-black text-amber-800 uppercase italic">Regra de Ouro (Qualidade)</h4>
            <p className="text-sm text-amber-900/70 font-medium max-w-2xl mx-auto">
              Toda questão deve, obrigatoriamente, conter o <strong>gabarito indicado</strong> e uma <strong>explicação/comentário do professor</strong>.
              Não é permitido salvar questões sem o embasamento pedagógico da resposta.
            </p>
          </div>

          <div className="space-y-6">
            <h4 className="text-lg font-black text-slate-800 uppercase border-l-4 border-blue-500 pl-4 text-left">3. Passo a Passo: Criando uma Nova Questão</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <StepCard number="A" title="Configurações" desc="Preencha Banca, Disciplina e Assunto. Escolha a Modalidade (Múltipla Escolha ou C/E) e Dificuldade." />
              <StepCard number="B" title="Conteúdo" desc="Use Texto Base para várias questões ou Enunciado Direto. Você pode Vincular IDs de textos existentes." />
              <StepCard number="C" title="Alternativas" desc="Insira o texto, marque a correta e escreva o Comentário do Professor detalhado." />
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h4 className="text-lg font-black text-slate-800 uppercase">4. Status da Questão</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded-full bg-amber-500 shadow-sm shadow-amber-200"></div>
                  <span className="text-sm font-bold text-slate-700">PENDENTE:</span>
                  <span className="text-xs text-slate-500 italic">Salva, mas precisa de revisão ou metadados.</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                  <span className="text-sm font-bold text-slate-700">VALIDADA:</span>
                  <span className="text-xs text-slate-500 italic">Pronta e disponível para Apostilas e Simulados.</span>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-500">lightbulb</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong>Dica do Pro:</strong> Sempre revise o texto no editor de "Conteúdo Rico". Use negritos e listas para tornar a leitura agradável!
              </p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: CADERNOS */}
      <GuideSection id="modulo-cadernos" title="Módulo de Cadernos: Teoria vs. Prática" icon="menu_book" color="amber">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">🎯 O que é um Caderno?</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  É um guia de estudos prático composto por uma lista de questões progressivas (em média 30). O objetivo é conduzir o aluno passo a passo, consolidando o aprendizado.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">📍 Onde os Cadernos ficam?</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Eles são o "gran finale" da teoria. Ficam posicionados sempre ao final de uma Apostila com o botão verde <strong>"Bora Praticar!"</strong>.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="bg-amber-100 rounded-[40px] p-8 space-y-4 border border-amber-200 shadow-inner">
                <div className="flex items-center gap-2 text-amber-800 font-black uppercase text-xs">
                  <span className="material-symbols-outlined">settings</span> Papel do Professor na criação
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">1</div>
                    <p className="text-xs text-amber-900/70 font-bold">Curadoria Pedagógica: Filtre e escolha as questões ideais no Banco.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">2</div>
                    <p className="text-xs text-amber-900/70 font-bold">Anote os IDs: Use o botão "Copiar ID" na ordem que o aluno deve responder.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">3</div>
                    <p className="text-xs text-amber-900/70 font-bold">Solicite: Envie a lista de IDs e o tema para a equipe de suporte.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: SIMULADOS */}
      <GuideSection id="modulo-simulados" title="Módulo de Simulados: O Teste de Fogo" icon="assignment" color="emerald">
        <div className="space-y-10">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h4 className="text-xl font-black text-slate-800 uppercase mb-4 italic">🎯 Objetivo Pedagógico</h4>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Visa recriar a experiência real de prova, treinando não apenas conhecimento, mas também gestão de tempo e controle emocional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">01</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Parâmetros</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Título claro, Tempo (cronômetro), Banca e Status (Ativo).</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">02</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Pontuação</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Pesos por disciplina e Peso Erro (fator de correção).</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">03</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Montagem</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Inserir as questões colando os IDs manualmente.</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">04</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Organizando</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Reordenar questões ou remover as incorretas.</p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: APOSTILAS */}
      <GuideSection id="modulo-apostilas" title="Módulo de Apostilas: O Coração Interativo" icon="description" color="purple">
        <div className="space-y-12">
          <p className="text-slate-600 leading-relaxed font-medium">
            Integram teoria, prática e multimídia. O professor atua como um "garante" da qualidade técnica e pedagógica, assegurando que a experiência seja imersiva.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h4 className="text-xl font-black text-slate-800 uppercase italic">🛠️ O Editor Inteativo</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Utilize botões coloridos para inserir elementos via TAGS:
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--QUESTAO--]</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--VIDEO--]</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--TAGS DE FORMATAÇÃO--]</span>
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold">Dica: Use as tags Lei, Exemplo e Correção para blocos destacados.</p>
            </div>

            <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl space-y-6">
              <h4 className="text-lg font-black uppercase tracking-tight text-white border-l-2 border-purple-400 pl-4">✅ O Fluxo de Validação</h4>
              <ul className="space-y-4 text-xs font-medium text-slate-400">
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Estrutura:</strong> Layout limpo, fontes e títulos (H1, H2) corretos.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Imagens:</strong> Avalie se precisa de mapas mentais ou gráficos adicionais.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Cadernos:</strong> Certifique-se de que estão vinculados ao final.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Questões:</strong> Verifique se os IDs inseridos são pertinentes ao texto.</li>
                <li className="flex gap-3 items-start pt-4 border-t border-slate-800 text-emerald-400 uppercase font-black tracking-widest">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span> VALIDAR APOSTILA: O selo final de qualidade.
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <span className="material-symbols-outlined text-rose-500">history</span>
              <h5 className="font-black text-xs uppercase text-slate-800 italic">Backup de Segurança</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Use a função Copiar Apostila com sufixo _BACKUP antes de grandes edições.</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <span className="material-symbols-outlined text-blue-500">speaker_notes</span>
              <h5 className="font-black text-xs uppercase text-slate-800 italic">Notas de Edição</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Use o campo de notas para pedir ajustes que não consegue fazer diretamente.</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <span className="material-symbols-outlined text-amber-500">filter_list</span>
              <h5 className="font-black text-xs uppercase text-slate-800 italic">Filtros de Edição</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Visualize apenas os materiais sob sua responsabilidade ou disciplina.</p>
            </div>
          </div>
        </div>
      </GuideSection>

      <div className="text-center pt-10 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Bora Passar Agora &copy; 2026</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
};

const GuideSection: React.FC<{ id: string; title: string; icon: string; color: 'blue' | 'amber' | 'emerald' | 'purple'; children: React.ReactNode }> = ({ id, title, icon, color, children }) => {
  const colorClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    amber: 'border-amber-100 bg-amber-50 text-amber-600',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    purple: 'border-purple-100 bg-purple-50 text-purple-600',
  };

  return (
    <section id={id} className="scroll-mt-24">
      <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center">
        <div className={`w-full p-8 md:p-12 flex flex-col md:flex-row items-center gap-6 border-b border-slate-100`}>
          <div className={`size-16 rounded-2xl flex items-center justify-center shrink-0 ${colorClasses[color]}`}>
            <span className="material-symbols-outlined text-3xl">{icon}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic transition-colors text-center md:text-left">{title}</h2>
        </div>
        <div className="p-8 md:p-12 w-full text-left">
          {children}
        </div>
      </div>
    </section>
  );
};

const StepCard: React.FC<{ number: string; title: string; desc: string }> = ({ number, title, desc }) => (
  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
    <div className="size-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-black mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">{number}</div>
    <h5 className="font-black text-sm uppercase text-slate-800 mb-2">{title}</h5>
    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{desc}</p>
  </div>
);

// --- FIM COMPONENTES CARTILHA ---

// Components Auxiliares
const DashboardCard: React.FC<{ title: string; icon: string; color: string; children: React.ReactNode }> = ({ title, icon, color, children }) => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all h-full flex flex-col">
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
      <div className={`size-10 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h4 className="font-bold text-slate-800">{title}</h4>
    </div>
    <div className="flex-1">
      {children}
    </div>
  </div>
);

const ListItem: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <li className="flex flex-col pb-2 border-b border-slate-50 last:border-0 last:pb-0">
    <span className="font-bold text-slate-700 text-sm truncate">{title}</span>
    <span className="text-[10px] text-slate-400 uppercase font-bold">{subtitle}</span>
  </li>
);

const EmptyState = () => (
  <div className="text-center py-8 opacity-50">
    <span className="material-symbols-outlined text-3xl mb-1">sentiment_dissatisfied</span>
    <p className="text-xs">Sem dados recentes</p>
  </div>
);

export default Dashboard;
