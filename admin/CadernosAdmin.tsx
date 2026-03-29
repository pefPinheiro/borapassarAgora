
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Disciplina {
    id: string;
    name: string;
}

interface Assunto {
    id: string;
    name: string;
    disciplina_id: string;
}

interface Notebook {
    id: string;
    title: string;
    description?: string;
    discipline_id: string;
    // ... existing
    subject_id: string;
    created_at: string;
    disciplina?: { name: string };
    assunto?: { name: string };
    questions_count?: number;
}

const NotebookQuestionItem = ({ q, idx }: { q: any, idx: number }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);

    const handleSelect = (opt: string) => {
        if (showResult) return;
        setSelected(opt);
        setShowResult(true);
    };

    return (
        <div className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-blue-500 uppercase">Questão {idx + 1}</span>
            </div>
            <p className="text-sm font-medium text-slate-700 mb-3">{q.question_text}</p>

            <div className="space-y-1 mb-3 pl-4 border-l-2 border-slate-100">
                {Array.isArray(q.options) && q.options.map((opt: string, i: number) => {
                    const isCorrect = q.correct_answer === opt;
                    const isSelected = selected === opt;

                    let colorClass = "text-slate-500 hover:text-blue-500 cursor-pointer";
                    if (showResult) {
                        if (isCorrect) colorClass = "text-emerald-600 font-bold";
                        else if (isSelected) colorClass = "text-red-500 font-bold line-through";
                        else colorClass = "text-slate-400 opacity-60";
                    }

                    return (
                        <div
                            key={i}
                            onClick={() => handleSelect(opt)}
                            className={`text-xs ${colorClass} flex gap-2 transition-all p-1 items-center`}
                        >
                            <span>{String.fromCharCode(65 + i)})</span>
                            <span>{opt}</span>
                            {showResult && isCorrect && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                            {showResult && isSelected && !isCorrect && <span className="material-symbols-outlined text-[14px]">cancel</span>}
                        </div>
                    );
                })}
                {!Array.isArray(q.options) && (
                    <div className="text-xs text-slate-400 italic">Opções em formato inválido</div>
                )}
            </div>

            {showResult && q.explanation && (
                <div className="mt-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 animate-in fade-in">
                    <strong className="block mb-1 font-black uppercase tracking-wider">COMENTÁRIO</strong>
                    {q.explanation}
                </div>
            )}
        </div>
    );
};

