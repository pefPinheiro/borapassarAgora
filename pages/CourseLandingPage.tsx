
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface CourseData {
    id: string;
    title: string;
    description: string;
    area: string;
    cargo: string;
    banner_url: string;
    price_base: number;
    price_offer: number;
    coupon_name: string;
    bancas?: { name: string; logo?: string };
    apostilas_count: number;
    simulados_count: number;
    questions_count: number;
    lp_model?: string;
    coupons_json?: { name: string, discount_type: string, discount_value: number }[];
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
                supabase.from('course_items').select('id').eq('course_id', id),
                supabase.from('course_simulados').select('id').eq('course_id', id),
                supabase.from('questions').select('*', { count: 'exact', head: true })
            ]);

            const apostilasCount = apsRes.data?.length || 0;
            const simuladosCount = simsRes.data?.length || 0;
            const totalQuestionsCount = questRes.count || 0;

            setCourse({
                ...courseData,
                apostilas_count: apostilasCount,
                simulados_count: simuladosCount,
                questions_count: totalQuestionsCount
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

    // --- 10 HIGH-IMPACT MODELS ---

    const Standard = () => {
        const FeaturesStandard = [
            { title: 'Suporte Especializado Ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-yellow-500 selection:text-black">
                <nav className="fixed top-0 inset-x-0 h-24 bg-black/80 backdrop-blur-2xl border-b border-white/5 z-[100] px-6 lg:px-20 flex items-center justify-between">
                    <img src="/bora_passar_logo.png" className="h-10 transition-transform hover:scale-105" alt="Logo" />
                    <button onClick={handlePurchase} className="bg-yellow-500 text-black px-10 py-3.5 rounded-full font-black uppercase text-[11px] tracking-widest hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all active:scale-95">Garanta Sua Vaga</button>
                </nav>

                <main>
                    {/* Hero Section */}
                    <section className="pt-48 lg:pt-60 pb-32 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-yellow-500/10 blur-[150px] pointer-events-none"></div>
                        <div className="max-w-6xl mx-auto px-6 space-y-12">
                            <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-yellow-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">#REVOLUÇÃO_BPA 2026</div>
                            <h1 className="text-6xl lg:text-[110px] font-black leading-[0.9] tracking-tighter">O MÉTODO DEFINITIVO <br /> PARA <span className="text-yellow-500 underline decoration-white/10">APROVAÇÃO</span>.</h1>
                            <p className="text-xl lg:text-3xl text-white/50 font-medium max-w-4xl mx-auto leading-relaxed">Prepare-se para <span className="text-white font-black">{course.title}</span> com o curso mais completo e atualizado.</p>

                            <div className="flex flex-col items-center gap-8 py-10">
                                <div className="flex flex-col items-center gap-2 relative">
                                    <PromoBadge className="mb-6 scale-110" />
                                    {course.coupon_name && (
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap"> Cupom: {course.coupon_name} </div>
                                    )}
                                    {hasDiscount && <span className="text-white/30 line-through text-2xl font-bold">R$ {formatPrice(course.price_base)}</span>}
                                    <span className="text-7xl lg:text-[140px] font-black tracking-tighter leading-none">{isFree ? 'GRÁTIS' : `R$ ${formatPrice(course.price_offer)}`}</span>
                                </div>
                                <button onClick={handlePurchase} className="group relative px-20 py-8 bg-yellow-500 text-black font-black text-2xl lg:text-3xl uppercase tracking-widest rounded-3xl hover:scale-105 transition-all shadow-2xl active:translate-y-2">
                                    {CTA_TEXT}
                                    <span className="inline-block ml-4 group-hover:translate-x-2 transition-transform">🚀</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Banner & Floating Stats */}
                    <section className="max-w-7xl mx-auto px-6 py-20">
                        <div className="relative rounded-[40px] overflow-hidden border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
                            <img src={course.banner_url} className="w-full aspect-video object-cover" alt="Banner" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/20 to-transparent p-10 lg:p-20">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                                    {Stats.map((st, i) => (
                                        <div key={i} className="text-center space-y-2 group">
                                            <p className="text-4xl lg:text-7xl font-black text-yellow-500 group-hover:scale-110 transition-transform">{st.val}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{st.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Features */}
                    <section className="max-w-7xl mx-auto px-6 py-40 grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-8">
                            <h2 className="text-5xl lg:text-7xl font-black tracking-tighter leading-none">POR QUE ESTUDAR <br /> COM O <span className="text-yellow-500">BORA PASSAR AGORA?</span></h2>
                            <p className="text-white/50 text-xl leading-relaxed">Nossa plataforma foi desenhada para quem não tem tempo a perder. Conteúdo objetivo, estratégias de prova e suporte total ao aluno.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {FeaturesStandard.map((f, i) => (
                                <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group">
                                    <span className="material-symbols-outlined text-4xl text-yellow-500 mb-6">{f.icon}</span>
                                    <h4 className="text-2xl font-black mb-4">{f.title}</h4>
                                    <p className="text-sm text-white/40 font-medium leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                <footer className="py-20 border-t border-white/5 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
                    Bora Passar Agora © 2026 – Todos os direitos reservados.
                </footer>
            </div>
        );
    };

    const Minimalist = () => (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-black selection:text-white">
            <nav className="p-10 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <img src="/bora_passar_logo.png" className="h-6 invert transition-opacity hover:opacity-100 opacity-60" alt="" />
                <button onClick={handlePurchase} className="font-bold border-b-2 border-black hover:pb-2 transition-all">Começar Jornada</button>
            </nav>
            <main className="max-w-6xl mx-auto px-10 py-20 lg:py-40">
                <div className="grid lg:grid-cols-2 gap-40 items-center">
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom duration-1000">
                        <h1 className="text-7xl lg:text-[140px] font-black leading-[0.8] tracking-tighter">Bora <br /> Passar <br /> <span className="text-blue-600 italic">Agora!</span></h1>
                        <div className="space-y-2">
                            <p className="text-3xl font-black text-slate-900 border-l-8 border-blue-600 pl-6">{course.title}</p>
                            <p className="text-xl font-medium text-slate-400 pl-8">A estratégia perfeita para passar agora!</p>
                        </div>
                        <div className="flex flex-col gap-8">
                            <PromoBadge className="mb-2" />
                            <div className="flex items-baseline gap-6">
                                <span className="text-8xl font-black tracking-tighter">R$ {formatPrice(course.price_offer)}</span>
                                {hasDiscount && <span className="text-3xl text-slate-300 line-through font-bold">R$ {formatPrice(course.price_base)}</span>}
                            </div>
                            <button onClick={handlePurchase} className="w-full py-8 bg-black text-white font-black text-2xl hover:bg-blue-600 transition-colors uppercase tracking-widest">Quero Minha Vaga →</button>
                        </div>
                    </div>
                    <div className="relative group">
                        <img src={course.banner_url} className="grayscale hover:grayscale-0 transition-all duration-1000 w-full rounded-2xl shadow-3xl" alt="" />
                        <div className="absolute -bottom-10 -right-10 p-10 bg-white border border-slate-100 shadow-2xl rounded-2xl hidden lg:block">
                            <div className="grid grid-cols-2 gap-10">
                                {Stats.slice(0, 4).map((s, i) => (
                                    <div key={i}><p className="text-3xl font-black text-blue-600">{s.val}</p><p className="text-[10px] font-bold uppercase opacity-30">{s.label}</p></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <section className="mt-60 grid lg:grid-cols-4 gap-12">
                    {Features.map((f, i) => (
                        <div key={i} className="space-y-6">
                            <span className="text-6xl font-black text-slate-100">0{i + 1}</span>
                            <h4 className="text-2xl font-black">{f.title}</h4>
                            <p className="text-slate-500 font-medium">{f.desc}</p>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );

    const Futuristic = () => {
        const FeaturesFuturistic = [
            { title: 'Suporte Especializado Ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#020617] text-cyan-400 font-mono selection:bg-cyan-400 selection:text-black pt-10">
                <nav className="fixed top-0 inset-x-0 h-24 bg-black/40 backdrop-blur-xl border-b border-cyan-500/10 z-[100] px-6 lg:px-20 flex items-center justify-between">
                    <img src="/bora_passar_logo.png" className="h-10 transition-all hover:scale-105 brightness-0 invert sepia(1) saturate(100) hue-rotate(140deg) drop-shadow(0 0 10px #22d3ee)" alt="Logo" />
                    <button onClick={handlePurchase} className="px-8 py-3 bg-cyan-500 text-black font-black uppercase text-[10px] tracking-widest hover:shadow-[0_0_30px_#22d3ee] transition-all active:scale-95">EU QUERO AGORA!</button>
                </nav>

                <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                <div className="size-[600px] bg-cyan-500/10 blur-[150px] absolute -top-40 left-1/2 -translate-x-1/2 -z-10 animate-pulse"></div>

                <header className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center min-h-[90vh] text-center space-y-12 relative">
                    <div className="px-6 py-2 border border-cyan-500/50 rounded-full text-[10px] tracking-[0.5em] animate-bounce uppercase">Status: Protocolo_Aprovado_Ativado</div>
                    <h1 className="text-5xl lg:text-[120px] font-black leading-none tracking-tighter uppercase italic border-y border-cyan-500/20 py-20 w-full group overflow-hidden">
                        <span className="block group-hover:translate-y-[-100%] transition-transform duration-700">{course.title}</span>
                        <span className="block absolute inset-0 py-20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-700 text-transparent stroke-cyan-400" style={{ WebkitTextStroke: '2px #22d3ee' }}>{course.title}</span>
                    </h1>

                    <div className="w-full max-w-5xl rounded-[40px] border-2 border-cyan-500/20 p-4 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                        <img src={course.banner_url} className="w-full h-full object-cover rounded-[30px] opacity-60 grayscale hover:grayscale-0 transition-all duration-1000" alt="Banner" />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-20">
                        {Stats.map((s, i) => (
                            <div key={i} className="space-y-1 group cursor-default p-4 hover:bg-cyan-500/5 rounded-2xl transition-all hover:scale-110 active:scale-95">
                                <p className="text-white font-black text-4xl group-hover:text-cyan-400 transition-colors">{s.val}</p>
                                <p className="text-[8px] opacity-40 uppercase tracking-widest group-hover:opacity-100 transition-opacity">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2 relative">
                            <PromoBadge className="mb-6 scale-110 shadow-[0_0_40px_rgba(225,29,72,0.8)]" />
                            {course.coupon_name && (
                                <div className="text-xs font-black uppercase tracking-[0.4em] text-cyan-500 animate-pulse">// ACTIVE_COUPON: {course.coupon_name}</div>
                            )}
                            <div className="flex items-center justify-center gap-6">
                                <span className="text-7xl font-black text-white italic">R$ {formatPrice(course.price_offer)}</span>
                                {hasDiscount && <span className="text-3xl text-cyan-900 line-through font-bold">R$ {formatPrice(course.price_base)}</span>}
                            </div>
                        </div>
                        <button onClick={handlePurchase} className="px-20 py-10 bg-cyan-500 text-black font-black text-3xl uppercase tracking-[0.3em] hover:shadow-[0_0_80px_rgba(34,211,238,0.5)] transition-all active:scale-95">BORA PASSAR AGORA!</button>
                    </div>
                </header>

                <section className="max-w-7xl mx-auto px-6 py-60">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-px bg-cyan-500/10 border border-cyan-500/10">
                        {FeaturesFuturistic.map((f, i) => (
                            <div key={i} className="p-12 bg-[#020617] space-y-8 hover:bg-cyan-500/[0.05] transition-colors relative group">
                                <span className="material-symbols-outlined text-4xl text-cyan-400">{f.icon}</span>
                                <h4 className="text-xl font-black uppercase tracking-widest italic">{f.title}</h4>
                                <p className="text-xs opacity-40 leading-relaxed font-mono">{f.desc}</p>
                                <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 w-0 group-hover:w-full transition-all"></div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        );
    };

    const Executive = () => {
        const FeaturesExecutive = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#0f172a] text-slate-200 font-serif selection:bg-amber-500 selection:text-slate-900 overflow-x-hidden">
                <nav className="fixed top-0 inset-x-0 h-20 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 z-[100] px-6 lg:px-20 flex items-center justify-between">
                    <img src="/bora_passar_logo.png" className="h-6 opacity-60 transition-opacity hover:opacity-100" alt="Logo" />
                    <button onClick={handlePurchase} className="px-6 py-2 border border-amber-500/30 text-amber-500 font-black uppercase text-[10px] tracking-widest hover:bg-amber-500 hover:text-slate-900 transition-all active:scale-95">EU QUERO AGORA!</button>
                </nav>

                <main className="pt-20">
                    {/* Hero Split */}
                    <section className="max-w-7xl mx-auto px-6 py-20 lg:py-32 grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10 animate-in fade-in slide-in-from-left duration-1000">
                            <div className="space-y-4">
                                <span className="text-amber-500 font-black tracking-[0.5em] text-[10px] uppercase block">PREPARAÇÃO DE ALTO NÍVEL</span>
                                <h1 className="text-5xl lg:text-8xl font-black text-white italic tracking-tighter leading-none">{course.title}</h1>
                                <p className="text-xl lg:text-2xl text-slate-400 italic max-w-xl">Um ecossistema fechado para quem busca a vaga com autoridade absoluta.</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl space-y-8 max-w-lg">
                                <div className="flex flex-col gap-1">
                                    <PromoBadge className="mb-6" />
                                    {course.coupon_name && <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 animate-pulse">CÓDIGO_ATIVO: {course.coupon_name}</span>}
                                    {hasDiscount && <span className="text-white/30 line-through text-lg font-bold">R$ {formatPrice(course.price_base)}</span>}
                                    <div className="flex items-baseline gap-4">
                                        <span className="text-6xl font-black text-white italic">R$ {formatPrice(course.price_offer)}</span>
                                        <span className="text-xs font-bold uppercase opacity-20 tracking-widest">Investimento único</span>
                                    </div>
                                </div>
                                <button onClick={handlePurchase} className="w-full py-6 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-amber-400 transition-colors shadow-2xl shadow-amber-500/20">Solicitar Admissão Imediata</button>
                            </div>

                            <div className="flex gap-12 border-t border-white/5 pt-10">
                                {Stats.map((s, i) => (
                                    <div key={i} className="space-y-1">
                                        <p className="text-2xl font-black text-white italic">{s.val}</p>
                                        <p className="text-[9px] uppercase tracking-[0.2em] opacity-30 font-serif">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative group perspective-1000 hidden lg:block">
                            <div className="absolute inset-0 bg-amber-500/10 blur-[100px] -z-10 group-hover:bg-amber-500/20 transition-all duration-1000"></div>
                            <img src={course.banner_url} className="w-full rounded-[40px] shadow-huge border border-white/10 grayscale hover:grayscale-0 transition-all duration-1000 rotate-y-[-10deg] group-hover:rotate-y-0" alt="" />
                        </div>
                    </section>

                    {/* Features Grid */}
                    <section className="bg-white/[0.02] border-y border-white/5">
                        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32 grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                            {FeaturesExecutive.map((f, i) => (
                                <div key={i} className="space-y-6 group">
                                    <span className="text-5xl font-black text-amber-500/10 group-hover:text-amber-500/40 transition-colors italic">0{i + 1}</span>
                                    <div className="space-y-3">
                                        <h4 className="text-xl font-black text-white uppercase tracking-wider">{f.title}</h4>
                                        <p className="text-sm text-slate-400 leading-relaxed font-serif italic opacity-60">Atendimento especializado ao Aluno</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                <footer className="py-20 text-center border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-20 italic">Bora Passar Elite Prep • Strategic Learning Systems</p>
                </footer>
            </div>
        );
    };

    const Energetic = () => {
        const FeaturesEnergetic = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-orange-600 text-white font-sans overflow-hidden">
                <div className="fixed h-screen w-32 bg-black left-0 top-0 hidden lg:flex items-center justify-center -rotate-6 -translate-x-12 z-50">
                    <span className="origin-center -rotate-90 font-black text-4xl uppercase tracking-tighter text-orange-600 animate-marquee whitespace-nowrap">BORA PASSAR / BORA PASSAR / BORA PASSAR</span>
                </div>
                <main className="pl-0 lg:pl-20">
                    <section className="min-h-screen grid lg:grid-cols-2">
                        <div className="flex flex-col justify-center p-12 lg:p-24 space-y-12 bg-white text-black relative">
                            <img src="/bora_passar_logo.png" className="h-10 w-fit absolute top-10 left-10" alt="Logo" />
                            <span className="px-6 py-2 bg-orange-600 text-white font-black text-sm skew-x-[-15deg] w-fit">VAGAS LIMITADAS</span>
                            <h1 className="text-7xl lg:text-[140px] font-black leading-[0.8] tracking-tighter uppercase -ml-4 italic">SEM <br /> <span className="text-orange-600">FOLGA.</span></h1>
                            <p className="text-2xl font-bold italic opacity-60 leading-tight">O conteúdo mais agressivo para detonar no cuncurso e garantir a aprovação!.</p>
                            <div className="p-8 bg-orange-50 border-4 border-black shadow-[15px_15px_0_#000] rotate-2 space-y-4">
                                <div className="space-y-1 relative">
                                    <PromoBadge className="mb-6 -rotate-2" />
                                    {course.coupon_name && <p className="text-xs font-black uppercase text-orange-600 tracking-widest animate-pulse">CUMPOM ATIVO: {course.coupon_name}</p>}
                                    {hasDiscount && <p className="text-2xl text-black/20 line-through font-black italic">R$ {formatPrice(course.price_base)}</p>}
                                    <span className="text-7xl lg:text-9xl font-black italic block italic leading-none">R$ {formatPrice(course.price_offer)}</span>
                                </div>
                                <button onClick={handlePurchase} className="w-full bg-black text-white py-8 font-black text-4xl uppercase hover:translate-x-2 hover:translate-y-2 hover:shadow-none transition-all shadow-[10px_10px_0_#ea580c] active:scale-95">EU QUERO MINHA POSSE! ⚡</button>
                            </div>
                        </div>
                        <div className="relative overflow-hidden group flex items-center justify-center">
                            <img src={course.banner_url} className="h-full w-full object-cover grayscale scale-125 group-hover:grayscale-0 group-hover:scale-100 transition-all duration-[3000ms]" alt="" />
                            <div className="absolute inset-x-0 h-24 bg-orange-600/90 -rotate-3 flex items-center justify-center border-y-4 border-black shadow-2xl skew-y-3 z-10">
                                <span className="text-white font-black text-4xl lg:text-5xl uppercase tracking-tighter drop-shadow-lg">{course.title}</span>
                            </div>
                            <div className="absolute inset-0 bg-orange-600/30 mix-blend-multiply transition-opacity group-hover:opacity-0"></div>
                            <div className="absolute top-10 right-10 flex flex-col gap-4">
                                {Stats.map((s, i) => (<div key={i} className="bg-white text-black p-4 border-2 border-black font-black text-center -rotate-12"><p className="text-xl">{s.val}</p><p className="text-[8px] uppercase">{s.label}</p></div>))}
                            </div>
                        </div>
                    </section>
                    <div className="py-40 grid lg:grid-cols-4 gap-8 px-12 lg:px-24">
                        {FeaturesEnergetic.map((f, i) => (
                            <div key={i} className="p-12 border-4 border-white bg-transparent text-white space-y-6 hover:bg-white hover:text-black transition-all">
                                <span className="material-symbols-outlined text-6xl">{f.icon}</span>
                                <h4 className="text-3xl font-black uppercase italic">{f.title}</h4>
                                <p className="text-sm font-bold opacity-70 italic leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    };

    const Nature = () => {
        const FeaturesNature = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#f7fee7] text-emerald-950 font-sans p-4 lg:p-12 selection:bg-emerald-200">
                <div className="max-w-7xl mx-auto bg-white rounded-[60px] lg:rounded-[100px] p-8 lg:p-24 space-y-24 shadow-[0_50px_100px_rgba(6,78,59,0.05)] border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-[600px] bg-emerald-50 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 -z-10"></div>

                    <nav className="flex justify-between items-center">
                        <img src="/bora_passar_logo.png" className="h-10 brightness-0 sepia(1) saturate(100) hue-rotate(100deg)" alt="Logo" />
                        <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-emerald-800/40">Soft Prep Experience • 2026</span>
                    </nav>

                    <header className="text-center space-y-10">
                        <div className="inline-flex items-center gap-3 px-6 py-2 bg-emerald-50 text-emerald-700 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse border border-emerald-100">🌱 Semeie seu futuro agora</div>
                        <div className="space-y-6">
                            <h1 className="text-6xl lg:text-[110px] font-black leading-[0.9] tracking-tighter text-emerald-950 uppercase">ESTUDE COM <br /> <span className="text-emerald-500 italic uppercase">EQUILÍBRIO.</span></h1>
                            <h2 className="text-3xl lg:text-5xl font-black text-emerald-600 uppercase tracking-tighter drop-shadow-sm">{course.title}</h2>
                        </div>
                        <p className="text-xl lg:text-2xl font-medium max-w-3xl mx-auto text-emerald-900/60 leading-relaxed italic">Preparatório para mudar sua vida. Um método focado na absorção estratégica para sua aprovação!</p>

                        <div className="flex flex-wrap justify-center gap-4 lg:gap-8 pt-6">
                            {Stats.map((s, i) => (
                                <div key={i} className="px-8 py-4 bg-emerald-50/50 backdrop-blur-sm rounded-3xl text-center border border-emerald-100 transition-transform hover:scale-105">
                                    <p className="text-3xl font-black text-emerald-600">{s.val}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </header>

                    <section className="bg-emerald-600 text-white rounded-[50px] lg:rounded-[80px] p-10 lg:p-20 grid lg:grid-cols-2 gap-16 items-center relative overflow-hidden shadow-2xl shadow-emerald-900/20 group">
                        <div className="absolute top-0 left-0 size-full opacity-5 pointer-events-none">
                            <div className="grid grid-cols-10 gap-px size-full">{Array(100).fill(0).map((_, i) => (<div key={i} className="border border-white"></div>))}</div>
                        </div>

                        <div className="space-y-10 z-10 text-center lg:text-left">
                            <div className="space-y-4">
                                <h2 className="text-4xl lg:text-6xl font-black leading-tight">Garantir a sua posse é questão de estratégia.</h2>
                                <div className="space-y-2">
                                    <PromoBadge className="mb-6" />
                                    {course.coupon_name && <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 animate-pulse">Cupom Ativo: {course.coupon_name}</p>}
                                    {hasDiscount && <p className="text-2xl text-white/30 line-through font-black italic">R$ {formatPrice(course.price_base)}</p>}
                                    <div className="text-8xl lg:text-[140px] font-black italic tracking-tighter leading-none">R$ {formatPrice(course.price_offer)}</div>
                                </div>
                            </div>
                            <button onClick={handlePurchase} className="w-full lg:w-auto px-16 py-8 bg-white text-emerald-900 rounded-full font-black text-2xl hover:scale-105 transition-all shadow-xl active:scale-95">{CTA_TEXT}</button>
                        </div>

                        <div className="relative z-10">
                            <div className="absolute -inset-4 bg-emerald-400/20 blur-2xl rounded-full scale-0 group-hover:scale-100 transition-transform duration-1000"></div>
                            <div className="rounded-[40px] overflow-hidden shadow-2xl border-8 border-white/10 group-hover:border-white/20 transition-all">
                                <img src={course.banner_url} className="w-full aspect-video object-cover transition-transform duration-1000 group-hover:scale-110" alt="Banner" />
                            </div>
                        </div>
                    </section>

                    <footer className="grid lg:grid-cols-4 gap-12 pb-10">
                        {FeaturesNature.map((f, i) => (
                            <div key={i} className="space-y-6 group p-8 rounded-3xl hover:bg-emerald-50 transition-colors">
                                <span className="material-symbols-outlined text-5xl text-emerald-300 group-hover:text-emerald-600 transition-all transform group-hover:rotate-12">{f.icon}</span>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-black text-emerald-950">{f.title}</h4>
                                    <p className="text-sm text-emerald-900/40 font-medium leading-relaxed italic">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </footer>
                </div>
            </div>
        );
    };

    const Premium = () => {
        const FeaturesPremium = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal exclusivo de atendimento direto no WhatsApp.', icon: 'support_agent' },
            { title: 'Material de Elite', desc: 'Apostilas densas, focadas no que realmente cai na prova.', icon: 'auto_stories' },
            { title: 'Monitoramento', desc: 'Simulados ranqueados com análise de desempenho real.', icon: 'analytics' },
            { title: 'Questões Reais', desc: 'Milhares de itens comentados pela nossa equipe.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#050505] text-neutral-100 font-serif selection:bg-[#d4af37] selection:text-black overflow-x-hidden">
                <nav className="fixed top-0 inset-x-0 h-24 px-6 lg:px-20 flex items-center justify-between z-[100] bg-black/60 backdrop-blur-xl border-b border-[#d4af37]/10">
                    <img src="/bora_passar_logo.png" className="h-8 brightness-0 invert sepia(1) saturate(5) hue-rotate-[340deg] contrast(1.2) drop-shadow(0 0 5px #d4af37)" alt="Logo" />
                    <button onClick={handlePurchase} className="px-8 py-2.5 bg-[#d4af37] text-black text-[10px] uppercase font-black tracking-[0.2em] hover:bg-white transition-all transform hover:scale-105 active:scale-95">Solicitar Acesso VIP</button>
                </nav>

                <main>
                    {/* Immersive Hero */}
                    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-6 overflow-hidden">
                        <div className="absolute inset-0 z-0">
                            <img src={course.banner_url} className="w-full h-full object-cover opacity-20 scale-110 blur-sm" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]"></div>
                            <div className="absolute inset-0 bg-black/40"></div>
                        </div>

                        <div className="relative z-10 text-center space-y-12 max-w-7xl mx-auto">
                            <div className="space-y-6 animate-in fade-in slide-in-from-top duration-1000">
                                <span className="inline-block px-10 py-2 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-black uppercase tracking-[0.8em]">Padrão Refinado</span>
                                <h1 className="text-6xl lg:text-[140px] font-black uppercase tracking-tighter leading-[0.85] text-white">
                                    {course.title}
                                </h1>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-16 max-w-4xl mx-auto py-12 border-y border-white/5 bg-white/[0.02] backdrop-blur-sm rounded-[40px] px-10">
                                {Stats.map((s, i) => (
                                    <div key={i} className="text-center group space-y-1">
                                        <p className="text-3xl lg:text-5xl font-black text-[#d4af37] group-hover:scale-110 transition-transform">{s.val}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-100">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col items-center gap-10">
                                <div className="space-y-4 flex flex-col items-center">
                                    <PromoBadge className="mb-4" />
                                    {course.coupon_name && <p className="text-[11px] font-black text-[#d4af37] uppercase tracking-[0.4em] animate-pulse"># CUPOM_ATIVADO: {course.coupon_name}</p>}
                                    <div className="flex items-center justify-center gap-8">
                                        {hasDiscount && <span className="text-3xl text-white/10 line-through font-bold">R$ {formatPrice(course.price_base)}</span>}
                                        <span className="text-7xl lg:text-9xl font-black italic tracking-tighter text-white drop-shadow-[0_0_50px_rgba(212,175,55,0.2)]">R$ {formatPrice(course.price_offer)}</span>
                                    </div>
                                </div>
                                <button onClick={handlePurchase} className="group relative px-24 py-10 bg-white text-black font-black text-2xl uppercase tracking-widest hover:bg-[#d4af37] transition-all transform hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(212,175,55,0.3)]">
                                    BORA SER VIP
                                    <span className="absolute inset-0 border border-white translate-x-3 translate-y-3 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform"></span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Features Grid */}
                    <section className="max-w-7xl mx-auto px-6 py-40">
                        <div className="grid lg:grid-cols-2 gap-32 items-center">
                            <div className="space-y-16">
                                <h2 className="text-6xl lg:text-8xl font-black uppercase leading-none text-white tracking-tighter">O SEGREDO <br /> <span className="text-[#d4af37] italic">DA POSSE.</span></h2>
                                <div className="space-y-12">
                                    {FeaturesPremium.map((f, i) => (
                                        <div key={i} className="flex gap-10 items-start group border-l-2 border-white/5 pl-10 hover:border-[#d4af37] transition-colors">
                                            <span className="material-symbols-outlined text-4xl text-[#d4af37] opacity-40 group-hover:opacity-100 transition-opacity">{f.icon}</span>
                                            <div className="space-y-3">
                                                <h4 className="text-2xl font-black uppercase text-white tracking-widest">{f.title}</h4>
                                                <p className="text-lg text-neutral-500 font-medium leading-relaxed italic">{f.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative group perspective-1000">
                                <div className="absolute -inset-10 bg-[#d4af37]/5 blur-[120px] rounded-full group-hover:bg-[#d4af37]/10 transition-all duration-1000"></div>
                                <div className="rounded-[60px] overflow-hidden border border-white/10 shadow-huge rotate-y-[-12deg] group-hover:rotate-y-0 transition-all duration-1000 relative">
                                    <img src={course.banner_url} className="w-full aspect-[4/5] object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="py-20 text-center border-t border-white/5 opacity-20 text-[10px] uppercase font-black tracking-[1em]">
                    Bora Passar Agora • Premium Academic Experience • 2026
                </footer>
            </div>
        );
    };

    const ModernTech = () => {
        const FeaturesTech = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Suporte técnico e pedagógico direto.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Acesso instantâneo ao material de estudo.', icon: 'auto_stories' },
            { title: 'Simulados Online', desc: 'Pratique com cronômetro e ranking.', icon: 'quiz' },
            { title: 'Banco de Dados', desc: 'Milhares de questões mapeadas.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-[#050508] text-indigo-400 font-mono p-4 lg:p-12 overflow-hidden selection:bg-indigo-500 selection:text-white">
                <div className="max-w-[1600px] mx-auto min-h-[90vh] border-2 border-indigo-500/20 rounded-[40px] overflow-hidden bg-[#0a0a14] flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative">
                    {/* Efeitos de Fundo */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"></div>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-indigo-500 to-transparent animate-scanline"></div>
                        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-indigo-500 to-transparent animate-scanline delay-1000"></div>
                    </div>

                    <div className="h-16 bg-[#0f0f1f] flex items-center px-6 lg:px-10 border-b border-indigo-500/10 justify-between z-10">
                        <div className="flex items-center gap-6">
                            <div className="flex gap-2">
                                <div className="size-3 rounded-full bg-red-500/40"></div>
                                <div className="size-3 rounded-full bg-yellow-500/40"></div>
                                <div className="size-3 rounded-full bg-green-500/40"></div>
                            </div>
                            <img src="/bora_passar_logo.png" className="h-6 brightness-0 invert sepia(1) saturate(5) hue-rotate-[240deg] contrast(1.2)" alt="Logo" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hidden md:block">bpa_nucleo_v3.0.estabilidade</span>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto">
                        <div className="flex-1 p-8 lg:p-24 space-y-12">
                            <div className="space-y-4">
                                <span className="text-indigo-500 bg-indigo-500/10 px-4 py-1 rounded text-[10px] animate-pulse font-bold tracking-widest">$ comando_executado --posse_imediata</span>
                                <h1 className="text-5xl lg:text-8xl font-black text-white leading-none uppercase tracking-tighter">
                                    INICIAR <br /> <span className="text-indigo-500 italic">APROVAÇÃO</span>
                                </h1>
                                <p className="text-xl text-indigo-300/60 max-w-xl font-bold uppercase tracking-widest underline decoration-indigo-500/30">{course.title}</p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                {Stats.map((s, i) => (
                                    <div key={i} className="p-6 bg-black/40 border border-indigo-500/10 rounded-2xl group hover:border-indigo-500/40 transition-all text-center">
                                        <p className="text-[9px] font-black uppercase opacity-30 group-hover:opacity-100 transition-opacity tracking-widest">{s.label}</p>
                                        <p className="text-3xl font-black text-white mt-1 italic group-hover:scale-110 transition-transform">{s.val}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl space-y-6">
                                <p className="text-indigo-500 font-black text-[10px] uppercase tracking-widest animate-pulse">&gt; módulos_ativos_do_preparatório:</p>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {FeaturesTech.map((f, i) => (
                                        <div key={i} className="flex gap-4 items-center">
                                            <span className="text-green-500 font-black text-[10px]">[OK]</span>
                                            <div>
                                                <p className="text-sm text-white font-black uppercase tracking-wider">{f.title}</p>
                                                <p className="text-[10px] text-indigo-400/50 uppercase leading-relaxed">{f.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row items-center gap-12 pt-10 border-t border-white/5">
                                <div className="space-y-2 text-center lg:text-left flex flex-col items-center lg:items-start">
                                    <PromoBadge className="mb-4" />
                                    {course.coupon_name && <p className="text-[10px] font-black uppercase tracking-widest text-[#00ffc3] animate-pulse">CÓDIGO_VITAL: {course.coupon_name}</p>}
                                    <div className="flex flex-col">
                                        {hasDiscount && <span className="text-2xl text-white/10 line-through font-black italic italic leading-none">R$ {formatPrice(course.price_base)}</span>}
                                        <span className="text-7xl lg:text-9xl font-black text-white italic tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]">R$ {formatPrice(course.price_offer)}</span>
                                    </div>
                                </div>
                                <button onClick={handlePurchase} className="w-full lg:w-auto px-20 py-8 bg-indigo-600 text-white font-black text-2xl rounded-2xl hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-all active:scale-95 border-b-4 border-indigo-800 uppercase tracking-widest">EXECUTAR_SISTEMA ↗</button>
                            </div>
                        </div>
                        <div className="w-full lg:w-[45%] bg-black relative flex items-center justify-center p-12 lg:border-l border-indigo-500/10 min-h-[400px]">
                            <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full"></div>
                            <img src={course.banner_url} className="max-w-full rounded-2xl relative z-10 border-2 border-indigo-500/20 shadow-2xl transition-all hover:scale-105 duration-1000" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none z-20"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const Creative = () => {
        const FeaturesCreative = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-pink-500 text-black font-sans p-6 lg:p-12 overflow-x-hidden selection:bg-yellow-400">
                <div className="max-w-[1400px] mx-auto space-y-12">
                    <nav className="h-24 bg-white border-[8px] border-black p-8 flex justify-between items-center shadow-[15px_15px_0_#000] rotate-[-1deg] transition-transform hover:rotate-0">
                        <img src="/bora_passar_logo.png" className="h-6 invert" alt="" />
                        <button onClick={handlePurchase} className="px-10 py-3 bg-black text-white font-black text-sm uppercase skew-x-[-10deg]">QUERO AGORA!</button>
                    </nav>
                    <div className="grid lg:grid-cols-12 gap-12">
                        <section className="lg:col-span-8 bg-yellow-400 border-[12px] border-black p-12 lg:p-24 space-y-12 shadow-[20px_20px_0_#000] rotate-[1deg] transition-transform hover:rotate-0">
                            <span className="inline-block bg-black text-white px-6 py-2 font-black text-lg skew-x-[-20deg]">#PROJETO_POSSE_MÁXIMA</span>
                            <h1 className="text-7xl lg:text-[160px] font-black leading-[0.7] tracking-tighter uppercase italic -ml-4 underline group cursor-default">
                                BORA <br /> <span className="text-pink-600">PASSAR</span> <br /> AGORA!
                            </h1>
                            <p className="text-2xl font-black uppercase tracking-widest bg-white border-4 border-black px-6 py-4 inline-block -rotate-2">{course.title}</p>

                            <div className="flex flex-col gap-4">
                                <PromoBadge className="mb-2 rotate-2 scale-110 z-20" />
                                {course.coupon_name && <p className="text-xs font-black uppercase tracking-widest bg-black text-white px-4 py-1 w-fit rotate-2 mt-4">CUPOM: {course.coupon_name}</p>}
                                <div className="flex flex-wrap items-end gap-10">
                                    <div className="flex flex-col">
                                        {hasDiscount && <span className="text-3xl font-black text-black/20 line-through -mb-4 ml-6 rotate-[-5deg] z-10">R${formatPrice(course.price_base)}</span>}
                                        <span className="text-[140px] font-black italic tracking-tighter leading-none text-white drop-shadow-[10px_10px_0_#000]">R${formatPrice(course.price_offer)}</span>
                                    </div>
                                    <button onClick={handlePurchase} className="mb-6 px-16 py-10 bg-black text-white font-black text-4xl uppercase hover:translate-x-4 hover:translate-y-4 hover:shadow-none shadow-[20px_20px_0_#f472b6] transition-all active:scale-95 leading-none">GO!!! 🎯</button>
                                </div>
                            </div>
                        </section>
                        <div className="lg:col-span-4 flex flex-col gap-12">
                            <div className="flex-1 bg-white border-[8px] border-black p-10 flex flex-col justify-center items-center text-center shadow-[15px_15px_0_#000] -rotate-3 transition-transform hover:rotate-0 gap-6">
                                <img src={course.banner_url} className="w-full border-4 border-black grayscale group-hover:grayscale-0" alt="" />
                                <div className="space-y-2">{Stats.map((s, i) => (<div key={i} className="flex justify-between items-center gap-10 font-black uppercase text-xl"><span>{s.label}:</span> <span className="text-pink-500">{s.val}</span></div>))}</div>
                            </div>
                            <div className="bg-cyan-400 border-[8px] border-black p-10 shadow-[15px_15px_0_#000] rotate-2 transition-transform hover:rotate-0">
                                <h4 className="font-black uppercase text-3xl mb-8 border-b-8 border-black pb-4">POR QUE NÓS?</h4>
                                <div className="space-y-6">{FeaturesCreative.map((f, i) => (<div key={i} className="flex items-center gap-6 font-black uppercase text-xs group"><span className="size-8 bg-black text-white flex items-center justify-center shrink-0 group-hover:rotate-45 transition-transform">{i + 1}</span> {f.title}</div>))}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const Classic = () => {
        const FeaturesClassic = [
            { title: 'Atendimento especializado ao Aluno', desc: 'Canal direto para tirar dúvidas com nossos especialistas.', icon: 'support_agent' },
            { title: 'Apostilas Digitais', desc: 'Material estratégico otimizado para sua leitura rápida.', icon: 'auto_stories' },
            { title: 'Simulados de Elite', desc: 'Treine com questões inéditas no tempo real da prova.', icon: 'quiz' },
            { title: 'Banco de Questões', desc: 'Milhares de itens comentados e mapeados por assunto.', icon: 'database' }
        ];

        return (
            <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-blue-900 selection:text-white">
                <header className="bg-[#0f172a] py-32 text-center text-white space-y-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                    <img src="/bora_passar_logo.png" className="h-12 brightness-0 invert mx-auto mb-10 transition-transform hover:scale-105" alt="Logo" />
                    <div className="max-w-5xl mx-auto space-y-6 relative z-10">
                        <span className="text-red-500 font-black text-xs lg:text-sm uppercase tracking-[0.3em] border-y border-red-500/20 py-4 px-10 inline-block">Mátriculas Abertas – Temporada 2026</span>
                        <h1 className="text-5xl lg:text-[100px] font-black leading-[0.9] tracking-tight uppercase">CURSO PREPARATÓRIO <br /> <span className="text-transparent border border-white/40 px-6 py-2 mt-4 inline-block -skew-x-6 italic" style={{ WebkitTextFillColor: 'transparent', WebkitTextStroke: '2px white' }}>{course.title}</span></h1>
                    </div>
                    <p className="text-xl lg:text-2xl font-bold opacity-40 max-w-2xl mx-auto relative z-10">Método focado na sua aprovação!</p>
                    <div className="flex flex-wrap justify-center gap-10 lg:gap-20 py-10 relative z-10">
                        {Stats.map((s, i) => (<div key={i} className="text-center group cursor-default"><p className="text-4xl lg:text-6xl font-black group-hover:text-red-500 transition-colors">{s.val}</p><p className="text-[10px] uppercase font-black tracking-widest opacity-30">{s.label}</p></div>))}
                    </div>

                    <div className="max-w-4xl mx-auto px-6 relative z-10 mt-10">
                        <div className="p-4 bg-white/5 border-4 border-white/10 rounded-[40px] shadow-2xl overflow-hidden group">
                            <img src={course.banner_url} className="w-full rounded-[30px] group-hover:scale-105 transition-transform duration-[3000ms]" alt="Banner" />
                        </div>
                    </div>
                </header>

                <main className="max-w-6xl mx-auto px-6 py-40 grid lg:grid-cols-12 gap-20">
                    <div className="lg:col-span-7 space-y-20">
                        <div className="space-y-8">
                            <h2 className="text-4xl lg:text-5xl font-black text-blue-950 uppercase border-l-[12px] border-red-600 pl-10 tracking-widest">Aqui você tem:</h2>
                            <div className="grid sm:grid-cols-2 gap-8">
                                {FeaturesClassic.map((f, i) => (
                                    <div key={i} className="bg-slate-50 p-10 rounded-2xl border border-slate-100 space-y-6 hover:shadow-xl transition-all group">
                                        <span className="material-symbols-outlined text-6xl text-blue-900 group-hover:scale-110 transition-transform">{f.icon}</span>
                                        <div>
                                            <p className="font-black text-xl text-blue-950">{f.title}</p>
                                            <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed uppercase tracking-widest">{f.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-5">
                        <div className="sticky top-40 bg-white border border-slate-100 p-10 lg:p-16 text-center space-y-12 shadow-huge transform hover:-translate-y-4 transition-all rounded-[40px]">
                            <div className="space-y-2 flex flex-col items-center">
                                <PromoBadge className="mb-6 -mt-6" />
                                <p className="font-black uppercase tracking-widest text-slate-400 text-[10px]">Investimento na Carreira:</p>
                                <div className="flex flex-col items-center gap-2">
                                    {hasDiscount && <span className="text-2xl line-through text-slate-200 font-bold decoration-red-500">R$ {formatPrice(course.price_base)}</span>}
                                    <span className="text-7xl lg:text-8xl font-black text-blue-950 tracking-tighter leading-none">R$ {formatPrice(course.price_offer)}</span>
                                </div>
                            </div>
                            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                <p className="text-red-600 font-black text-[10px] uppercase tracking-widest leading-relaxed">⚠️ Atenção: Últimas vagas com este valor!</p>
                            </div>
                            <button onClick={handlePurchase} className="w-full py-10 bg-red-600 text-white font-black text-2xl rounded-3xl shadow-[0_20px_60px_rgba(220,38,38,0.3)] hover:bg-red-700 transition-all uppercase active:scale-95 leading-none tracking-widest">MATRICULAR-SE AGORA</button>
                            <div className="flex items-center justify-center gap-6 opacity-40">
                                <span className="material-symbols-outlined text-4xl text-blue-950">verified_user</span>
                                <span className="text-left leading-none font-bold text-[10px] uppercase italic">Acesso 100% Seguro <br /> 7 Dias de Garantia</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    };

    const ModelSwitcher = () => {
        switch (course.lp_model) {
            case 'minimalist': return <Minimalist />;
            case 'futuristic': return <Futuristic />;
            case 'executive': return <Executive />;
            case 'energetic': return <Energetic />;
            case 'nature': return <Nature />;
            case 'premium': return <Premium />;
            case 'modern_tech': return <ModernTech />;
            case 'creative': return <Creative />;
            case 'classic': return <Classic />;
            default: return <Standard />;
        }
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
