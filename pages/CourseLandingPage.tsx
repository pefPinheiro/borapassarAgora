import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const VideoPlayer = ({ url }: { url: string }) => {
    if (!url) return null;

    const getEmbedUrl = (url: string) => {
        if (url.includes('youtube.com/watch?v=')) {
            const id = url.split('v=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('youtu.be/')) {
            const id = url.split('be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('vimeo.com/')) {
            const id = url.split('com/')[1];
            return `https://player.vimeo.com/video/${id}`;
        }
        return url;
    };

    const embedUrl = getEmbedUrl(url);
    const isEmbed = embedUrl.includes('embed') || embedUrl.includes('player.vimeo');

    if (isEmbed) {
        return (
            <iframe 
                src={embedUrl} 
                className="w-full h-full border-0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
            />
        );
    }

    return (
        <video src={url} controls className="w-full h-full object-cover" />
    );
};

interface CourseData {
    id: string;
    title: string;
    description: string;
    area: string;
    cargo: string;
    banner_url: string;
    video_url?: string;
    price_base: number;
    price_offer: number;
    coupon_name: string;
    bancas?: { name: string; logo?: string };
    apostilas_count: number;
    simulados_count: number;
    questions_count: number;
    lp_model?: string;
    coupons_json?: { name: string, discount_type: string, discount_value: number }[];
    lp_images?: string[];
    disciplinas?: string[];
    cadernos_count: number;
    resolved_notebooks_count?: number;
}

const CourseLandingPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<CourseData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchCourse();
    }, [id]);

    const fetchCourse = async () => {
        setLoading(true);
        try {
            const { data: courseData, error: courseError } = await supabase
                .from('courses')
                .select('*, bancas(name, logo)')
                .eq('id', id)
                .single();

            if (courseError) throw courseError;

            const [apsRes, simsRes, questRes] = await Promise.all([
                supabase.from('course_items').select('id, apostila_id').eq('course_id', id),
                supabase.from('course_simulados').select('id').eq('course_id', id),
                supabase.from('questions').select('*', { count: 'exact', head: true })
            ]);

            const apostilaIds = apsRes.data?.map(a => a.apostila_id).filter(Boolean) || [];
            const apostilasCount = apsRes.data?.length || 0;
            const simuladosCount = simsRes.data?.length || 0;
            const totalQuestionsCount = questRes.count || 0;

            const { data: apsWithDetails } = await supabase
                .from('apostilas')
                .select('is_resolution_notebook, disciplinas(name)')
                .in('id', apostilaIds.length > 0 ? apostilaIds : ['none']);

            const uniqueDisciplinas = Array.from(new Set(
                apsWithDetails?.map((a: any) => a.disciplinas?.name).filter(Boolean)
            )) as string[];

            const resolvedCount = apsWithDetails?.filter((a: any) => a.is_resolution_notebook).length || 0;

            let totalCadernosCount = 0;
            if (apostilaIds.length > 0) {
                const { count: nbCount } = await supabase
                    .from('notebooks')
                    .select('*', { count: 'exact', head: true })
                    .in('apostila_id', apostilaIds);
                totalCadernosCount = nbCount || 0;
            }

            setCourse({
                ...courseData,
                apostilas_count: apostilasCount,
                simulados_count: simuladosCount,
                questions_count: totalQuestionsCount,
                disciplinas: uniqueDisciplinas,
                cadernos_count: totalCadernosCount,
                resolved_notebooks_count: resolvedCount
            });
        } catch (e) {
            console.error('Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = () => {
        navigate(`/aluno/curso/${id}/comprar`);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="size-16 border-4 border-white/10 border-t-yellow-500 rounded-full animate-spin"></div>
        </div>
    );

    if (!course) return null;

    const isFree = course.price_offer === 0;
    const hasDiscount = course.price_base > course.price_offer;
    const formatPrice = (p: number) => p.toFixed(2).replace('.', ',');
    const CTA_TEXT = isFree ? 'Quero Acesso Grátis' : 'Quero Minha Aprovação';

    const PromoBadge = ({ className = "" }: { className?: string }) => {
        const promoObj = course.coupons_json?.find(c => c.name.startsWith('__PROMO__'));
        if (!promoObj) return null;
        
        const title = promoObj.name.replace('__PROMO__', '');
        
        return (
            <div className={`bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] md:text-sm font-black px-8 py-3 rounded-full uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(225,29,72,0.6)] animate-pulse flex items-center justify-center gap-3 border-2 border-rose-300 w-fit whitespace-nowrap z-50 ${className}`}>
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                {title || 'Mega Promoção Ativa!'}
            </div>
        );
    };

    const Features = [
        { title: 'Videoaulas Focadas', desc: 'Teoria sem enrolação direto ao ponto nas questões.', icon: 'play_circle' },
        { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
        { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
        { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
    ];

    const Stats = [
        { val: course.apostilas_count || 12, label: 'Apostilas' },
        { val: course.simulados_count || 5, label: 'Simulados' },
        { val: course.questions_count || '5k', label: 'Questões' },
        { val: '2026', label: 'Atualizado' }
    ];

    const EliteGold = () => {
        const FeaturesElite = [
            { title: 'Apostilas Interativas', desc: 'Material estratégico com tecnologia de leitura dinâmica e interativa.', icon: 'menu_book' },
            { title: 'Simulados de Elite', desc: 'Treine com simulados periódicos focados no perfil da sua banca.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de questões comentadas para você dominar a banca.', icon: 'database' },
            { title: 'Exportar em PDF', desc: 'Leve seu estudo para onde quiser com a exportação simplificada.', icon: 'picture_as_pdf' },
            { title: 'Cadernos de Questões', desc: 'Organize seu treino por assunto com cadernos personalizados.', icon: 'auto_stories' },
            { title: 'Controle de Estudo', desc: 'Dashboard completo para monitorar sua evolução e metas.', icon: 'analytics' },
            { title: 'Suporte & Atualizações', desc: 'Acompanhamento total e material sempre em dia com o edital.', icon: 'verified' },
            { title: 'Modo Relax', desc: 'Interface otimizada para reduzir o cansaço visual durante o estudo.', icon: 'visibility' }
        ];

        const FAQ = [
            { q: 'O curso é focado em qual edital?', a: 'O curso é totalmente focado no edital atualizado para este cargo, abordando todos os tópicos exigidos pela banca.' },
            { q: 'Como funcionam as apostilas interativas?', a: 'Nossas apostilas permitem interações diretas no texto, marcações inteligentes e acesso rápido a questões relacionadas ao tema.' },
            { q: 'Possui garantia de satisfação?', a: 'Sim, você tem 7 dias de garantia incondicional. Se não gostar, devolvemos seu dinheiro.' }
        ];

        const displayImages = course.lp_images && course.lp_images.length > 0 ? course.lp_images : [
            'https://images.unsplash.com/photo-1434031211128-57d90e40217b?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1454165833767-027ffea9e77b?auto=format&fit=crop&q=80&w=800'
        ];

        const scrollToContent = () => {
            const el = document.getElementById('premium');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        };

        return (
            <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-yellow-500 selection:text-black scroll-smooth">
                {/* Header */}
                <nav className="fixed top-0 inset-x-0 h-24 bg-black/80 backdrop-blur-md border-b border-white/5 z-[100] px-6 lg:px-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src="/bora_passar_logo.png" className="h-8 transition-transform hover:scale-105" alt="Logo" />
                        <span className="hidden md:block w-px h-6 bg-white/10"></span>
                        <span className="hidden md:block text-[10px] font-black uppercase tracking-widest text-yellow-500">{course.title}</span>
                    </div>
                    <div className="hidden lg:flex gap-10 text-[10px] font-black uppercase tracking-widest text-white/50">
                        <a href="#hero" className="hover:text-yellow-500 transition-colors">Destaque</a>
                        <a href="#premium" className="hover:text-yellow-500 transition-colors">Recursos</a>
                        <a href="#disciplinas" className="hover:text-yellow-500 transition-colors">Matérias</a>
                        <a href="#vitalicio" className="hover:text-yellow-500 transition-colors">Preço</a>
                        <a href="#faq" className="hover:text-yellow-500 transition-colors">FAQ</a>
                    </div>
                    <button onClick={handlePurchase} className="bg-yellow-500 text-black px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]">Matricular Agora</button>
                </nav>

                {/* Hero Section */}
                <section id="hero" className="relative pt-40 lg:pt-56 pb-20 overflow-hidden">
                    <div className="absolute top-0 left-1/4 size-[600px] bg-yellow-500/10 blur-[150px] -z-10 animate-pulse"></div>
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-10 text-center lg:text-left">
                            <div className="space-y-4">
                                <span className="text-yellow-500 text-xs font-black uppercase tracking-[0.4em] block animate-in slide-in-from-left duration-700">PREPARAÇÃO DE ALTO NÍVEL</span>
                                <h1 className="text-5xl lg:text-[80px] font-black leading-[0.85] tracking-tighter uppercase italic animate-in slide-in-from-left duration-1000">
                                    {course.title.split(' ').map((word, i) => (
                                        <React.Fragment key={i}>
                                            {word} {i === 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </h1>
                            </div>
                            <p className="text-xl lg:text-2xl text-white/50 font-medium leading-relaxed max-w-xl italic mx-auto lg:mx-0">
                                Domine o edital com a tecnologia do <span className="text-yellow-500">Bora Passar Agora</span>. O ecossistema mais completo para sua aprovação.
                            </p>
                            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                                <button onClick={handlePurchase} className="px-10 py-6 bg-yellow-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white transition-all transform hover:-translate-y-1 shadow-2xl">Quero Meu Acesso</button>
                                <button onClick={scrollToContent} className="px-10 py-6 bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all">Ver Detalhes</button>
                            </div>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-10 bg-yellow-500/5 blur-[100px] rounded-full group-hover:bg-yellow-500/10 transition-all duration-1000"></div>
                            <div className="relative rounded-[40px] overflow-hidden border border-white/10 shadow-huge aspect-video group-hover:scale-[1.02] transition-transform duration-700 bg-slate-900">
                                {course.video_url ? (
                                    <VideoPlayer url={course.video_url} />
                                ) : (
                                    <img src={course.banner_url || displayImages[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Categories/Stats Bar */}
                <div className="border-y border-white/5 bg-white/[0.02] py-12">
                    <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-5 gap-8">
                        <div className="text-center space-y-2">
                            <p className="text-4xl lg:text-5xl font-black italic text-yellow-500">{course.apostilas_count || 0}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Apostilas</span>
                        </div>
                        <div className="text-center space-y-2 border-l border-white/5">
                            <p className="text-4xl lg:text-5xl font-black italic text-white">{course.simulados_count || 0}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Simulados</span>
                        </div>
                        <div className="text-center space-y-2 border-l border-white/5">
                            <p className="text-4xl lg:text-5xl font-black italic text-yellow-500">{course.questions_count || '0'}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Questões</span>
                        </div>
                        <div className="text-center space-y-2 border-l border-white/5">
                            <p className="text-4xl lg:text-5xl font-black italic text-white">{course.cadernos_count || 0}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Cadernos</span>
                        </div>
                        <div className="text-center space-y-2 border-l border-white/5">
                            <p className="text-4xl lg:text-5xl font-black italic text-yellow-500">{course.resolved_notebooks_count || 0}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Resolvidos</span>
                        </div>
                    </div>
                </div>

                {/* Conteúdo Premium */}
                <section id="premium" className="py-32 lg:py-48 max-w-7xl mx-auto px-6 space-y-20">
                    <div className="flex flex-col lg:flex-row justify-between items-end gap-10">
                        <div className="space-y-4">
                            <span className="text-yellow-500 text-xs font-black uppercase tracking-widest">O QUE VOCÊ VAI RECEBER</span>
                            <h2 className="text-5xl lg:text-7xl font-black uppercase italic leading-none">CONTEÚDO <span className="text-yellow-500">PREMIUM</span></h2>
                        </div>
                        <p className="text-white/40 font-bold max-w-sm italic leading-relaxed">
                            As ferramentas mais agressivas do mercado para garantir a sua vaga no menor espaço de tempo possível.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-10">
                        {/* Big Feature */}
                        <div className="lg:col-span-1 bg-white/[0.03] border border-white/5 rounded-[40px] p-10 space-y-12 relative overflow-hidden group">
                            <div className="space-y-6 relative z-10">
                                <span className="size-12 bg-yellow-500 text-black rounded-xl flex items-center justify-center font-black">01</span>
                                <h3 className="text-4xl font-black uppercase italic tracking-tighter">APOSTILAS INTERATIVAS</h3>
                                <p className="text-white/50 font-medium leading-relaxed">Nossa tecnologia exclusiva permite que você estude de forma ativa, com marcações, comentários e integração direta com o banco de questões.</p>
                                <div className="flex items-center gap-3 text-yellow-500 text-[10px] font-black uppercase tracking-widest">
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span> Tecnologia de Estudo Ativo
                                </div>
                            </div>
                            <div className="relative rounded-3xl overflow-hidden aspect-video border border-white/10 group-hover:scale-105 transition-transform duration-700">
                                <img src={displayImages[1 % displayImages.length]} className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt="Questões" />
                            </div>
                        </div>

                        {/* Right Grid */}
                        <div className="space-y-10">
                            <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 flex gap-10 items-center group">
                                <div className="space-y-4 flex-1">
                                    <span className="material-symbols-outlined text-4xl text-yellow-500">quiz</span>
                                    <h4 className="text-2xl font-black uppercase tracking-tighter italic">SIMULADOS & QUESTÕES</h4>
                                    <p className="text-white/40 text-sm font-medium leading-relaxed italic">Simulados periódicos e caderno de questões resolvidas para você não ter surpresas na hora da prova.</p>
                                    <div className="flex items-center gap-2 text-yellow-500 text-[9px] font-black uppercase">
                                        <span className="size-1.5 rounded-full bg-yellow-500"></span> Foco Total na Banca
                                    </div>
                                </div>
                                <div className="size-32 rounded-2xl overflow-hidden hidden md:block">
                                    <img src={displayImages[2 % displayImages.length]} className="w-full h-full object-cover grayscale opacity-20 group-hover:opacity-100 transition-all" alt="" />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-10">
                                <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 space-y-6 group">
                                    <span className="material-symbols-outlined text-4xl text-white/20 group-hover:text-yellow-500 transition-colors">analytics</span>
                                    <h4 className="text-xl font-black uppercase tracking-tighter italic leading-none">CONTROLE DE ESTUDO</h4>
                                    <p className="text-xs text-white/30 font-medium leading-relaxed italic">Monitore seu desempenho em tempo real e saiba exatamente onde precisa melhorar.</p>
                                    <button onClick={scrollToContent} className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-white hover:text-yellow-500 transition-colors">VER DETALHES →</button>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 space-y-6 group relative overflow-hidden">
                                    <div className="space-y-4 relative z-10">
                                        <h4 className="text-xl font-black uppercase tracking-tighter italic leading-none">MODO RELAX</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-[9px] font-black uppercase text-yellow-500"><span className="material-symbols-outlined text-[14px]">visibility</span> Conforto Visual</div>
                                            <div className="flex items-center gap-3 text-[9px] font-black uppercase text-white/40"><span className="material-symbols-outlined text-[14px]">bolt</span> Estudo Prolongado</div>
                                            <div className="flex items-center gap-3 text-[9px] font-black uppercase text-white/40"><span className="material-symbols-outlined text-[14px]">verified</span> Foco Máximo</div>
                                        </div>
                                    </div>
                                    <img src={displayImages[0]} className="absolute right-[-10%] bottom-[-10%] size-48 object-cover rounded-full grayscale opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700 border-4 border-white/5" alt="" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid (Full List) */}
                <section className="py-32 bg-white/[0.01] border-y border-white/5">
                    <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                        {FeaturesElite.map((f, i) => (
                            <div key={i} className="space-y-4 group">
                                <span className="material-symbols-outlined text-3xl text-yellow-500 opacity-50 group-hover:opacity-100 transition-all">{f.icon}</span>
                                <h4 className="text-lg font-black uppercase italic tracking-tighter">{f.title}</h4>
                                <p className="text-sm text-white/40 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conteúdo Programático (Disciplinas) */}
                {course.disciplinas && course.disciplinas.length > 0 && (
                    <section id="disciplinas" className="py-32 lg:py-48 max-w-7xl mx-auto px-6">
                        <div className="flex flex-col lg:flex-row justify-between items-center mb-20 gap-10">
                            <div className="text-center lg:text-left space-y-4">
                                <span className="text-yellow-500 text-xs font-black uppercase tracking-[0.4em]">CHECKLIST DA APROVAÇÃO</span>
                                <h2 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter">CONTEÚDO <span className="text-yellow-500">PROGRAMÁTICO</span></h2>
                            </div>
                            <div className="bg-white/5 border border-white/10 px-8 py-4 rounded-2xl flex items-center gap-4">
                                <span className="material-symbols-outlined text-yellow-500 text-3xl">verified</span>
                                <div className="text-left">
                                    <p className="text-xs font-black uppercase tracking-widest text-white">Edital 100% Coberto</p>
                                    <p className="text-[10px] font-bold text-white/30 uppercase">Foco total no seu cargo</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {course.disciplinas.map((disc, idx) => (
                                <div key={idx} className="group bg-white/[0.03] border border-white/5 p-8 rounded-3xl flex items-center justify-between hover:bg-yellow-500 transition-all duration-500 hover:scale-[1.02]">
                                    <div className="flex items-center gap-6">
                                        <span className="text-3xl font-black italic text-white/10 group-hover:text-black/20 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                                        <h4 className="text-sm font-black uppercase tracking-widest text-white/70 group-hover:text-black transition-colors">{disc}</h4>
                                    </div>
                                    <span className="material-symbols-outlined text-white/10 group-hover:text-black/50 transition-colors">check_circle</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Pricing Section */}
                <section id="vitalicio" className="py-32 bg-yellow-500 text-black text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <div className="max-w-4xl mx-auto px-6 space-y-12 relative z-10">
                        <div className="space-y-4">
                            <span className="text-black/40 font-black uppercase tracking-[0.4em] text-xs">OFERTA DE LANÇAMENTO</span>
                            <h2 className="text-6xl lg:text-8xl font-black uppercase italic tracking-tighter leading-none">ACESSO <span className="text-white drop-shadow-lg">IMEDIATO</span></h2>
                            <p className="text-lg font-black uppercase italic opacity-60">Invista agora no seu futuro e garanta sua aprovação.</p>
                        </div>

                        <div className="bg-black text-white p-12 rounded-[50px] shadow-2xl relative group transform hover:scale-[1.02] transition-all duration-700 border-b-[12px] border-black/20">
                            <div className="absolute top-8 right-10 -rotate-12 bg-yellow-500 text-black px-4 py-1 font-black text-[10px] uppercase tracking-widest rounded shadow-xl animate-pulse">OFERTA LIMITADA</div>
                            
                            <div className="space-y-2 mb-10">
                                <p className="text-xs font-black uppercase tracking-widest text-white/30">CURSO: {course.title}</p>
                                
                                {hasDiscount && (
                                    <p className="text-xl font-black text-white/30 line-through decoration-red-500/50 italic mb-[-10px]">
                                        De R$ {formatPrice(course.price_base)}
                                    </p>
                                )}
                                
                                <div className="flex items-baseline justify-center gap-3">
                                    <span className="text-4xl font-black text-yellow-500 italic">R$</span>
                                    <span className="text-8xl lg:text-[140px] font-black italic tracking-tighter leading-none">
                                        {isFree ? 'GRÁTIS' : formatPrice(course.price_offer)}
                                    </span>
                                </div>
                                <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40 italic">Acesso Anual • Em até 12x no cartão</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 text-left border-y border-white/5 py-10">
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">event_available</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Acesso por 365 dias</span>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">update</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Atualização Grátis</span>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">support</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Suporte Especializado</span>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">ads_click</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Banco de Questões</span>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">auto_stories</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Apostilas Interativas</span>
                                </div>
                                <div className="flex items-center gap-4 group">
                                    <span className="material-symbols-outlined text-yellow-500 group-hover:scale-125 transition-transform">quiz</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Simulados de Elite</span>
                                </div>
                            </div>

                            <button onClick={handlePurchase} className="w-full mt-10 py-10 bg-yellow-500 text-black font-black text-3xl uppercase italic tracking-widest rounded-3xl hover:bg-white transition-all transform hover:-translate-y-2 shadow-[0_20px_50px_rgba(234,179,8,0.2)]">QUERO APROVAR AGORA!</button>
                            <p className="mt-6 text-[9px] font-black uppercase tracking-[0.3em] opacity-30 italic">PAGAMENTO 100% SEGURO VIA MERCADO PAGO OU PIX</p>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="py-32 lg:py-48 max-w-4xl mx-auto px-6 space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter">DEBRIEFING DA <span className="text-yellow-500">MISSÃO (FAQ)</span></h2>
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs italic">Tudo o que você precisa saber antes de começar.</p>
                    </div>

                    <div className="space-y-4">
                        {FAQ.map((item, i) => (
                            <details key={i} className="group bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden hover:bg-white/5 transition-all">
                                <summary className="flex items-center justify-between p-8 cursor-pointer list-none">
                                    <span className="text-xs lg:text-sm font-black uppercase tracking-widest group-open:text-yellow-500 transition-colors">{item.q}</span>
                                    <span className="material-symbols-outlined text-yellow-500 group-open:rotate-180 transition-transform">expand_more</span>
                                </summary>
                                <div className="px-8 pb-8 text-white/50 text-sm font-medium leading-relaxed italic border-t border-white/5 pt-4">
                                    {item.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-48 lg:py-72 text-center relative overflow-hidden bg-[#000]">
                    <div className="absolute inset-0 bg-yellow-500/5 blur-[150px] animate-pulse"></div>
                    <div className="max-w-4xl mx-auto px-6 space-y-12 relative z-10">
                        <h2 className="text-6xl lg:text-[120px] font-black uppercase italic tracking-tighter leading-[0.8] animate-in zoom-in duration-1000">
                            ESTEJA À FRENTE DA <br /> <span className="text-yellow-500">LINHA.</span>
                        </h2>
                        <p className="text-xl lg:text-3xl text-white/40 font-medium italic leading-relaxed">
                            Prepare-se para o concurso {course.title} com quem realmente entende de aprovação.
                        </p>
                        <button onClick={handlePurchase} className="px-20 py-10 bg-yellow-500 text-black font-black text-3xl uppercase italic tracking-widest rounded-[40px] hover:bg-white transition-all transform hover:scale-105 shadow-[0_30px_100px_rgba(234,179,8,0.3)]">QUERO MEU ACESSO AGORA</button>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-20 border-t border-white/5 bg-black px-6 lg:px-20 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <img src="/bora_passar_logo.png" className="h-6 grayscale opacity-30" alt="" />
                    <div className="flex gap-10 text-[9px] font-black uppercase tracking-widest text-white/20">
                        <a href="#" className="hover:text-white">Termos de Uso</a>
                        <a href="#" className="hover:text-white">Políticas de Vendas</a>
                        <a href="#" className="hover:text-white">Suporte</a>
                        <a href="#" className="hover:text-white">FAQ</a>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/10">BORA PASSAR AGORA © 2026</p>
                </footer>
            </div>
        );
    };

    const ProfessionalClean = () => {
        const Features = [
            { title: 'Questões Comentadas', desc: 'Aprenda com o erro e o acerto. Banco de questões gigante com explicações detalhadas.', icon: 'database' },
            { title: 'Apostilas Digitais Atualizadas', desc: 'Direto ao ponto, sem enrolação.', icon: 'menu_book' },
            { title: 'Simulados Reais', desc: 'Treine com o tempo e a pressão da sua prova.', icon: 'quiz' },
            { title: 'Modo Relax', desc: 'Estude sem cansar a vista. Perfeito para horas de estudo noturno.', icon: 'visibility' },
            { title: 'Atualizações Grátis', desc: 'Edital mudou? Atualizamos seu material sem custo adicional.', icon: 'update' }
        ];

        const FAQ = [
            { q: 'Como recebo o acesso ao curso?', a: 'Imediatamente após a confirmação do pagamento, você receberá um e-mail com seus dados de acesso exclusivos à nossa plataforma.' },
            { q: 'O material é atualizado conforme o edital?', a: 'Sim, todos os nossos cursos são revisados e atualizados constantemente para refletir as mudanças nos editais.' },
            { q: 'O pagamento é realmente único?', a: 'Sim, este modelo de acesso anual permite que você utilize todos os recursos por 365 dias sem mensalidades.' },
            { q: 'E se eu não gostar do conteúdo?', a: 'Você tem 7 dias de garantia incondicional. Se não ficar satisfeito, devolvemos 100% do seu investimento.' }
        ];

        const scrollToContent = () => {
            const el = document.getElementById('recursos');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        };

        return (
            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
                {hasDiscount && (
                    <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white text-center py-2 text-[11px] md:text-sm font-black uppercase tracking-widest px-4 relative z-[200] flex justify-center items-center gap-3 animate-pulse shadow-md">
                        <span className="material-symbols-outlined text-[16px]">campaign</span>
                        Promoção Ativa: Desconto Exclusivo Liberado!
                    </div>
                )}
                
                <nav className={`fixed ${hasDiscount ? 'top-8' : 'top-0'} inset-x-0 h-20 bg-white/80 backdrop-blur-xl border-b border-white/20 z-[100] px-6 lg:px-20 flex items-center justify-between shadow-sm transition-all`}>
                    <img src="/bora_passar_logo.png" className="h-8 hover:scale-105 transition-transform" alt="Logo" />
                    <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        <a href="#hero" className="hover:text-indigo-600 transition-colors">Início</a>
                        <a href="#recursos" className="hover:text-indigo-600 transition-colors">A plataforma</a>
                        <a href="#materias" className="hover:text-indigo-600 transition-colors">Matérias</a>
                        <button onClick={handlePurchase} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5">Assinar Agora</button>
                    </div>
                </nav>

                <section id="hero" className="relative pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center space-y-12 z-10">
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
                    
                    <div className="space-y-6 relative z-10 max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-shadow">
                            <span className="material-symbols-outlined text-[14px] text-indigo-500">school</span> Preparação Oficial
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-[1.05]">
                            A sua vaga em <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">{course.title}</span> garantida.
                        </h1>
                        <p className="text-lg lg:text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                            Estude com inteligência. Plataforma completa com tudo que você precisa para ser aprovado, reunido em um único lugar.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
                        <button onClick={handlePurchase} className="px-10 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl shadow-indigo-500/30">
                            QUERO COMEÇAR AGORA
                        </button>
                        <button onClick={scrollToContent} className="px-10 py-5 bg-white text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-2">
                            Ver plataforma <span className="material-symbols-outlined">arrow_downward</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full max-w-5xl pt-10 relative z-10">
                        {[
                            { v: course.apostilas_count || 0, l: 'Apostilas' },
                            { v: course.simulados_count || 0, l: 'Simulados' },
                            { v: course.questions_count || 0, l: 'Questões' },
                            { v: course.cadernos_count || 0, l: 'Cadernos' },
                            { v: course.resolved_notebooks_count || 0, l: 'Resolvidos' }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:-translate-y-1 transition-transform">
                                <span className="text-4xl font-black text-indigo-600">{stat.v}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">{stat.l}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="px-6 max-w-6xl mx-auto -mt-10 relative z-20 pb-32">
                    <div className="rounded-[40px] overflow-hidden bg-slate-900 shadow-2xl shadow-slate-900/20 border-8 border-white group relative aspect-video flex items-center justify-center">
                         {course.video_url ? (
                             <VideoPlayer url={course.video_url} />
                         ) : (
                             <img src={course.banner_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-80" />
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-40 pointer-events-none"></div>
                    </div>
                </section>

                <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/20 to-transparent pointer-events-none"></div>
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                <span className="material-symbols-outlined text-[14px]">visibility</span> Exclusividade
                            </div>
                            <h2 className="text-5xl font-black tracking-tighter">O Famoso <span className="text-indigo-400 italic">Modo Relax</span></h2>
                            <p className="text-lg text-slate-400 font-medium leading-relaxed">
                                Cansado de forçar a vista depois de um dia de trabalho? Nosso Modo Relax ajusta toda a interface para tons escuros suaves e contrastes inteligentes. Estude até tarde sem dores de cabeça.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300"><span className="material-symbols-outlined text-indigo-400">check_circle</span> Foco Extremo e Zero Distrações</li>
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300"><span className="material-symbols-outlined text-indigo-400">check_circle</span> Proteção Ocular Integrada</li>
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300"><span className="material-symbols-outlined text-indigo-400">check_circle</span> Economia de Bateria no Celular</li>
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="absolute -inset-4 bg-indigo-500/20 blur-[50px] rounded-full"></div>
                            <div className="relative aspect-square md:aspect-video lg:aspect-square bg-[#0f172a] rounded-[40px] border border-slate-700 p-8 shadow-2xl flex flex-col overflow-hidden">
                                <div className="absolute inset-0 group-hover:scale-110 transition-transform duration-1000">
                                    <img 
                                        src={(course.lp_images && course.lp_images[1]) || course.banner_url || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800"} 
                                        className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" 
                                        alt="Modo Relax Preview"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent"></div>
                                </div>
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                                        <div className="h-3 w-24 bg-white/10 rounded-full"></div>
                                        <div className="size-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                            <span className="material-symbols-outlined text-indigo-400 text-[16px]">dark_mode</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-5 w-2/3 bg-white/20 rounded-lg"></div>
                                        <div className="h-3 w-full bg-white/5 rounded-lg"></div>
                                        <div className="h-3 w-5/6 bg-white/5 rounded-lg"></div>
                                    </div>
                                    <div className="mt-auto pt-6 flex gap-3">
                                        <div className="h-8 w-20 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20"></div>
                                        <div className="h-8 w-20 bg-white/5 rounded-lg"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="recursos" className="py-24 px-6 max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Features.map((f, i) => (
                        <div key={i} className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-6 group hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
                            <div className="size-14 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-3xl">{f.icon}</span>
                            </div>
                            <div className="space-y-2">
                                <h5 className="text-xl font-black text-slate-800">{f.title}</h5>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-8 rounded-[32px] text-white space-y-6 lg:col-span-1 shadow-lg group overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 group-hover:scale-110 transition-transform duration-700">
                            <span className="material-symbols-outlined text-9xl">library_books</span>
                        </div>
                        <div className="relative z-10 space-y-4">
                            <span className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md">Plus+</span>
                            <h5 className="text-xl font-black">Cadernos Resolvidos</h5>
                            <p className="text-sm text-indigo-100 font-medium leading-relaxed">
                                Nossos cadernos vêm com resoluções completas passo-a-passo. É como ter um professor particular com você 24h por dia.
                            </p>
                        </div>
                    </div>
                </section>

                {course.disciplinas && course.disciplinas.length > 0 && (
                    <section id="materias" className="py-24 bg-slate-50 border-t border-slate-200/50">
                        <div className="max-w-7xl mx-auto px-6">
                            <div className="text-center space-y-4 mb-16">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Edital 100% Mapeado</h2>
                                <p className="text-slate-500 font-medium">Todas as matérias que você precisa para destruir a banca.</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3">
                                {course.disciplinas.map((disc, idx) => (
                                    <div key={idx} className="bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 cursor-default transition-colors">
                                        {disc}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section id="precos" className="py-24 lg:py-32 relative overflow-hidden bg-white">
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-slate-50 pointer-events-none"></div>
                    <div className="max-w-5xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8 text-center lg:text-left">
                            <h2 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
                                Invista no seu <br/><span className="text-indigo-600">futuro hoje.</span>
                            </h2>
                            <p className="text-lg text-slate-500 font-medium leading-relaxed">
                                Tudo que você precisa para ser aprovado em um único pagamento. Sem mensalidades, com atualizações gratuitas.
                            </p>
                            <div className="hidden lg:flex items-center gap-4 text-slate-400 font-bold">
                                <span className="material-symbols-outlined text-green-500">verified</span> Compra 100% Segura
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] p-10 lg:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.08)] border border-slate-100 relative group text-center">
                            {hasDiscount && (
                                <div className="absolute -top-5 inset-x-0 flex justify-center">
                                    <span className="bg-rose-500 text-white px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg animate-bounce">
                                        Desconto Aplicado
                                    </span>
                                </div>
                            )}
                            
                            <div className="space-y-6 mb-10 mt-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{course.title}</p>
                                
                                <div className="flex flex-col items-center justify-center">
                                    {hasDiscount && (
                                        <p className="text-lg font-bold text-slate-400 line-through decoration-rose-500/50 mb-[-10px]">
                                            De R$ {formatPrice(course.price_base)}
                                        </p>
                                    )}
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-800">R$</span>
                                        <span className={`text-7xl lg:text-8xl font-black tracking-tighter ${hasDiscount ? 'text-rose-600' : 'text-indigo-600'}`}>
                                            {isFree ? 'GRÁTIS' : formatPrice(course.price_offer)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-400 mt-2">Acesso por 1 Ano</p>
                                </div>
                            </div>

                            <button onClick={handlePurchase} className={`w-full py-6 text-white font-black text-xl rounded-2xl transition-all shadow-xl hover:-translate-y-1 ${hasDiscount ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}>
                                COMPRAR AGORA
                            </button>
                            <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400">7 Dias de Garantia Incondicional</p>
                        </div>
                    </div>
                </section>

                <section className="py-24 bg-slate-50">
                    <div className="max-w-3xl mx-auto px-6 space-y-12">
                        <h3 className="text-3xl font-black text-center text-slate-900 tracking-tighter">Perguntas Frequentes</h3>
                        <div className="space-y-4">
                            {FAQ.map((f, i) => (
                                <details key={i} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-slate-800 group-open:text-indigo-600 transition-colors">
                                        {f.q}
                                        <span className="material-symbols-outlined group-open:rotate-180 transition-transform">expand_more</span>
                                    </summary>
                                    <div className="px-6 pb-6 text-sm text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4">
                                        {f.a}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <footer className="py-12 bg-white border-t border-slate-100 px-6 lg:px-20 flex flex-col md:flex-row justify-between items-center gap-6">
                    <img src="/bora_passar_logo.png" className="h-6 grayscale opacity-50" alt="" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">BORA PASSAR AGORA © 2026</p>
                </footer>
            </div>
        );
    };


    const ImpactoNeon = () => {
        const FAQ = [
            { q: 'Por quanto tempo tenho acesso ao curso?', a: 'Você terá acesso ilimitado por 1 ano inteiro, com todas as atualizações inclusas.' },
            { q: 'O material serve para qualquer concurso?', a: 'Este material é focado 100% no edital do curso selecionado, garantindo máxima eficiência.' },
            { q: 'Existe garantia de reembolso?', a: 'Sim! Você tem 7 dias de garantia incondicional. Se não gostar, devolvemos 100% do seu dinheiro.' }
        ];

        const scrollToContent = () => {
            const el = document.getElementById('ecossistema');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        };

        const displayImages = course.lp_images && course.lp_images.length > 0 ? course.lp_images : [
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800'
        ];

        return (
            <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-[#00f5d4] selection:text-black overflow-x-hidden">
                <nav className="fixed top-0 inset-x-0 h-24 bg-[#020617]/80 backdrop-blur-2xl border-b border-white/5 z-[100] px-6 lg:px-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-gradient-to-br from-[#00f5d4] to-[#00b4d8] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,245,212,0.3)]">
                            <span className="material-symbols-outlined text-black font-black">bolt</span>
                        </div>
                        <img src="/bora_passar_logo.png" className="h-6" alt="Logo" />
                    </div>
                    <div className="hidden lg:flex items-center gap-12 text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                        <a href="#hero" className="hover:text-[#00f5d4] transition-colors">Destaque</a>
                        <a href="#ecossistema" className="hover:text-[#00f5d4] transition-colors">Ecossistema</a>
                        <a href="#materias" className="hover:text-[#00f5d4] transition-colors">Matérias</a>
                        <a href="#preco" className="hover:text-[#00f5d4] transition-colors">Acesso</a>
                    </div>
                    <button onClick={handlePurchase} className="bg-[#00f5d4] text-black px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all shadow-[0_0_30px_rgba(0,245,212,0.2)]">Matricular Agora</button>
                </nav>

                <section id="hero" className="relative pt-44 lg:pt-64 pb-32 px-6 max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(0,245,212,0.05)_0%,transparent_50%)] pointer-events-none"></div>
                    <div className="space-y-10 relative z-10">
                        <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-[#00f5d4]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f5d4] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f5d4]"></span>
                            </span>
                            Inscrições Abertas 2026
                        </div>
                        <h1 className="text-6xl lg:text-[84px] font-black leading-[0.9] tracking-tighter uppercase italic">
                            Aprovação <br /> Institucional com <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f5d4] to-[#00b4d8]">Bora Passar Agora!</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-white/40 font-medium leading-relaxed max-w-xl italic">
                            Domine o edital de <span className="text-white font-black">{course.title}</span> com rigor acadêmico e ferramentas de elite.
                        </p>
                        <div className="flex flex-wrap gap-5">
                            <button onClick={handlePurchase} className="px-10 py-6 bg-[#00f5d4] text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white transition-all transform hover:-translate-y-1 shadow-2xl shadow-[#00f5d4]/20">Começar Agora →</button>
                            <button onClick={scrollToContent} className="px-10 py-6 bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all">Ver Ecossistema</button>
                        </div>
                    </div>
                    <div className="relative group">
                        <div className="absolute -inset-1 w-full h-full bg-gradient-to-r from-[#00f5d4] to-[#00b4d8] rounded-[40px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative aspect-video bg-[#050914] rounded-[40px] border border-white/10 overflow-hidden shadow-huge flex items-center justify-center">
                            {course.video_url ? (
                                <VideoPlayer url={course.video_url} />
                            ) : (
                                <div className="w-full h-full relative">
                                    <img src={course.banner_url || displayImages[0]} className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="size-20 bg-[#00f5d4] rounded-full flex items-center justify-center text-black shadow-[0_0_50px_rgba(0,245,212,0.5)]">
                                            <span className="material-symbols-outlined text-4xl font-black">play_arrow</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="ecossistema" className="py-32 bg-white/[0.02] border-y border-white/5 relative">
                    <div className="max-w-7xl mx-auto px-6 space-y-20">
                        <div className="text-center space-y-6">
                            <h2 className="text-4xl lg:text-6xl font-black uppercase italic tracking-tighter">Ecossistema de <span className="text-[#00f5d4]">Elite</span></h2>
                            <p className="text-white/30 font-bold uppercase tracking-widest text-[10px]">Quantitativo completo do seu material de estudo.</p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { title: `${course.questions_count || 0}+ Questões`, desc: 'Base de dados atualizada diariamente com filtros por banca e cargo.', icon: 'database' },
                                { title: `${course.apostilas_count || 0} Livros Digitais`, desc: 'Material teórico aprofundado com tecnologia de leitura interativa.', icon: 'auto_stories' },
                                { title: `${course.simulados_count || 0} Simulados de Elite`, desc: 'Treine com questões inéditas e cronômetro real de prova.', icon: 'quiz' },
                                { title: `${course.cadernos_count || 0} Cadernos de Treino`, desc: 'Exercícios selecionados e organizados por assunto.', icon: 'menu_book' },
                                { title: `${course.resolved_notebooks_count || 0} Cadernos Resolvidos`, desc: 'Resoluções detalhadas passo-a-passo pelos professores.', icon: 'verified' },
                                { title: 'Atualizações Grátis', desc: 'Material sempre em dia com o edital vigente.', icon: 'update' }
                            ].map((f, i) => (
                                <div key={i} className="bg-white/[0.03] border border-white/5 p-10 rounded-[40px] space-y-8 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
                                    <span className="material-symbols-outlined text-4xl text-[#00f5d4]">{f.icon}</span>
                                    <div className="space-y-4">
                                        <h4 className="text-xl font-black uppercase italic leading-tight">{f.title}</h4>
                                        <p className="text-xs text-white/30 font-medium leading-relaxed">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-32 lg:py-56 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
                    <div className="relative group">
                        <div className="absolute -inset-10 bg-[#00f5d4]/5 blur-[100px] rounded-full group-hover:bg-[#00f5d4]/10 transition-all duration-1000"></div>
                        <div className="relative aspect-square md:aspect-video lg:aspect-square bg-[#050914] rounded-[60px] border border-white/10 overflow-hidden shadow-huge p-12 flex flex-col group-hover:scale-[1.02] transition-transform duration-700">
                             <div className="absolute inset-0 opacity-20 grayscale group-hover:grayscale-0 group-hover:opacity-40 transition-all duration-1000">
                                 <img src={displayImages[1 % displayImages.length]} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-gradient-to-t from-[#050914] via-transparent to-transparent"></div>
                             </div>
                             <div className="relative z-10 flex flex-col h-full">
                                 <div className="flex justify-between items-center border-b border-white/5 pb-6 mb-6">
                                     <div className="h-4 w-32 bg-white/10 rounded-full"></div>
                                     <div className="size-10 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4]/40 flex items-center justify-center">
                                         <span className="material-symbols-outlined text-[#00f5d4] text-[20px]">dark_mode</span>
                                     </div>
                                 </div>
                                 <div className="space-y-4">
                                     <div className="h-8 w-3/4 bg-white/20 rounded-xl"></div>
                                     <div className="h-4 w-full bg-white/5 rounded-lg"></div>
                                 </div>
                                 <div className="mt-auto flex gap-4">
                                     <div className="h-12 w-32 bg-[#00f5d4] rounded-2xl shadow-[0_10px_30px_rgba(0,245,212,0.3)]"></div>
                                 </div>
                             </div>
                        </div>
                    </div>
                    <div className="space-y-10 text-center lg:text-left">
                        <div className="space-y-4">
                            <span className="text-[#00f5d4] text-xs font-black uppercase tracking-[0.4em]">EXCLUSIVIDADE BORA PASSAR</span>
                            <h2 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none">MODO <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f5d4] to-[#00b4d8]">RELAX</span></h2>
                        </div>
                        <p className="text-lg text-white/40 font-medium leading-relaxed italic">
                            A única plataforma com tecnologia de conforto visual absoluto. Reduza a fadiga ocular e estude por mais tempo.
                        </p>
                    </div>
                </section>

                {course.disciplinas && course.disciplinas.length > 0 && (
                    <section id="materias" className="py-32 bg-white/[0.01]">
                        <div className="max-w-7xl mx-auto px-6 space-y-20">
                             <div className="flex flex-col lg:flex-row justify-between items-end gap-10">
                                 <h2 className="text-5xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none">MATÉRIAS DO <br /><span className="text-[#00f5d4]">EDITAL</span></h2>
                             </div>
                             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {course.disciplinas.map((disc, idx) => (
                                     <div key={idx} className="group bg-white/[0.02] border border-white/5 p-8 rounded-[32px] flex items-center justify-between hover:bg-[#00f5d4] transition-all duration-500 hover:scale-[1.02]">
                                         <span className="text-sm font-black uppercase tracking-widest text-white/50 group-hover:text-black transition-colors">{disc}</span>
                                         <span className="material-symbols-outlined text-[#00f5d4] group-hover:text-black transition-colors">check_circle</span>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </section>
                )}

                <section id="preco" className="py-32 lg:py-56 relative overflow-hidden">
                    <div className="max-w-4xl mx-auto px-6 relative z-10 text-center space-y-16">
                        <div className="bg-white/[0.03] border border-white/10 rounded-[60px] p-16 lg:p-24 shadow-huge relative overflow-hidden group hover:border-[#00f5d4]/30 transition-all duration-700">
                             <div className="space-y-8 mb-12">
                                 {hasDiscount && (
                                     <p className="text-xl font-black text-white/20 line-through decoration-[#00f5d4]/40 italic mb-[-15px]">
                                         De R$ {formatPrice(course.price_base)}
                                     </p>
                                 )}
                                 <div className="flex items-baseline justify-center gap-3">
                                     <span className="text-4xl font-black italic text-white/20">R$</span>
                                     <span className="text-8xl lg:text-[140px] font-black italic tracking-tighter leading-none text-white group-hover:text-[#00f5d4] transition-colors">
                                         {isFree ? 'GRÁTIS' : formatPrice(course.price_offer)}
                                     </span>
                                 </div>
                             </div>
                             <button onClick={handlePurchase} className="w-full py-10 bg-[#00f5d4] text-black font-black text-3xl uppercase italic tracking-widest rounded-3xl hover:bg-white transition-all transform hover:-translate-y-2 shadow-[0_20px_50px_rgba(0,245,212,0.2)]">QUERO MINHA VAGA AGORA</button>
                        </div>
                    </div>
                </section>
            </div>
        );
    };


    const ModelSwitcher = () => {
        if (course.lp_model === 'impacto-neon') return <ImpactoNeon />;
        if (course.lp_model === 'premium') return <ProfessionalClean />;
        return <EliteGold />;
    };

    return (
        <>
            <ModelSwitcher />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Playfair+Display:ital,wght@0,900;1,900&family=Space+Mono:wght@400;700&display=swap');
                
                body { overflow-x: hidden; scroll-behavior: smooth; background: #000; }
                
                @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .animate-marquee { animation: marquee 20s linear infinite; }
                
                .shadow-huge { box-shadow: 0 50px 100px rgba(0,0,0,0.1); }
                
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
                
                .stroke-cyan-400 { -webkit-text-stroke: 1px #22d3ee; }

                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.02); } }
                .animate-pulse { animation: pulse 3s infinite ease-in-out; }
            `}</style>
        </>
    );
};

export default CourseLandingPage;
