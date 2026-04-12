
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

    const [stats, setStats] = useState({ apostilas: 0, questions: 0, simulados: 0 });

    useEffect(() => {
        if (id) {
            fetchCourse();
            checkEnrollment();
            fetchStats();
        }
    }, [id]);

    const fetchStats = async () => {
        try {
            // Conta apostilas vinculadas ao curso via course_items
            const { count: itemsCount, data: itemsData } = await supabase
                .from('course_items')
                .select('apostila_id, apostila:apostilas(disciplina_id)', { count: 'exact' })
                .eq('course_id', id);

            // Conta simulados vinculados via course_simulados
            const { count: simuladosCount } = await supabase
                .from('course_simulados')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', id);

            // Conta todas as questões do banco de dados (conforme solicitado)
            const { count: totalQuestionsCount } = await supabase
                .from('questions')
                .select('*', { count: 'exact', head: true });

            setStats({
                apostilas: itemsCount || 0,
                questions: totalQuestionsCount || 0,
                simulados: simuladosCount || 0
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
                                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    Já Inscrito • Ver Curso
                                    <span className="material-symbols-outlined">play_circle</span>
                                </button>
                            ) : isFree ? (
                                <button
                                    onClick={handleEnrollFree}
                                    disabled={enrolling}
                                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                                >
                                    {enrolling ? 'Inscrevendo...' : 'Resgatar Gratuitamente'}
                                    <span className="material-symbols-outlined">bolt</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate(`/aluno/curso/${course.id}/checkout`)}
                                    className="w-full py-5 bg-[#137fec] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-[#0e69c5] hover:scale-[1.05] hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    Fazer Inscrição
                                    <span className="material-symbols-outlined">shopping_cart</span>
                                </button>
                            )}
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
        </div>
    );
};

export default CoursePurchase;
