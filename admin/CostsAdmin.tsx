import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Custo {
    id: string;
    description: string;
    amount: number;
    category: 'Recurso' | 'Aquisição' | 'Serviço' | 'Marketing' | 'Outros';
    payment_date: string;
    recurrence: 'Único' | 'Mensal' | 'Anual';
    status: 'Pago' | 'Pendente';
    notes?: string;
}

const CostsAdmin: React.FC = () => {
    const [custos, setCustos] = useState<Custo[]>([]);
    const [loading, setLoading] = useState(true);

    // Paginação
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const ITEMS_PER_PAGE = 10;

    // Filtros
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todas');
    const [statusFilter, setStatusFilter] = useState('Todos');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false); // Novo estado para modo de visualização
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Custo>>({
        description: '',
        amount: 0,
        category: 'Serviço',
        payment_date: new Date().toISOString().split('T')[0],
        recurrence: 'Único',
        status: 'Pendente',
        notes: ''
    });

    const [stats, setStats] = useState({
        totalMes: 0,
        pendentes: 0,
        pagos: 0
    });

    useEffect(() => {
        fetchCosts();
        fetchStats();
    }, [page, categoryFilter, statusFilter]);

    const fetchStats = async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const { data } = await supabase
            .from('costs')
            .select('amount, status')
            .gte('payment_date', startOfMonth)
            .lte('payment_date', endOfMonth);

        if (data) {
            const total = data.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            const pendente = data.filter(c => c.status === 'Pendente').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            const pago = total - pendente;

            setStats({
                totalMes: total,
                pendentes: pendente,
                pagos: pago
            });
        }
    };

    const fetchCosts = async () => {
        setLoading(true);
        try {
            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('costs')
                .select('*', { count: 'exact' });

            if (search) {
                query = query.ilike('description', `%${search}%`);
            }
            if (categoryFilter !== 'Todas') {
                query = query.eq('category', categoryFilter);
            }
            if (statusFilter !== 'Todos') {
                query = query.eq('status', statusFilter);
            }

            const { data, error, count } = await query
                .order('payment_date', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (data) {
                setCustos(data);
                if (count !== null) setTotalItems(count);
            }
        } catch (error) {
            console.error('Erro ao buscar custos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (custo?: Custo) => {
        setIsViewMode(false); // Reset view mode
        if (custo) {
            setEditingId(custo.id);
            setFormData(custo);
        } else {
            setEditingId(null);
            setFormData({
                description: '',
                amount: 0,
                category: 'Serviço',
                payment_date: new Date().toISOString().split('T')[0],
                recurrence: 'Único',
                status: 'Pendente',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleView = (custo: Custo) => {
        setEditingId(custo.id);
        setFormData(custo);
        setIsViewMode(true); // Set view mode
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isViewMode) return; // Prevent submit in view mode

        try {
            const payload = {
                description: formData.description,
                amount: formData.amount,
                category: formData.category,
                payment_date: formData.payment_date,
                recurrence: formData.recurrence,
                status: formData.status,
                notes: formData.notes
            };

            if (editingId) {
                const { error } = await supabase
                    .from('costs')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('costs')
                    .insert([payload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchCosts();
            fetchStats();
        } catch (error) {
            console.error('Erro ao salvar custo:', error);
            alert('Erro ao salvar lançamento.');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Deseja excluir este lançamento permanentemente?')) {
            try {
                const { error } = await supabase.from('costs').delete().eq('id', id);
                if (error) throw error;
                fetchCosts();
                fetchStats();
            } catch (error) {
                console.error('Erro ao excluir:', error);
            }
        }
    };

    const toggleStatus = async (custo: Custo) => {
        if (isViewMode) return;
        const newStatus = custo.status === 'Pago' ? 'Pendente' : 'Pago';
        try {
            // Optimistic update
            setCustos(prev => prev.map(c => c.id === custo.id ? { ...c, status: newStatus } : c));

            const { error } = await supabase
                .from('costs')
                .update({ status: newStatus })
                .eq('id', custo.id);

            if (error) {
                throw error;
            }
            fetchStats();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            fetchCosts(); // Revert
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Custos & Despesas</h2>
                    <p className="text-[#617589] font-medium">Gestão de recursos, serviços e investimentos operacionais.</p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined">add_card</span>
                    Lançar Despesa
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Saída Total (Mês)', val: stats.totalMes, color: 'text-slate-900', bg: 'bg-white', icon: 'payments' },
                    { label: 'Total Pago', val: stats.pagos, color: 'text-emerald-600', bg: 'bg-emerald-50/50', icon: 'check_circle' },
                    { label: 'A Pagar', val: stats.pendentes, color: 'text-amber-600', bg: 'bg-amber-50/50', icon: 'pending_actions' },
                ].map((s, i) => (
                    <div key={i} className={`${s.bg} p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between`}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                            <span className={`text-2xl font-black ${s.color}`}>R$ {s.val.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <span className={`material-symbols-outlined text-4xl opacity-20 ${s.color}`}>{s.icon}</span>
                    </div>
                ))}
            </div>

            {/* Filtros e Tabela */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Barra de Ferramentas */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                    <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar despesa..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onBlur={() => fetchCosts()}
                                onKeyDown={(e) => e.key === 'Enter' && fetchCosts()}
                                className="pl-10 pr-4 py-2 w-full md:w-48 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-red-500 transition-all"
                            />
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-red-500 cursor-pointer"
                        >
                            <option value="Todas">Todas Categorias</option>
                            <option value="Recurso">Recurso</option>
                            <option value="Aquisição">Aquisição</option>
                            <option value="Serviço">Serviço</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Outros">Outros</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-red-500 cursor-pointer"
                        >
                            <option value="Todos">Todos Status</option>
                            <option value="Pago">Pago</option>
                            <option value="Pendente">Pendente</option>
                        </select>
                    </div>

                    <p className="text-xs font-bold text-slate-400 whitespace-nowrap">
                        {totalItems} lançamentos
                    </p>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="size-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin"></div>
                    </div>
                ) : custos.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2">money_off</span>
                        <p className="font-bold">Nenhum custo encontrado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                                    <th className="px-8 py-5">Descrição / Categoria</th>
                                    <th className="px-8 py-5">Recorrência</th>
                                    <th className="px-8 py-5">Vencimento</th>
                                    <th className="px-8 py-5 text-center">Valor</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9]">
                                {custos.map((c) => (
                                    <tr key={c.id} className="hover:bg-[#f8fafc] transition-colors group cursor-pointer" onClick={() => handleOpenForm(c)}>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl shrink-0 ${c.category === 'Recurso' ? 'bg-blue-50 text-blue-600' :
                                                        c.category === 'Serviço' ? 'bg-purple-50 text-purple-600' :
                                                            c.category === 'Marketing' ? 'bg-amber-50 text-amber-600' :
                                                                'bg-slate-50 text-slate-600'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-[20px]">
                                                        {c.category === 'Recurso' ? 'database' :
                                                            c.category === 'Marketing' ? 'campaign' :
                                                                'settings'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[#111418] mb-0.5">{c.description}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{c.category}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${c.recurrence !== 'Único' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {c.recurrence}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-bold text-slate-700">
                                                {new Date(c.payment_date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="text-sm font-black text-red-600">
                                                - R$ {c.amount.toFixed(2).replace('.', ',')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleStatus(c); }}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${c.status === 'Pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                                    }`}
                                            >
                                                <div className={`size-1.5 rounded-full ${c.status === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                                {c.status}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleView(c); }}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Visualizar Detalhes"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenForm(c); }}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginação */}
                {totalItems > ITEMS_PER_PAGE && (
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
                            Página <span className="text-slate-900">{page}</span> de <span className="text-slate-900">{Math.ceil(totalItems / ITEMS_PER_PAGE)}</span>
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
                )}
            </div>

            {/* Modal de Cadastro/Visualização */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                {isViewMode ? 'Detalhes do Gasto' : (editingId ? 'Editar Lançamento' : 'Novo Gasto')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição</label>
                                <input
                                    disabled={isViewMode}
                                    required
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Servidor AWS, Limpeza..."
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-red-500 transition-all text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valor (R$)</label>
                                    <input
                                        disabled={isViewMode}
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-red-600 outline-none focus:border-red-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-red-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data</label>
                                    <input
                                        disabled={isViewMode}
                                        required
                                        type="date"
                                        value={formData.payment_date}
                                        onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-red-500 transition-all disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Categoria</label>
                                    <select
                                        disabled={isViewMode}
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                    >
                                        <option>Recurso</option>
                                        <option>Aquisição</option>
                                        <option>Serviço</option>
                                        <option>Marketing</option>
                                        <option>Outros</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recorrência</label>
                                    <select
                                        disabled={isViewMode}
                                        value={formData.recurrence}
                                        onChange={e => setFormData({ ...formData, recurrence: e.target.value as any })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                    >
                                        <option>Único</option>
                                        <option>Mensal</option>
                                        <option>Anual</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
                                <button
                                    disabled={isViewMode}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: 'Pendente' })}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.status === 'Pendente' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'text-slate-400 hover:text-slate-600'} disabled:opacity-70`}
                                >
                                    Pendente
                                </button>
                                <button
                                    disabled={isViewMode}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: 'Pago' })}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.status === 'Pago' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-slate-600'} disabled:opacity-70`}
                                >
                                    Pago
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Observações</label>
                                <textarea
                                    disabled={isViewMode}
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-red-500 transition-all disabled:bg-slate-100 disabled:text-slate-500"
                                    placeholder="Detalhes adicionais..."
                                ></textarea>
                            </div>

                            {!isViewMode && (
                                <button
                                    type="submit"
                                    className="w-full py-4 bg-slate-900 text-white rounded-[24px] font-black shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] uppercase tracking-widest"
                                >
                                    {editingId ? 'Atualizar Gasto' : 'Confirmar Lançamento'}
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostsAdmin;
