import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SalesAdminProps {
  type: 'vendas' | 'inscricoes' | 'pagamentos';
}

interface SaleItem {
  id: string;
  user: string;
  email: string;
  course: string;
  value: number;
  status: string;
  method: string;
  date: string;
  formattedDate: string;
}

const SalesAdmin: React.FC<SalesAdminProps> = ({ type }) => {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [statusFilter, setStatusFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [summary, setSummary] = useState({
    totalMonth: 0,
    totalMonthString: 'R$ 0,00',
    pending: 0,
    pendingString: 'R$ 0,00',
    count: 0
  });

  useEffect(() => {
    fetchSales();
    fetchSummary(); // Separate summary fetch to always show accurate totals regardless of pagination
  }, [page, statusFilter, search]); // Refetch on page or filter change

  // Separate function to get global totals (not affected by pagination)
  const fetchSummary = async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Totais do mês
    const { data: monthData } = await supabase
      .from('enrollments')
      .select('amount_paid, status')
      .gte('created_at', firstDay);

    if (monthData) {
      const total = monthData
        .filter(i => i.status !== 'Cancelado')
        .reduce((acc, curr) => acc + (curr.amount_paid || 0), 0);

      const count = monthData.filter(i => i.status !== 'Cancelado').length;

      // Pendentes (Geral, não só do mês)
      const { data: pendingData } = await supabase
        .from('enrollments')
        .select('amount_paid')
        .in('status', ['Pendente', 'Aguardando']);

      const totalPending = pendingData
        ? pendingData.reduce((acc, curr) => acc + (curr.amount_paid || 0), 0)
        : 0;

      setSummary({
        totalMonth: total,
        totalMonthString: formatCurrency(total),
        pending: totalPending,
        pendingString: formatCurrency(totalPending),
        count
      });
    }
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('enrollments')
        .select(`
          id,
          amount_paid,
          payment_method,
          status,
          created_at,
          course_id,
          profile_id,
          profiles!inner (full_name, email),
          courses (title)
        `, { count: 'exact' });

      // Apply filters
      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (search) {
        // Busca textual (usando ilike no join !inner do profiles)
        // Nota: Isso pode ser performático, mas depende de índices
        query = query.ilike('profiles.full_name', `%${search}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setTotalItems(count || 0);

      if (data) {
        const formattedSales: SaleItem[] = data.map((item: any) => {
          const isFree = item.amount_paid === 0;
          // Lógica de método: Se grátis, é "Gratuito". Se não informado e não grátis, "Indefinido".
          let displayMethod = item.payment_method;
          if (isFree) displayMethod = 'Gratuito';
          else if (!displayMethod) displayMethod = 'Não inf.';

          return {
            id: item.id,
            user: item.profiles?.full_name || 'Usuário Desconhecido',
            email: item.profiles?.email || '',
            course: item.courses?.title || 'Curso Removido',
            value: item.amount_paid || 0,
            status: item.status || 'Pendente',
            method: displayMethod,
            date: item.created_at,
            formattedDate: new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
          };
        });

        setSales(formattedSales);
      }
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Financeiro: Vendas</h2>
          <p className="text-slate-500">Acompanhamento de fluxo de caixa e novos alunos em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSales}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all text-slate-600"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total do Mês (Recebido)', val: summary.totalMonthString, trend: `${summary.count} vendas`, color: 'blue' },
          { label: 'Ticket Médio (Mês)', val: summary.count > 0 ? formatCurrency(summary.totalMonth / summary.count) : 'R$ 0,00', trend: 'Média', color: 'green' },
          { label: 'Pendentes / Processando', val: summary.pendingString, trend: 'Aguardando Pgto', color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className={`absolute right-0 top-0 p-3 opacity-10 group-hover:scale-110 transition-transform`}>
              <span className={`material-symbols-outlined text-6xl text-${stat.color}-500`}>
                {i === 0 ? 'payments' : i === 1 ? 'analytics' : 'pending'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-end gap-3">
              <span className="text-2xl font-black text-slate-900">{stat.val}</span>
              <span className={`text-xs font-bold text-${stat.color}-500 mb-1 px-1.5 py-0.5 bg-${stat.color}-50 rounded-lg`}>
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros e Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

        {/* Barra de Filtros */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-lg text-slate-800">Transações</h3>
            <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-lg tracking-wider">
              {totalItems} Registros
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">search</span>
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSales()}
                onBlur={() => fetchSales()}
                className="pl-10 pr-4 py-2 w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1); // Reset page on filter change
              }}
              className="pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">Ativo / Aprovado</option>
              <option value="Pendente">Pendente</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center">
            <div className="size-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-sm">Carregando transações...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
            <p className="font-bold text-slate-500">Nenhum resultado encontrado.</p>
            <p className="text-xs">Tente ajustar os filtros de busca.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Cliente / Produto</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Valor</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Método</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{item.user}</span>
                          <span className="text-xs text-slate-500 mb-0.5">{item.email}</span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1">{item.course}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-slate-700">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase border ${item.method === 'Gratuito'
                            ? 'bg-purple-50 text-purple-600 border-purple-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                          {item.method}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide flex items-center w-fit gap-1.5 ${item.status === 'Ativo' || item.status === 'Pago' || item.status === 'Aprovado'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'Cancelado'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                          <div className={`size-1.5 rounded-full ${item.status === 'Ativo' || item.status === 'Pago' || item.status === 'Aprovado' ? 'bg-emerald-500' :
                              item.status === 'Cancelado' ? 'bg-red-500' : 'bg-amber-500'
                            }`}></div>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400 font-bold font-mono">
                        {item.formattedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase disabled:opacity-50 hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
                Anterior
              </button>

              <span className="text-xs font-bold text-slate-400">
                Página <span className="text-slate-900">{page}</span> de <span className="text-slate-900">{Math.ceil(totalItems / ITEMS_PER_PAGE) || 1}</span>
              </span>

              <button
                disabled={page * ITEMS_PER_PAGE >= totalItems}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase disabled:opacity-50 hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                Próxima
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SalesAdmin;

