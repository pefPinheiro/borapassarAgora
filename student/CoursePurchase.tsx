
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const CoursePurchase: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [enrolling, setEnrolling] = useState(false);

    const [stats, setStats] = useState({
        apostilas: 0,
        questions: 0,
        simulados: 0,
        cadernos: 0,
        resolvidos: 0,
        disciplinas: [] as string[]
    });
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            fetchCourse();
            checkEnrollment();
            fetchStats();
        }
    }, [id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsInfoModalOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const fetchStats = async () => {
        try {
            // Conta apostilas vinculadas ao curso via course_items
            const { count: itemsCount, data: itemsData } = await supabase
                .from('course_items')
                .select('apostila_id', { count: 'exact' })
                .eq('course_id', id);

            const apostilaIds = itemsData?.map(a => a.apostila_id).filter(Boolean) || [];

            // Conta simulados vinculados via course_simulados
            const { count: simuladosCount } = await supabase
                .from('course_simulados')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', id);

            // Conta todas as questões do banco de dados (conforme solicitado)
            const { count: totalQuestionsCount } = await supabase
                .from('questions')
                .select('*', { count: 'exact', head: true });

            // Busca detalhes das apostilas vinculadas para extrair disciplinas e contagem de cadernos resolvidos
            let resolvedCount = 0;
            let uniqueDisciplinas: string[] = [];
            if (apostilaIds.length > 0) {
                const { data: apsWithDetails } = await supabase
                    .from('apostilas')
                    .select('is_resolution_notebook, disciplinas(name)')
                    .in('id', apostilaIds);

                uniqueDisciplinas = Array.from(new Set(
                    apsWithDetails?.map((a: any) => a.disciplinas?.name).filter(Boolean)
                )) as string[];

                resolvedCount = apsWithDetails?.filter((a: any) => a.is_resolution_notebook).length || 0;
            }

            // Conta cadernos vinculados às apostilas
            let totalCadernosCount = 0;
            if (apostilaIds.length > 0) {
                const { count: nbCount } = await supabase
                    .from('notebooks')
                    .select('*', { count: 'exact', head: true })
                    .in('apostila_id', apostilaIds);
                totalCadernosCount = nbCount || 0;
            }

            setStats({
                apostilas: itemsCount || 0,
                questions: totalQuestionsCount || 0,
                simulados: simuladosCount || 0,
                cadernos: totalCadernosCount || 0,
                resolvidos: resolvedCount || 0,
                disciplinas: uniqueDisciplinas
            });
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    };

    const fetchCourse = async () => {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*, bancas(name)')
                .eq('id', id)
                .single();

            if (error) throw error;
            setCourse(data);
        } catch (e) {
            console.error('Error fetching course:', e);
        } finally {
            setLoading(false);
        }
    };

    const checkEnrollment = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
            .from('enrollments')
            .select('id, status')
            .eq('course_id', id)
            .eq('profile_id', session.user.id)
            .maybeSingle();

        if (data && data.status === 'Ativo') setIsEnrolled(true);
    };

    const handleEnrollFree = async () => {
        setEnrolling(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate(`/login?redirect=/aluno/curso/${id}/comprar`);
                return;
            }

            const { error } = await supabase
                .from('enrollments')
                .insert([
                    { course_id: id, profile_id: session.user.id, status: 'Ativo', progress: 0 }
                ]);

            if (error) throw error;
            setIsEnrolled(true);
            navigate(`/aluno/curso/${id}`);
        } catch (e) {
            console.error('Error enrolling:', e);
            alert('Erro ao realizar inscrição gratuita.');
        } finally {
            setEnrolling(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="size-12 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
        </div>
    );

    if (!course) return <div className="p-20 text-center font-black uppercase text-slate-400">Curso não encontrado</div>;

    const isFree = course.price_offer === 0;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-700">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-500 hover:text-[#137fec] transition-colors font-bold mb-8"
            >
                <span className="material-symbols-outlined">arrow_back</span>
                Voltar
            </button>

            <div className="flex flex-col lg:flex-row gap-12">
                {/* Visual Section */}
                <div className="flex-1 space-y-8">
                    <div className="aspect-video rounded-[40px] overflow-hidden shadow-2xl relative">
                        <img
                            src={course.banner_url || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1470&auto=format&fit=crop'}
                            alt={course.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-8 left-8">
                            <span className="px-4 py-2 bg-white/20 backdrop-blur-md text-white text-xs font-black uppercase rounded-xl border border-white/30 mb-4 inline-block">
                                {course.bancas?.name || 'Oficial'}
                            </span>
                            <h1 className="text-4xl font-black text-white leading-tight">
                                {course.title}
                            </h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { icon: 'description', title: 'Apostilas Interativas', text: 'Material completo focado no edital.' },
                            { icon: 'quiz', title: 'Banco de Questões', text: 'Questões comentadas por especialistas.' },
                            { icon: 'verified', title: 'Garantia de 7 dias', text: 'Satisfação garantida ou seu dinheiro de volta.' },
                            { icon: 'schedule', title: 'Acesso Imediato', text: 'Comece a estudar agora mesmo.' },
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white rounded-3xl border border-slate-100 flex gap-4">
                                <div className="size-12 bg-blue-50 text-[#137fec] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900">{item.title}</h3>
                                    <p className="text-sm text-slate-500 font-medium">{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Checkout Card */}
                <div className="lg:w-[400px] shrink-0">
                    <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-2xl shadow-blue-500/5 sticky top-8">
                        <div className="mb-8">
                            {!isFree && course.price_base > course.price_offer && (
                                <p className="text-slate-400 font-bold line-through">De R$ {course.price_base?.toFixed(2).replace('.', ',')}</p>
                            )}
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">{isFree ? 'Valor' : 'Por R$'}</span>
                                <span className={`${isFree ? 'text-emerald-500' : 'text-slate-900'} text-5xl font-black tracking-tighter`}>
                                    {isFree ? 'GRÁTIS' : course.price_offer?.toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                            {!isFree && course.price_base > course.price_offer && (
                                <p className="text-emerald-500 text-sm font-black uppercase mt-2">Sua oportunidade de aprovação!</p>
                            )}
                        </div>

                        <div className="space-y-4 mb-8">
                            {isEnrolled ? (
                                <button
                                    onClick={() => navigate(`/aluno/curso/${id}`)}
                                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest cursor-pointer"
                                >
                                    Já Inscrito • Ver Curso
                                    <span className="material-symbols-outlined">play_circle</span>
                                </button>
                            ) : isFree ? (
                                <button
                                    onClick={handleEnrollFree}
                                    disabled={enrolling}
                                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                                >
                                    {enrolling ? 'Inscrevendo...' : 'Resgatar Gratuitamente'}
                                    <span className="material-symbols-outlined">bolt</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate(`/aluno/curso/${course.id}/checkout`)}
                                    className="w-full py-5 bg-[#137fec] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-[#0e69c5] hover:scale-[1.05] hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest cursor-pointer"
                                >
                                    Fazer Inscrição
                                    <span className="material-symbols-outlined">shopping_cart</span>
                                </button>
                            )}

                            {/* Novo Botão de Informações do Curso */}
                            <button
                                type="button"
                                onClick={() => setIsInfoModalOpen(true)}
                                className="w-full py-4.5 bg-slate-50 hover:bg-blue-50/50 text-slate-700 hover:text-[#137fec] rounded-2xl font-black text-xs border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">info</span>
                                Informações do Curso
                            </button>

                            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{isFree ? 'Acesso 100% Livre' : ''}</p>
                        </div>

                        <div className="pt-8 border-t border-slate-50 space-y-6">
                            {/* Destaque Apostilas, Simulados e Questões */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col items-center text-center">
                                    <span className="text-blue-600 font-black text-lg leading-none mb-1">{stats.apostilas}</span>
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tight">Apostilas</span>
                                </div>
                                <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col items-center text-center">
                                    <span className="text-purple-600 font-black text-lg leading-none mb-1">{stats.simulados}</span>
                                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-tight">Simulados</span>
                                </div>
                                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col items-center text-center">
                                    <span className="text-emerald-600 font-black text-sm leading-none mb-1 uppercase">Milhares de</span>
                                    <span className="text-9px font-black text-emerald-400 uppercase tracking-tight">Questões</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {[
                                    'Acesso total ao conteúdo',
                                    'Suporte via Ticket',
                                    'Mapas mentais exclusivos',
                                    'Simulados comentados',
                                    'Atualizações constantes'
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                                        <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Informações Detalhas do Curso */}
            {isInfoModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
                    <div 
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
                        onClick={() => setIsInfoModalOpen(false)}
                    ></div>
                    
                    <div className="relative w-full max-w-4xl bg-white rounded-[32px] md:rounded-[40px] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header do Modal */}
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="size-12 bg-gradient-to-tr from-[#137fec] to-blue-400 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <span className="material-symbols-outlined text-2xl font-black">school</span>
                                </div>
                                <div className="text-left">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Guia e Detalhes</span>
                                    <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mt-1">
                                        Informações do Curso
                                    </h3>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsInfoModalOpen(false)}
                                className="size-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Corpo do Modal */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
                            
                            {/* Banner Informativo do Curso */}
                            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-white relative overflow-hidden flex flex-col md:flex-row gap-6 items-center shadow-xl">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                                <div className="relative z-10 text-center md:text-left flex-1">
                                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest text-[#137fec]">Edital Mapeado</span>
                                    <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-2">{course.title}</h4>
                                    <p className="text-xs text-slate-300 mt-2 font-medium">Banca Organizadora: <span className="text-white font-black">{course.bancas?.name || 'Oficial'}</span></p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto shrink-0 z-10">
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
                                        <p className="text-lg font-black text-white">{stats.apostilas}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Apostilas</p>
                                    </div>
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
                                        <p className="text-lg font-black text-white">{stats.simulados}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Simulados</p>
                                    </div>
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
                                        <p className="text-lg font-black text-white">{stats.cadernos}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Cadernos</p>
                                    </div>
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
                                        <p className="text-lg font-black text-white">{stats.resolvidos}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Resolvidos</p>
                                    </div>
                                </div>
                            </div>

                            {/* Conteúdo de Descrição Principal */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                
                                {/* Lado Esquerdo: Descrição Detalhada em HTML */}
                                <div className="lg:col-span-8 space-y-6 text-left">
                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                                        <span className="material-symbols-outlined text-[#137fec] text-[20px]">assignment</span>
                                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Descrição Detalhada do Curso</h4>
                                    </div>
                                    
                                    {course.description ? (
                                        <div 
                                            className="prose prose-slate max-w-none text-slate-600 font-medium text-sm leading-relaxed 
                                                       prose-headings:font-black prose-headings:text-slate-900 prose-headings:tracking-tight 
                                                       prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h1:mt-8 prose-h2:mt-6
                                                       prose-strong:font-black prose-strong:text-slate-900 prose-a:text-[#137fec] 
                                                       prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-img:rounded-3xl"
                                            dangerouslySetInnerHTML={{ __html: course.description }}
                                        />
                                    ) : (
                                        <div className="p-8 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-center space-y-3">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 animate-pulse">article</span>
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Descrição detalhada indisponível</p>
                                            <p className="text-[11px] text-slate-400 leading-normal">
                                                A descrição detalhada ainda não foi preenchida pelo administrador para este curso. Mas você já pode aproveitar todos os recursos interativos inclusos!
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Lado Direito: Disciplinas e Recursos Padronizados */}
                                <div className="lg:col-span-4 space-y-6 text-left">
                                    {/* Disciplinas */}
                                    {stats.disciplinas.length > 0 && (
                                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                <span className="material-symbols-outlined text-[#137fec] text-[18px]">verified</span>
                                                <h5 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Disciplinas Cobertas</h5>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {stats.disciplinas.map((disc, idx) => (
                                                    <span 
                                                        key={idx} 
                                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 shadow-sm hover:border-[#137fec] hover:text-[#137fec] transition-colors cursor-default"
                                                    >
                                                        {disc}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recursos Padronizados */}
                                    <div className="p-6 bg-blue-50/40 rounded-3xl border border-blue-100/60 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                                            <span className="material-symbols-outlined text-[#137fec] text-[18px]">auto_awesome</span>
                                            <h5 className="text-[10px] font-black uppercase text-blue-900 tracking-wider">Metodologia e Recursos</h5>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {[
                                                { icon: 'menu_book', title: 'Estudo Ativo', desc: 'Apostilas Digitais Interativas com grifos e anotações integradas.' },
                                                { icon: 'quiz', title: 'Simulados de Elite', desc: 'Simulações no tempo e regras reais da banca organizadora.' },
                                                { icon: 'checklist', title: 'Questões Dinâmicas', desc: 'Banco de questões com filtros e marcação de resolvidas.' },
                                                { icon: 'visibility', title: 'Modo Relax', desc: 'Interface de leitura e estudo noturno suave para proteção ocular.' },
                                                { icon: 'history_edu', title: 'Cadernos Resolvidos', desc: 'Resoluções detalhadas comentadas passo-a-passo pelos professores.' }
                                            ].map((rec, i) => (
                                                <div key={i} className="flex gap-3 items-start text-left">
                                                    <div className="size-8 bg-white border border-blue-100 text-[#137fec] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                                        <span className="material-symbols-outlined text-[16px] font-black">{rec.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 leading-tight">{rec.title}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5">{rec.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-emerald-500">verified_user</span>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Garantia Incondicional de 7 dias</p>
                            </div>
                            <button
                                onClick={() => setIsInfoModalOpen(false)}
                                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer shadow-md transition-all active:scale-95 w-full sm:w-auto"
                            >
                                Entendi, fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoursePurchase;
