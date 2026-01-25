import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useReactToPrint } from 'react-to-print';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BalanceSummary {
    revenue: number;
    operatingCosts: number;
    professionalCosts: number;
    totalExpenses: number;
    netResult: number;
}

interface Transaction {
    id: string;
    date: string;
    description: string;
    category: 'Receita' | 'Custo Operacional' | 'Pagamento Profissional';
    amount: number;
    status: string;
    type: 'income' | 'expense';
}

const FinancialBalance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [summary, setSummary] = useState<BalanceSummary>({
        revenue: 0,
        operatingCosts: 0,
        professionalCosts: 0,
        totalExpenses: 0,
        netResult: 0
    });
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const printRef = useRef(null);

    const handlePrint = useReactToPrint({
        // @ts-ignore
        content: () => printRef.current,
        documentTitle: `Balanco_Financeiro_${month}_${year}`,
    });

    useEffect(() => {
        fetchData();
    }, [month, year]);

    const fetchData = async () => {
        setLoading(true);
        // Define date range
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString(); // Last day of month

        try {
            // 1. Fetch Revenue (Enrollments)
            // Using created_at for sales date
            const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (enrollError) throw enrollError;

            // 2. Fetch Operating Costs
            // Using payment_date for competence
            const { data: costs, error: costsError } = await supabase
                .from('costs')
                .select('*')
                .gte('payment_date', startDate.split('T')[0]) // comparison with date string
                .lte('payment_date', endDate.split('T')[0]);

            if (costsError) throw costsError;

            // 3. Fetch Professional Payments
            // Using created_at for competence (when the obligation was created)
            // Or due_date? commissions are created_at = sale date usually.
            const { data: profPayments, error: profError } = await supabase
                .from('professional_payments')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (profError) throw profError;

            // Process Data
            const revenueTotal = enrollments?.reduce((sum, item) => sum + (Number(item.amount_paid) || 0), 0) || 0;
            const costTotal = costs?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
            const profTotal = profPayments?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

            setSummary({
                revenue: revenueTotal,
                operatingCosts: costTotal,
                professionalCosts: profTotal,
                totalExpenses: costTotal + profTotal,
                netResult: revenueTotal - (costTotal + profTotal)
            });

            // Merge Transactions for List
            const transList: Transaction[] = [];

            enrollments?.forEach(e => {
                transList.push({
                    id: `env-${e.id}`,
                    date: e.created_at,
                    description: `Venda Curso (ID: ${e.id.slice(0, 8)})`,
                    category: 'Receita',
                    amount: Number(e.amount_paid) || 0,
                    status: e.status,
                    type: 'income'
                });
            });

            costs?.forEach(c => {
                transList.push({
                    id: `cost-${c.id}`,
                    date: c.payment_date,
                    description: c.description,
                    category: 'Custo Operacional',
                    amount: Number(c.amount) || 0,
                    status: c.status,
                    type: 'expense'
                });
            });

            profPayments?.forEach(p => {
                transList.push({
                    id: `prof-${p.id}`,
                    date: p.created_at,
                    description: p.description || 'Pagamento Profissional',
                    category: 'Pagamento Profissional',
                    amount: Number(p.amount) || 0,
                    status: p.status,
                    type: 'expense'
                });
            });

            // Sort by date desc
            transList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(transList);

        } catch (error) {
            console.error('Error fetching balance:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="animate-in fade-in duration-500 pb-20 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Balanço Geral</h2>
                    <p className="text-[#617589] font-medium">Análise de receitas e despesas do período.</p>
                </div>
                <div className="flex gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <select
                        value={month}
                        onChange={e => setMonth(Number(e.target.value))}
                        className="bg-transparent font-bold text-slate-700 outline-none px-2 py-1"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="bg-transparent font-bold text-slate-900 outline-none px-2 py-1 border-l border-slate-200"
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95 no-print"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir Relatório
                </button>
            </div>

            {/* Printable Content */}
            <div ref={printRef} className="space-y-8 p-4 print:p-0">
                <div className="hidden print:block mb-8 text-center border-b border-black pb-4">
                    <h1 className="text-2xl font-black uppercase">Relatório Financeiro</h1>
                    <p className="text-sm">Período: {month}/{year}</p>
                    <p className="text-xs text-slate-500">Gerado em {new Date().toLocaleDateString()}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-100 print:border-slate-200 print:bg-white">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm print:hidden">
                                <span className="material-symbols-outlined">trending_up</span>
                            </span>
                            <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Receita Bruta</p>
                        </div>
                        <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(summary.revenue)}</p>
                    </div>

                    <div className="p-6 bg-amber-50 rounded-[32px] border border-amber-100 print:border-slate-200 print:bg-white">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 bg-white rounded-lg text-amber-600 shadow-sm print:hidden">
                                <span className="material-symbols-outlined">settings</span>
                            </span>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Custos Operacionais</p>
                        </div>
                        <p className="text-2xl font-black text-amber-600 tracking-tight">{formatCurrency(summary.operatingCosts)}</p>
                    </div>

                    <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100 print:border-slate-200 print:bg-white">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 bg-white rounded-lg text-blue-600 shadow-sm print:hidden">
                                <span className="material-symbols-outlined">groups</span>
                            </span>
                            <p className="text-xs font-black text-blue-800 uppercase tracking-widest">Repasse Profissionais</p>
                        </div>
                        <p className="text-2xl font-black text-blue-600 tracking-tight">{formatCurrency(summary.professionalCosts)}</p>
                    </div>

                    <div className={`p-6 rounded-[32px] border ${summary.netResult >= 0 ? 'bg-slate-900 text-white' : 'bg-red-50 text-red-600 border-red-100'} print:border-black print:bg-white print:text-black`}>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`p-2 rounded-lg shadow-sm print:hidden ${summary.netResult >= 0 ? 'bg-white/10 text-white' : 'bg-white text-red-500'}`}>
                                <span className="material-symbols-outlined">account_balance</span>
                            </span>
                            <p className={`text-xs font-black uppercase tracking-widest ${summary.netResult >= 0 ? 'text-slate-400' : 'text-red-400'}`}>Resultado Líquido</p>
                        </div>
                        <p className="text-3xl font-black tracking-tight">{formatCurrency(summary.netResult)}</p>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm print:hidden h-[400px]">
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-6">Visualização Gráfica</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Receita', value: summary.revenue, fill: '#10b981' },
                            { name: 'Custos', value: summary.operatingCosts, fill: '#f59e0b' },
                            { name: 'Repasses', value: summary.professionalCosts, fill: '#3b82f6' },
                            { name: 'Líquido', value: summary.netResult, fill: summary.netResult >= 0 ? '#1e293b' : '#ef4444' }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(value) => `R$${value / 1000}k`} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                    <div className="p-8 border-b border-slate-100 print:border-b-2 print:border-black">
                        <h3 className="text-xl font-black text-slate-900 uppercase">Detalhamento de Transações</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 uppercase font-black text-[10px] tracking-widest text-slate-400 print:bg-transparent print:text-black">
                                <tr>
                                    <th className="p-6">Data</th>
                                    <th className="p-6">Descrição</th>
                                    <th className="p-6">Categoria</th>
                                    <th className="p-6">Status</th>
                                    <th className="p-6 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                                            Nenhuma transação encontrada neste período.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                                            <td className="p-6 font-bold">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="p-6 font-medium max-w-[300px] truncate">{t.description}</td>
                                            <td className="p-6">
                                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-wide
                                                    ${t.category === 'Receita' ? 'bg-emerald-100 text-emerald-700' :
                                                        t.category === 'Custo Operacional' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}
                                                    print:bg-transparent print:text-black print:p-0
                                                `}>
                                                    {t.category}
                                                </span>
                                            </td>
                                            <td className="p-6 text-xs">{t.status}</td>
                                            <td className={`p-6 text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-400'} print:text-black`}>
                                                {t.type === 'expense' ? '- ' : '+ '}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style type="text/css" media="print">
                {`
               @page { size: landscape; margin: 20mm; }
               body { -webkit-print-color-adjust: exact; }
               .no-print { display: none !important; }
               `}
            </style>
        </div>
    );
};

export default FinancialBalance;
