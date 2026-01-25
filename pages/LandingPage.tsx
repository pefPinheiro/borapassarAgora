
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface LandpageData {
    id: string;
    titulo: string;
    slug: string;
    body_content: string;
    curso_id: string;
    courses?: {
        id: string;
        title: string;
        price_offer: number;
        price_base: number;
        banner_url: string;
        cargo: string;
        area: string;
        description: string;
    }
}

interface CourseCounts {
    apostilas: number;
    simulados: number;
    materiais: number;
}

const CampaignLandingPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [lp, setLp] = useState<LandpageData | null>(null);
    const [counts, setCounts] = useState<CourseCounts>({ apostilas: 0, simulados: 0, materiais: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [slug]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('landpages')
                .select('*, courses(*)')
                .eq('slug', slug)
                .single();

            if (error) throw error;
            setLp(data);

            if (data.curso_id) {
                const [aps, sims, mats] = await Promise.all([
                    supabase.from('course_items').select('id', { count: 'exact', head: true }).eq('course_id', data.curso_id),
                    supabase.from('course_simulados').select('id', { count: 'exact', head: true }).eq('course_id', data.curso_id),
                    supabase.from('course_materials').select('id', { count: 'exact', head: true }).eq('course_id', data.curso_id)
                ]);
                setCounts({
                    apostilas: aps.count || 0,
                    simulados: sims.count || 0,
                    materiais: mats.count || 0
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = () => {
        if (lp?.curso_id) {
            navigate(`/login?redirect=/aluno/curso/${lp.curso_id}/checkout`);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Header */}
            <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-8 md:px-20 max-w-7xl mx-auto w-full bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <img src="/bora_passar_logo.png" alt="Logo" className="h-10 w-auto" />
                </div>
                <button onClick={handleBuy} className="px-8 py-2.5 bg-[#137fec] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">Garantir Minha Vaga</button>
            </nav>

            {/* Robust Product Hero */}
            <header className="bg-slate-50 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                    <div className="lg:col-span-7 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-[#137fec] rounded-full text-[10px] font-black uppercase tracking-widest">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            Conteúdo 100% Verificado • {lp?.courses?.area}
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[0.95] tracking-tighter">
                            {lp?.titulo}
                        </h1>

                        {/* Course Specs Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm text-center">
                                <p className="text-2xl font-black text-[#137fec]">{counts.apostilas}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Apostilas</p>
                            </div>
                            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm text-center">
                                <p className="text-2xl font-black text-[#137fec]">{counts.simulados}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Simulados</p>
                            </div>
                            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm text-center">
                                <p className="text-2xl font-black text-[#137fec]">{counts.materiais}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Materiais</p>
                            </div>
                        </div>

                        <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-xl">
                            Acesso imediato à plataforma com materiais focados no cargo de <span className="text-slate-900 font-black italic">{lp?.courses?.cargo}</span>.
                        </p>
                    </div>

                    <div className="lg:col-span-5">
                        <div className="bg-white p-6 rounded-[48px] shadow-2xl border border-slate-100 space-y-6">
                            <div className="relative aspect-video rounded-[32px] overflow-hidden bg-slate-100 border border-slate-100">
                                <img src={lp?.courses?.banner_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1470&auto=format&fit=crop'} className="size-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                                <div className="absolute bottom-4 left-6 flex items-center gap-2">
                                    <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-white text-[9px] font-black uppercase tracking-widest">Inscrições Abertas</span>
                                </div>
                            </div>

                            <div className="space-y-4 px-2">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest line-through">De R$ {lp?.courses?.price_base?.toFixed(2).replace('.', ',')}</p>
                                        <p className="text-4xl font-black text-slate-900">R$ {lp?.courses?.price_offer?.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Oferta Especial</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBuy}
                                    className="w-full py-5 bg-[#137fec] text-white rounded-[24px] font-black text-sm shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    Quero me Matricular
                                    <span className="material-symbols-outlined">bolt</span>
                                </button>
                                <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">Acesso por 365 dias • Garantia de 7 dias</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Body Content */}
            <main className="max-w-4xl mx-auto px-8 py-24 animate-in fade-in duration-1000">
                <div
                    className="prose prose-slate prose-lg max-w-none 
                    prose-headings:text-slate-900 prose-headings:font-black 
                    prose-p:text-slate-600 prose-p:leading-relaxed
                    prose-strong:text-slate-900 
                    prose-img:rounded-[40px] prose-img:shadow-2xl
                    prose-li:marker:text-[#137fec]"
                    dangerouslySetInnerHTML={{ __html: lp?.body_content }}
                />

                <div className="mt-24 p-12 bg-slate-900 rounded-[48px] text-white overflow-hidden relative group">
                    <div className="absolute -top-10 -right-10 size-60 bg-blue-600 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div className="relative z-10 text-center space-y-8">
                        <h2 className="text-4xl font-black leading-tight italic">Sua aprovação começa com o <br /> primeiro passo.</h2>
                        <button
                            onClick={handleBuy}
                            className="inline-flex px-16 py-6 bg-white text-slate-900 rounded-[28px] font-black text-xl shadow-2xl hover:scale-[1.05] active:scale-95 transition-all items-center gap-3 uppercase tracking-widest"
                        >
                            Quero o curso agora
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                        <div className="flex justify-center gap-12 pt-8 opacity-40 grayscale">
                            <span className="text-[10px] font-black uppercase tracking-widest italic">Pagamento Seguro</span>
                            <span className="text-[10px] font-black uppercase tracking-widest italic">Acesso Imediato</span>
                            <span className="text-[10px] font-black uppercase tracking-widest italic">7 dias de Garantia</span>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-20 border-t border-slate-100 text-center">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">&copy; 2026 Bora Passar Agora • Todos os direitos reservados</p>
                <div className="flex justify-center gap-8 mt-6">
                    <img src="/bcode_logo.png" className="h-3 opacity-20 grayscale" alt="Bcode" />
                </div>
            </footer>
        </div>
    );
};

export default CampaignLandingPage;