const CadernosAdmin: React.FC = () => {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedDiscipline, setSelectedDiscipline] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Aux Data
    const [disciplines, setDisciplines] = useState<Disciplina[]>([]);
    const [subjects, setSubjects] = useState<Assunto[]>([]);

    const [previewNotebook, setPreviewNotebook] = useState<Notebook | null>(null);
    const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [nbRes, dRes, sRes] = await Promise.all([
                supabase.from('notebooks').select('*, disciplina:disciplinas(name), assunto:assuntos(name)').order('created_at', { ascending: false }),
                supabase.from('disciplinas').select('*').order('name'),
                supabase.from('assuntos').select('*').order('name')
            ]);

            if (nbRes.data) setNotebooks(nbRes.data);
            if (dRes.data) setDisciplines(dRes.data);
            if (sRes.data) setSubjects(sRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (notebook: Notebook) => {
        setPreviewNotebook(notebook);
        try {
            const { data, error } = await supabase
                .from('notebook_questions')
                .select('*')
                .eq('notebook_id', notebook.id)
                .order('order_index', { ascending: true });

            if (error) throw error;
            setPreviewQuestions(data || []);
        } catch (error: any) {
            console.error('Error fetching questions:', error);
            alert('Erro ao carregar questões');
        }
    };

    const handleEdit = (notebook: Notebook) => {
        setIsEditing(true);
        setEditingId(notebook.id);
        setTitle(notebook.title);
        setDescription(notebook.description || '');
        setSelectedDiscipline(notebook.discipline_id);
        setSelectedSubject(notebook.subject_id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o caderno "${title}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            setLoading(true);
            // Delete questions first (if no cascade)
            await supabase.from('notebook_questions').delete().eq('notebook_id', id);
            
            // Delete notebook
            const { error } = await supabase.from('notebooks').delete().eq('id', id);
            
            if (error) throw error;

            alert('Caderno excluído com sucesso!');
            fetchInitialData();
        } catch (error: any) {
            console.error('Error deleting notebook:', error);
            alert('Erro ao excluir caderno: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadModel = () => {
        const model = [
            {
                "text": "Qual a capital do Brasil?",
                "options": ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"],
                "answer": "Brasília",
                "explanation": "Brasília foi inaugurada em 1960."
            },
            {
                "text": "Quanto é 2 + 2?",
                "options": ["3", "4", "5", "6"],
                "answer": "4"
            }
        ];
        const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modelo_caderno.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Read JSON (Only if creating new or if file is provided)
            let formattedQuestions: any[] = [];
            if (!isEditing || jsonFile) {
                if (!jsonFile) {
                    alert('Selecione um arquivo JSON para as questões.');
                    setIsSubmitting(false);
                    return;
                }

                const text = await jsonFile.text();
                let questions = [];
                try {
                    questions = JSON.parse(text);
                } catch (err) {
                    alert('Erro ao ler JSON. Verifique a formatação.');
                    setIsSubmitting(false);
                    return;
                }

                if (!Array.isArray(questions) || questions.length === 0) {
                    alert('O arquivo JSON deve conter uma lista de questões (array não vazio).');
                    setIsSubmitting(false);
                    return;
                }

                // Validate basic structure of first item
                if (!questions[0].text && !questions[0].question) {
                    alert('Formato inválido. As questões devem ter o campo "text" ou "question".');
                    setIsSubmitting(false);
                    return;
                }

                formattedQuestions = questions.map((q: any, i: number) => ({
                    question_text: q.text || q.question || 'Questão sem texto',
                    options: Array.isArray(q.options) ? q.options : [],
                    correct_answer: q.answer || q.correct_answer || 'Sem gabarito',
                    explanation: q.explanation || '',
                    order_index: i + 1
                }));
            }

            if (isEditing && editingId) {
                // Update Notebook
                const { error: nbError } = await supabase
                    .from('notebooks')
                    .update({
                        title,
                        description,
                        discipline_id: selectedDiscipline,
                        subject_id: selectedSubject
                    })
                    .eq('id', editingId);

                if (nbError) throw new Error('Erro ao atualizar caderno: ' + nbError.message);

                // Update Questions if new file provided
                if (jsonFile && formattedQuestions.length > 0) {
                    // Delete old questions
                    await supabase.from('notebook_questions').delete().eq('notebook_id', editingId);
                    
                    // Insert new questions
                    const questionsToInsert = formattedQuestions.map(q => ({
                        ...q,
                        notebook_id: editingId
                    }));
                    const { error: qError } = await supabase.from('notebook_questions').insert(questionsToInsert);
                    if (qError) throw new Error('Erro ao atualizar questões: ' + qError.message);
                }

                alert('Caderno atualizado com sucesso!');
            } else {
                // 2. Create Notebook
                const { data: nb, error: nbError } = await supabase
                    .from('notebooks')
                    .insert({
                        title,
                        description,
                        discipline_id: selectedDiscipline,
                        subject_id: selectedSubject
                    })
                    .select()
                    .single();

                if (nbError) throw new Error('Erro ao criar caderno: ' + nbError.message);
                if (!nb) throw new Error('Caderno criado mas nenhum dado retornado.');

                // 3. Create Questions
                const questionsToInsert = formattedQuestions.map(q => ({
                    ...q,
                    notebook_id: nb.id
                }));

                const { error: qError } = await supabase.from('notebook_questions').insert(questionsToInsert);

                if (qError) {
                    console.error('Erro ao salvar questões:', qError);
                    await supabase.from('notebooks').delete().eq('id', nb.id);
                    throw new Error('Erro ao salvar questões (Rollback executado): ' + qError.message);
                }

                alert(`Caderno criado com sucesso com ${formattedQuestions.length} questões!`);
            }
            setIsModalOpen(false);
            resetForm();
            fetchInitialData();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Erro desconhecido');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setSelectedDiscipline('');
        setSelectedSubject('');
        setJsonFile(null);
        setIsEditing(false);
        setEditingId(null);
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setJsonFile(e.target.files[0]);
        }
    };

    const filteredSubjects = subjects.filter(s => s.disciplina_id === selectedDiscipline);

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black leading-tight tracking-tight">Cadernos de Questões</h2>
                    <p className="text-[#617589] text-base font-medium">Cadernos focados para memorização de apostilas.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleDownloadModel}
                        className="flex items-center gap-2 rounded-xl h-12 px-6 bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all"
                    >
                        <span className="material-symbols-outlined">download</span>
                        <span>Baixar Modelo</span>
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-xl h-12 px-6 bg-[#137fec] text-white text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span>Novo Caderno</span>
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#dbe0e6] overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Carregando...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#f8fafc] border-b border-[#f1f5f9] text-[#64748b] text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Título</th>
                                <th className="px-8 py-5">Disciplina / Assunto</th>
                                <th className="px-8 py-5 text-center">Questões</th>
                                <th className="px-8 py-5 text-center">Criado em</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {notebooks.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum caderno encontrado.</td></tr>
                            ) : (
                                notebooks.map(nb => (
                                    <tr key={nb.id} className="hover:bg-[#f8fafc] group">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-slate-900">{nb.title}</div>
                                            {nb.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{nb.description}</p>}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-bold text-slate-700">{nb.disciplina?.name}</div>
                                            <div className="text-xs text-slate-400">{nb.assunto?.name}</div>
                                        </td>
                                        <td className="px-8 py-5 text-center font-bold text-slate-700">{nb.questions_count}</td>
                                        <td className="px-8 py-5 text-center text-xs text-slate-400 font-bold">{new Date(nb.created_at).toLocaleDateString()}</td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => handlePreview(nb)}
                                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                                    title="Visualizar Questões"
                                                >
                                                    <span className="material-symbols-outlined">visibility</span>
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(nb)}
                                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(nb.id, nb.title)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
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

            {/* Modal Create */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-[#111418]">{isEditing ? 'Editar Caderno' : 'Novo Caderno'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><span className="material-symbols-outlined text-slate-400">close</span></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Título do Caderno</label>
                                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" placeholder="Ex: Caderno de Memorização - D. Const." />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição (Opcional)</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none"
                                    placeholder="Breve descrição do conteúdo..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Disciplina</label>
                                    <select required value={selectedDiscipline} onChange={e => setSelectedDiscipline(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-slate-600">
                                        <option value="">Selecione...</option>
                                        {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Assunto</label>
                                    <select required value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-slate-600" disabled={!selectedDiscipline}>
                                        <option value="">Selecione...</option>
                                        {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Arquivo JSON (Questões)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                    <input type="file" required={!isEditing} accept=".json" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">upload_file</span>
                                    <p className="text-sm font-bold text-slate-500">{jsonFile ? jsonFile.name : (isEditing ? 'Clique para trocar o JSON (opcional)' : 'Clique para selecionar o JSON')}</p>
                                </div>
                                <p className="text-[10px] text-slate-400">O arquivo deve conter um array de objetos com: text, options, answer.</p>
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50">
                                {isSubmitting ? (isEditing ? 'Salvando...' : 'Criando...') : (isEditing ? 'Salvar Alterações' : 'Criar Caderno')}
                            </button>
                        </form>
                    </div>
                </div >
            )}

            {/* Modal Preview */}
            {previewNotebook && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPreviewNotebook(null)}></div>
                    <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#111418] mb-1">{previewNotebook.title}</h3>
                                {previewNotebook.description && <p className="text-sm text-slate-500">{previewNotebook.description}</p>}
                                <div className="flex gap-2 mt-2">
                                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{previewNotebook.disciplina?.name}</span>
                                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{previewNotebook.assunto?.name}</span>
                                </div>
                            </div>
                            <button onClick={() => setPreviewNotebook(null)} className="size-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all">
                                <span className="material-symbols-outlined text-slate-400">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                            {previewQuestions.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">Nenhuma questão encontrada neste caderno.</div>
                            ) : (
                                previewQuestions.map((q, idx) => (
                                    <NotebookQuestionItem key={q.id} q={q} idx={idx} />
                                ))
                            )}
                        </div>
                    </div>
                </div >
            )}
        </div>
    );
};


export default CadernosAdmin;
