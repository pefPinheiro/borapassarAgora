import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import InteractiveQuestion from '../components/InteractiveQuestion';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Apostila {
    id: string;
    title: string;
    content: string;
    disciplina: { name: string };
    author: { full_name: string };
    created_at?: string;
    description?: string;
    estimated_time?: string;
    disciplina_id?: string;
    assunto_id?: string;
}

interface Question {
    id: string;
    enunciado: string;
    text_bases?: { content: string, title: string };
    texto_base?: string;
    alternativas: {
        id: string;
        texto: string;
        isCorreta: boolean;
    }[];
    resposta_professor?: string;
    bancas?: { name: string };
    ano?: string;
}

interface Profile {
    full_name: string;
    cpf: string;
}

const ApostilaReader: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [apostila, setApostila] = useState<Apostila | null>(null);
    const [courseBanner, setCourseBanner] = useState<string | null>(null);
    const [courseName, setCourseName] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [notebooks, setNotebooks] = useState<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Apostila
            const { data: apData, error: apError } = await supabase
                .from('apostilas')
                .select('*, disciplina:disciplinas(name), author:profiles!author_id(full_name)')
                .eq('id', id)
                .single();

            if (apError) throw apError;
            setApostila(apData);

            // 2. Fetch Course Banner using relation
            const { data: itemData } = await supabase
                .from('course_items')
                .select('courses(banner_url, title)')
                .eq('apostila_id', id)
                .limit(1)
                .maybeSingle();

            if (itemData?.courses) {
                const course = itemData.courses as any;
                setCourseBanner(course.banner_url);
                setCourseName(course.title);
            }

            // 3. Fetch User Profile for Footer
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profData } = await supabase
                    .from('profiles')
                    .select('full_name, cpf')
                    .eq('id', user.id)
                    .single();
                if (profData) setProfile(profData);
            }

            // 4. Fetch Linked Notebooks
            const { data: nbData } = await supabase
                .from('notebooks')
                .select('*')
                .eq('apostila_id', id)
                .order('created_at', { ascending: false });

            if (nbData) setNotebooks(nbData);

        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        window.print();
    };

    const toggleFocus = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
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

    // Função para renderizar conteúdo processando placeholders de questões e vídeos de forma resiliente
    const renderProcessedContent = (content: string) => {
        if (!content) return null;

        // 1. Limpeza agressiva de divs wrappers geradas pelo editor com suporte a quebras de linha
        let cleanContent = content.replace(/<div class="ap-placeholder[^>]*>([\s\S]*?)<\/div>/gi, '$1');

        // 1.5. Detectar IFrames de vídeo (YouTube/Vimeo) inseridos diretamente pelo editor e converter para Shortcode
        // Isso garante que vídeos colados diretamente recebam a nossa estilização
        cleanContent = cleanContent.replace(/<div[^>]*data-youtube-video[^>]*>[\s\S]*?<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, '[VÍDEO AULA: "$1"]');
        cleanContent = cleanContent.replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, (match, src) => {
            if (src.includes('youtube') || src.includes('youtu.be') || src.includes('vimeo')) {
                return `[VÍDEO AULA: "${src}"]`;
            }
            return match;
        });

        // 1.8. Process Mathematical Equations (KaTeX)
        const processMath = (text: string) => {
            return text
                // Display Mode: $$...$$
                .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
                    try {
                        return katex.renderToString(tex, { displayMode: true, throwOnError: false });
                    } catch { return _; }
                })
                // Display Mode: \[...\]
                .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
                    try {
                        return katex.renderToString(tex, { displayMode: true, throwOnError: false });
                    } catch { return _; }
                })
                // Inline Mode: \(...\)
                .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
                    try {
                        return katex.renderToString(tex, { displayMode: false, throwOnError: false });
                    } catch { return _; }
                });
        };

        cleanContent = processMath(cleanContent);

        // 2. Regex flexível para capturar IDs de questões e vídeos
        // Permite "QUESTÃO INTERATIVA ID", "QUESTÃO INTERATIVA" e o novo formato "quest_id"
        const tagRegex = /\[\s*(?:QUESTÃO INTERATIVA ID|QUESTÃO INTERATIVA|VÍDEO AULA|quest_id)\s*[:=]\s*(?:")?([^"\]]+)(?:")?\s*\]/gi;

        // ... (custom tags replacement code lines 229-234 remain unchanged efficiently) ...
        // PROCESSAMENTO DE TAGS PERSONALIZADAS (Visual Vibrant Pop)
        cleanContent = cleanContent
            .replace(/\[--AVISO--\]([\s\S]*?)\[\/--AVISO--\]/g, '<div class="custom-tag tag-aviso"><div class="tag-icon-box"><span class="material-symbols-outlined">warning</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Ponto de Atenção</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--IMPORTANTE--\]([\s\S]*?)\[\/--IMPORTANTE--\]/g, '<div class="custom-tag tag-importante"><div class="tag-icon-box"><span class="material-symbols-outlined">priority_high</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Importante</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--LEI--\]([\s\S]*?)\[\/--LEI--\]/g, '<div class="custom-tag tag-lei"><div class="tag-icon-box"><span class="material-symbols-outlined">gavel</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Lei Seca / Jurisprudência</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--LINK--\]([\s\S]*?)\[\/--LINK--\]/g, '<div class="custom-tag tag-link"><div class="tag-icon-box"><span class="material-symbols-outlined">link</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Recurso Extra</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--OBSERVE--\]([\s\S]*?)\[\/--OBSERVE--\]/gi, '<div class="custom-tag tag-observe"><div class="tag-icon-box"><span class="material-symbols-outlined">visibility</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Observe</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--FREQUENTE--\]([\s\S]*?)\[\/--FREQUENTE--\]/g, '<div class="custom-tag tag-frequente"><div class="tag-icon-box"><span class="material-symbols-outlined">local_fire_department</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Cai com Frequência</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--EXTRA--\]([\s\S]*?)\[\/--EXTRA--\]/g, '<div class="custom-tag tag-extra"><div class="tag-icon-box"><span class="material-symbols-outlined">add_circle</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Conteúdo Extra</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--NOVIDADE--\]([\s\S]*?)\[\/--NOVIDADE--\]/g, '<div class="custom-tag tag-novidade"><div class="tag-icon-box"><span class="material-symbols-outlined">auto_awesome</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Novidade</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--EXEMPLO--\]([\s\S]*?)\[\/--EXEMPLO--\]/g, '<div class="custom-tag tag-exemplo"><div class="tag-icon-box"><span class="material-symbols-outlined">lightbulb</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Exemplo</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--BORA-PRATICAR--\]([\s\S]*?)\[\/--BORA-PRATICAR--\]/g, '<div class="custom-tag tag-praticar"><div class="tag-icon-box"><span class="material-symbols-outlined">fitness_center</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Bora Praticar Agora!</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--CORRECAO--\]([\s\S]*?)\[\/--CORRECAO--\]/g, '<div class="custom-tag tag-correcao"><div class="tag-icon-box"><span class="material-symbols-outlined">edit_note</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Correção Necessária</strong></div><div class="tag-text">$1</div></div></div>')
            .replace(/\[--TITULO--\]([\s\S]*?)\[\/--TITULO--\]/g, '<div class="custom-tag tag-titulo"><div class="tag-content-wrapper"><div class="tag-text">$1</div></div></div>');


        // 3. Encontra todas as ocorrências e cria um array de partes
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = tagRegex.exec(cleanContent)) !== null) {
            // Adiciona o texto antes do marcador
            if (match.index > lastIndex) {
                const textBefore = cleanContent.substring(lastIndex, match.index);
                // Evita criar divs vazias ou só com breaks se possível
                if (textBefore.replace(/<br\s*\/?>/g, '').trim()) {
                    parts.push(
                        <div
                            key={`text-${lastIndex}`}
                            className="ql-editor p-0 mb-8"
                            dangerouslySetInnerHTML={{ __html: textBefore }}
                        />
                    );
                }
            }

            const rawId = match[1].trim().replace(/<[^>]*>/g, ''); // Limpeza de HTML residual interno
            const fullTag = match[0].toUpperCase();

            // Lógica unificada para detectar se é questão (support old and new formats)
            if (fullTag.includes('QUESTÃO') || fullTag.includes('QUEST_ID')) {
                parts.push(
                    <div key={`q-wrap-${rawId}-${match.index}`} className="my-16 print:my-4">
                        <InteractiveQuestion id={rawId} />
                    </div>
                );
            } else if (match[0].toUpperCase().includes('VÍDEO AULA')) {
                const videoUrl = rawId;
                let embedUrl = videoUrl;
                if (videoUrl.includes('youtube.com/watch?v=')) {
                    embedUrl = videoUrl.replace('watch?v=', 'embed/');
                } else if (videoUrl.includes('youtu.be/')) {
                    embedUrl = videoUrl.replace('youtu.be/', 'youtube.com/embed/');
                }

                parts.push(
                    <div key={`v-wrap-${rawId}-${match.index}`} className="custom-tag tag-video my-16 mx-auto w-full max-w-4xl animate-in zoom-in duration-700 flex flex-col p-0 overflow-hidden bg-white border border-slate-100 shadow-xl">
                        <div className="flex items-center gap-4 p-6 border-b border-slate-50 bg-slate-50/50">
                            <div className="size-10 bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                                <span className="material-symbols-outlined text-xl">play_circle</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 m-0 leading-none uppercase tracking-widest">Vídeo Aula</h3>
                                <p className="text-[10px] text-slate-400 font-bold mt-1">Material Complementar</p>
                            </div>
                        </div>
                        <div className="w-full aspect-video bg-black relative">
                            <iframe
                                src={embedUrl}
                                title="Vídeo Aula"
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                );
            }

            lastIndex = tagRegex.lastIndex;
        }

        // Adiciona o restante do texto
        if (lastIndex < cleanContent.length) {
            const remainingText = cleanContent.substring(lastIndex);
            if (remainingText.replace(/<br\s*\/?>/g, '').trim()) {
                parts.push(
                    <div
                        key={`text-${lastIndex}`}
                        className="ql-editor p-0"
                        dangerouslySetInnerHTML={{ __html: remainingText }}
                    />
                );
            }
        }

        // Se não houver partes complexas, renderiza o conteúdo puro
        return parts.length > 0 ? parts : <div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: cleanContent }} />;
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white text-slate-300">
            <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#137fec]">Preparando seu Material...</p>
        </div>
    );

    if (!apostila) return (
        <div className="h-screen flex flex-col items-center justify-center p-10 text-center gap-6">
            <span className="material-symbols-outlined text-6xl text-slate-200">sentiment_very_dissatisfied</span>
            <h2 className="text-2xl font-black text-slate-900 uppercase">Material não disponível</h2>
            <button onClick={() => navigate(-1)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase">Voltar</button>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-all duration-500 overflow-y-auto print:bg-white print:p-0 ${isFocusMode ? 'bg-white p-0' : 'bg-[#f6f7f9] p-4 md:p-12'}`}
            style={{ scrollBehavior: 'smooth' }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:wght@500;800&display=swap');

                @page { margin: 1cm; size: A4; }
                @media print {
                  .no-print { display: none !important; }
                  .print-only { display: block !important; }
                  body { background: white !important; font-family: 'Inter', serif !important; color: #000; }
                  .apostila-sheet { width: 100% !important; max-width: none !important; border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
                }
                
                .apostila-sheet {
                  background: white;
                  width: 100%;
                  max-width: 900px;
                  margin: 0 auto;
                  box-shadow: 0 40px 100px -20px rgba(0,0,0,0.03);
                  border: 1px solid #f1f5f9;
                  border-radius: 0px;
                  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* Quill Overrides & Viva Content Formatting */
                .apostila-content { 
                    font-family: 'Plus Jakarta Sans', sans-serif; 
                    color: #1e293b; 
                    -webkit-font-smoothing: antialiased;
                    text-rendering: optimizeLegibility;
                    width: 100%;
                }

                .apostila-content .ql-editor, .apostila-content .tiptap { 
                    padding: 0; 
                    overflow: visible; 
                    line-height: 1.8;
                    text-align: left !important;
                }

                /* REGRA SUPREMA: Evitar overflow mas permitir quebras necessárias */
                .apostila-content * {
                    hyphens: auto !important;
                    word-break: break-word !important; 
                    overflow-wrap: break-word !important;
                }
                
                /* Impedir que blocos importantes quebrem no fim da página */
                .apostila-content h1, 
                .apostila-content h2, 
                .apostila-content h3, 
                .apostila-content h4,
                .apostila-content blockquote,
                .apostila-content img,
                .apostila-content table,
                .apostila-content .video-container,
                .interactive-question-block,
                .custom-tag {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                /* TAGS PERSONALIZADAS - Vibrant Pop Style */
                .custom-tag {
                    margin: 3rem 0;
                    padding: 0;
                    border-radius: 0px;
                    display: flex;
                    align-items: stretch;
                    background: #fff;
                    position: relative;
                    overflow: hidden;
                    border: 1px solid rgba(0,0,0,0.03);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08); /* Soft entry shadow */
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .custom-tag:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 40px -12px rgba(0,0,0,0.12);
                }
                
                .tag-icon-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 70px;
                    flex-shrink: 0;
                    position: relative;
                    overflow: hidden;
                }
                .tag-icon-box::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
                }
                .tag-icon-box span { 
                    font-size: 32px; 
                    position: relative;
                    z-index: 10;
                    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
                }
                
                .tag-content-wrapper {
                    flex: 1;
                    padding: 1.5rem 2rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: #fff;
                }

                .tag-body strong { 
                    display: block; 
                    font-family: 'Lexend', sans-serif;
                    font-size: 0.85rem; 
                    text-transform: uppercase; 
                    letter-spacing: 0.08em; 
                    margin-bottom: 0.5rem;
                    font-weight: 800;
                }
                .tag-text p { margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.6; padding: 0; color: #475569; }
                .tag-text p:last-child { margin-bottom: 0; }

                /* Variante AVISO (Red) */
                .tag-aviso { border-left: 0; border-right: 4px solid #ef4444; }
                .tag-aviso .tag-icon-box { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; }
                .tag-aviso .tag-body strong { color: #dc2626; }
                
                /* Variante IMPORTANTE (Yellow/Orange) */
                .tag-importante { border-left: 0; border-right: 4px solid #f59e0b; }
                .tag-importante .tag-icon-box { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: white; }
                .tag-importante .tag-body strong { color: #d97706; }

                /* Variante LEI (Purple) */
                .tag-lei { border-left: 0; border-right: 4px solid #8b5cf6; }
                .tag-lei .tag-icon-box { background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%); color: white; }
                .tag-lei .tag-body strong { color: #7c3aed; }
                .tag-lei .tag-text { font-family: 'Georgia', serif; font-style: italic; color: #5b21b6; }

                /* Variante LINK (Blue) */
                .tag-link { border-left: 0; border-right: 4px solid #3b82f6; }
                .tag-link .tag-icon-box { background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); color: white; }
                .tag-link .tag-body strong { color: #2563eb; }

                /* Variante OBSERVE (Cyan/Dark Blue) */
                .tag-observe { border-left: 0; border-right: 4px solid #0891b2; }
                .tag-observe .tag-icon-box { background: linear-gradient(135deg, #22d3ee 0%, #0e7490 100%); color: white; }
                .tag-observe .tag-body strong { color: #0e7490; }

                /* Variante FREQUENTE (Hot Orange/Red) */
                .tag-frequente { border-left: 0; border-right: 4px solid #f97316; }
                .tag-frequente .tag-icon-box { background: linear-gradient(135deg, #fb923c 0%, #ea580c 100%); color: white; }
                .tag-frequente .tag-body strong { color: #ea580c; }

                /* Variante EXTRA (Teal/Green) */
                .tag-extra { border-left: 0; border-right: 4px solid #14b8a6; }
                .tag-extra .tag-icon-box { background: linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%); color: white; }
                .tag-extra .tag-body strong { color: #0d9488; }
                
                /* Variante NOVIDADE (Pink/Rose) */
                .tag-novidade { border-left: 0; border-right: 4px solid #be185d; }
                .tag-novidade .tag-icon-box { background: linear-gradient(135deg, #f472b6 0%, #db2777 100%); color: white; }
                .tag-novidade .tag-body strong { color: #be185d; }

                /* Variante CORREÇÃO (Red/Rose - Correction) */
                .tag-correcao { border-left: 0; border-right: 4px solid #e11d48; }
                .tag-correcao .tag-icon-box { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%); color: white; }
                .tag-correcao .tag-body strong { color: #be123c; }

                /* Variante EXEMPLO (Yellow/Lime) */
                .tag-exemplo { border-left: 0; border-right: 4px solid #84cc16; }
                .tag-exemplo .tag-icon-box { background: linear-gradient(135deg, #a3e635 0%, #65a30d 100%); color: white; }
                .tag-exemplo .tag-body strong { color: #4d7c0f; }

                /* Variante BORA PRATICAR (Indigo/Violet) */
                .tag-praticar { border-left: 0; border-right: 4px solid #4338ca; }
                .tag-praticar .tag-icon-box { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: white; }
                .tag-praticar .tag-body strong { color: #4338ca; font-size: 1.1rem; letter-spacing: 0.1em; }
                .tag-praticar .tag-content-wrapper { padding: 1rem 1.5rem; } /* Altura reduzida conforme solicitado */

                /* Variante TITULO (Light Blue Background - Chapter Header) */
                .tag-titulo { 
                    border: none;
                    border-radius: 0;
                    background: #e0f2fe; /* Sky 100 */
                    margin: 3rem 0;
                }
                .tag-titulo .tag-content-wrapper { 
                    padding: 1.5rem 2rem; 
                    display: block;
                    text-align: left;
                }
                .tag-titulo .tag-text, .tag-titulo .tag-text p { 
                    color: #0369a1; /* Sky 700 */
                    font-family: 'Lexend', sans-serif;
                    font-weight: 900;
                    font-size: 1.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin: 0;
                    line-height: 1.2;
                }

                /* Variante VIDEO */
                .tag-video {
                    border: none;
                    display: flex;
                    flex-direction: column;
                }

                /* TIPOGRAFIA GERAL */
                .apostila-content h1 { 
                    font-family: 'Lexend', sans-serif;
                    font-size: 3rem; 
                    font-weight: 900; 
                    color: #0f172a; 
                    margin: 3rem 0 2rem 0; 
                    line-height: 0.95; 
                    text-transform: uppercase;
                    letter-spacing: -0.03em;
                    background: linear-gradient(to right, #0f172a 0%, #334155 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    padding: 0;
                }
                
                .apostila-content h2 { 
                    font-family: 'Lexend', sans-serif;
                    font-size: 1.8rem; 
                    font-weight: 800; 
                    color: #1e293b; 
                    margin: 3rem 0 1.5rem 0; 
                    padding: 0 0 0 1.5rem;
                    text-align: left !important;
                    border-left: 6px solid #3b82f6;
                    line-height: 1.2;
                }

                .apostila-content h3 { 
                    font-family: 'Lexend', sans-serif;
                    font-size: 1.4rem; 
                    font-weight: 700; 
                    color: #334155; 
                    margin: 2rem 0 1rem 0; 
                    padding: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .apostila-content h3::before {
                    content: '#';
                    font-family: 'Lexend', sans-serif;
                    font-size: 1.8rem;
                    color: #cbd5e1;
                    font-weight: 900;
                    line-height: 1;
                    margin-top: -4px; /* Ajuste visual fino */
                }

                .apostila-content h4 {
                    font-family: 'Lexend', sans-serif;
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #0ea5e9;
                    margin: 1.5rem 0 0.8rem 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .apostila-content p { 
                    font-size: 1.05rem; 
                    line-height: 1.75; 
                    color: #475569; 
                    margin-bottom: 1.5rem; 
                    padding: 0;
                }

                .apostila-content blockquote { 
                    margin: 3rem 0;
                    padding: 2.5rem;
                    background: #f8fafc;
                    border-radius: 24px;
                    border: 2px dashed #cbd5e1;
                    position: relative;
                }
                .apostila-content blockquote p {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #475569;
                    font-style: italic;
                    text-align: center;
                    margin: 0;
                }

                .apostila-content img { 
                    border-radius: 24px; 
                    margin: 3rem 0; 
                    width: 100%; 
                    box-shadow: 0 20px 40px -5px rgba(0,0,0,0.1); /* Floating Shadow */
                    border: 1px solid rgba(0,0,0,0.05);
                }

                .apostila-content b, .apostila-content strong { 
                    font-weight: 800; 
                    color: #0f172a; 
                    padding: 0 2px;
                }

                /* Lists with Icons */
                .apostila-content ul, .apostila-content ol { 
                    margin: 2rem 0; 
                    padding-left: 2rem; 
                }
                .apostila-content ul li { 
                    position: relative;
                    padding-left: 2rem;
                    margin-bottom: 1rem;
                    font-weight: 500;
                    list-style-type: none;
                }
                .apostila-content ul li::before {
                    content: 'check_circle';
                    font-family: 'Material Symbols Outlined';
                    position: absolute;
                    left: 0;
                    top: 2px;
                    color: #3b82f6;
                    font-size: 1.2rem;
                    background: none;
                    box-shadow: none;
                    width: auto;
                    height: auto;
                    border-radius: 0;
                }
                
                .apostila-content ol li {
                    margin-bottom: 1rem;
                    color: #334155;
                    font-weight: 600;
                    padding-left: 0.5rem;
                }
                .apostila-content ol li::marker {
                    color: #3b82f6;
                    font-weight: 900;
                    font-size: 1.1rem;
                }
                
                /* Blockquote: Vibrant Pink/Violet Insight Card */
                .apostila-content blockquote { 
                    margin: 3rem 0;
                    padding: 2.5rem;
                    background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
                    border-radius: 0px;
                    border: 2px solid #e879f9;
                    position: relative;
                    box-shadow: 0 20px 40px -10px rgba(232, 121, 249, 0.1);
                }
                .apostila-content blockquote p {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #701a75;
                    font-style: italic;
                    margin-bottom: 0;
                    line-height: 1.5;
                    text-align: center;
                }
                .apostila-content blockquote::after {
                    content: '― Especialista Bora Passar';
                    display: block;
                    text-align: center;
                    margin-top: 1.5rem;
                    font-size: 0.8rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: #a21caf;
                }

                /* Media: Sombra Colorida */
                /* Media: Sombra Colorida e Centralizada */
                .apostila-content img { 
                    border-radius: 0px; 
                    display: block;
                    margin: 5rem auto 1.5rem auto; 
                    max-width: 100%; 
                    box-shadow: 0 40px 80px -20px rgba(99, 102, 241, 0.25);
                    border: 4px solid white;
                }
                .apostila-content .img-caption {
                    text-align: center;
                    font-size: 0.9rem;
                    font-weight: 900;
                    color: #6366f1;
                    margin-bottom: 5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                /* Tables: Vibrant Header Glass */
                .apostila-content table {
                    width: 100%;
                    margin: 5rem 0;
                    border-radius: 0px;
                    overflow: hidden;
                    border: 2px solid #e0e7ff;
                    box-shadow: 0 20px 40px rgba(99, 102, 241, 0.08);
                }
                .apostila-content th {
                    background: linear-gradient(to right, #6366f1, #8b5cf6);
                    padding: 1.8rem;
                    text-align: left;
                    font-size: 0.9rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: white;
                    letter-spacing: 0.15em;
                }
                .apostila-content td {
                    padding: 1.8rem;
                    border-bottom: 1px solid #eef2ff;
                    font-size: 1.1rem;
                    color: #1e1b4b;
                    background: white;
                }
                .apostila-content tr:nth-child(even) td {
                    background: #fbfbfe;
                }

                /* Code: Synthwave Visual */
                .apostila-content code {
                    background: #1e1b4b;
                    color: #f472b6;
                    padding: 0.4rem 0.8rem;
                    border-radius: 10px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.95em;
                    font-weight: 800;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    border-bottom: 2px solid #ec4899;
                }

                /* MOBILE RESPONSIVE TWEAKS */
                @media (max-width: 768px) {
                    .apostila-content h1 { font-size: 2rem !important; margin: 2rem 0 1.5rem 0 !important; }
                    .apostila-content h2 { font-size: 1.4rem !important; margin: 2rem 0 1rem 0 !important; padding-left: 1rem !important; border-left-width: 4px !important; }
                    .apostila-content h3 { font-size: 1.2rem !important; margin: 1.5rem 0 0.8rem 0 !important; }
                    .apostila-content p { font-size: 1rem !important; line-height: 1.6 !important; margin-bottom: 1.2rem !important; }
                    
                    .custom-tag { margin: 2rem 0 !important; flex-direction: column !important; }
                    .custom-tag .tag-icon-box { width: 100% !important; height: 50px !important; background: none !important; }
                    .custom-tag .tag-icon-box::after { display: none !important; }
                    .custom-tag .tag-icon-box span { font-size: 24px !important; color: inherit; } 
                    /* Specific fixes for gradient backgrounds on mobile */
                    .tag-aviso .tag-icon-box { background: #fee2e2 !important; color: #ef4444 !important; }
                    .tag-importante .tag-icon-box { background: #fef3c7 !important; color: #d97706 !important; }
                    .tag-lei .tag-icon-box { background: #ede9fe !important; color: #7c3aed !important; }
                    .tag-link .tag-icon-box { background: #dbeafe !important; color: #2563eb !important; }
                    .tag-observe .tag-icon-box { background: #cffafe !important; color: #0891b2 !important; }
                    .tag-frequente .tag-icon-box { background: #ffedd5 !important; color: #ea580c !important; }
                    .tag-extra .tag-icon-box { background: #ccfbf1 !important; color: #0d9488 !important; }
                    .tag-novidade .tag-icon-box { background: #fce7f3 !important; color: #db2777 !important; }
                    .tag-exemplo .tag-icon-box { background: #ecfccb !important; color: #65a30d !important; }
                    .tag-praticar .tag-icon-box { background: #e0e7ff !important; color: #4338ca !important; }

                    .custom-tag .tag-content-wrapper { padding: 1.5rem !important; }

                    .apostila-content blockquote { margin: 2rem 0 !important; padding: 1.5rem !important; }
                    .apostila-content blockquote p { font-size: 1rem !important; }
                    
                    .apostila-content img { margin: 2rem 0 !important; border-radius: 12px !important; }
                }

                .no-scrollbar::-webkit-scrollbar { display: none; }

                /* PRINT STYLES - MAGAZINE FORMAT */
                @media print {
                    @page {
                        margin: 1.5cm 1cm 1.5cm 1cm; /* Margens para encadernação */
                        size: A4;
                    }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        font-family: 'Inter', sans-serif;
                    }
                    
                    /* Esconde Interface do Usuário */
                    /* Esconde Interface do Usuário */
                    .no-print, 
                    .material-symbols-outlined, 
                    iframe,
                    .video-container,
                    .print-hidden {
                        display: none !important;
                    }

                    /* Ajuste do Layout Principal */
                    .apostila-sheet {
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        width: 100% !important;
                        max-width: none !important;
                        background: white !important;
                    }

                    .apostila-content {
                        font-size: 12pt;
                        line-height: 1.6;
                        color: #1a1a1a;
                    }
                    
                    .apostila-content p {
                        text-align: justify;
                        hyphens: auto;
                    }

                    /* Tags e Caixas - Estilo Revista */
                    .custom-tag {
                        break-inside: avoid;
                        border-left: 4px solid #000 !important;
                        box-shadow: none !important;
                        margin: 1cm 0 !important;
                        background: transparent !important;
                        padding-left: 10px;
                    }
                    .custom-tag .tag-icon-box { display: none !important; }
                    .custom-tag .tag-content-wrapper { padding: 0 !important; }
                    .custom-tag .tag-body strong { color: #000 !important; text-transform: uppercase; font-size: 0.9rem; }
                    
                    /* Título Principal */
                    /* Título Principal */
                    h1 {
                        font-family: 'Lexend', sans-serif !important;
                        font-weight: 900 !important;
                        font-size: 3rem !important;
                        color: #000 !important;
                        text-shadow: none !important;
                        text-transform: uppercase;
                        letter-spacing: -0.05em;
                        margin-bottom: 2rem;
                    }

                    /* Banner Impresso Limpo */
                    header { margin-bottom: 1rem !important; }
                    .banner-container {
                        height: auto !important;
                        border: none !important;
                        margin-bottom: 1rem !important;
                        background: none !important;
                        box-shadow: none !important;
                        display: block !important;
                        position: relative !important;
                    }
                    .banner-container img {
                        height: 250px !important;
                        object-fit: cover !important;
                        margin-bottom: 1rem !important;
                        display: block !important;
                        max-width: 100% !important;
                    }
                    .banner-logo-container {
                        display: none !important; /* Remove logo de DENTRO do banner na impressão */
                    }
                    .print-header-top {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        border-bottom: 2px solid #000 !important;
                        padding-bottom: 0.5rem !important;
                        margin-bottom: 1rem !important;
                    }
                    .print-header-top img {
                        height: 40px !important;
                        filter: brightness(0) !important; /* Torna a logo preta */
                    }
                    .print-header-top span {
                        font-family: 'Lexend', sans-serif !important;
                        font-weight: 900 !important;
                        font-size: 14pt !important;
                        text-transform: uppercase !important;
                        color: #000 !important;
                    }
                    .banner-overlay { display: none !important; }
                    .banner-text-container {
                        position: static !important;
                        padding: 0 !important;
                        background: none !important;
                        color: black !important;
                        display: block !important;
                    }
                    .banner-text-container h1 {
                        color: black !important;
                        font-size: 24pt !important;
                        text-shadow: none !important;
                        box-shadow: none !important;
                        filter: none !important;
                        margin: 0 !important;
                        line-height: 1.2 !important;
                     }
                    .banner-text-container span {
                        background: #eee !important;
                        color: #333 !important;
                        border: 1px solid #ddd;
                        box-shadow: none !important;
                        display: inline-block !important;
                        margin-bottom: 0.5rem !important;
                    }

                    /* Remover Cabeçalho Decorativo da Questão */
                    .question-header { display: none !important; }
                    
                    .custom-tag,
                    .print-question-wrapper, 
                    .premium-question-wrapper,
                    .interactive-question-block,
                    .apostila-content p,
                    .apostila-sheet { 
                        break-inside: auto !important; 
                    }

                    /* Questões Estilo Prova - Texto Puro */

                    /* REMOVE VÍDEOS NA IMPRESSÃO */
                    .tag-video, 
                    .video-container, 
                    iframe[src*="youtube"], 
                    iframe[src*="vimeo"] {
                        display: none !important;
                    }

                    /* Questões Estilo Prova */
                    .interactive-question-block {
                        padding: 0 !important;
                        margin: 1.5cm 0 !important;
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .interactive-question-block .bg-white {
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    /* Remove Question Cards in Print */
                    .print-question-wrapper {
                        background: none !important;
                        padding: 0 !important;
                        margin: 1cm 0 !important;
                    }
                    .print-question-card {
                        background: none !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                    }
                    
                    /* Tira margens internas exageradas das questões na impressão */
                    .premium-question-header, 
                    .premium-question-text {
                        margin-bottom: 0.5rem !important;
                    }
                    .premium-button-alt {
                        padding: 0.5rem 0 !important;
                        background: none !important;
                        border: none !important;
                    }
                    .premium-alt-circle {
                        border: 1px solid #000 !important;
                        background: none !important;
                        color: #000 !important;
                        width: 20px !important;
                        height: 20px !important;
                        font-size: 10px !important;
                    }

                    /* Esconder botões de interação na impressão se desejar apenas o texto limpo, 
                       mas o usuário pediu "como questões de prova", então manter as alternativas é bom. 
                       Vamos apenas limpar o estilo. */
                     .interactive-question-block button {
                        display: flex !important;
                        position: relative !important;
                        border: none !important;
                        background: transparent !important;
                        color: black !important;
                        padding: 5px 0 !important;
                        width: 100% !important;
                        text-align: left !important;
                        box-shadow: none !important;
                     }
                     .interactive-question-block button div {
                        border: none !important;
                        background: transparent !important;
                        color: black !important;
                        width: auto !important;
                        height: auto !important;
                        margin-right: 8px !important;
                        font-weight: 900 !important;
                     }
                     .interactive-question-block button div span {
                         font-size: 1rem !important; /* Tamanho texto letra */
                     }
                     
                     /* Mostrar Gabarito Oculto */
                     .print-gabarito {
                         display: block !important;
                     }
                    
                    /* Imagens */
                    .apostila-content img {
                        max-height: 10cm;
                        margin: 1cm auto !important;
                        break-inside: avoid;
                        box-shadow: none !important;
                        border: 1px solid #eee !important;
                    }
                    
                    /* Rodapé da Página Fixado */
                    .print-only-footer {
                        display: flex !important;
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        padding-top: 10px;
                        border-top: 1px solid #000;
                        font-size: 9pt;
                        justify-content: space-between;
                        font-weight: bold;
                        background: white;
                        z-index: 9999;
                    }
                    
                    /* Headers Ajustados */
                    h1, h2, h3 { 
                        color: #000 !important; 
                        break-after: avoid; 
                    }
                }
            `}</style>

            {/* Toolbar */}
            <div className={`no-print flex items-center justify-between mx-auto max-w-4xl transition-all duration-500 ${isFocusMode ? 'fixed top-6 right-8 z-[100] gap-4' : 'mb-12'}`}>
                {!isFocusMode && (
                    <button
                        onClick={() => navigate(-1)}
                        className="size-12 flex items-center justify-center bg-white text-slate-400 hover:text-slate-900 transition-all rounded-2xl border border-slate-100 hover:shadow-xl shadow-sm group"
                        title="Voltar"
                    >
                        <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
                    </button>
                )}

                <div className={`flex items-center gap-3 ${isFocusMode ? '' : 'ml-auto'}`}>
                    <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex gap-1">
                        <button
                            onClick={toggleFocus}
                            className={`size-10 flex items-center justify-center transition-all rounded-xl ${isFocusMode ? 'bg-[#137fec] text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                            title="Modo Foco"
                        >
                            <span className="material-symbols-outlined text-xl">{isFocusMode ? 'close_fullscreen' : 'fullscreen'}</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="size-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
                            title="Exportar PDF Profissional"
                        >
                            <span className="material-symbols-outlined text-xl">file_save</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Sheet */}
            <article className={`apostila-sheet transition-all duration-700 ${isFocusMode ? 'rounded-none border-0 shadow-none py-20 px-10' : 'p-8 md:p-20'}`}>

                {/* Header Professional with Breadcrumbs & Banner */}
                <header className="mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 relative">

                    {/* Barra de Título Exclusiva para Impressão */}
                    <div className="hidden print-header-top">
                        <span>{courseName || apostila.disciplina?.name || 'Material Didático'}</span>
                        <img src="/bora_passar_logo.png" alt="Bora Passar" />
                    </div>

                    {/* Vibrant Banner */}
                    <div className="banner-container w-full h-64 md:h-80 rounded-none overflow-hidden mb-12 shadow-2xl relative group bg-slate-900 border-4 border-white">
                        {courseBanner ? (
                            <img src={courseBanner} className="size-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Banner" />
                        ) : (
                            <div className="size-full bg-[linear-gradient(45deg,#0f172a,#1e293b,#334155)] relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent"></div>
                                <div className="absolute top-10 right-10 opacity-10">
                                    <span className="material-symbols-outlined text-9xl text-white">school</span>
                                </div>
                            </div>
                        )}
                        <div className="banner-overlay absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                        <div className="banner-text-container absolute bottom-0 left-0 right-0 p-8 md:p-12 flex flex-col justify-end items-start">
                            <span className="px-5 py-2 bg-[#137fec] text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-none shadow-lg shadow-blue-900/50 mb-4 animate-in slide-in-from-left-4 duration-700">
                                {apostila.disciplina?.name || 'Material Didático'}
                            </span>
                            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight shadow-black drop-shadow-lg">
                                {apostila.title}
                            </h1>
                        </div>
                        {/* Logo Transparente no Canto Inferior Direito */}
                        {/* Logo Transparente no Canto Inferior Direito */}
                        <div className="absolute top-8 right-8 z-20 opacity-90 banner-logo-container flex items-center gap-3">
                            <span className="hidden print:block banner-logo-text text-white font-bold uppercase tracking-wider text-xs shadow-black drop-shadow-md">
                                {apostila.disciplina?.name}
                            </span>
                            <img
                                src="/bora_passar_logo.png"
                                className="w-16 md:w-20 object-contain drop-shadow-2xl brightness-0 invert banner-logo-img"
                                alt="Bora Passar Agora"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500 mb-8 px-4">
                        <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-sm">person</span>
                            </div>
                            <span>Prof. {apostila.author?.full_name?.split(' ')[0]}</span>
                        </div>
                        {apostila.estimated_time && (
                            <>
                                <div className="size-1 bg-slate-200 rounded-full"></div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-300">timer</span>
                                    <span>Tempo de Leitura: {apostila.estimated_time}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <p className="text-xl text-slate-600 font-medium leading-relaxed px-4 border-l-4 border-[#137fec] pl-6 ml-4 md:ml-0">
                        {apostila.description || 'Uma abordagem prática e direto ao ponto para dominar este conteúdo.'}
                    </p>
                </header>

                {/* Content body */}
                <div className="apostila-content select-text selection:bg-[#137fec]/20 selection:text-[#137fec]">
                    {renderProcessedContent(apostila.content)}
                </div>


                <footer className="mt-20 pt-10 border-t border-slate-100 text-center space-y-6">
                    {notebooks.length > 0 && (
                        <div className="flex flex-col items-center justify-center gap-2 no-print">
                            {notebooks.map(nb => (
                                <button
                                    key={nb.id}
                                    onClick={() => navigate(`/aluno/caderno/${nb.id}`)}
                                    className="px-4 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 text-[10px] font-black uppercase tracking-widest rounded-full transition-all flex items-center gap-2 hover:bg-white"
                                >
                                    <span className="material-symbols-outlined text-sm">menu_book</span>
                                    Caderno: {nb.title}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 max-w-3xl mx-auto no-print">
                        <button
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (apostila.disciplina_id) params.append('disciplina', apostila.disciplina_id);
                                if (apostila.assunto_id) params.append('assunto', apostila.assunto_id);
                                navigate(`/aluno/questoes?${params.toString()}`);
                            }}
                            className="flex-1 py-5 bg-[#10b981] text-white rounded-none font-black uppercase tracking-widest hover:bg-[#059669] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 group hover:-translate-y-1"
                        >
                            <span className="material-symbols-outlined group-hover:animate-bounce">rocket_launch</span>
                            Bora Praticar!
                        </button>

                        <button
                            onClick={() => navigate(-1)}
                            className="flex-1 py-5 bg-[#3b82f6] text-white rounded-none font-black uppercase tracking-widest hover:bg-[#2563eb] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 group hover:-translate-y-1"
                        >
                            Ir para Trilha
                            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-2 opacity-50">
                        <img src="/bcode_logo.png" className="h-4 w-auto grayscale opacity-50 mb-2" alt="Logo" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">© 2026 Plataforma Bora Passar Agora</p>
                    </div>
                </footer>
            </article>

            {/* Print Footer - Fixed on every page bottom for printing */}
            <div className="print-only-footer hidden no-screen flex-row justify-between items-center w-full">
                <div className="uppercase">Bora Passar Agora • Material Didático</div>
                <div className="uppercase text-right">
                    Aluno: {profile?.full_name || 'Usuário'} • CPF: {(profile as any)?.cpf || '___.___.___-__'}
                </div>
            </div>

            {/* Focus Mode Tooltip */}
            {isFocusMode && (
                <button
                    onClick={() => setIsFocusMode(false)}
                    className="fixed bottom-6 right-6 z-50 bg-slate-900/10 hover:bg-slate-900 text-slate-400 hover:text-white p-3 rounded-full transition-all no-print backdrop-blur-sm"
                    title="Sair do Modo Foco"
                >
                    <span className="material-symbols-outlined text-xl">close_fullscreen</span>
                </button>
            )}
        </div>
    );
};

export default ApostilaReader;
