import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface InvestorConfig {
    quota_value: number;
    max_quotas: number;
    return_duration_months: number;
}

interface InvestorQuota {
    id: string;
    profile_id: string;
    full_name: string;
    email: string;
    quantity: number;
    amount_paid: number;
    total_received: number;
    roi_date: string | null;
    created_at: string;
    status: 'active' | 'pending' | 'rejected';
}

interface InvestorSummary {
    profile_id: string;
    full_name: string;
    email: string;
    totalQuotas: number;
    totalInvested: number;
    totalReturned: number;
    quotas: InvestorQuota[];
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
}

const InvestidoresAdmin: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<InvestorConfig>({ quota_value: 0, max_quotas: 0, return_duration_months: 0 });
    const [summaries, setSummaries] = useState<InvestorSummary[]>([]);
    const [investors, setInvestors] = useState<Profile[]>([]); // Potential investors (is_investor=true)

    // Modal State
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [buyData, setBuyData] = useState({ user_id: '', quantity: 1 });

    // Details Modal State
    const [selectedInvestor, setSelectedInvestor] = useState<InvestorSummary | null>(null);

    // Config Edit State
    const [editingConfig, setEditingConfig] = useState(false);
    const [tempConfig, setTempConfig] = useState<InvestorConfig>({ quota_value: 0, max_quotas: 0, return_duration_months: 0 });
    const [systemTotalQuotas, setSystemTotalQuotas] = useState(0);

    const [userRole, setUserRole] = useState('');
    const [userId, setUserId] = useState('');

    useEffect(() => {
        fetchUserAndData();
    }, []);

    const fetchUserAndData = async () => {
        setLoading(true);
        try {
            // Get Current User
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);

            // Get Profile Role
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            const role = profile?.role || 'user';
            setUserRole(role);

            // 1. Fetch Config
            const { data: configData } = await supabase.from('investor_config').select('*').single();
            if (configData) {
                setConfig({
                    quota_value: configData.quota_value,
                    max_quotas: configData.max_quotas,
                    return_duration_months: configData.return_duration_months
                });
                setTempConfig(configData);
            }

            // 2. Fetch Active Investors (Only needed for Super Admin to sell)
            if (role === 'super' || role === 'admin') {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').eq('is_investor', true).order('full_name');
                setInvestors(profiles || []);
            }

            // 3. Fetch Quotas
            let quotaQuery = supabase
                .from('investor_quotas')
                .select(`
                    id, quantity, amount_paid, total_received, roi_date, created_at, status, user_id,
                    profiles!user_id (id, full_name, email)
                `)
                .order('created_at', { ascending: false });

            // If NOT super, filter by own ID.
            if (role !== 'super') {
                quotaQuery = quotaQuery.eq('user_id', user.id);
            }

            const { data: quotasData, error } = await quotaQuery;
            if (error) throw error;

            const formattedQuotas = (quotasData || []).map((q: any) => ({
                id: q.id,
                profile_id: q.user_id, // Important: user_id from quota table
                full_name: q.profiles?.full_name || 'Desconhecido',
                email: q.profiles?.email || '—',
                quantity: q.quantity,
                amount_paid: q.amount_paid,
                total_received: q.total_received,
                roi_date: q.roi_date,
                created_at: q.created_at,
                status: q.status || 'active'
            }));

            processSummaries(formattedQuotas);

            // 4. Fetch System Total Quotas
            const { data: sumData } = await supabase.from('investor_quotas').select('quantity');
            const totalUsed = sumData?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
            setSystemTotalQuotas(totalUsed);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const processSummaries = (data: InvestorQuota[]) => {
        const map = new Map<string, InvestorSummary>();

        data.forEach(q => {
            const pid = q.profile_id;
            if (!map.has(pid)) {
                map.set(pid, {
                    profile_id: pid,
                    full_name: q.full_name,
                    email: q.email,
                    totalQuotas: 0,
                    totalInvested: 0,
                    totalReturned: 0,
                    quotas: []
                });
            }
            const summary = map.get(pid)!;
            summary.quotas.push(q);

            if (q.status === 'active') {
                summary.totalQuotas += q.quantity;
                summary.totalInvested += q.amount_paid;
                summary.totalReturned += q.total_received;
            } else if (q.status === 'rejected') {
                // For financial consistency with the visual list (where rejected is negative):
                // We deduct the values to ensure the Summary Total matches the sum of transactions.
                summary.totalInvested -= q.amount_paid;
                summary.totalReturned -= q.total_received;
            }
        });

        setSummaries(Array.from(map.values()));
    };

    const isAdminOrSuper = userRole === 'super' || userRole === 'admin';
    const isStrictSuper = userRole === 'super';

    const handleSaveConfig = async () => {
        if (!isStrictSuper) return;
        try {
            const { error } = await supabase.from('investor_config').upsert({
                id: 1,
                ...tempConfig
            });
            if (error) throw error;
            setConfig(tempConfig);
            setEditingConfig(false);
            alert('Configurações salvas!');
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        }
    };

    const handleBuyQuota = async () => {
        if (!isAdminOrSuper) return;

        let targetUserId = buyData.user_id;

        // If not super, force buy for self
        if (!isStrictSuper) {
            targetUserId = userId;
        }

        if (!targetUserId) return alert('Usuário inválido.');
        if (buyData.quantity <= 0) return alert('Quantidade inválida.');

        if (systemTotalQuotas + buyData.quantity > config.max_quotas) {
            return alert(`Limite global de cotas excedido. Disponíveis: ${config.max_quotas - systemTotalQuotas}`);
        }

        try {
            const amount = buyData.quantity * config.quota_value;
            const status = isStrictSuper ? 'active' : 'pending';

            const { error } = await supabase.from('investor_quotas').insert({
                user_id: targetUserId,
                quantity: buyData.quantity,
                amount_paid: amount,
                status: status
            });
            if (error) throw error;

            alert(
                isStrictSuper
                    ? 'Venda registrada com sucesso!'
                    : 'Solicitação de compra enviada! Aguarde a aprovação do administrador.'
            );
            setIsBuyModalOpen(false);
            setBuyData({ user_id: '', quantity: 1 });
            fetchUserAndData();
        } catch (e: any) {
            alert('Erro ao registrar transação: ' + e.message);
        }
    };

    const handleStatusChange = async (id: string, newStatus: 'active' | 'rejected') => {
        if (!isStrictSuper) return;
        try {
            const { error } = await supabase.from('investor_quotas').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            fetchUserAndData();
            if (selectedInvestor) {
                setSelectedInvestor(null);
            }
        } catch (e: any) {
            alert('Erro ao atualizar status: ' + e.message);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-8 animate-in fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">
                        {isStrictSuper ? 'Gestão de Investidores' : 'Investimentos'}
                    </h2>
                    <p className="text-[#617589] font-medium">
                        {isStrictSuper ? 'Controle de cotas e regras do sistema.' : 'Gerencie seus investimentos e acompanhe rendimentos.'}
                    </p>
                </div>
                {(isAdminOrSuper || userRole === 'user') && (
                    // Actually logic said: Admin View Investors. User view Self.
                    // The logic here is: Admin/Super sees Manage Buttons. Regular user sees "Invest" if allowed?
                    // Let's keep logic simple: Anyone can theoretically see 'Buy' if logic allows (e.g. self buy pending)
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setBuyData({ user_id: isStrictSuper ? '' : userId, quantity: 1 });
                                setIsBuyModalOpen(true);
                            }}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                        >
                            <span className="material-symbols-outlined">add_card</span>
                            {isStrictSuper ? 'Venda Manual' : 'Nova Aplicação'}
                        </button>
                    </div>
                )}
            </div>

            {/* Config Section (Super Admin Only) */}
            {isStrictSuper && (
                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">settings</span>
                            Regras de Investimento
                        </h3>
                        <button
                            onClick={() => editingConfig ? handleSaveConfig() : setEditingConfig(true)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${editingConfig ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            {editingConfig ? 'Salvar Alterações' : 'Editar Regras'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valor Unitário</label>
                            <input
                                type="number"
                                disabled={!editingConfig}
                                value={editingConfig ? tempConfig.quota_value : config.quota_value}
                                onChange={e => setTempConfig({ ...tempConfig, quota_value: Number(e.target.value) })}
                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Max Cotas (System)</label>
                            <input
                                type="number"
                                disabled={!editingConfig}
                                value={editingConfig ? tempConfig.max_quotas : config.max_quotas}
                                onChange={e => setTempConfig({ ...tempConfig, max_quotas: Number(e.target.value) })}
                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Meses Retorno</label>
                            <input
                                type="number"
                                disabled={!editingConfig}
                                value={editingConfig ? tempConfig.return_duration_months : config.return_duration_months}
                                onChange={e => setTempConfig({ ...tempConfig, return_duration_months: Number(e.target.value) })}
                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Summaries List */}
            {loading ? (
                <div className="p-12 flex justify-center">
                    <div className="size-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : summaries.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">savings</span>
                    <p className="font-bold">Nenhum investimento encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {summaries.map(investor => {
                        const hasActive = investor.quotas.some(q => q.status === 'active');
                        const hasPending = investor.quotas.some(q => q.status === 'pending');

                        let badgeText = 'Inativo';
                        let badgeColor = 'bg-slate-100 text-slate-400';

                        if (hasActive) {
                            badgeText = 'Investidor Ativo';
                            badgeColor = 'bg-emerald-100 text-emerald-600';
                        } else if (hasPending) {
                            badgeText = 'Aprovação Pendente';
                            badgeColor = 'bg-amber-100 text-amber-600';
                        }

                        return (
                            <div key={investor.profile_id} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                                <div className="p-8 flex-1 border-b md:border-b-0 md:border-r border-slate-100">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="size-12 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-xl uppercase">
                                            {investor.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-900">{investor.full_name}</h4>
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                                                    {badgeText}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{investor.email}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Investido</p>
                                            <p className="text-xl font-black text-slate-900">{formatCurrency(investor.totalInvested)}</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Retorno Recebido</p>
                                            <p className="text-xl font-black text-emerald-600">{formatCurrency(investor.totalReturned)}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedInvestor(investor)}
                                        className="w-full mt-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">history</span>
                                        Ver Detalhes
                                    </button>
                                </div>

                                <div className="flex-1 p-8 bg-slate-50/50">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Últimas Transações</h5>
                                    <div className="space-y-3">
                                        {investor.quotas.slice(0, 3).map((q, i) => (
                                            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 shadow-sm ${q.status === 'rejected' ? 'bg-red-50/50' : 'bg-white'
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-8 rounded-lg flex items-center justify-center ${q.status === 'rejected' ? 'bg-red-100 text-red-500' :
                                                        q.status === 'pending' ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-600'
                                                        }`}>
                                                        <span className="material-symbols-outlined text-[16px]">
                                                            {q.status === 'rejected' ? 'block' :
                                                                q.status === 'pending' ? 'pending' : 'check_circle'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[11px] font-bold ${q.status === 'rejected' ? 'text-red-700' : 'text-slate-800'}`}>
                                                            {q.quantity} Cotas
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-medium">{new Date(q.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[11px] font-black ${q.status === 'rejected' ? 'text-red-500' : 'text-slate-900'
                                                        }`}>
                                                        {q.status === 'rejected' ? formatCurrency(-q.amount_paid) : formatCurrency(q.amount_paid)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {investor.quotas.length > 3 && (
                                            <p className="text-[10px] text-center text-slate-400 font-bold mt-2">
                                                + {investor.quotas.length - 3} outras
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Detalhes (Table View) */}
            {selectedInvestor && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedInvestor(null)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Extrato do Investidor</h3>
                                <p className="text-sm font-bold text-slate-500">{selectedInvestor.full_name}</p>
                            </div>
                            <button onClick={() => setSelectedInvestor(null)} className="size-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar -mr-4 pr-4">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                                        <th className="px-6 py-4 rounded-l-xl">Data</th>
                                        <th className="px-6 py-4 text-center">Qtd. Cotas</th>
                                        <th className="px-6 py-4 text-right">Investido</th>
                                        <th className="px-6 py-4 text-right">Retornado</th>
                                        <th className="px-6 py-4 text-center rounded-r-xl">Status</th>
                                        {isStrictSuper && <th className="px-6 py-4 text-right">Ações</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedInvestor.quotas.map(q => {
                                        const isRejected = q.status === 'rejected';

                                        return (
                                            <tr key={q.id} className={`group hover:bg-slate-50 transition-colors ${isRejected ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-slate-700">{new Date(q.created_at).toLocaleDateString()}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-xs font-black text-slate-900">{q.quantity}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-xs font-bold ${isRejected ? 'text-red-500' : 'text-slate-600'}`}>
                                                        {isRejected ? formatCurrency(-q.amount_paid) : formatCurrency(q.amount_paid)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-xs font-bold text-emerald-600">
                                                        {isRejected ? '-' : formatCurrency(q.total_received)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${q.status === 'active' ? 'bg-emerald-100 text-emerald-600' :
                                                        q.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                            'bg-amber-100 text-amber-600'
                                                        }`}>
                                                        {q.status === 'active' ? 'Ativo' : q.status === 'rejected' ? 'Cancelado' : 'Pendente'}
                                                    </span>
                                                </td>
                                                {isStrictSuper && (
                                                    <td className="px-6 py-4 text-right">
                                                        {q.status === 'pending' && (
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => handleStatusChange(q.id, 'active')} className="size-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100" title="Aprovar">
                                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                                </button>
                                                                <button onClick={() => handleStatusChange(q.id, 'rejected')} className="size-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100" title="Rejeitar">
                                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                        {q.status === 'active' && (
                                                            <button onClick={() => handleStatusChange(q.id, 'rejected')} className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase hover:bg-red-50 hover:text-red-500 transition-colors">
                                                                Cancelar
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Buy Modal */}
            {isBuyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBuyModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 uppercase mb-6">{isStrictSuper ? 'Venda de Cotas' : 'Comprar Cotas'}</h3>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Investidor</label>
                                {isStrictSuper ? (
                                    <select
                                        value={buyData.user_id}
                                        onChange={e => setBuyData({ ...buyData, user_id: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                                    >
                                        <option value="">Selecione...</option>
                                        {investors.map(inv => (
                                            <option key={inv.id} value={inv.id}>{inv.full_name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-xl font-bold flex items-center text-slate-500">
                                        Você ({userId})
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Quantidade de Cotas</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={buyData.quantity}
                                    onChange={e => setBuyData({ ...buyData, quantity: Number(e.target.value) })}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none"
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                                <p className="text-xs text-blue-800 font-bold uppercase tracking-widest mb-1">Total a Pagar</p>
                                <p className="text-3xl font-black text-blue-600">{formatCurrency(buyData.quantity * config.quota_value)}</p>
                            </div>

                            <button
                                onClick={handleBuyQuota}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                            >
                                {isStrictSuper ? 'Confirmar Venda' : 'Confirmar Compra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvestidoresAdmin;
