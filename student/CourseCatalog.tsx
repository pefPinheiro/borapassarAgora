
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Curso {
    id: string;
    title: string;
    description: string;
    banner_url: string;
    price_base: number;
    price_offer: number;
    status: 'Ativo' | 'Rascunho';
    cargo: string;
    area: string;
    state?: string;
    is_notice_open?: boolean;
    bancas?: {
        name: string;
    };
}

const CourseCatalog: React.FC = () => {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('Todos');
    const [stateFilter, setStateFilter] = useState('Brasil');
    const [onlyNoticeOpen, setOnlyNoticeOpen] = useState(false);
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchCursos();
    }, []);

    const fetchCursos = async () => {
        setLoading(true);
        try {
            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser();
            let enrolledIds: string[] = [];

            // 2. If logged in, get enrolled courses
            if (user) {
                const { data: enrolled } = await supabase
                    .from('enrollments')
                    .select('course_id')
                    .eq('profile_id', user.id)
                    .eq('status', 'Ativo'); // Only filter out Active courses

                if (enrolled) {
                    enrolledIds = enrolled.map((e: any) => e.course_id);
                }
            }

            // 3. Fetch all active courses
            const { data, error } = await supabase
                .from('courses')
                .select(`
                    *,
                    bancas(name)
                `)
                .eq('status', 'Ativo')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // 4. Filter out enrolled courses
            const available = (data || []).filter(c => !enrolledIds.includes(c.id));
            setCursos(available);
        } catch (e) {
            console.error('Error fetching courses:', e);
        } finally {
            setLoading(false);
        }
    };

    const filters = ['Todos', ...Array.from(new Set(cursos.map(c => c.area))), ...Array.from(new Set(cursos.map(c => c.bancas?.name || '')))].filter(f => f !== '').slice(0, 8);

    const filteredCursos = cursos.filter(c =>
        (c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.cargo.toLowerCase().includes(search.toLowerCase()) ||
            (c.bancas?.name || '').toLowerCase().includes(search.toLowerCase())) &&
        (activeFilter === 'Todos' || c.area === activeFilter || c.bancas?.name === activeFilter) &&
        (stateFilter === 'Brasil' || c.state === stateFilter || c.state === 'Nacional') &&
        (!onlyNoticeOpen || c.is_notice_open)
    );

    return (
        <div className="flex flex-col gap-12 pb-24 animate-in fade-in duration-700 bg-[#f9fafb]">
            {/* Vibrant Header Section */}
            <div className="relative p-12 bg-slate-900 rounded-[54px] overflow-hidden text-white flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#137fec] rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#ff3b9a] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

                <div className="space-y-4 relative z-10 text-center md:text-left">
                    <h2 className="text-[11px] font-black text-[#ff3b9a] uppercase tracking-[0.5em]">Academia de Elite</h2>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
                        Explore seu <br /><span className="text-[#137fec]">Próximo Nível.</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-lg italic pr-10">Filtre por área ou banca e encontre sua trilha para a aprovação.</p>
                </div>

                <div className="relative z-10 flex flex-col items-center bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-2xl min-w-[200px]">
                    <span className="material-symbols-outlined text-[#ff3b9a] text-4xl mb-4 animate-bounce-slow">workspace_premium</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cursos Liberados</p>
                    <p className="text-3xl font-black text-[#137fec]">{cursos.length}</p>
                </div>
            </div>

            {/* Search & Dynamic Filters */}
            <div className="flex flex-col gap-8 px-4">
                <div className="flex flex-col xl:flex-row gap-6 items-stretch xl:items-center w-full">
                    <div className="relative flex-1 group">
                        <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ff3b9a] transition-colors text-2xl">search</span>
                        <input
                            type="text"
                            placeholder="Busca rápida por cargo ou banca..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-18 pl-16 pr-8 bg-white border border-slate-200 rounded-[30px] outline-none focus:ring-12 focus:ring-[#137fec]/5 focus:border-[#137fec] transition-all font-black text-slate-900 shadow-sm placeholder:text-slate-300 placeholder:font-bold"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative min-w-[180px]">
                            <select
                                value={stateFilter}
                                onChange={(e) => setStateFilter(e.target.value)}
                                className="w-full h-18 px-8 bg-white border border-slate-200 rounded-[30px] outline-none appearance-none font-black text-[10px] uppercase tracking-widest text-slate-700 cursor-pointer focus:border-[#137fec] transition-all"
                            >
                                {['Brasil', 'Nacional', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                    <option key={uf} value={uf}>{uf === 'Brasil' ? '🌎 Todos Estados' : uf}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>

                        <button
                            onClick={() => setOnlyNoticeOpen(!onlyNoticeOpen)}
                            className={`h-18 px-8 rounded-[30px] flex items-center gap-3 transition-all duration-300 font-black text-[10px] uppercase tracking-widest border ${onlyNoticeOpen
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-500 hover:text-emerald-500'
                                }`}
                        >
                            <span className="material-symbols-outlined">{onlyNoticeOpen ? 'check_circle' : 'notifications_active'}</span>
                            Edital Aberto
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar w-full">
                    <button
                        onClick={() => setActiveFilter('Todos')}
                        className={`px-10 py-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${activeFilter === 'Todos'
                            ? 'bg-[#ff3b9a] text-white shadow-xl shadow-pink-500/20 scale-105'
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-[#137fec] hover:text-[#137fec]'
                            }`}
                    >
                        {activeFilter === 'Todos' && <span className="material-symbols-outlined text-sm">check_circle</span>}
                        Todos
                    </button>
                    {filters.filter(f => f !== 'Todos').map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-10 py-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${activeFilter === filter
                                ? 'bg-[#ff3b9a] text-white shadow-xl shadow-pink-500/20 scale-105'
                                : 'bg-white text-slate-400 border border-slate-100 hover:border-[#137fec] hover:text-[#137fec]'
                                }`}
                        >
                            {activeFilter === filter && <span className="material-symbols-outlined text-sm">check_circle</span>}
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de Cursos - Vibrant Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-[520px] bg-slate-100 rounded-[54px] animate-pulse"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-4">
                    {filteredCursos.map((curso) => {
                        const discount = Math.round(((curso.price_base - curso.price_offer) / curso.price_base) * 100);

                        return (
                            <div
                                key={curso.id}
                                onClick={() => navigate(`/aluno/curso/${curso.id}/comprar`)}
                                className="group bg-white rounded-[60px] border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_100px_-20px_rgba(19,127,236,0.15)] transition-all duration-700 overflow-hidden flex flex-col h-full cursor-pointer relative"
                            >
                                {/* Course Image Area */}
                                <div className="relative aspect-video overflow-hidden p-4 pb-0">
                                    <div className="relative h-full rounded-[48px] overflow-hidden shadow-2xl">
                                        <img
                                            src={curso.banner_url || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1470&auto=format&fit=crop'}
                                            alt={curso.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 origin-center"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

                                        <div className="absolute top-6 left-6 flex items-center gap-2">
                                            <div className="px-5 py-2 bg-white/95 backdrop-blur-md text-slate-900 text-[10px] font-black uppercase rounded-[18px] shadow-xl tracking-[0.2em] flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm text-[#137fec]">location_on</span>
                                                {curso.state || 'Nacional'}
                                            </div>
                                        </div>

                                        {discount > 0 && (
                                            <div className="absolute top-6 right-6 px-6 py-3 bg-[#ff3b9a] text-white text-xs font-black uppercase rounded-[20px] shadow-[0_10px_30px_-5px_rgba(255,59,154,0.5)] tracking-[0.2em] animate-bounce-slow">
                                                {discount}% OFF
                                            </div>
                                        )}

                                        {curso.is_notice_open && (
                                            <div className="absolute bottom-6 left-8 flex flex-col gap-1">
                                                <p className="text-[9px] font-black text-[#137fec] uppercase tracking-[0.3em]">Status</p>
                                                <p className="text-white font-black uppercase italic tracking-tighter text-lg leading-none">Edital Aberto</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="p-10 flex flex-col flex-1 gap-6">
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] font-black text-[#137fec] uppercase tracking-[0.2em] bg-[#137fec]/10 px-4 py-1.5 rounded-full">
                                            {curso.area}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-4 py-1.5 rounded-full">
                                            {curso.cargo}
                                        </span>
                                    </div>

                                    <h3 className="text-3xl font-black text-slate-900 leading-[1] tracking-tighter group-hover:text-[#ff3b9a] transition-colors uppercase italic line-clamp-2">
                                        {curso.title}
                                    </h3>

                                    <p className="text-slate-400 leading-relaxed font-medium text-sm line-clamp-3 italic">
                                        Inclui: Apostilas Interativas, Questões Comentadas, Mapas Mentais, Simulados de Elite e Plano de Estudo.
                                    </p>

                                    <div className="mt-auto pt-10 border-t border-slate-50 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-300 line-through font-black uppercase tracking-widest pl-1">R$ {curso.price_base?.toFixed(2).replace('.', ',')}</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xs font-black text-slate-900 uppercase">R$</span>
                                                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{curso.price_offer?.toFixed(2).replace('.', ',')}</span>
                                            </div>
                                        </div>
                                        <div className="size-18 bg-slate-900 text-white rounded-[32px] flex items-center justify-center group-hover:bg-[#137fec] transition-all duration-500 shadow-2xl group-hover:scale-110 active:scale-95">
                                            <span className="material-symbols-outlined text-4xl font-black">add_shopping_cart</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && filteredCursos.length === 0 && (
                <div className="py-40 flex flex-col items-center justify-center text-center gap-10 bg-white rounded-[80px] border-2 border-dashed border-slate-100 animate-in zoom-in-95 px-10">
                    <div className="size-32 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 border border-slate-100 shadow-inner">
                        <span className="material-symbols-outlined text-6xl font-black">find_in_page</span>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Nenhuma trilha encontrada</h3>
                        <p className="text-slate-400 font-medium text-lg italic max-w-sm mx-auto">Tente ajustar seus filtros ou termos de pesquisa para outras fardas.</p>
                    </div>
                    <button
                        onClick={() => { setSearch(''); setActiveFilter('Todos'); }}
                        className="px-14 py-6 bg-[#ff3b9a] text-white rounded-[28px] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-900 hover:scale-105 transition-all shadow-2xl shadow-pink-500/20"
                    >
                        Resetar Busca
                    </button>
                </div>
            )}

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default CourseCatalog;
