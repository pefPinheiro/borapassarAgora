
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Inscricao {
    id: string;
    profile_id: string;
    alunoNome: string;
    alunoEmail: string;
    cursoId: string;
    cursoNome: string;
    dataMatricula: string;
    status: string;
}

const InscricoesAdmin: React.FC = () => {
    const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const ITEMS_PER_PAGE = 20;

    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInscricao, setEditingInscricao] = useState<Inscricao | null>(null);

    // Dropdowns data
    const [cursosDisponiveis, setCursosDisponiveis] = useState<any[]>([]);
    const [alunosDisponiveis, setAlunosDisponiveis] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        profile_id: '',
        cursoId: '',
        status: 'Ativo'
    });

    useEffect(() => {
        fetchData(page);

        // Subscribe to Realtime changes
        const channel = supabase
            .channel('realtime-enrollments')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'enrollments' },
                (payload) => {
                    console.log('Realtime update:', payload);
                    // Refresh current page
                    fetchData(page);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [page]); // Removed dependency on searchTerm to allow manual search trigger or we can add it if we want live search

    const fetchData = async (currentPage = page) => {
        try {
            setLoading(true);
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let enrollQuery = supabase
                .from('enrollments')
                .select(`
                    id,
                    status,
                    created_at,
                    course_id,
                    profile_id,
                    courses:course_id (title),
                    profiles:profile_id!inner (full_name, email, cpf)
                `, { count: 'exact' });

            if (searchTerm) {
                enrollQuery = enrollQuery.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`, { foreignTable: 'profiles' });
            }

            enrollQuery = enrollQuery
                .order('created_at', { ascending: false })
                .range(from, to);

            // In Parallel: Fetch Enrollments, Courses, Profiles
            const [enrollResult, coursesResult, profilesResult] = await Promise.all([
                enrollQuery,

                supabase
                    .from('courses')
                    .select('id, title')
                    .order('title'),

                supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .order('full_name')
            ]);

            if (enrollResult.error) throw enrollResult.error;
            if (coursesResult.error) throw coursesResult.error;
            // profilesResult might fail if RLS prevents listing all users. We handle gracefully.

            if (enrollResult.count !== null) setTotalItems(enrollResult.count);

            // Set Dropdowns
            setCursosDisponiveis(coursesResult.data || []);
            setAlunosDisponiveis(profilesResult.data || []);

            // Format Enrollments
            const formatted = (enrollResult.data || []).map((item: any) => ({
                id: item.id,
                profile_id: item.profile_id,
                alunoNome: item.profiles?.full_name || 'Desconhecido',
                alunoEmail: item.profiles?.email || '—',
                cursoId: item.course_id,
                cursoNome: item.courses?.title || 'Curso Removido',
                dataMatricula: new Date(item.created_at).toLocaleDateString('pt-BR'),
                status: item.status || 'Ativo'
            }));

            setInscricoes(formatted);

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            // alert('Erro ao carregar dados de inscrições.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (inscricao?: Inscricao) => {
        if (inscricao) {
            setEditingInscricao(inscricao);
            setFormData({
                profile_id: inscricao.profile_id,
                cursoId: inscricao.cursoId,
                status: inscricao.status
            });
        } else {
            setEditingInscricao(null);
            setFormData({
                profile_id: '',
                cursoId: '',
                status: 'Ativo'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingInscricao) {
                // Update existing
                const { error } = await supabase
                    .from('enrollments')
                    .update({
                        course_id: formData.cursoId,
                        status: formData.status
                        // We typically don't change profile_id of an existing enrollment
                    })
                    .eq('id', editingInscricao.id);

                if (error) throw error;
            } else {
                // Create new
                // Check if user is already enrolled in this course?
                // For now, simplify. Supabase might throw constraint error.
                const { error } = await supabase
                    .from('enrollments')
                    .insert([{
                        profile_id: formData.profile_id,
                        course_id: formData.cursoId,
                        status: formData.status,
                        progress: 0
                    }]);

                if (error) throw error;
            }

            await fetchData();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleToggleStatus = async (inscricao: Inscricao) => {
        try {
            const newStatus = inscricao.status === 'Ativo' ? 'Cancelado' : 'Ativo';

            // Optimistic Update
            setInscricoes(prev => prev.map(ins =>
                ins.id === inscricao.id ? { ...ins, status: newStatus } : ins
            ));

            const { error } = await supabase
                .from('enrollments')
                .update({ status: newStatus })
                .eq('id', inscricao.id);

            if (error) {
                // Revert if error
                setInscricoes(prev => prev.map(ins =>
                    ins.id === inscricao.id ? { ...ins, status: inscricao.status } : ins
                ));
                throw error;
            }

            // [NEW] If canceling, create negative refund records for existing commissions
            if (newStatus === 'Cancelado') {
                const { data: existingPayments } = await supabase
                    .from('professional_payments')
                    .select('*')
                    .eq('enrollment_id', inscricao.id)
                    .neq('type', 'Estorno'); // Avoid double reversing if toggled back and forth multiple times? 
                // Ideally we should check if already reversed, but simplistic approach:
                // Just reverse whatever positive amount exists.

                if (existingPayments && existingPayments.length > 0) {
                    const estornos = existingPayments.map(p => ({
                        user_id: p.user_id,
                        amount: -Math.abs(p.amount), // Ensure negative
                        description: `Estorno (Cancelamento Matrícula)`,
                        type: 'Estorno',
                        due_date: new Date().toISOString().split('T')[0], // Immediate effect
                        status: 'Pendente', // Pending usually means "to be deducted from next payment"
                        enrollment_id: inscricao.id,
                        course_id: p.course_id,
                        created_at: new Date().toISOString()
                    }));

                    const { error: estornoError } = await supabase
                        .from('professional_payments')
                        .insert(estornos);

                    if (estornoError) console.error('Error creating estornos', estornoError);
                }
            }

        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            alert('Não foi possível atualizar o status.');
        }
    };

    if (loading && inscricoes.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="size-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight">Suporte: Inscrições</h2>
                    <p className="text-[#617589] font-medium">Gerencie as matrículas dos alunos, troque cursos e ajuste acessos.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar Aluno (Nome, Email, CPF)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setPage(1);
                                    fetchData(1);
                                }
                            }}
                            className="h-12 w-full md:w-80 pl-10 pr-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setPage(1); fetchData(1); }}
                            className="flex items-center justify-center size-12 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-500 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
                            title="Atualizar Lista"
                        >
                            <span className={`material-symbols-outlined ${loading ? 'animate-spin text-blue-500' : ''}`}>sync</span>
                        </button>
                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            Nova Matrícula
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                                <th className="px-8 py-5">Aluno / Identificação</th>
                                <th className="px-8 py-5">Curso Matriculado</th>
                                <th className="px-8 py-5">Data Matrícula</th>
                                <th className="px-8 py-5 text-center">Status</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {inscricoes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                                        Nenhuma inscrição encontrada na base de dados.
                                    </td>
                                </tr>
                            ) : (
                                inscricoes.map((ins) => (
                                    <tr key={ins.id} className="hover:bg-[#f8fafc] transition-colors group">
                                        <td className="px-8 py-6">
                                            <div>
                                                <p className="text-sm font-black text-[#111418] mb-0.5">{ins.alunoNome}</p>
                                                <p className="text-[10px] text-slate-400 font-bold tracking-tight">{ins.alunoEmail}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px] text-[#137fec]">school</span>
                                                <span className="text-sm font-bold text-slate-700">{ins.cursoNome}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-medium text-slate-500">{ins.dataMatricula}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${ins.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600' :
                                                ins.status === 'Cancelado' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                <div className={`size-1.5 rounded-full ${ins.status === 'Ativo' ? 'bg-emerald-500' :
                                                    ins.status === 'Cancelado' ? 'bg-red-500' : 'bg-slate-400'
                                                    }`}></div>
                                                {ins.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenModal(ins)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Trocar Curso / Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(ins)}
                                                    className={`p-2 rounded-lg transition-all ${ins.status === 'Ativo'
                                                        ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                        : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                                                        }`}
                                                    title={ins.status === 'Ativo' ? 'Cancelar Matrícula' : 'Ativar Matrícula'}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">
                                                        {ins.status === 'Ativo' ? 'block' : 'check_circle'}
                                                    </span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, totalItems)} de {totalItems}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase disabled:opacity-50 hover:bg-slate-200 transition-all"
                        >
                            Anterior
                        </button>
                        <button
                            disabled={page * ITEMS_PER_PAGE >= totalItems}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase disabled:opacity-50 hover:bg-slate-200 transition-all"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}

            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                        <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                            <h3 className="text-2xl font-black text-[#111418] mb-6">
                                {editingInscricao ? 'Ajustar Matrícula' : 'Matrícula Manual'}
                            </h3>

                            <form onSubmit={handleSubmit} className="space-y-6">

                                {/* Seleção de Aluno */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Aluno</label>
                                    {editingInscricao ? (
                                        // Se editando, mostramos apenas o nome (não troca o aluno)
                                        <div className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-xl font-bold flex items-center text-slate-500">
                                            {editingInscricao.alunoNome} ({editingInscricao.alunoEmail})
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={formData.profile_id}
                                            onChange={e => setFormData({ ...formData, profile_id: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-[#137fec] transition-all"
                                        >
                                            <option value="">Selecione o aluno...</option>
                                            {alunosDisponiveis.map(aluno => (
                                                <option key={aluno.id} value={aluno.id}>
                                                    {aluno.full_name} ({aluno.email})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Seleção de Curso */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Curso</label>
                                    <select
                                        required
                                        value={formData.cursoId}
                                        onChange={e => setFormData({ ...formData, cursoId: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-[#137fec] transition-all"
                                    >
                                        <option value="">Selecione o curso...</option>
                                        {cursosDisponiveis.map(c => (
                                            <option key={c.id} value={c.id}>{c.title}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Seleção de Status */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                                    <select
                                        required
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-[#137fec] transition-all"
                                    >
                                        <option value="Ativo">Ativo</option>
                                        <option value="Cancelado">Cancelado</option>
                                        <option value="Expirado">Expirado</option>
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-3 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all"
                                    >
                                        {editingInscricao ? 'Salvar Alterações' : 'Concluir Matrícula'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default InscricoesAdmin;
