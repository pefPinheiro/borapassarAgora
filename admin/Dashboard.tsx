import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

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
