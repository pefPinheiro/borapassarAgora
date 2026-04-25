
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Questao, Disciplina, Assunto } from '../types';
import InteractiveQuestion from '../components/InteractiveQuestion';

interface Banca {
    id: string;
    name: string;
}

const QuestionsStudent: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const filtroInicial = searchParams.get('filtro');

    const [isFocusMode, setIsFocusMode] = useState(false);
    const [questions, setQuestions] = useState<Questao[]>([]);
    const [loading, setLoading] = useState(true);
    const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Filters Data
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [subassuntos, setSubassuntos] = useState<any[]>([]);
    const [subsubassuntos, setSubsubassuntos] = useState<any[]>([]);
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [years] = useState(Array.from({ length: 15 }, (_, i) => (new Date().getFullYear() - i).toString()));

    // Selected Filters (Multi-select)
    const [filterDisciplinas, setFilterDisciplinas] = useState<string[]>(searchParams.getAll('disciplinas'));
    const [filterAssuntos, setFilterAssuntos] = useState<string[]>(searchParams.getAll('assuntos'));
    const [filterSubassuntos, setFilterSubassuntos] = useState<string[]>(searchParams.getAll('subassuntos'));
    const [filterSubsubassuntos, setFilterSubsubassuntos] = useState<string[]>(searchParams.getAll('subsubassuntos'));
    const [filterBancas, setFilterBancas] = useState<string[]>(searchParams.getAll('bancas'));
    const [filterAnos, setFilterAnos] = useState<string[]>(searchParams.getAll('anos'));
    const [filterModalidades, setFilterModalidades] = useState<string[]>(searchParams.getAll('modalidades'));
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');

    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;

    // Daily Limit State
    const [dailyLimitStatus, setDailyLimitStatus] = useState({ is_premium: false, questions_today: 0, daily_limit: 20 });
    const [showLimitPopup, setShowLimitPopup] = useState(false);

    useEffect(() => {
        fetchAuxiliaryData();
        fetchQuestions(1);
        checkDailyLimit();
    }, []);

    const checkDailyLimit = async () => {
        const { data } = await supabase.rpc('get_student_daily_status');
        if (data) {
            setDailyLimitStatus(data);
        }
    };

    // Filter effect: When filters change, reset to page 1
    useEffect(() => {
        setPage(1);
        fetchQuestions(1);
    }, [filterDisciplinas, filterAssuntos, filterSubassuntos, filterSubsubassuntos, filterBancas, filterAnos, filterStatus, filterModalidades]);

    const fetchAuxiliaryData = async () => {
        try {
            const [dRes, aRes, saRes, ssaRes, bRes] = await Promise.all([
                supabase.from('disciplinas').select('*').order('name'),
                supabase.from('assuntos').select('*').order('name'),
                supabase.from('subassuntos').select('*').order('name'),
                supabase.from('subsubassuntos').select('*').order('name'),
                supabase.from('bancas').select('*').order('name')
            ]);
            
            if (dRes.data) setDisciplinas(dRes.data);
            if (aRes.data) setAssuntos(aRes.data);
            if (saRes.data) setSubassuntos(saRes.data);
            if (ssaRes.data) setSubsubassuntos(ssaRes.data);
            
            if (bRes.data) {
                const excludedBancas = ['Bora Passar Agora - Relax', 'Bora Passar Agora - Simulado'];
                setBancas(bRes.data.filter(b =>
                    !excludedBancas.includes(b.name) &&
                    !b.name.toUpperCase().includes('SIMULADOS - BPA')
                ));
            }
        } catch (error) {
            console.error('Error fetching filter data:', error);
        }
    };


    const fetchQuestions = async (pageNumber: number) => {
        if (pageNumber === 1) setLoading(true);
        const start = (pageNumber - 1) * pageSize;
        const end = start + pageSize - 1;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            const { data: historyData } = await supabase
                .from('student_question_history')
                .select('question_id')
                .eq('student_id', user.id);

            const rIds = new Set(historyData?.map(h => h.question_id) || []);
            setResolvedIds(rIds);

            // 2. Build Query
            let query = supabase
                .from('questions')
                .select('*, disciplinas(name), bancas!inner(name, sigla), text_bases(content, title), assuntos(name), subassuntos(name), subsubassuntos(name)', { count: 'exact' });
 
            // Apply Multi-select Filters
            if (filterDisciplinas.length > 0) query = query.in('disciplina_id', filterDisciplinas);
            if (filterBancas.length > 0) query = query.in('banca_id', filterBancas);
            if (filterAnos.length > 0) query = query.in('ano', filterAnos);
            
            // Handle Subjects Hierarchy (Assunto, Subassunto, Subsubassunto)
            const subjectOrConditions = [];
            if (filterAssuntos.length > 0) subjectOrConditions.push(`assunto_id.in.(${filterAssuntos.join(',')})`);
            if (filterSubassuntos.length > 0) subjectOrConditions.push(`subassunto_id.in.(${filterSubassuntos.join(',')})`);
            if (filterSubsubassuntos.length > 0) subjectOrConditions.push(`subsubassunto_id.in.(${filterSubsubassuntos.join(',')})`);
            
            if (subjectOrConditions.length > 0) {
                query = query.or(subjectOrConditions.join(','));
            }
 
            // Modalidade Filter
            if (filterModalidades.length > 0) {
                const modConditions = filterModalidades.map(m => {
                    if (m === 'Certo/Errado') return `modalidade.eq.Certo/Errado`;
                    return `modalidade.ilike.%Multipla Escolha%`;
                });
                query = query.or(modConditions.join(','));
            }
 
            // Exclude Simulados and Relax
            query = query.not('bancas.name', 'ilike', '%SIMULADOS%BPA%')
                .neq('bancas.name', 'Bora Passar Agora - Relax')
                .neq('bancas.name', 'Bora Passar Agora - Simulado');

            const idsArray = Array.from(rIds);
            if (filterStatus === 'resolved') {
                if (idsArray.length === 0) {
                    setQuestions([]);
                    setLoading(false);
                    return;
                }
                query = query.in('id', idsArray);
            } else if (filterStatus === 'unresolved' && idsArray.length > 0) {
                query = query.not('id', 'in', `(${idsArray.join(',')})`);
            }

            const { data, error } = await query
                .range(start, end)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                if (pageNumber === 1) {
                    setQuestions(data as unknown as Questao[]);
                } else {
                    setQuestions(prev => [...prev, ...(data as unknown as Questao[])]);
                }
                setHasMore(data.length === pageSize);
            }
        } catch (e) {
            console.error('Error fetching questions:', e);
        } finally {
            setLoading(false);
        }
    };


    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchQuestions(nextPage);
    };

    const toggleFocus = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error: ${err.message}`);
            });
            setIsFocusMode(true);
        } else {
            document.exitFullscreen();
            setIsFocusMode(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFocusMode(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleQuestionAnswer = async (questionId: string, altId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (!dailyLimitStatus.is_premium && dailyLimitStatus.questions_today >= dailyLimitStatus.daily_limit) {
                setShowLimitPopup(true);
                return;
            }

            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            const altIndex = parseInt(altId.split('-').pop() || '0');
            const isCorrect = question.alternativas[altIndex]?.isCorreta || false;

            await supabase.from('student_question_history').upsert({
                student_id: user.id,
                question_id: question.id,
                selected_alternative_index: altIndex,
                is_correct: isCorrect,
                created_at: new Date().toISOString()
            }, { onConflict: 'student_id,question_id' });

            setResolvedIds(prev => new Set(prev).add(questionId));

            if (!dailyLimitStatus.is_premium) {
                setDailyLimitStatus(prev => ({ ...prev, questions_today: prev.questions_today + 1 }));
            }
        } catch (error) {
            console.error('Error saving answer history:', error);
        }
    };

    return (
        <div ref={containerRef} className={`min-h-screen transition-all duration-500 overflow-y-auto ${isFocusMode ? 'bg-white p-0' : 'bg-[#f6f7f9] p-4 md:p-12'}`}>
            <div className={`flex items-center justify-between mx-auto max-w-5xl transition-all duration-500 ${isFocusMode ? 'fixed top-6 right-8 z-[100] gap-4' : 'mb-12'}`}>
                {!isFocusMode && (
                    <button onClick={() => navigate(-1)} className="size-12 flex items-center justify-center bg-white text-slate-400 hover:text-slate-900 transition-all rounded-2xl border border-slate-100 shadow-sm">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                )}
                <div className={`flex items-center gap-3 ${isFocusMode ? '' : 'ml-auto'}`}>
                    <button onClick={toggleFocus} className={`size-12 flex items-center justify-center transition-all rounded-2xl border ${isFocusMode ? 'bg-[#137fec] text-white' : 'bg-white text-slate-400 border-slate-100'}`} title="Modo Foco">
                        <span className="material-symbols-outlined">{isFocusMode ? 'close_fullscreen' : 'fullscreen'}</span>
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-12">
                {!isFocusMode && (
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-top-10 duration-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-blue-50 text-[#137fec] rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">tune</span>
                                </div>
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em]">Laboratório de Questões</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setFilterDisciplinas([]);
                                    setFilterAssuntos([]);
                                    setFilterSubassuntos([]);
                                    setFilterSubsubassuntos([]);
                                    setFilterBancas([]);
                                    setFilterAnos([]);
                                    setFilterModalidades([]);
                                    setFilterStatus('all');
                                }}
                                className="px-4 py-1.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">restart_alt</span>
                                Limpar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <MultiSelect label="Disciplinas" options={disciplinas.map(d => ({ id: d.id, name: d.name }))} selected={filterDisciplinas} onToggle={(id) => setFilterDisciplinas(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="book" />
                            <MultiSelect label="Bancas" options={bancas.map(b => ({ id: b.id, name: b.name }))} selected={filterBancas} onToggle={(id) => setFilterBancas(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="business_center" />
                            <MultiSelect label="Modalidade" options={[{ id: 'Multipla Escolha', name: 'Múltipla Escolha' }, { id: 'Certo/Errado', name: 'Certo/Errado' }]} selected={filterModalidades} onToggle={(id) => setFilterModalidades(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="rule" />
                            <MultiSelect label="Ano" options={years.map(y => ({ id: y, name: y }))} selected={filterAnos} onToggle={(id) => setFilterAnos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="calendar_month" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                            <MultiSelect label="Assuntos" options={assuntos.filter(a => filterDisciplinas.length === 0 || filterDisciplinas.includes(a.disciplina_id)).map(a => ({ id: a.id, name: a.name }))} selected={filterAssuntos} onToggle={(id) => setFilterAssuntos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="topic" />
                            <MultiSelect label="Subassuntos" options={subassuntos.filter(s => filterAssuntos.length === 0 || filterAssuntos.includes(s.assunto_id)).map(s => ({ id: s.id, name: s.name }))} selected={filterSubassuntos} onToggle={(id) => setFilterSubassuntos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="layers" />
                            <MultiSelect label="Sub-Subassuntos" options={subsubassuntos.filter(s => filterSubassuntos.length === 0 || filterSubassuntos.includes(s.subassunto_id)).map(s => ({ id: s.id, name: s.name }))} selected={filterSubsubassuntos} onToggle={(id) => setFilterSubsubassuntos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} icon="segment" />
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</p>
                            <div className="flex bg-slate-50 p-1 rounded-2xl">
                                {['all', 'resolved', 'unresolved'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === status ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {status === 'all' ? 'Todas' : status === 'resolved' ? 'Feitas' : 'Não Feitas'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <FilterSummary 
                            filters={{
                                bancas: { data: bancas, selected: filterBancas },
                                disciplinas: { data: disciplinas, selected: filterDisciplinas },
                                assuntos: { data: assuntos, selected: filterAssuntos },
                                subassuntos: { data: subassuntos, selected: filterSubassuntos },
                                subsubassuntos: { data: subsubassuntos, selected: filterSubsubassuntos },
                                anos: { selected: filterAnos },
                                modalidades: { selected: filterModalidades }
                            }}
                            onRemove={(type, id) => {
                                if (type === 'bancas') setFilterBancas(prev => prev.filter(i => i !== id));
                                if (type === 'disciplinas') setFilterDisciplinas(prev => prev.filter(i => i !== id));
                                if (type === 'assuntos') setFilterAssuntos(prev => prev.filter(i => i !== id));
                                if (type === 'subassuntos') setFilterSubassuntos(prev => prev.filter(i => i !== id));
                                if (type === 'subsubassuntos') setFilterSubsubassuntos(prev => prev.filter(i => i !== id));
                                if (type === 'anos') setFilterAnos(prev => prev.filter(i => i !== id));
                                if (type === 'modalidades') setFilterModalidades(prev => prev.filter(i => i !== id));
                            }}
                        />
                    </div>
                )}

                <div className="space-y-12 pb-24">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sincronizando Banco de Questões...</p>
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[40px] border border-dashed border-slate-100">
                            <span className="material-symbols-outlined text-6xl text-slate-100 mb-4">inventory_2</span>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma questão encontrada com estes filtros.</p>
                        </div>
                    ) : questions.map((q) => (
                        <InteractiveQuestion
                            key={q.id}
                            question={{
                                id: q.id,
                                enunciado: q.enunciado,
                                texto_base: q.texto_base,
                                text_bases: q.text_bases,
                                alternativas: (q.alternativas || []).map((alt, i) => ({
                                    id: `${q.id}-${i}`,
                                    texto: alt.texto,
                                    isCorreta: alt.isCorreta
                                })),
                                resposta_professor: q.resposta_professor,
                                bancas: q.bancas,
                                disciplinas: q.disciplinas,
                                assuntos: q.assuntos,
                                ano: q.ano
                            }}
                            onBeforeAnswer={() => {
                                if (!dailyLimitStatus.is_premium && dailyLimitStatus.questions_today >= dailyLimitStatus.daily_limit) {
                                    setShowLimitPopup(true);
                                    return false;
                                }
                                return true;
                            }}
                            onAnswer={(altId) => handleQuestionAnswer(q.id, altId)}
                        />
                    ))}

                    {hasMore && !loading && questions.length > 0 && (
                        <div className="flex justify-center pt-8">
                            <button onClick={loadMore} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 hover:text-[#137fec] transition-all shadow-sm">Carregar Mais</button>
                        </div>
                    )}
                </div>
            </div>

            {showLimitPopup && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white p-10 rounded-[40px] shadow-3xl max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#137fec] to-[#ff3b9a]"></div>
                        <div className="size-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl font-black">lock</span>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Limite Diário <br /> <span className="text-amber-500">Atingido!</span></h2>
                            <p className="text-slate-500 font-medium leading-relaxed">Você atingiu o limite de {dailyLimitStatus.daily_limit} questões gratuitas por dia.</p>
                        </div>
                        <div className="space-y-3 pt-4">
                            <button onClick={() => navigate('/aluno/catalogo')} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-[#137fec] transition-all shadow-xl flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">workspace_premium</span>
                                Liberar Acesso
                            </button>
                            <button onClick={() => setShowLimitPopup(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600">Voltar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MultiSelect: React.FC<{
    label: string;
    options: { id: string; name: string }[];
    selected: string[];
    onToggle: (id: string) => void;
    icon: string;
}> = ({ label, options, selected, onToggle, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-14 px-5 bg-slate-50 border border-transparent rounded-2xl flex items-center justify-between transition-all group ${isOpen ? 'bg-white border-[#137fec] ring-4 ring-blue-50' : 'hover:bg-slate-100'}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`material-symbols-outlined text-xl ${selected.length > 0 ? 'text-[#137fec]' : 'text-slate-400'}`}>{icon}</span>
                    <div className="text-left overflow-hidden">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter truncate">
                            {selected.length === 0 ? `Todos` : `${selected.length} Selecionados`}
                        </p>
                    </div>
                </div>
                <span className={`material-symbols-outlined transition-transform duration-300 text-slate-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-[24px] shadow-2xl z-[150] max-h-64 overflow-y-auto custom-scrollbar p-3 space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {options.length === 0 ? (
                        <p className="p-4 text-[10px] text-slate-400 font-bold uppercase text-center italic">Nenhuma opção</p>
                    ) : options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onToggle(opt.id)}
                            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left ${selected.includes(opt.id) ? 'bg-blue-50 text-[#137fec]' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                            <div className={`size-5 rounded-md border-2 flex items-center justify-center transition-all ${selected.includes(opt.id) ? 'bg-[#137fec] border-[#137fec]' : 'border-slate-200 bg-white'}`}>
                                {selected.includes(opt.id) && <span className="material-symbols-outlined text-[14px] text-white font-bold">check</span>}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-tight truncate">{opt.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const FilterSummary: React.FC<{
    filters: any;
    onRemove: (type: string, id: string) => void;
}> = ({ filters, onRemove }) => {
    const hasActiveFilters = Object.values(filters).some((f: any) => f.selected.length > 0);
    if (!hasActiveFilters) return null;
    return (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
            {Object.entries(filters).map(([type, config]: [string, any]) => {
                return config.selected.map((id: string) => {
                    const item = config.data ? config.data.find((i: any) => i.id === id) : { name: id };
                    return (
                        <div key={`${type}-${id}`} className="px-3 py-1.5 bg-blue-50 text-[#137fec] rounded-lg flex items-center gap-2 group transition-all hover:bg-[#137fec] hover:text-white">
                            <span className="text-[9px] font-black uppercase tracking-widest">{item?.name || id}</span>
                            <button onClick={() => onRemove(type, id)} className="material-symbols-outlined text-sm opacity-50 hover:opacity-100">close</button>
                        </div>
                    );
                });
            })}
        </div>
    );
};

export default QuestionsStudent;