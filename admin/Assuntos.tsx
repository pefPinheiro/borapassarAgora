
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Disciplina, Assunto, Subassunto, Subsubassunto } from '../types';

interface AssuntoExtended extends Assunto {
    disciplina_name?: string;
    quantidade_questoes?: number;
    quantidade_subassuntos?: number;
}

interface SubassuntoExtended extends Subassunto {
    quantidade_subsubassuntos?: number;
}

const Assuntos: React.FC = () => {
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<AssuntoExtended[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssunto, setEditingAssunto] = useState<Assunto | null>(null);
    const [formData, setFormData] = useState<Partial<Assunto>>({
        name: '',
        disciplina_id: '',
        status: 'Ativo'
    });

    // Subassuntos State
    const [isSubassuntosModalOpen, setIsSubassuntosModalOpen] = useState(false);
    const [selectedAssuntoForSubassuntos, setSelectedAssuntoForSubassuntos] = useState<Assunto | null>(null);
    const [subassuntosList, setSubassuntosList] = useState<SubassuntoExtended[]>([]);
    const [subassuntosLoading, setSubassuntosLoading] = useState(false);
    const [newSubassunto, setNewSubassunto] = useState({ name: '', status: 'Ativo' });
    const [editingSubassuntoId, setEditingSubassuntoId] = useState<string | null>(null);

    // Subsubassuntos State
    const [isSubsubassuntosModalOpen, setIsSubsubassuntosModalOpen] = useState(false);
    const [selectedSubassuntoForSubsubassuntos, setSelectedSubassuntoForSubsubassuntos] = useState<Subassunto | null>(null);
    const [subsubassuntosList, setSubsubassuntosList] = useState<Subsubassunto[]>([]);
    const [subsubassuntosLoading, setSubsubassuntosLoading] = useState(false);
    const [newSubsubassunto, setNewSubsubassunto] = useState({ name: '', status: 'Ativo' });
    const [editingSubsubassuntoId, setEditingSubsubassuntoId] = useState<string | null>(null);

    // Filtros e Paginação
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDisciplina, setFilterDisciplina] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        fetchDisciplinas();
    }, []);

    useEffect(() => {
        fetchData();
    }, [searchQuery, filterDisciplina, currentPage]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterDisciplina]);

    const fetchDisciplinas = async () => {
        try {
            const { data, error } = await supabase.from('disciplinas').select('*').order('name');
            if (error) throw error;
            setDisciplinas(data || []);
        } catch (error) {
            console.error('Error fetching disciplinas:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('assuntos')
                .select('*, disciplinas(name), subassuntos(count)', { count: 'exact' });

            if (searchQuery) {
                query = query.ilike('name', `%${searchQuery}%`);
            }
            if (filterDisciplina) {
                query = query.eq('disciplina_id', filterDisciplina);
            }

            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('name')
                .range(from, to);

            if (error) throw error;

            setAssuntos(data.map(a => ({
                ...a,
                disciplina_name: (a.disciplinas as any)?.name || 'N/A',
                quantidade_questoes: 0,
                quantidade_subassuntos: (a.subassuntos as any)?.[0]?.count || 0
            })));
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const handleOpenModal = (assunto?: Assunto) => {
        if (assunto) {
            setEditingAssunto(assunto);
            setFormData({
                name: assunto.name,
                disciplina_id: assunto.disciplina_id,
                status: assunto.status
            });
        } else {
            setEditingAssunto(null);
            setFormData({ name: '', disciplina_id: '', status: 'Ativo' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAssunto(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('assuntos')
                .upsert({
                    id: editingAssunto?.id,
                    name: formData.name,
                    disciplina_id: formData.disciplina_id,
                    status: formData.status
                });

            if (error) throw error;

            fetchData();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving assunto:', error);
            alert('Erro ao salvar assunto');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Deseja realmente excluir este assunto?')) {
            try {
                const { error } = await supabase
                    .from('assuntos')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                fetchData();
            } catch (error) {
                console.error('Error deleting assunto:', error);
                alert('Erro ao excluir assunto');
            }
        }
    };

    const handleOpenSubassuntosModal = (assunto: Assunto) => {
        setSelectedAssuntoForSubassuntos(assunto);
        setIsSubassuntosModalOpen(true);
        fetchSubassuntos(assunto.id);
    };

    const handleCloseSubassuntosModal = () => {
        setIsSubassuntosModalOpen(false);
        setSelectedAssuntoForSubassuntos(null);
        setSubassuntosList([]);
        setNewSubassunto({ name: '', status: 'Ativo' });
        setEditingSubassuntoId(null);
    };

    const fetchSubassuntos = async (assuntoId: string) => {
        setSubassuntosLoading(true);
        try {
            const { data, error } = await supabase
                .from('subassuntos')
                .select('*, subsubassuntos(count)')
                .eq('assunto_id', assuntoId)
                .order('name');
            if (error) throw error;
            setSubassuntosList(data?.map((s: any) => ({
                ...s,
                quantidade_subsubassuntos: s.subsubassuntos?.[0]?.count || 0
            })) || []);
        } catch (error) {
            console.error('Error fetching subassuntos:', error);
            alert('Erro ao carregar subassuntos');
        } finally {
            setSubassuntosLoading(false);
        }
    };

    const handleSaveSubassunto = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedAssuntoForSubassuntos || !newSubassunto.name.trim()) return;

        try {
            const payload: any = {
                name: newSubassunto.name,
                assunto_id: selectedAssuntoForSubassuntos.id,
                status: newSubassunto.status,
            };
            if (editingSubassuntoId) {
                payload.id = editingSubassuntoId;
            }
            
            const { error } = await supabase.from('subassuntos').upsert(payload);
            if (error) throw error;
            
            setNewSubassunto({ name: '', status: 'Ativo' });
            setEditingSubassuntoId(null);
            fetchSubassuntos(selectedAssuntoForSubassuntos.id);
        } catch (error) {
            console.error('Error saving subassunto:', error);
            alert('Erro ao salvar subassunto');
        }
    };

    const handleDeleteSubassunto = async (id: string) => {
        if (!selectedAssuntoForSubassuntos) return;
        if (window.confirm('Deseja realmente excluir este subassunto?')) {
            try {
                const { error } = await supabase.from('subassuntos').delete().eq('id', id);
                if (error) throw error;
                fetchSubassuntos(selectedAssuntoForSubassuntos.id);
            } catch (error) {
                console.error('Error deleting subassunto:', error);
                alert('Erro ao excluir subassunto');
            }
        }
    };

    const startEditingSubassunto = (sub: Subassunto) => {
        setEditingSubassuntoId(sub.id);
        setNewSubassunto({ name: sub.name, status: sub.status });
    };

    const cancelEditingSubassunto = () => {
        setEditingSubassuntoId(null);
        setNewSubassunto({ name: '', status: 'Ativo' });
    };

    const handleOpenSubsubassuntosModal = (subassunto: Subassunto) => {
        setSelectedSubassuntoForSubsubassuntos(subassunto);
        setIsSubsubassuntosModalOpen(true);
        fetchSubsubassuntos(subassunto.id);
    };

    const handleCloseSubsubassuntosModal = () => {
        setIsSubsubassuntosModalOpen(false);
        setSelectedSubassuntoForSubsubassuntos(null);
        setSubsubassuntosList([]);
        setNewSubsubassunto({ name: '', status: 'Ativo' });
        setEditingSubsubassuntoId(null);
    };

    const fetchSubsubassuntos = async (subassuntoId: string) => {
        setSubsubassuntosLoading(true);
        try {
            const { data, error } = await supabase
                .from('subsubassuntos')
                .select('*')
                .eq('subassunto_id', subassuntoId)
                .order('name');
            if (error) throw error;
            setSubsubassuntosList(data || []);
        } catch (error) {
            console.error('Error fetching subsubassuntos:', error);
            alert('Erro ao carregar subsubassuntos');
        } finally {
            setSubsubassuntosLoading(false);
        }
    };

    const handleSaveSubsubassunto = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedSubassuntoForSubsubassuntos || !newSubsubassunto.name.trim()) return;

        try {
            const payload: any = {
                name: newSubsubassunto.name,
                subassunto_id: selectedSubassuntoForSubsubassuntos.id,
                status: newSubsubassunto.status,
            };
            if (editingSubsubassuntoId) {
                payload.id = editingSubsubassuntoId;
            }
            
            const { error } = await supabase.from('subsubassuntos').upsert(payload);
            if (error) throw error;
            
            setNewSubsubassunto({ name: '', status: 'Ativo' });
            setEditingSubsubassuntoId(null);
            fetchSubsubassuntos(selectedSubassuntoForSubsubassuntos.id);
        } catch (error) {
            console.error('Error saving subsubassunto:', error);
            alert('Erro ao salvar subsubassunto');
        }
    };

    const handleDeleteSubsubassunto = async (id: string) => {
        if (!selectedSubassuntoForSubsubassuntos) return;
        if (window.confirm('Deseja realmente excluir este subsubassunto?')) {
            try {
                const { error } = await supabase.from('subsubassuntos').delete().eq('id', id);
                if (error) throw error;
                fetchSubsubassuntos(selectedSubassuntoForSubsubassuntos.id);
            } catch (error) {
                console.error('Error deleting subsubassunto:', error);
                alert('Erro ao excluir subsubassunto');
            }
        }
    };

    const startEditingSubsubassunto = (subsub: Subsubassunto) => {
        setEditingSubsubassuntoId(subsub.id);
        setNewSubsubassunto({ name: subsub.name, status: subsub.status });
    };

    const cancelEditingSubsubassunto = () => {
        setEditingSubsubassuntoId(null);
        setNewSubsubassunto({ name: '', status: 'Ativo' });
    };

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight">Assuntos</h2>
                    <p className="text-[#617589] font-medium">Gerencie os tópicos específicos de cada disciplina.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Assunto
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-6 rounded-2xl border border-[#dbe0e6] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-blue-100">
                    <span className="material-symbols-outlined text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Pesquisar assunto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-bold w-full"
                    />
                </div>
                <select
                    value={filterDisciplina}
                    onChange={(e) => setFilterDisciplina(e.target.value)}
                    className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none"
                >
                    <option value="">Todas as Disciplinas</option>
                    {disciplinas.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {/* Tabela de Assuntos */}
            <div className="bg-white rounded-2xl border border-[#dbe0e6] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 font-medium italic">
                            <div className="size-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                            Sincronizando...
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                                    <th className="px-8 py-5">Assunto / Tópico</th>
                                    <th className="px-8 py-5">Disciplina</th>
                                    <th className="px-8 py-5 text-center">Subtópicos</th>
                                    <th className="px-8 py-5 text-center">Questões</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9]">
                                {assuntos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-medium italic">
                                            Nenhum assunto encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    assuntos.map((assunto) => (
                                        <tr key={assunto.id} className="hover:bg-[#f8fafc] transition-colors group">
                                            <td className="px-8 py-5 font-black text-[#111418] text-sm">
                                                {assunto.name}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase">
                                                    {assunto.disciplina_name}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-sm font-black text-[#111418]">{assunto.quantidade_subassuntos}</span>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Cadastrados</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-sm font-black text-[#111418]">{assunto.quantidade_questoes}</span>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Cadastradas</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${assunto.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    <div className={`size-1.5 rounded-full ${assunto.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                                    {assunto.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenSubassuntosModal(assunto)}
                                                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Gerenciar Subassuntos"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">account_tree</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal(assunto)}
                                                        className="p-2 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(assunto.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-[#dbe0e6] shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Exibindo {assuntos.length} de {totalCount} assuntos
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-[#137fec] transition-all"
                        >
                            <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage > 3) pageNum = currentPage - 2 + i;
                                    if (pageNum + (4 - i) > totalPages) pageNum = totalPages - 4 + i;
                                }
                                if (pageNum <= 0 || pageNum > totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`size-10 rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-[#137fec] text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-[#137fec] transition-all"
                        >
                            <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Section */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc]">
                            <h3 className="text-xl font-black text-[#111418]">
                                {editingAssunto ? 'Editar Assunto' : 'Novo Assunto'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Assunto</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Recursos Criminais"
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Disciplina Associada</label>
                                <select
                                    required
                                    value={formData.disciplina_id}
                                    onChange={e => setFormData({ ...formData, disciplina_id: e.target.value })}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-bold text-slate-700"
                                >
                                    <option value="">Selecione a Disciplina...</option>
                                    {disciplinas.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Inativo' })}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-bold text-slate-700"
                                >
                                    <option value="Ativo">🟢 Ativo</option>
                                    <option value="Inativo">⚪ Inativo</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 h-12 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] h-12 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                                >
                                    {editingAssunto ? 'Salvar Alterações' : 'Criar Assunto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Subassuntos Modal */}
            {isSubassuntosModalOpen && selectedAssuntoForSubassuntos && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseSubassuntosModal}></div>
                    <div className="relative bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc] shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#111418]">Subassuntos</h3>
                                <p className="text-sm text-slate-500 font-medium">Pertencentes a <strong className="text-slate-700">{selectedAssuntoForSubassuntos.name}</strong></p>
                            </div>
                            <button onClick={handleCloseSubassuntosModal} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
                            {/* Formulário Subassunto */}
                            <form onSubmit={handleSaveSubassunto} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider">
                                    {editingSubassuntoId ? 'Editar Subassunto' : 'Novo Subassunto'}
                                </h4>
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 space-y-2 w-full">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Subassunto</label>
                                        <input
                                            required
                                            type="text"
                                            value={newSubassunto.name}
                                            onChange={e => setNewSubassunto({ ...newSubassunto, name: e.target.value })}
                                            placeholder="Ex: Prazos Processuais"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium text-sm"
                                        />
                                    </div>
                                    <div className="w-full md:w-36 space-y-2 shrink-0">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                                        <select
                                            value={newSubassunto.status}
                                            onChange={e => setNewSubassunto({ ...newSubassunto, status: e.target.value })}
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-bold text-slate-700 text-sm"
                                        >
                                            <option value="Ativo">🟢 Ativo</option>
                                            <option value="Inativo">⚪ Inativo</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                                        {editingSubassuntoId && (
                                            <button 
                                                type="button" 
                                                onClick={cancelEditingSubassunto}
                                                className="h-11 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button 
                                            type="submit" 
                                            disabled={!newSubassunto.name.trim()}
                                            className="h-11 px-6 bg-[#137fec] text-white font-black rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            {editingSubassuntoId ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Lista de Subassuntos */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {subassuntosLoading ? (
                                    <div className="p-8 text-center text-slate-500 font-medium italic">Carregando subassuntos...</div>
                                ) : subassuntosList.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 font-medium italic">Nenhum subassunto cadastrado.</div>
                                ) : (
                                    <ul className="divide-y divide-slate-100">
                                        {subassuntosList.map(sub => (
                                            <li key={sub.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm">{sub.name}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${sub.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            <div className={`size-1.5 rounded-full ${sub.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                                            <span className={sub.status === 'Ativo' ? 'text-green-600' : 'text-slate-500'}>{sub.status}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">account_tree</span>
                                                            {sub.quantidade_subsubassuntos} níveis
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenSubsubassuntosModal(sub)}
                                                        className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Gerenciar Subsubassuntos"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">account_tree</span>
                                                    </button>
                                                    <button
                                                        onClick={() => startEditingSubassunto(sub)}
                                                        className="p-2 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSubassunto(sub.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Subsubassuntos Modal */}
            {isSubsubassuntosModalOpen && selectedSubassuntoForSubsubassuntos && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseSubsubassuntosModal}></div>
                    <div className="relative bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc] shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#111418]">Subsubassuntos</h3>
                                <p className="text-sm text-slate-500 font-medium">Pertencentes a <strong className="text-slate-700">{selectedSubassuntoForSubsubassuntos.name}</strong></p>
                            </div>
                            <button onClick={handleCloseSubsubassuntosModal} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
                            {/* Formulário Subsubassunto */}
                            <form onSubmit={handleSaveSubsubassunto} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider">
                                    {editingSubsubassuntoId ? 'Editar Subsubassunto' : 'Novo Subsubassunto'}
                                </h4>
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 space-y-2 w-full">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Subsubassunto</label>
                                        <input
                                            required
                                            type="text"
                                            value={newSubsubassunto.name}
                                            onChange={e => setNewSubsubassunto({ ...newSubsubassunto, name: e.target.value })}
                                            placeholder="Ex: Artigo 5º"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium text-sm"
                                        />
                                    </div>
                                    <div className="w-full md:w-36 space-y-2 shrink-0">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                                        <select
                                            value={newSubsubassunto.status}
                                            onChange={e => setNewSubsubassunto({ ...newSubsubassunto, status: e.target.value })}
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-bold text-slate-700 text-sm"
                                        >
                                            <option value="Ativo">🟢 Ativo</option>
                                            <option value="Inativo">⚪ Inativo</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                                        {editingSubsubassuntoId && (
                                            <button 
                                                type="button" 
                                                onClick={cancelEditingSubsubassunto}
                                                className="h-11 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button 
                                            type="submit" 
                                            disabled={!newSubsubassunto.name.trim()}
                                            className="h-11 px-6 bg-[#137fec] text-white font-black rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            {editingSubsubassuntoId ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Lista de Subsubassuntos */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {subsubassuntosLoading ? (
                                    <div className="p-8 text-center text-slate-500 font-medium italic">Carregando subsubassuntos...</div>
                                ) : subsubassuntosList.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 font-medium italic">Nenhum subsubassunto cadastrado.</div>
                                ) : (
                                    <ul className="divide-y divide-slate-100">
                                        {subsubassuntosList.map(subsub => (
                                            <li key={subsub.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm">{subsub.name}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${subsub.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            <div className={`size-1.5 rounded-full ${subsub.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                                            <span className={subsub.status === 'Ativo' ? 'text-green-600' : 'text-slate-500'}>{subsub.status}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 transition-opacity">
                                                    <button
                                                        onClick={() => startEditingSubsubassunto(subsub)}
                                                        className="p-2 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSubsubassunto(subsub.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assuntos;
