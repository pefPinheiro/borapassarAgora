import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface InteractiveQuestionProps {
    id?: string;
    question?: {
        id?: string;
        enunciado: string;
        text_bases?: { content: string; title?: string } | null;
        texto_base?: string | null;
        alternativas: {
            id: string;
            texto: string;
            isCorreta: boolean;
        }[];
        resposta_professor?: string | null;
        bancas?: { name: string; sigla?: string } | null;
        disciplinas?: { name: string } | null;
        assuntos?: { name: string } | null;
        ano?: string | number | null;
    };
    startOpen?: boolean;
    disabled?: boolean;
    onAnswer?: (altId: string) => void;
    onBeforeAnswer?: () => boolean;
}

const InteractiveQuestion: React.FC<InteractiveQuestionProps> = ({ id, question: propQuestion, onAnswer, onBeforeAnswer, disabled }) => {
    const [localQuestion, setLocalQuestion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [showBaseText, setShowBaseText] = useState(false);

    const activeQuestion = propQuestion || localQuestion;

    const processMath = (text: string) => {
        const cleanLatex = (tex: string) => {
            return tex
                .replace(/&amp;/gi, '&')      // Unescape & primeiro
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/<br\s*\/?>/gi, ' ') // Substituir breaks por espaço
                .replace(/<\/?(?:p|div|br|span|strong|b|em|i|u|s|h[1-6]|ol|ul|li|pre|code|font)\b[^>]*?>/gi, ' ') // Remover apenas tags HTML conhecidas
                .replace(/\s+/g, ' ')           // Colapsar múltiplos espaços
                .trim();
        };

        return text
            // 1. Converte <code> com conteúdo LaTeX para texto puro para processamento
            .replace(/<code>([\s\S]*?\\(?:frac|sqrt|cdot|times|sum|int|align|begin|quad|implies|iff|neg|lor|land)[\s\S]*?)<\/code>/gi, '$1')
            
            // 2. Display Mode: $$...$$ ou \[...\]
            .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
                try {
                    return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
                } catch { return _; }
            })
            .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
                try {
                    return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
                } catch { return _; }
            })
            
            // 3. Inline Mode: \(...\) ou $...$ (apenas se tiver caracteres matemáticos para evitar falsos positivos com $)
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
                try {
                    return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: false, throwOnError: false });
                } catch { return _; }
            })
            .replace(/\$([^\n\$]+?)\$/g, (_, tex) => {
                // Detectar se parece math (presença de \, ^, _, {, } ou operadores comuns)
                if (/[\\^_\{\}\+\=\-\/\(\)]/.test(tex)) {
                    try {
                        return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: false, throwOnError: false });
                    } catch { return _; }
                }
                return _;
            })
            
            // 4. Ambientes diretos \begin{array} ... \end{array} que podem não estar em \[ \]
            .replace(/\\begin\{array\}([\s\S]*?)\\end\{array\}/gi, (match) => {
                try {
                    return katex.renderToString(cleanLatex(match).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
                } catch { return match; }
            });
    };

    const processMarkdown = (text: string) => {
        let processed = text;
        
        // 0. Process Advanced Markdown Tables (GFM Standard)
        const potentialTableBlockRegex = /((?:(?:<p>|<div>)?\s*(?:(?!<\/?(?:p|div)).)*?\|.*?(?:\s*|<\/p>|<\/div>|<br\s*\/?>)*){2,})/gi;
        
        processed = processed.replace(potentialTableBlockRegex, (block) => {
            if (block.includes('\\begin') || block.includes('\\end')) return block;

            const lines = block
                .replace(/<(?:p|div|br\s*\/?)>/gi, '\n')
                .replace(/<\/(?:p|div)>/gi, '\n')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.includes('|'));

            if (lines.length < 2) return block;

            const parseMarkdownRow = (line: string) => {
                let cleaned = line.trim();
                if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
                if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
                const parts = [];
                let current = '';
                for (let i = 0; i < cleaned.length; i++) {
                    if (cleaned[i] === '|' && (i === 0 || cleaned[i-1] !== '\\')) {
                        parts.push(current.trim());
                        current = '';
                    } else {
                        current += cleaned[i];
                    }
                }
                parts.push(current.trim());
                return parts.map(p => p.replace(/\\\|/g, '|'));
            };

            const headerRow = parseMarkdownRow(lines[0]);
            const dividerRow = parseMarkdownRow(lines[1]);
            
            const isDivider = dividerRow.every(c => /^[|:\s-]+$/.test(c)) && dividerRow.some(c => c.includes('-'));
            if (!isDivider) return block;

            const alignments = dividerRow.map(c => {
                const start = c.startsWith(':');
                const end = c.endsWith(':');
                if (start && end) return 'center';
                if (end) return 'right';
                return 'left';
            });

            const bodyRows = lines.slice(2).map(parseMarkdownRow);

            let html = '<div class="table-container my-12 animate-in fade-in zoom-in-95 duration-1000"><table>';
            html += '<thead><tr>';
            headerRow.forEach((h, i) => {
                const align = alignments[i] || 'left';
                html += `<th style="text-align: ${align}">${h}</th>`;
            });
            html += '</tr></thead><tbody>';

            bodyRows.forEach(row => {
                if (row.length === 0 || (row.length === 1 && row[0] === '')) return;
                html += '<tr>';
                for (let i = 0; i < headerRow.length; i++) {
                    const align = alignments[i] || 'left';
                    html += `<td style="text-align: ${align}">${row[i] || ''}</td>`;
                }
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            return html;
        });

        processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        const headerRegex = /(#{2,4})\s+((?:(?!(?:<br|<\/p>|<div>|\n)).)*)/gi;
        
        processed = processed.replace(headerRegex, (match, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content.trim()}</h${level}>`;
        });

        processed = processed.replace(/<p>\s*<\/p>/g, '');
        
        return processed;
    };

    // Process custom BPA tags (specifically [--OBSERVE--] as requested)
    const processContent = (text: string | null | undefined) => {
        if (!text) return '';
        
        // Handle newlines before processing math/markdown to ensure they don't break regex
        // Also handle literal \n strings that often appear in JSON content
        let processed = text
            .replace(/\\n/g, '<br/>')
            .replace(/\n/g, '<br/>');

        processed = processMath(processed);
        processed = processMarkdown(processed);
        
        processed = processed.replace(/\[--OBSERVE--\]([\s\S]*?)\[\/--OBSERVE--\]/gi, (match, content) => {
            return `<div class="custom-tag tag-observe"><div class="tag-icon-box"><span class="material-symbols-outlined">visibility</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Observe</strong></div><div class="tag-text">${content}</div></div></div>`;
        });

        // Add SOLUCAO tags support
        processed = processed.replace(/\[--SOLUCAO--\]([\s\S]*?)\[\/--SOLUCAO--\]/gi, '<div class="resolve-solution">$1</div>');
        processed = processed.replace(/\[--SOLUÇÃO--\]([\s\S]*?)\[\/--SOLUÇÃO--\]/gi, '<div class="resolve-solution">$1</div>');

        return processed;
    };

    useEffect(() => {
        if (id && !propQuestion) {
            const fetchQuestion = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('questions')
                        .select('*, bancas(name, sigla), disciplinas(name), text_bases(content, title)')
                        .eq('id', id)
                        .single();
                    if (data) setLocalQuestion(data);
                } catch (e) {
                    console.error('Error fetching interactive question:', e);
                } finally {
                    setLoading(false);
                }
            };
            fetchQuestion();
        }
    }, [id, propQuestion]);

    const handleAnswer = (altId: string) => {
        if (showResult) return;

        // Allow parent to block the interaction (e.g. daily limit locked)
        if (onBeforeAnswer && !onBeforeAnswer()) {
            return;
        }

        setSelectedAlt(altId);
        setShowResult(true);
        if (onAnswer) onAnswer(altId);
    };

    if (loading) return (
        <div className="p-10 border border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center gap-3 animate-pulse">
            <div className="size-8 border-2 border-slate-200 border-t-[#3b82f6] rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Desafio...</span>
        </div>
    );

    if (!activeQuestion) return null;

    // Helper to safely extract base text content and title
    const getBaseTextData = () => {
        const tb = activeQuestion.text_bases as any;
        let data = { content: '', title: '' };

        if (Array.isArray(tb) && tb.length > 0) {
            data = tb[0];
        } else if (tb && !Array.isArray(tb)) {
            data = tb;
        }

        return {
            content: data.content || activeQuestion.texto_base || '',
            title: data.title || 'Texto de Apoio'
        };
    };

    const baseTextData = getBaseTextData();
    // Verifica se tem conteúdo real removendo tags HTML vazias
    const hasBaseText = !!baseTextData.content && baseTextData.content.replace(/<[^>]*>/g, '').trim().length > 0;

    return (
        <div className="premium-question-wrapper w-full overflow-hidden print:overflow-visible break-inside-auto">
            <div className="premium-question-card overflow-hidden">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 justify-between premium-question-header">
                    <div className="flex items-start md:items-center gap-4">
                        <div className="size-11 bg-[#3b82f6] flex items-center justify-center text-white shadow-lg shadow-blue-200 print:hidden shrink-0 rounded-xl">
                            <span className="material-symbols-outlined text-2xl">quiz</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 m-0 leading-none tracking-tight">Desafio de Fixação</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-left">
                                {activeQuestion.disciplinas?.name && (
                                    <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm">
                                        {activeQuestion.disciplinas.name}
                                    </span>
                                )}
                                {activeQuestion.assuntos?.name && (
                                    <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm">
                                        {activeQuestion.assuntos.name}
                                    </span>
                                )}
                                {(() => {
                                    const b = Array.isArray(activeQuestion.bancas) ? activeQuestion.bancas[0] : activeQuestion.bancas;
                                    if (!b?.name) return null;
                                    return (
                                        <span className="premium-tag-banca text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm shadow-sm border border-blue-100 bg-blue-50/50 text-blue-600">
                                            {b.sigla ? `${b.sigla} - ${b.name}` : b.name}
                                        </span>
                                    );
                                })()}
                                {activeQuestion.ano && (
                                    <span className="premium-tag-ano text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-sm shadow-sm border border-slate-200">
                                        {activeQuestion.ano}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {hasBaseText && (
                        <button
                            onClick={() => setShowBaseText(!showBaseText)}
                            className={`w-full md:w-auto px-5 py-3 md:py-2.5 rounded-xl md:rounded-full border text-[10px] font-black uppercase tracking-widest transition-all no-print flex items-center justify-center gap-2 ${showBaseText ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{showBaseText ? 'visibility_off' : 'description'}</span>
                            {showBaseText ? 'Ocultar Texto' : 'Texto Base'}
                        </button>
                    )}
                </div>

                {/* Texto Base / Apoio */}
                {hasBaseText && (
                    <div className={`mb-8 p-6 md:p-8 bg-slate-50 border-l-4 border-indigo-500 premium-question-text text-slate-600 text-sm leading-relaxed ${showBaseText ? 'animate-in fade-in slide-in-from-top-2 duration-500' : 'hidden print:block'}`}>
                        <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 break-words">
                            <span className="material-symbols-outlined text-lg">description</span>
                            TEXTO DE APOIO
                        </h4>
                        <div className="prose prose-slate max-w-none break-words overflow-hidden" dangerouslySetInnerHTML={{ __html: baseTextData.content }} />
                    </div>
                )}

                {/* Enunciado */}
                <div className="text-base md:text-lg font-bold text-slate-800 leading-relaxed mb-8 md:mb-10 premium-question-text break-words" dangerouslySetInnerHTML={{ __html: processContent(activeQuestion.enunciado) }} />

                {/* Alternativas */}
                <div className="space-y-3 md:space-y-4">
                    {activeQuestion.alternativas.map((alt: any, idx: number) => {
                        const isSelected = selectedAlt === alt.id;
                        const isThisCorrect = alt.isCorreta;
                        const showAsCorrect = showResult && isThisCorrect;

                        let wrapperClass = "premium-button-alt";
                        let circleClass = "premium-alt-circle border-slate-200 text-slate-400";

                        if (showResult && isThisCorrect) {
                            wrapperClass = "border-emerald-500 bg-emerald-50 pointer-events-none";
                            circleClass = "bg-emerald-500 border-emerald-500 text-white";
                        } else if (isSelected && !isThisCorrect) {
                            wrapperClass = "border-red-500 bg-red-50 pointer-events-none";
                            circleClass = "bg-red-500 border-red-500 text-white";
                        } else if (isSelected) {
                            wrapperClass = "border-blue-500 bg-blue-50";
                            circleClass = "bg-[#3b82f6] border-[#3b82f6] text-white";
                        }

                        return (
                            <button
                                key={alt.id}
                                disabled={showResult || disabled}
                                onClick={() => handleAnswer(alt.id)}
                                className={`w-full flex items-start gap-4 md:gap-5 p-4 md:p-5 min-h-[3.5rem] transition-all text-left outline-none rounded-2xl md:rounded-3xl border-2 ${wrapperClass}`}
                            >
                                <div className={`size-8 md:size-9 flex items-center justify-center text-xs md:text-sm font-black transition-all shrink-0 rounded-full border-2 mt-0.5 ${circleClass}`}>
                                    {showAsCorrect ? <span className="material-symbols-outlined text-[18px] md:text-[20px]">check</span> : String.fromCharCode(65 + idx)}
                                </div>
                                <span className="text-sm md:text-[15px] font-semibold text-slate-700 flex-1 premium-question-text break-words whitespace-normal min-w-0" dangerouslySetInnerHTML={{ __html: processContent(alt.texto) }} />
                                {showResult && isThisCorrect && <span className="material-symbols-outlined text-emerald-500 animate-in zoom-in text-xl md:text-2xl shrink-0">check_circle</span>}
                                {showResult && isSelected && !isThisCorrect && <span className="material-symbols-outlined text-red-500 animate-in zoom-in text-xl md:text-2xl shrink-0">cancel</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Comentário do Professor */}
                {showResult && activeQuestion.resposta_professor && (
                    <div className="mt-10 pt-10 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                                <span className="material-symbols-outlined text-xl">school</span>
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] m-0">Gabarito Comentado</h4>
                                <p className="text-[10px] text-slate-400 font-bold m-0 uppercase mt-0.5">Análise do Especialista</p>
                            </div>
                        </div>
                        <div className="text-[15px] text-slate-600 leading-relaxed bg-emerald-50/30 p-8 border-l-4 border-emerald-500 premium-question-text" dangerouslySetInnerHTML={{ __html: processContent(activeQuestion.resposta_professor) }} />
                    </div>
                )}

                {/* Print Only Footer */}
                <div className="hidden print-gabarito mt-6 pt-6 border-t border-slate-300">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-4">Gabarito Oficial</div>
                    <div className="text-xl font-black text-[#137fec]">
                        Resposta: {(() => {
                            const idx = activeQuestion.alternativas.findIndex((a: any) => a.isCorreta);
                            if (idx === -1) return 'N/A';
                            const text = activeQuestion.alternativas[idx].texto;
                            if (['certo', 'errado'].includes(text.toLowerCase().trim())) return text.toUpperCase();
                            return String.fromCharCode(65 + idx);
                        })()}
                    </div>
                </div>
            </div>
            <style>{`
                .premium-question-wrapper .custom-tag { margin: 2rem 0; background: #fff; border: 1px solid rgba(0,0,0,0.03); display: flex; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08); overflow: hidden; }
                .premium-question-wrapper .tag-icon-box { min-width: 60px; display: flex; justify-content: center; align-items: center; background: linear-gradient(135deg, #22d3ee 0%, #0e7490 100%); color: white; }
                .premium-question-wrapper .tag-content-wrapper { padding: 1.5rem; flex: 1; }
                .premium-question-wrapper .tag-body strong { display: block; text-transform: uppercase; font-size: 0.8rem; margin-bottom: 0.5rem; color: #0e7490; }
                .premium-question-wrapper .tag-observe { border-right: 4px solid #0891b2; }
                .premium-question-wrapper .resolve-solution { margin-top: 1.5rem; padding: 2rem; background-color: #f0f9ff; border-radius: 16px; border: 1px solid #bae6fd; position: relative; }
                .premium-question-wrapper .resolve-solution::before { content: 'RESPOSTA E COMENTÁRIOS'; display: block; font-family: 'Lexend', sans-serif; font-size: 0.75rem; font-weight: 800; color: #0369a1; margin-bottom: 1rem; letter-spacing: 0.1em; }
            `}</style>
        </div>
    );
};

export default InteractiveQuestion;