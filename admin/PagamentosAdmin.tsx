import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface Payment {
    id: string;
    user_id: string;
    amount: number;
    status: 'Pendente' | 'Pago';
    due_date: string;
    type: 'Comissão' | 'Fixo' | 'Outros' | 'Estorno';
    description: string;
    created_at: string;
    enrollment_id?: string;
    course_id?: string;
    snapshot_total_apostilas?: number;
    profiles?: {
        full_name: string;
        role: string;
    };
}

interface ProfessionalSummary {
    user_id: string;
    name: string;
    role: string;
    totalPending: number;
    totalPaid: number;
    payments: Payment[];
}

interface CommissionDetail {
    apostila_title: string;
    apostila_author: string;
    value_per_apostila: number;
    total_apostilas: number;
}

const PagamentosAdmin: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [summaries, setSummaries] = useState<ProfessionalSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProf, setSelectedProf] = useState<ProfessionalSummary | null>(null);
    const [canManagePayments, setCanManagePayments] = useState(false);

    // Form Modal State for Manual Payment
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [professionals, setProfessionals] = useState<Profile[]>([]);
    const [formData, setFormData] = useState({
        user_id: '',
        amount: 0,
        description: '',
        type: 'Outros',
        due_date: new Date().toISOString().split('T')[0]
    });

    // Commission Details Modal State
    const [commissionDetails, setCommissionDetails] = useState<any[]>([]);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<Payment | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Check current user permissions
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, role, view_all_payments')
                .eq('id', user.id)
                .single();

            const canViewAll = profile?.role === 'super' || profile?.view_all_payments === true;

            // 2. Fetch Payments
            let payQuery = supabase
                .from('professional_payments')
                .select('*, profiles(full_name, role)')
                .order('created_at', { ascending: false });

            // If CANNOT view all, filter by own ID
            if (!canViewAll) {
                payQuery = payQuery.eq('user_id', user.id);
            }

            const { data: payData, error: payError } = await payQuery;

            if (payError) throw payError;

            // 3. Fetch Professionals (for manual entry) ONLY if can view all (Admin mode)
            // If they can only see themselves, they shouldn't trigger manual payments for others
            if (canViewAll) {
                setCanManagePayments(true);
                const { data: profData, error: profError } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('role', ['admin', 'teacher', 'editor', 'moderator', 'user'])
                    .order('full_name');

                if (profError) console.error('Error fetching profiles', profError);
                else setProfessionals(profData || []);
            } else {
                setCanManagePayments(false);
            }

            setPayments(payData || []);
            processSummaries(payData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const processSummaries = (data: Payment[]) => {
        const map = new Map<string, ProfessionalSummary>();

        data.forEach(p => {
            const userId = p.user_id;
            if (!map.has(userId)) {
                map.set(userId, {
                    user_id: userId,
                    name: p.profiles?.full_name || 'Desconhecido',
                    role: p.profiles?.role || 'Staff',
                    totalPending: 0,
                    totalPaid: 0,
                    payments: []
                });
            }
            const summary = map.get(userId)!;
            summary.payments.push(p);

            if (p.status === 'Pendente') {
                summary.totalPending += Number(p.amount);
            } else {
                summary.totalPaid += Number(p.amount);
            }
        });

        setSummaries(Array.from(map.values()));
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('professional_payments').insert([{
                user_id: formData.user_id,
                amount: formData.amount,
                description: formData.description,
                type: formData.type,
                due_date: formData.due_date,
                status: 'Pendente'
            }]);

            if (error) throw error;

            setIsFormOpen(false);
            setFormData({ ...formData, description: '', amount: 0 });
            fetchData();
            alert('Pagamento registrado com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao registrar pagamento.');
        }
    };

    const handleMarkAsPaid = async (paymentId: string) => {
        if (!confirm('Confirmar pagamento deste lançamento?')) return;
        try {
            const { error } = await supabase
                .from('professional_payments')
                .update({ status: 'Pago' })
                .eq('id', paymentId);

            if (error) throw error;

            // Update local state to avoid full refetch flicker
            const updatedPayments = payments.map(p => p.id === paymentId ? { ...p, status: 'Pago' as const } : p);
            setPayments(updatedPayments);
            processSummaries(updatedPayments);

            // Update selectedProf as well if open
            if (selectedProf) {
                const updatedProfPayments = selectedProf.payments.map(p => p.id === paymentId ? { ...p, status: 'Pago' as const } : p);
                setSelectedProf({
                    ...selectedProf,
                    payments: updatedProfPayments,
                    totalPending: selectedProf.totalPending - (updatedPayments.find(p => p.id === paymentId)?.amount || 0),
                    totalPaid: selectedProf.totalPaid + (updatedPayments.find(p => p.id === paymentId)?.amount || 0)
                });
            }

        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar status.');
        }
    };

    const openCommissionDetails = async (payment: Payment) => {
        if (!payment.course_id || !payment.enrollment_id) return;

        setSelectedPaymentForDetail(payment);
        setDetailLoading(true);
        setIsDetailModalOpen(true);
        setCommissionDetails([]);

        try {
            // 1. Get Enrollment Amount
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('amount_paid')
                .eq('id', payment.enrollment_id)
                .single();

            const amountPaid = enrollment?.amount_paid || 0;

            // 2. Get Course Items (Apostilas) / Snapshot
            let totalApostilas = payment.snapshot_total_apostilas || 0;
            let currentItems = [];

            if (!totalApostilas) {
                const { data: items } = await supabase
                    .from('course_items')
                    .select('apostila_id')
                    .eq('course_id', payment.course_id);

                totalApostilas = items?.length || 0;
                currentItems = items || [];
            } else {
                // Even with snapshot, we need IDs to find author apostilas later
                // But for value calc, we use snapshot.
                // Ideally we should list all apostilas from that time, but we only store the count.
                // We will fetch current items to at least show names, but calc relies on count.
                const { data: items } = await supabase
                    .from('course_items')
                    .select('apostila_id')
                    .eq('course_id', payment.course_id);
                currentItems = items || [];
            }

            // Note: If course items changed, 'currentItems' might not match 'snapshot_total_apostilas' count.
            // But we use snapshot count for VALUE calculation.

            const apostilaValue = totalApostilas > 0 ? (amountPaid / 2.0) / totalApostilas : 0;

            // 3. Get Apostilas details for THIS author
            const { data: apostilas } = await supabase
                .from('apostilas')
                .select('id, title, author_id, commission_valid_until')
                .in('id', currentItems?.map(i => i.apostila_id) || []);

            const authorApostilas = apostilas?.filter(a => {
                const isAuthor = a.author_id === payment.user_id;
                if (!isAuthor) return false;

                if (a.commission_valid_until) {
                    const validDate = new Date(a.commission_valid_until);
                    const paymentDate = new Date(payment.created_at);
                    // Ensure validity covers the whole day
                    validDate.setHours(23, 59, 59, 999);
                    return paymentDate <= validDate;
                }
                return true;
            }) || [];

            // Correctly derive unit value from the final payment amount to ensure visual consistency
            // (Total Amount / Count of Author's contributing items)
            const realUnitValue = authorApostilas.length > 0 ? payment.amount / authorApostilas.length : 0;

            const details = authorApostilas.map(a => ({
                apostila_title: a.title,
                value_per_apostila: realUnitValue,
            }));

            setCommissionDetails(details);

        } catch (e) {
            console.error('Error fetching details', e);
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Pagamentos Profissionais</h2>
                    <p className="text-[#617589] font-medium">Controle de repasses financeiros para professores e colaboradores.</p>
                </div>
                <div className="flex gap-3">
                    {professionals.length > 0 && (
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all text-emerald-600 shadow-sm"
                        >
                            <span className="material-symbols-outlined">add_card</span>
                            Novo Pagamento Manual
                        </button>
                    )}
                    {/* Placeholder for export if needed */}
                </div>
            </div>

            {/* Aviso sobre garantia de 7 dias */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4">
                <div className="size-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                    <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight">Regra de Liberação & Cancelamentos</h4>
                    <p className="text-xs text-amber-700 font-medium mt-1 leading-relaxed">
                        Os pagamentos de comissão só são contabilizados efetivamente <strong>7 dias após a venda</strong> (prazo de garantia).
                        <br />
                        Caso uma inscrição seja cancelada neste período, o valor será descontado automaticamente ou deverá ser lançado como <strong>"Estorno"</strong> (seja por valor devolvido ao aluno ou custo administrativo).
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center">
                    <div className="size-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : summaries.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">payments</span>
                    <p className="font-bold">Nenhum registro de pagamento encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {summaries.map(prof => (
                        <div key={prof.user_id} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                            <div className="p-8 flex-1 border-b md:border-b-0 md:border-r border-slate-100">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl uppercase">
                                        {prof.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{prof.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{prof.role}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">A Pagar (Pendente)</p>
                                        <p className="text-xl font-black text-emerald-600">R$ {prof.totalPending.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Já Pago</p>
                                        <p className="text-xl font-black text-slate-300">R$ {prof.totalPaid.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedProf(prof)}
                                    className="w-full mt-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                    Ver Extrato Detalhado
                                </button>
                            </div>

                            <div className="flex-1 p-8 bg-slate-50/50">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Últimos Lançamentos</h5>
                                <div className="space-y-3">
                                    {prof.payments.slice(0, 3).map((lan, i) => (
                                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 shadow-sm ${lan.type === 'Estorno' || lan.amount < 0
                                            ? 'bg-red-50/50'
                                            : 'bg-white'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`size-8 rounded-lg flex items-center justify-center ${lan.type === 'Estorno' || lan.amount < 0 ? 'bg-red-100 text-red-600' :
                                                    lan.type === 'Comissão' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {lan.type === 'Comissão' ? 'local_offer' :
                                                            lan.type === 'Estorno' || lan.amount < 0 ? 'remove_circle' : 'payments'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-[11px] font-bold line-clamp-1 ${lan.type === 'Estorno' || lan.amount < 0 ? 'text-red-700' : 'text-slate-800'
                                                            }`}>{lan.description}</p>
                                                        {lan.type === 'Comissão' && lan.course_id && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openCommissionDetails(lan); }}
                                                                className="text-blue-500 hover:text-blue-700"
                                                                title="Ver detalhes do cálculo"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">info</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(lan.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[11px] font-black ${lan.type === 'Estorno' || lan.amount < 0 ? 'text-red-600' :
                                                    lan.status === 'Pago' ? 'text-slate-300' : 'text-emerald-600'
                                                    }`}>
                                                    {lan.status === 'Pago' ? '✔ ' : lan.amount < 0 ? '' : '+ '}
                                                    R$ {Number(lan.amount).toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {prof.payments.length > 3 && (
                                        <p className="text-[10px] text-center text-slate-400 font-bold mt-2">
                                            + {prof.payments.length - 3} outros lançamentos
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Extrato Completo */}
            {selectedProf && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProf(null)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Extrato do Profissional</h3>
                                <p className="text-sm font-bold text-slate-500">{selectedProf.name} — {selectedProf.role}</p>
                            </div>
                            <button onClick={() => setSelectedProf(null)} className="size-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-3 flex-1">
                            {selectedProf.payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(lan => (
                                <div key={lan.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${lan.status === 'Pago' ? 'bg-slate-200 text-slate-400' : 'bg-white text-emerald-600 shadow-sm'}`}>
                                            <span className="material-symbols-outlined">{lan.status === 'Pago' ? 'check' : 'attach_money'}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900">{lan.description}</p>
                                                {lan.type === 'Comissão' && lan.course_id && (
                                                    <button
                                                        onClick={() => openCommissionDetails(lan)}
                                                        className="size-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-100 transition-all"
                                                        title="Ver detalhes do cálculo"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-mono">Venc: {new Date(lan.due_date).toLocaleDateString()} • Emitido: {new Date(lan.created_at).toLocaleDateString()}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-500 text-[9px] font-black uppercase">
                                                {lan.type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`text-base font-black ${lan.status === 'Pago' ? 'text-slate-400 line-through decoration-2' : 'text-emerald-600'}`}>
                                            R$ {Number(lan.amount).toFixed(2).replace('.', ',')}
                                        </span>
                                        {lan.status === 'Pendente' ? (
                                            canManagePayments ? (
                                                <button
                                                    onClick={() => handleMarkAsPaid(lan.id)}
                                                    className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-600 active:scale-95"
                                                    title="Realizar Pagamento"
                                                >
                                                    Pagar
                                                </button>
                                            ) : null
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">done_all</span> Pago
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalhes da Comissão */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
                    <div className="relative bg-[#fafbfc] w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

                        {/* Header Fixed */}
                        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalhamento da Comissão</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">Base de cálculo por venda unitária</p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="p-12 flex justify-center h-full items-center">
                                <div className="size-10 border-4 border-slate-200 border-t-[#137fec] rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

                                {/* Total Card */}
                                <div className="relative overflow-hidden bg-gradient-to-br from-[#137fec] to-[#1d4ed8] p-8 rounded-[32px] text-white shadow-xl shadow-blue-500/30 ring-1 ring-white/20">
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Comissão Total deste Lançamento</p>
                                            <p className="text-4xl font-black tracking-tight">
                                                R$ {selectedPaymentForDetail?.amount.toFixed(2).replace('.', ',')}
                                            </p>
                                        </div>
                                        <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                            <span className="material-symbols-outlined text-3xl">payments</span>
                                        </div>
                                    </div>
                                    {/* Decoration */}
                                    <div className="absolute -right-10 -top-10 size-40 bg-white/10 rounded-full blur-3xl"></div>
                                    <div className="absolute -left-10 -bottom-10 size-40 bg-white/10 rounded-full blur-3xl"></div>
                                </div>

                                {/* List */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Apostilas Contabilizadas ({commissionDetails.length})
                                        </p>
                                        <div className="px-3 py-1 bg-slate-100 rounded-lg">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                                Valor Unitário: <span className="text-slate-900">R$ {commissionDetails[0]?.value_per_apostila.toFixed(2).replace('.', ',')}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {commissionDetails.length === 0 ? (
                                        <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                                            <p className="text-sm font-bold text-slate-400">Nenhuma apostila vinculada a este professor.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {commissionDetails.map((det, i) => (
                                                <div key={i} className="group flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-[#137fec]/30 hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="size-10 bg-slate-50 rounded-xl flex items-center justify-center text-xs font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors border border-slate-100">
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-slate-700 block mb-0.5 max-w-[200px] truncate" title={det.apostila_title}>{det.apostila_title}</span>
                                                            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <span className="size-1.5 rounded-full bg-[#137fec]"></span>
                                                                Apostila Digital
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                        + R$ {det.value_per_apostila.toFixed(2).replace('.', ',')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Info */}
                                <div className="bg-slate-100 p-5 rounded-3xl flex items-start gap-4 border border-slate-200">
                                    <div className="size-8 bg-white rounded-full flex items-center justify-center shrink-0 text-slate-400 shadow-sm">
                                        <span className="material-symbols-outlined text-lg">info</span>
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium leading-relaxed">
                                        <strong className="text-slate-900 block mb-1">Entenda o Cálculo:</strong>
                                        O aluno pagou o valor do curso. Metade desse valor (50%) é destinado ao pagamento de materiais.
                                        Esse montante é dividido pelo <strong className="text-slate-700">total de apostilas do curso</strong> para definir o valor unitário.
                                        Você recebe a soma das apostilas de sua autoria.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Novo Pagamento Manual */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Novo Pagamento Manual</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreatePayment} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Profissional</label>
                                <select
                                    required
                                    value={formData.user_id}
                                    onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                >
                                    <option value="">Selecione...</option>
                                    {professionals.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valor (R$)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo</label>
                                    <select
                                        required
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                    >
                                        <option>Fixo</option>
                                        <option>Comissão</option>
                                        <option>Estorno</option>
                                        <option>Outros</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vencimento</label>
                                <input
                                    required
                                    type="date"
                                    value={formData.due_date}
                                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Salário Jan/2026, Bônus..."
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-emerald-500 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-slate-900 text-white rounded-[24px] font-black shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] uppercase tracking-widest"
                            >
                                Confirmar Pagamento
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PagamentosAdmin;
