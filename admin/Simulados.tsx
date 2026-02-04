
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Simulado, Questao, Disciplina, Assunto } from '../types';

interface Banca {
    id: string;
    name: string;
}

const Simulados: React.FC = () => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [simulados, setSimulados] = useState<Simulado[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter and Selection States
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [allQuestions, setAllQuestions] = useState<Questao[]>([]);
    const [filteredQuestions, setFilteredQuestions] = useState<Questao[]>([]);

    // Question Selection Filters
    const [searchQ, setSearchQ] = useState('');
    const [filterDisc, setFilterDisc] = useState('');
    const [filterSub, setFilterSub] = useState('');
    const [filterBan, setFilterBan] = useState('');
    const [filterAno, setFilterAno] = useState('');
    const [filterDiff, setFilterDiff] = useState('');

    const [editingSimulado, setEditingSimulado] = useState<Simulado | null>(null);
    const [formData, setFormData] = useState<Partial<Simulado & { questions: string[] }>>({
        title: '',
        banca_id: '',
        duration: 240,
        penalty: 0,
        status: 'Ativo',
        questions: []
    });
    const [disciplineWeights, setDisciplineWeights] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchSimulados();
        fetchAuxiliaryData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchQ, filterDisc, filterSub, filterBan, filterAno, filterDiff, allQuestions]);

    const fetchSimulados = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('simulados')
                .select(`
                    *,
                    bancas (name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: counts } = await supabase.from('simulado_questions').select('simulado_id');
            const simuladosWithCount = data.map(s => ({
                ...s,
                questions_count: counts?.filter(c => c.simulado_id === s.id).length || 0
            }));

            setSimulados(simuladosWithCount);
        } catch (error) {
            console.error('Error fetching simulados:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxiliaryData = async () => {
        const [bRes, dRes, aRes, qRes] = await Promise.all([
            supabase.from('bancas').select('id, name').order('name'),
            supabase.from('disciplinas').select('*').order('name'),
            supabase.from('assuntos').select('*').order('name'),
            supabase.from('questions').select('*, bancas(name), disciplinas(name), assuntos(name)')
        ]);

        if (bRes.data) setBancas(bRes.data);
        if (dRes.data) setDisciplinas(dRes.data);
        if (aRes.data) setAssuntos(aRes.data);
        if (qRes.data) setAllQuestions(qRes.data);
    };

    const applyFilters = () => {
        let qs = [...allQuestions];
        if (searchQ) qs = qs.filter(q => q.enunciado.toLowerCase().includes(searchQ.toLowerCase()));
        if (filterDisc) qs = qs.filter(q => q.disciplina_id === filterDisc);
        if (filterSub) qs = qs.filter(q => q.assunto_id === filterSub);
        if (filterBan) qs = qs.filter(q => q.banca_id === filterBan);
        if (filterAno) qs = qs.filter(q => q.ano === filterAno);
        if (filterDiff) qs = qs.filter(q => q.dificuldade === filterDiff);
        setFilteredQuestions(qs);
    };

    const handleOpenForm = async (simulado?: Simulado) => {
        if (simulado) {
            const { data: sqData } = await supabase
                .from('simulado_questions')
                .select('question_id')
                .eq('simulado_id', simulado.id)
                .order('position', { ascending: true });

            const { data: wData } = await supabase
                .from('simulado_disciplina_weights')
                .select('disciplina_id, weight')
                .eq('simulado_id', simulado.id);

            const wMap: Record<string, number> = {};
            if (wData) {
                wData.forEach((w: any) => wMap[w.disciplina_id] = w.weight);
            }
            setDisciplineWeights(wMap);

            setEditingSimulado(simulado);
            setFormData({
                ...simulado,
                questions: sqData?.map(q => q.question_id) || []
            });
        } else {
            setEditingSimulado(null);
            setDisciplineWeights({});
            setFormData({
                title: '',
                banca_id: '',
                duration: 240,
                penalty: 0,
                status: 'Ativo',
                questions: []
            });
        }
        setView('form');
    };

    const handleCloseForm = () => {
        setView('list');
        setEditingSimulado(null);
    };

    const toggleQuestion = (id: string) => {
        const current = formData.questions || [];
        if (current.includes(id)) {
            setFormData({ ...formData, questions: current.filter(qid => qid !== id) });
        } else {
            setFormData({ ...formData, questions: [...current, id] });
        }
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const current = [...(formData.questions || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) return;

        [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
        setFormData({ ...formData, questions: current });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const simuladoPayload = {
                title: formData.title,
                banca_id: formData.banca_id || null,
                duration: formData.duration,
                penalty: formData.penalty,
                status: formData.status
            };

            let simuladoId = editingSimulado?.id;

            if (editingSimulado) {
                const { error } = await supabase.from('simulados').update(simuladoPayload).eq('id', simuladoId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('simulados').insert(simuladoPayload).select().single();
                if (error) throw error;
                simuladoId = data.id;
            }

            await supabase.from('simulado_questions').delete().eq('simulado_id', simuladoId);

            if (formData.questions && formData.questions.length > 0) {
                const sqPayload = formData.questions.map((qid, index) => ({
                    simulado_id: simuladoId,
                    question_id: qid,
                    position: index
                }));
                const { error: sqError } = await supabase.from('simulado_questions').insert(sqPayload);
                if (sqError) throw sqError;

                // Save Weights
                await supabase.from('simulado_disciplina_weights').delete().eq('simulado_id', simuladoId);
                const wPayload = Object.entries(disciplineWeights).map(([dId, w]) => ({
                    simulado_id: simuladoId,
                    disciplina_id: dId,
                    weight: w
                }));
                if (wPayload.length > 0) {
                    const { error: wError } = await supabase.from('simulado_disciplina_weights').insert(wPayload);
                    if (wError) throw wError;
                }
            }

            alert('Simulado salvo com sucesso!');
            fetchSimulados();
            handleCloseForm();
        } catch (error) {
            console.error('Error saving simulado:', error);
            alert('Erro ao salvar simulado');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Excluir este simulado?')) {
            const { error } = await supabase.from('simulados').delete().eq('id', id);
            if (error) throw error;
            fetchSimulados();
        }
    };

    if (view === 'form') {
        return (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between">
                    <div>
                        <button onClick={handleCloseForm} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-2">
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="text-xs font-bold uppercase">Voltar para lista</span>
                        </button>
                        <h2 className="text-[#111418] text-3xl font-black tracking-tight">
                            {editingSimulado ? 'Editando Simulado' : 'Criando Novo Simulado'}
                        </h2>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleCloseForm} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">
                            Cancelar
                        </button>
                        <button onClick={handleSubmit} className="px-8 py-3 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600">
                            Salvar Simulado
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
                    {/* Painel de Configurações */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 text-[#137fec]">
                                <span className="material-symbols-outlined">settings</span>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Configurações Gerais</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título do Simulado</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                                        placeholder="Ex: PM-SP 2026 - Pós Edital"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tempo (minutos)</label>
                                        <input
                                            required
                                            type="number"
                                            value={formData.duration}
                                            onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-1">Penalidade / Erro</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.penalty}
                                            onChange={e => setFormData({ ...formData, penalty: Number(e.target.value) })}
                                            className="w-full h-12 px-4 bg-red-50/50 border border-red-100 rounded-2xl outline-none font-bold text-red-600"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Banca Principal</label>
                                    <select
                                        value={formData.banca_id}
                                        onChange={e => setFormData({ ...formData, banca_id: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                                    >
                                        <option value="">Todas as Bancas</option>
                                        {bancas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status de Publicação</label>
                                    <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                                        {['Ativo', 'Inativo'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: s as any })}
                                                className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${formData.status === s ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-400'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 text-[#137fec]">
                                <span className="material-symbols-outlined">weight</span>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Pesos por Disciplina</h3>
                            </div>
                            <div className="space-y-3">
                                {(() => {
                                    const selectedQs = allQuestions.filter(q => formData.questions?.includes(q.id));
                                    const discIds = Array.from(new Set(selectedQs.map(q => q.disciplina_id))).filter(Boolean);

                                    if (discIds.length === 0) {
                                        return <p className="text-sm text-slate-400 italic">Adicione questões para configurar os pesos.</p>;
                                    }

                                    return discIds.map(dId => {
                                        const discName = disciplinas.find(d => d.id === dId)?.name || 'Desconhecida';
                                        return (
                                            <div key={dId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="text-xs font-bold text-slate-700">{discName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase text-slate-400">Pts</span>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={disciplineWeights[dId] !== undefined ? disciplineWeights[dId] : 1}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value);
                                                            setDisciplineWeights(prev => ({ ...prev, [dId]: isNaN(val) ? 0 : val }))
                                                        }}
                                                        className="w-16 h-8 px-2 text-center bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-[#137fec]">
                                    <span className="material-symbols-outlined">format_list_numbered</span>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Questões Selecionadas</h3>
                                </div>
                                <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                                    {formData.questions?.length || 0}
                                </span>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                {formData.questions?.length === 0 ? (
                                    <div className="text-center py-10 opacity-30 italic text-sm">Nenhuma questão adicionada.</div>
                                ) : formData.questions?.map((qid, idx) => {
                                    const q = allQuestions.find(x => x.id === qid);
                                    if (!q) return null;
                                    return (
                                        <div key={qid} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative">
                                            <div className="flex items-start gap-3">
                                                <div className="size-6 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-900">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] font-bold line-clamp-2 text-slate-600 mb-2 q-preview-no-img" dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                                                    <div className="flex gap-2">
                                                        <span className="text-[8px] font-black uppercase bg-white px-1.5 py-0.5 rounded border border-slate-100 text-slate-400">{q.bancas?.name}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => moveQuestion(idx, 'up')} className="size-6 bg-white rounded border border-slate-200 text-slate-400 hover:text-blue-500 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[16px]">expand_less</span>
                                                    </button>
                                                    <button onClick={() => moveQuestion(idx, 'down')} className="size-6 bg-white rounded border border-slate-200 text-slate-400 hover:text-blue-500 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                    </button>
                                                    <button onClick={() => toggleQuestion(qid)} className="size-6 bg-red-50 rounded border border-red-100 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Banco de Questões com Filtros */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="material-symbols-outlined">search</span>
                                    <h3 className="text-xs font-black uppercase tracking-widest">Banco de Filtros Completo</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        setSearchQ('');
                                        setFilterDisc('');
                                        setFilterSub('');
                                        setFilterBan('');
                                        setFilterAno('');
                                        setFilterDiff('');
                                    }}
                                    className="text-[10px] font-black text-blue-500 uppercase hover:underline"
                                >
                                    Limpar Filtros
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-3">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar no enunciado das questões..."
                                        value={searchQ}
                                        onChange={e => setSearchQ(e.target.value)}
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold placeholder:text-slate-400"
                                    />
                                </div>
                                <select value={filterDisc} onChange={e => { setFilterDisc(e.target.value); setFilterSub(''); }} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                                    <option value="">Disciplina: Todas</option>
                                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <select value={filterSub} onChange={e => setFilterSub(e.target.value)} disabled={!filterDisc} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50">
                                    <option value="">Assunto: Todos</option>
                                    {assuntos.filter(a => a.disciplina_id === filterDisc).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <select value={filterBan} onChange={e => setFilterBan(e.target.value)} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                                    <option value="">Banca: Todas</option>
                                    {bancas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                                    <option value="">Ano: Qualquer</option>
                                    {Array.from({ length: 10 }, (_, i) => String(2026 - i)).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                                    <option value="">Dificuldade: Todas</option>
                                    <option value="Fácil">Fácil</option>
                                    <option value="Médio">Médio</option>
                                    <option value="Difícil">Difícil</option>
                                </select>
                                <div className="h-11 flex items-center justify-center px-4 bg-blue-50 rounded-xl border border-blue-100 text-[10px] font-black text-blue-600 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {filteredQuestions.length} ITEMS
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredQuestions.slice(0, 50).map(q => {
                                const isSelected = formData.questions?.includes(q.id);
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => toggleQuestion(q.id)}
                                        className={`p-6 bg-white rounded-3xl border transition-all cursor-pointer relative group ${isSelected ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-100 hover:border-blue-200 shadow-sm'}`}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                <span className="material-symbols-outlined">{isSelected ? 'check' : 'add'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex gap-2 mb-2">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 leading-none truncate">{q.bancas?.name} • {q.ano}</span>
                                                    <span className="text-[9px] font-black uppercase text-blue-500 leading-none truncate">{q.disciplinas?.name}</span>
                                                </div>
                                                <div className="text-sm font-bold text-slate-900 leading-relaxed line-clamp-3 q-preview-no-img" dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${q.dificuldade === 'Fácil' ? 'bg-green-50 text-green-600' : q.dificuldade === 'Médio' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                                                        {q.dificuldade}
                                                    </span>
                                                    <span className="text-[9px] font-black text-slate-300 uppercase">#{q.id.slice(0, 8)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredQuestions.length > 50 && (
                                <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium italic">
                                    Exibindo as primeiras 50 questões. Use os filtros para refinar sua busca.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .q-preview-no-img img { display: none !important; }
                    .q-preview-no-img * { max-width: 100%; word-break: break-word; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight">Gestão de Simulados</h2>
                    <p className="text-[#617589] font-medium">Crie exames complexos com total controle de questões e pontuação.</p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Simulado
                </button>
            </div>

            {/* Tabela de Simulados */}
            <div className="bg-white rounded-[32px] border border-[#dbe0e6] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                                <th className="px-8 py-6">Simulado / Título</th>
                                <th className="px-8 py-6">Banca</th>
                                <th className="px-8 py-6 text-center">Questões</th>
                                <th className="px-8 py-6 text-center">Penalidade</th>
                                <th className="px-8 py-6 text-center">Tempo</th>
                                <th className="px-8 py-6 text-center">Status</th>
                                <th className="px-8 py-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {loading ? (
                                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-300 italic font-medium">Carregando base de simulados...</td></tr>
                            ) : simulados.length === 0 ? (
                                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-300 italic font-medium">Nenhum simulado cadastrado.</td></tr>
                            ) : simulados.map((s) => (
                                <tr key={s.id} className="hover:bg-[#f8fafc] transition-colors group">
                                    <td className="px-8 py-6">
                                        <p className="text-sm font-black text-[#111418]">{s.title}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Cadastrado em: {new Date(s.created_at).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="px-3 py-1 bg-slate-100 text-[#64748b] text-[10px] font-black rounded uppercase">
                                            {s.bancas?.name || 'Geral'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center font-black text-slate-900">{s.questions_count}</td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`text-xs font-black ${s.penalty > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {s.penalty > 0 ? `-${s.penalty}/erro` : 'Nula'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center font-black text-slate-900">{s.duration}m</td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${s.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <div className={`size-1.5 rounded-full ${s.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => handleOpenForm(s)} className="p-2.5 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-xl transition-all">
                                                <span className="material-symbols-outlined text-[22px]">edit</span>
                                            </button>
                                            <button onClick={() => handleDelete(s.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                <span className="material-symbols-outlined text-[22px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Simulados;
