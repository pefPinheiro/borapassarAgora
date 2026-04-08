import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Notebook {
    id: string;
    title: string;
    description?: string;
}

interface NotebookQuestion {
    id: string;
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation?: string;
    order_index: number;
}

const CadernoView: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [questions, setQuestions] = useState<NotebookQuestion[]>([]);
    const [loading, setLoading] = useState(true);

    // Interactive State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [direction, setDirection] = useState<'right' | 'left'>('right');
    const [correctCount, setCorrectCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        if (id) fetchNotebookData();
    }, [id]);

    const shuffleArray = (array: any[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    const fetchNotebookData = async () => {
        setLoading(true);
        try {
            const { data: nb, error: nbError } = await supabase
                .from('notebooks')
                .select('*')
                .eq('id', id)
                .single();

            if (nbError) throw nbError;
            setNotebook(nb);

            const { data: qs, error: qsError } = await supabase
                .from('notebook_questions')
                .select('*')
                .eq('notebook_id', id)
                .order('order_index', { ascending: true });

            if (qsError) throw qsError;
            
            // Shuffle options for each question
            const shuffledQs = (qs || []).map(q => ({
                ...q,
                options: shuffleArray(q.options)
            }));

            setQuestions(shuffledQs);

        } catch (error) {
            console.error('Error:', error);
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOption = (idx: number) => {
        if (showFeedback) return;
        setSelectedOptionIndex(idx);
        setShowFeedback(true);
        
        const currentQ = questions[currentIndex];
        if (currentQ.options[idx] === currentQ.correct_answer) {
            setCorrectCount(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setDirection('right');
            setLoading(true); // Short flicker for animation reset
            setTimeout(() => {
                setSelectedOptionIndex(null);
                setShowFeedback(false);
                setCurrentIndex(prev => prev + 1);
                setLoading(false);
            }, 50);
        } else {
            setIsFinished(true);
        }
    };

    // Process custom BPA tags (specifically [--OBSERVE--] as requested)
    const processContent = (text: string | null | undefined) => {
        if (!text) return '';
        return text.replace(/\[--OBSERVE--\]([\s\S]*?)\[\/--OBSERVE--\]/gi, (match, content) => {
            return `<div class="custom-tag tag-observe"><div class="tag-icon-box"><span class="material-symbols-outlined">visibility</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Observe</strong></div><div class="tag-text">${content}</div></div></div>`;
        });
    };

    if (loading && !notebook) return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#f8fafc]">
            <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
        </div>
    );

    if (!notebook || questions.length === 0) return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-[#f8fafc]">
            <h2 className="text-xl font-black text-slate-800 mb-4">Caderno Vazio ou Não Encontrado</h2>
            <button onClick={() => navigate(-1)} className="text-[#137fec] hover:underline font-bold">Voltar</button>
        </div>
    );

    if (isFinished) {
        const total = questions.length;
        const percent = (correctCount / total) * 100;
        
        let feedbackTitle = "";
        let feedbackMessage = "";
        let feedbackColor = "";

        if (percent < 60) {
            feedbackTitle = "(Ruim)";
            feedbackMessage = "Recomenda-se ler ATENTAMENTE a apostila novamente.";
            feedbackColor = "text-red-500";
        } else if (percent <= 75) {
            feedbackTitle = "(Bom)";
            feedbackMessage = "Recomenda-se ler a apostila novamente.";
            feedbackColor = "text-blue-500";
        } else if (percent <= 90) {
            feedbackTitle = "(Excelente)";
            feedbackMessage = "Recomenda-se REVISAR a apostila novamente.";
            feedbackColor = "text-emerald-500";
        } else {
            feedbackTitle = "(Excepcional)";
            feedbackMessage = "Você demonstrou um domínio incrível! Pronto para o próximo desafio.";
            feedbackColor = "text-purple-600";
        }

        return (
            <div className="h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-hidden relative">
                <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-500">
                    <div className="size-20 bg-blue-50 text-[#137fec] rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-4xl">emoji_events</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Caderno Finalizado!</h2>
                    <p className="text-slate-500 mb-8 font-medium">Confira seu desempenho abaixo:</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acertos</span>
                            <span className="text-2xl font-black text-emerald-500">{correctCount}</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Erros</span>
                            <span className="text-2xl font-black text-red-400">{total - correctCount}</span>
                        </div>
                    </div>

                    <div className="mb-8 pb-8 border-b border-slate-100">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-black text-slate-400 uppercase">Precisão</span>
                            <span className="text-lg font-black text-slate-800">{percent.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-[#137fec] transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>

                    <div className="mb-10">
                        <h3 className={`text-lg font-black mb-2 ${feedbackColor}`}>{feedbackTitle}</h3>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed italic">"{feedbackMessage}"</p>
                    </div>

                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-4 bg-[#111418] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all"
                    >
                        Voltar para Cadernos
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const isCorrect = selectedOptionIndex !== null && currentQ.options[selectedOptionIndex] === currentQ.correct_answer;

    return (
        <div className="h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-hidden relative">

            {/* Header Compacto */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-[#f0f4f8] to-transparent">
                <button
                    onClick={() => navigate(-1)}
                    className="size-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Caderno de Questões</span>
                    <h1 className="text-sm font-black text-slate-800">{notebook.title}</h1>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="absolute top-0 left-0 h-1.5 bg-[#137fec] transition-all duration-500 ease-out z-20" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>

            {/* Main Card */}
            <div className="w-full max-w-2xl relative perspective-1000">
                {!loading && (
                    <div className="bg-white rounded-[32px] shadow-2xl shadow-blue-900/10 border border-white overflow-hidden animate-in slide-in-from-right-8 duration-500 flex flex-col max-h-[85vh]">

                        {/* Question Header */}
                        <div className="p-8 pb-4 border-b border-slate-50">
                            <div className="flex justify-between items-center mb-6">
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Questão {currentIndex + 1} de {questions.length}
                                </span>
                                {showFeedback && (
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                        <span className="material-symbols-outlined text-sm">{isCorrect ? 'check_circle' : 'cancel'}</span>
                                        {isCorrect ? 'Correto!' : 'Ops, errou!'}
                                    </span>
                                )}
                            </div>
                            <div className="prose prose-slate prose-p:font-medium prose-p:text-slate-700 max-w-none">
                                <div className="text-lg md:text-xl font-bold text-slate-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: processContent(currentQ.question_text) }} />
                            </div>
                        </div>

                        {/* Options Area */}
                        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-3 bg-slate-50/50">
                            {currentQ.options.map((option, idx) => {
                                let stateStyle = "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-md";

                                if (showFeedback) {
                                    if (idx === selectedOptionIndex) {
                                        stateStyle = isCorrect
                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-200"
                                            : "bg-red-500 border-red-500 text-white shadow-red-200";
                                    } else if (option === currentQ.correct_answer) {
                                        stateStyle = "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-50"; // Show correct answer
                                    } else {
                                        stateStyle = "bg-slate-50 border-slate-100 text-slate-300 opacity-50"; // Dim others
                                    }
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectOption(idx)}
                                        disabled={showFeedback}
                                        className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 group flex items-start gap-4 ${stateStyle}`}
                                    >
                                        <div className={`mt-0.5 size-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px] font-black transition-colors ${showFeedback && idx === selectedOptionIndex
                                                ? (isCorrect ? 'border-white text-white' : 'border-white text-white')
                                                : 'border-current opacity-60'
                                            }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span className="text-sm font-bold leading-relaxed">{option}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Fast Action Footer - Permanent to prevent layout shifts */}
                        <div className="bg-white border-t border-slate-100 p-6">
                            <button
                                onClick={handleNext}
                                disabled={!showFeedback}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 ${
                                    showFeedback 
                                        ? 'bg-[#111418] text-white shadow-xl hover:scale-[1.02] hover:bg-black active:scale-95' 
                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <span>{currentIndex < questions.length - 1 ? 'Próxima Questão' : 'Concluir Caderno'}</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
            `}</style>
        </div>
    );
};

export default CadernoView;

// BPA Custom Tags Styles
const tagStyles = `
    .custom-tag { margin: 2rem 0; background: #fff; border: 1px solid rgba(0,0,0,0.03); display: flex; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08); overflow: hidden; border-radius: 12px; }
    .tag-icon-box { min-width: 60px; display: flex; justify-content: center; align-items: center; background: linear-gradient(135deg, #22d3ee 0%, #0e7490 100%); color: white; }
    .tag-content-wrapper { padding: 1.5rem; flex: 1; }
    .tag-body strong { display: block; text-transform: uppercase; font-size: 0.8rem; margin-bottom: 0.5rem; color: #0e7490; }
    .tag-observe { border-right: 4px solid #0891b2; }
    .tag-text p { margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.6; color: #475569; }
    .tag-text p:last-child { margin-bottom: 0; }
`;

const styleElement = document.createElement('style');
styleElement.innerHTML = tagStyles;
document.head.appendChild(styleElement);
