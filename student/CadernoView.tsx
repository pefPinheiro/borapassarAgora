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

    useEffect(() => {
        if (id) fetchNotebookData();
    }, [id]);

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
            setQuestions(qs || []);

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
            alert('Parabéns! Você finalizou este caderno.');
            navigate(-1);
        }
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
                                <p className="text-lg md:text-xl font-bold text-slate-900 leading-relaxed">{currentQ.question_text}</p>
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

                        {/* Explanation & Action Footer */}
                        {showFeedback && (
                            <div className="bg-white border-t border-slate-100 p-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                                        <span className="material-symbols-outlined text-sm">lightbulb</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Explicação</span>
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        {currentQ.explanation || 'Sem explicação disponível para esta questão.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="w-full py-4 bg-[#111418] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <span>{currentIndex < questions.length - 1 ? 'Próxima Questão' : 'Concluir Caderno'}</span>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>
                        )}
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
