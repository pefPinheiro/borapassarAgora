
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

    const [bancas, setBancas] = useState<Banca[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [allQuestions, setAllQuestions] = useState<Questao[]>([]);
    const [manualQuestionId, setManualQuestionId] = useState('');
    const [sectionTitle, setSectionTitle] = useState('');

    const [editingSimulado, setEditingSimulado] = useState<Simulado | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewSimulado, setPreviewSimulado] = useState<Simulado | null>(null);
    const [previewQuestions, setPreviewQuestions] = useState<Questao[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    
    const [formData, setFormData] = useState<Partial<Simulado & { questions: { id: string, section?: string }[] }>>({
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
        const [bRes, dRes, aRes] = await Promise.all([
            supabase.from('bancas').select('id, name').order('name'),
            supabase.from('disciplinas').select('*').order('name'),
            supabase.from('assuntos').select('*').order('name')
        ]);

        if (bRes.data) setBancas(bRes.data);
        if (dRes.data) setDisciplinas(dRes.data);
        if (aRes.data) setAssuntos(aRes.data);
    };


    const handleOpenForm = async (simulado?: Simulado) => {
        if (simulado) {
            const { data: sqData } = await supabase
                .from('simulado_questions')
                .select('question_id, section')
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
                questions: sqData?.map(q => ({ id: q.question_id, section: q.section })) || []
            });

            // Buscar detalhes das questões para exibição no formulário
            if (sqData && sqData.length > 0) {
                const ids = sqData.map(q => q.question_id);
                const { data: qDetails } = await supabase
                    .from('questions')
                    .select('*, bancas(name), disciplinas(name), assuntos(name)')
                    .in('id', ids);
                
                if (qDetails) {
                    setAllQuestions(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNew = qDetails.filter(d => !existingIds.has(d.id));
                        return [...prev, ...uniqueNew];
                    });
                }
            }
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
        if (current.some(q => q.id === id)) {
            setFormData({ ...formData, questions: current.filter(q => q.id !== id) });
        } else {
            setFormData({ ...formData, questions: [...current, { id, section: sectionTitle }] });
            setSectionTitle('');
        }
    };

    const handleAddManualId = async () => {
        let rawInput = manualQuestionId.trim();
        if (!rawInput) return;

        // Tenta extrair o UUID caso venha formatado como [QUESTÃO INTERATIVA ID: "UUID"]
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = rawInput.match(uuidRegex);
        
        const id = match ? match[0] : rawInput;
        
        if (formData.questions?.some(q => q.id === id)) {
            alert('Esta questão já está no simulado.');
            setManualQuestionId('');
            return;
        }

        let q = allQuestions.find(it => it.id === id);
        
        if (!q) {
            // Tentativa de busca direta no banco caso não esteja no cache local (slice de 50)
            const { data, error } = await supabase
                .from('questions')
                .select('*, bancas(name), disciplinas(name), assuntos(name)')
                .eq('id', id)
                .single();
            
            if (error || !data) {
                alert('ID da questão não encontrado na base de dados.');
                return;
            }
            q = data;
            // Opcional: Adicionar ao cache local para evitar refetch
            setAllQuestions(prev => [...prev, data]);
        }

        setFormData({
            ...formData,
            questions: [...(formData.questions || []), { id: q.id, section: sectionTitle }]
        });
        setManualQuestionId('');
        setSectionTitle('');
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
                const sqPayload = formData.questions.map((q, index) => ({
                    simulado_id: simuladoId,
                    question_id: q.id,
                    position: index,
                    section: q.section || null
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

    const handleOpenPreview = async (s: Simulado) => {
        setPreviewSimulado(s);
        setIsPreviewOpen(true);
        setPreviewLoading(true);
        setPreviewQuestions([]);
        try {
            const { data, error } = await supabase
                .from('simulado_questions')
                .select(`
                    question_id,
                    position,
                    section,
                    questao:questions (
                        *,
                        alternativas,
                        bancas (name),
                        disciplinas (name)
                    )
                `)
                .eq('simulado_id', s.id)
                .order('position', { ascending: true });

            if (error) throw error;
            setPreviewQuestions(data?.map((d: any) => ({ ...d.questao, section: d.section })) || []);
        } catch (error) {
            console.error('Error fetching preview questions:', error);
            alert('Erro ao carregar preview do simulado');
        } finally {
            setPreviewLoading(false);
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
                        {editingSimulado && (
                            <button 
                                onClick={() => handleOpenPreview(editingSimulado)}
                                className="px-6 py-3 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl font-bold hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                Visualizar
                            </button>
                        )}
                        <button onClick={handleCloseForm} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">
                            Cancelar
                        </button>
                        <button onClick={handleSubmit} className="px-8 py-3 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600">
                            Salvar Simulado
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
                    {/* Painel de Configurações Lateral */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 text-[#137fec]">
                                <span className="material-symbols-outlined">settings</span>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Parâmetros do Exame</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título do Simulado</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:border-blue-500"
                                        placeholder="Ex: PM-SP 2026 - Pós Edital"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tempo (min)</label>
                                        <input
                                            required
                                            type="number"
                                            value={formData.duration}
                                            onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-1">Peso Erro</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.penalty}
                                            onChange={e => setFormData({ ...formData, penalty: Number(e.target.value) })}
                                            className="w-full h-12 px-4 bg-red-50 border border-red-100 rounded-2xl outline-none font-bold text-red-600"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Banca Examinadora</label>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
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
                                    const selectedQs = allQuestions.filter(q => formData.questions?.some(fq => fq.id === q.id));
                                    const discIds = Array.from(new Set(selectedQs.map(q => q.disciplina_id))).filter(Boolean);

                                    if (discIds.length === 0) {
                                        return <p className="text-[11px] font-bold text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed">Adicione questões para configurar os pesos.</p>;
                                    }

                                    return (
                                        <div className="space-y-2">
                                            {discIds.map(dId => {
                                                const discName = disciplinas.find(d => d.id === dId)?.name || 'Desconhecida';
                                                return (
                                                    <div key={dId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <span className="text-[10px] font-black text-slate-600 truncate mr-2">{discName}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black uppercase text-slate-400">Peso</span>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                value={disciplineWeights[dId] !== undefined ? disciplineWeights[dId] : 1}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value);
                                                                    setDisciplineWeights(prev => ({ ...prev, [dId]: isNaN(val) ? 0 : val }))
                                                                }}
                                                                className="w-14 h-8 px-2 text-center bg-white border border-slate-200 rounded-lg text-xs font-black outline-none focus:border-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Central de Gerenciamento de Questões */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Seção de Inserção */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 text-[#137fec]">
                                <span className="material-symbols-outlined">add_circle</span>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Inserir por Identificador (ID)</h3>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Título da Sessão (Opcional - Ex: Língua Portuguesa)"
                                        value={sectionTitle}
                                        onChange={e => setSectionTitle(e.target.value)}
                                        className="w-full h-14 px-6 mb-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm placeholder:text-slate-400 focus:border-blue-500 transition-all font-mono"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Cole aqui o UUID da questão (ex: 550e8400-e29b-41d4-a716-446655440000)"
                                        value={manualQuestionId}
                                        onChange={e => setManualQuestionId(e.target.value)}
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm placeholder:text-slate-400 focus:border-blue-500 transition-all font-mono"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 px-2 uppercase tracking-tight">O simulado é montado exclusivamente através da colagem dos IDs das questões. Título da sessão ficará antes da questão inserida.</p>
                                </div>
                                <button 
                                    onClick={handleAddManualId}
                                    className="px-8 h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {/* Lista Principal Interativa */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-[700px]">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Itens do Simulado</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estrutura de {formData.questions?.length || 0} questões em ordem</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                     <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${formData.questions?.length || 0 > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                                        {formData.questions?.length || 0 > 0 ? 'Simulado Estruturado' : 'Aguardando Conteúdo'}
                                     </span>
                                </div>
                            </div>

                            <div className="space-y-4 overflow-y-auto max-h-[900px] pr-2 custom-scrollbar">
                                {formData.questions?.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-40 text-slate-300 gap-4">
                                        <span className="material-symbols-outlined text-7xl">quiz</span>
                                        <div className="text-center">
                                            <p className="font-bold text-sm uppercase tracking-widest">Nenhuma questão no simulado</p>
                                            <p className="text-xs mt-1">Utilize o campo de ID acima para popular o exame.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {formData.questions?.map((qItem, idx) => {
                                            const qid = qItem.id;
                                            const q = allQuestions.find(x => x.id === qid);
                                            if (!q) return (
                                                <div key={qid} className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-between animate-pulse">
                                                    <span className="text-xs font-bold text-slate-400">Buscando informações da questão {qid.slice(0, 8)}...</span>
                                                    <button onClick={() => toggleQuestion(qid)} className="text-red-500 material-symbols-outlined">close</button>
                                                </div>
                                            );
                                            return (
                                                <div key={qid} className="group/item relative">
                                                    {!qItem.section && (
                                                        <div className="opacity-0 group-hover/item:opacity-100 flex justify-center -mb-2 mt-2 relative z-10 transition-opacity">
                                                            <button 
                                                                onClick={() => {
                                                                    const newQs = [...(formData.questions || [])];
                                                                    newQs[idx].section = 'Nova Sessão';
                                                                    setFormData({ ...formData, questions: newQs });
                                                                }}
                                                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-200 transition-colors shadow-sm flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-xs">add</span> Adicionar Título
                                                            </button>
                                                        </div>
                                                    )}
                                                    {qItem.section && (
                                                        <div className="bg-blue-50 text-blue-800 font-black px-6 py-3 rounded-2xl mt-4 mb-4 text-sm uppercase tracking-widest border border-blue-200 flex items-center gap-2">
                                                            <span className="material-symbols-outlined">label</span>
                                                            <input 
                                                                type="text" 
                                                                value={qItem.section} 
                                                                onChange={(e) => {
                                                                    const newQs = [...(formData.questions || [])];
                                                                    newQs[idx].section = e.target.value;
                                                                    setFormData({ ...formData, questions: newQs });
                                                                }}
                                                                className="bg-transparent outline-none flex-1 placeholder:text-blue-300"
                                                                placeholder="Título da Sessão"
                                                            />
                                                            <button 
                                                                onClick={() => {
                                                                    const newQs = [...(formData.questions || [])];
                                                                    delete newQs[idx].section;
                                                                    setFormData({ ...formData, questions: newQs });
                                                                }}
                                                                className="text-blue-400 hover:text-blue-600"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">close</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group relative">
                                                        <div className="flex gap-6">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="size-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="flex flex-col gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100">
                                                                <button 
                                                                    onClick={() => moveQuestion(idx, 'up')} 
                                                                    disabled={idx === 0}
                                                                    className="size-7 flex items-center justify-center rounded-md hover:bg-white hover:text-blue-500 disabled:opacity-20 transition-all"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">expand_less</span>
                                                                </button>
                                                                <button 
                                                                    onClick={() => moveQuestion(idx, 'down')} 
                                                                    disabled={idx === (formData.questions?.length || 0) - 1}
                                                                    className="size-7 flex items-center justify-center rounded-md hover:bg-white hover:text-blue-500 disabled:opacity-20 transition-all"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">expand_more</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] font-black uppercase tracking-widest leading-none flex items-center h-5">{q.disciplinas?.name}</span>
                                                                <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest leading-none flex items-center h-5">{q.bancas?.name || 'Geral'}</span>
                                                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase tracking-widest leading-none flex items-center h-5">ID: {q.id.slice(0, 8)}</span>
                                                            </div>
                                                            <div 
                                                                className="text-sm font-bold text-slate-800 leading-relaxed q-preview-no-img line-clamp-2" 
                                                                dangerouslySetInnerHTML={{ __html: q.enunciado }} 
                                                            />
                                                            
                                                            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-[9px] font-black text-slate-300 uppercase">Dificuldade: <span className="text-slate-500">{q.dificuldade}</span></span>
                                                                    <span className="text-[9px] font-black text-slate-300 uppercase truncate max-w-[200px]">Assunto: <span className="text-slate-500">{q.assuntos?.name || 'Não classificado'}</span></span>
                                                                </div>
                                                                <button 
                                                                    onClick={() => toggleQuestion(qid)} 
                                                                    className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest"
                                                                >
                                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                                    Remover
                                                                </button>
                                                            </div>
                                                        </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
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
                                            <button onClick={() => handleOpenPreview(s)} className="p-2.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Visualizar Questões">
                                                <span className="material-symbols-outlined text-[22px]">visibility</span>
                                            </button>
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
            {/* Preview Modal */}
            {isPreviewOpen && previewSimulado && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col scale-in-center animate-in zoom-in-95">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="size-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <span className="material-symbols-outlined">visibility</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-none">{previewSimulado.title}</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                        {previewLoading ? 'Carregando questões...' : `${previewQuestions.length} Questões`} • {previewSimulado.duration} min
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                            <button 
                                onClick={() => window.open(`/aluno/simulado/${previewSimulado.id}`, '_blank')} 
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Ver como Aluno
                            </button>
                            <button 
                                onClick={() => setIsPreviewOpen(false)} 
                                className="size-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-slate-50/30">
                            {previewLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 animate-pulse">
                                    <span className="material-symbols-outlined text-6xl mb-4">hourglass_empty</span>
                                    <p className="font-bold uppercase tracking-widest text-xs">Carregando conteúdo...</p>
                                </div>
                            ) : previewQuestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <span className="material-symbols-outlined text-6xl mb-4">info</span>
                                    <p className="font-bold uppercase tracking-widest text-xs">Nenhuma questão vinculada a este simulado.</p>
                                </div>
                            ) : (
                                previewQuestions.map((q, idx) => (
                                    <div key={q.id}>
                                        {(q as any).section && (
                                            <div className="mb-6 mt-10 pb-2 border-b-2 border-slate-200 flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-[#137fec] text-white flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-sm">menu_book</span>
                                                </div>
                                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">
                                                    {(q as any).section}
                                                </h2>
                                            </div>
                                        )}
                                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative group">
                                            <div className="absolute -left-4 top-8 size-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-xl">{idx + 1}</div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-black text-[9px] uppercase tracking-widest">{q.bancas?.name}</span>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded font-black text-[9px] uppercase tracking-widest">{q.disciplinas?.name}</span>
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded font-black text-[9px] uppercase tracking-widest">#{q.id.slice(0, 8)}</span>
                                        </div>

                                        <div className="text-lg font-bold text-slate-900 leading-relaxed mb-8 break-words whitespace-pre-wrap [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: q.enunciado }}></div>

                                        <div className="space-y-3">
                                            {q.alternativas.map((alt, i) => (
                                                <div key={i} className={`p-4 rounded-xl border flex items-start gap-4 ${alt.isCorreta ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                                    <div className={`size-6 rounded-lg border flex items-center justify-center font-black text-xs shrink-0 ${alt.isCorreta ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white border-slate-200'}`}>
                                                        {String.fromCharCode(65 + i)}
                                                    </div>
                                                    <div className="text-sm font-bold break-words [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: alt.texto }}></div>
                                                    {alt.isCorreta && <span className="ml-auto material-symbols-outlined text-emerald-500">check_circle</span>}
                                                </div>
                                            ))}
                                        </div>

                                        {q.resposta_professor && (
                                            <div className="mt-8 pt-8 border-t border-slate-100">
                                                <div className="flex items-center gap-2 mb-4 text-[#137fec]">
                                                    <span className="material-symbols-outlined text-lg">psychology</span>
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Gabarito Comentado</p>
                                                </div>
                                                <div className="text-sm font-medium text-slate-600 italic leading-relaxed break-words [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: q.resposta_professor }}></div>
                                            </div>
                                        )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .q-preview-no-img img { display: none !important; }
                .q-preview-no-img * { max-width: 100%; word-break: break-word; }
            `}</style>
        </div>
    );
};

export default Simulados;
