
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const LandingPage: React.FC = () => {
  const [mainCourses, setMainCourses] = useState<any[]>([]);
  const [recentCourses, setRecentCourses] = useState<any[]>([]);
  const [freeCourses, setFreeCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data: allCourses, error } = await supabase
        .from('courses')
        .select('*, bancas(name)')
        .eq('status', 'Ativo');

      if (error) throw error;

      if (allCourses) {
        setMainCourses(allCourses.slice(0, 3));
        setRecentCourses([...allCourses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3));
        setFreeCourses(allCourses.filter(c => c.price_offer === 0));
      }
    } catch (e) {
      console.error('Error fetching courses:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (courseId: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate(`/login?redirect=/aluno/curso/${courseId}/comprar`);
    } else {
      navigate(`/aluno/curso/${courseId}/comprar`);
    }
  };

  const CourseCard = ({ course }: { course: any, key?: any }) => {
    const discount = course.price_base && course.price_offer && course.price_base > course.price_offer
      ? Math.round(((course.price_base - course.price_offer) / course.price_base) * 100)
      : 0;

    return (
      <div
        onClick={() => handlePurchase(course.id)}
        className="group bg-white/5 backdrop-blur-md rounded-[54px] p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-500 cursor-pointer flex flex-col h-full overflow-hidden relative"
      >
        <div className="relative h-64 rounded-[40px] overflow-hidden mb-8">
          <img
            src={course.banner_url || 'https://images.unsplash.com/photo-1454165833767-027ffea9e77b?q=80&w=1470&auto=format&fit=crop'}
            className="size-full object-cover transition-transform duration-1000 group-hover:scale-110"
            alt={course.title}
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>

          {discount > 0 && (
            <div className="absolute top-4 left-4 px-6 py-3 bg-[#ff3b9a] text-white rounded-[20px] text-xs font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_-5px_rgba(255,59,154,0.5)] animate-bounce-slow">
              {discount}% OFF
            </div>
          )}

          <div className="absolute top-4 right-4 px-4 py-1.5 bg-white text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest">
            {course.bancas?.name || 'Oficial'}
          </div>
        </div>

        <div className="space-y-4 flex-1 flex flex-col px-4 pb-4">
          <h4 className="text-2xl font-black text-white leading-tight uppercase italic group-hover:text-[#137fec] transition-colors line-clamp-2">{course.title}</h4>
          <p className="text-slate-400 font-medium text-sm line-clamp-2 italic">{course.area} • Acesso Imediato</p>

          <div className="pt-8 mt-auto flex items-end justify-between border-t border-white/10">
            <div className="space-y-1">
              {course.coupon_name && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-[10px] text-[#ff3b9a] animate-pulse">sell</span>
                  <span className="text-[9px] font-black text-[#ff3b9a] uppercase tracking-widest bg-[#ff3b9a]/10 px-2 py-0.5 rounded-md">Cupom: {course.coupon_name}</span>
                </div>
              )}

              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest line-through mb-0 pr-1 opacity-50">
                {course.price_base > 0 && course.price_offer > 0 ? `R$ ${course.price_base?.toFixed(2).replace('.', ',')}` : ''}
              </p>

              <div className="flex items-baseline gap-1.5">
                {course.price_offer > 0 ? (
                  <>
                    <span className="text-xs font-black text-[#137fec] uppercase">R$</span>
                    <span className="text-4xl font-black text-white tracking-tighter shadow-blue-500/20 drop-shadow-2xl">
                      {course.price_offer?.toFixed(2).replace('.', ',')}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-4xl font-black text-emerald-400 tracking-tighter uppercase italic drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] animate-pulse">
                      GRÁTIS
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="size-16 bg-white text-slate-900 rounded-[24px] flex items-center justify-center group-hover:bg-[#137fec] group-hover:text-white transition-all duration-500 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.3)] group-hover:shadow-[0_20px_40px_-5px_rgba(19,127,236,0.4)] group-hover:scale-110">
              <span className="material-symbols-outlined text-3xl font-black">
                {course.price_offer > 0 ? 'shopping_cart' : 'rocket_launch'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen text-[#0f172a] font-sans selection:bg-[#ff3b9a]/20 selection:text-[#ff3b9a]">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-8">
            <Link to="/login" className="bg-gradient-to-r from-[#137fec] to-[#3b82f6] text-white px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(19,127,236,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(19,127,236,0.4)] hover:-translate-y-1 active:scale-95 transition-all">Começar Agora</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 overflow-hidden bg-slate-50">
        <div className="absolute top-20 right-[-10%] w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-[120px] -z-10 animate-blob"></div>
        <div className="absolute bottom-10 left-[-5%] w-[500px] h-[500px] bg-pink-100/40 rounded-full blur-[100px] -z-10 animate-blob animation-delay-2000"></div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16 text-center lg:text-left">
            <div className="lg:w-3/5 space-y-10">
              <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-white rounded-full shadow-2xl shadow-blue-500/10 border border-blue-50">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3b9a] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff3b9a]"></span>
                </span>
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">O futuro da sua aprovação chegou</span>
              </div>

              <h1 className="text-6xl md:text-8xl lg:text-[110px] font-black leading-[0.85] tracking-tighter text-slate-900">
                Seu futuro <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#137fec] via-[#ff3b9a] to-[#7c3aed] uppercase italic">é um plano.</span>
              </h1>

              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Prepare-se com a metodologia que une tecnologia, interatividade e foco total no seu edital. Conquiste sua vaga com a melhor plataforma gamer de estudos.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 items-center justify-center lg:justify-start pt-6">
                <button
                  onClick={() => navigate('/aluno/catalogo')}
                  className="w-full sm:w-auto px-12 py-7 bg-slate-900 text-white rounded-[28px] font-black text-xl shadow-2xl shadow-slate-900/40 hover:bg-[#137fec] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 uppercase tracking-[0.1em]"
                >
                  Explorar Cursos
                  <span className="material-symbols-outlined text-[#ff3b9a]">bolt</span>
                </button>
              </div>
            </div>

            <div className="lg:w-2/5 relative">
              <div className="relative group">
                <div className="absolute -inset-6 bg-gradient-to-tr from-[#137fec] via-[#ff3b9a] to-transparent rounded-[60px] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img
                  src="https://images.unsplash.com/photo-1544652478-6653e09f18a2?q=80&w=1470&auto=format&fit=crop"
                  alt="Estudos para Concurso"
                  className="rounded-[54px] shadow-2xl border-8 border-white relative z-10 w-full object-cover aspect-[4/5] hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Courses Section */}
      <section className="py-32 bg-slate-900 rounded-[80px] mx-6 -mt-10 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,#137fec33,transparent)] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-10 relative z-10">
          <div className="mb-20 text-center lg:text-left">
            <h2 className="text-[11px] font-black text-[#ff3b9a] uppercase tracking-[0.5em] mb-4">Elite Federal</h2>
            <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
              Principais <br /> <span className="text-[#137fec]">Treinamentos.</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-[480px] bg-slate-800/50 rounded-[48px] animate-pulse"></div>)
              : mainCourses.map(course => <CourseCard key={course.id} course={course} />)}
          </div>
        </div>
      </section>

      {/* Free Content Section */}
      <section className="py-32 bg-emerald-950 rounded-[80px] mx-6 mt-10 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-10 relative z-10">
          <div className="mb-20 text-center lg:text-left">
            <h2 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] mb-4">Acesso Gratuito</h2>
            <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
              Conteúdo <br /> <span className="text-emerald-400">Sem Custo.</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-[480px] bg-emerald-900/50 rounded-[48px] animate-pulse"></div>)
              : freeCourses.length > 0 ? freeCourses.map(course => <CourseCard key={course.id} course={course} />)
                : <div className="col-span-full py-20 text-center text-emerald-800 font-bold uppercase tracking-widest">Nenhum curso gratuito disponível no momento</div>}
          </div>
        </div>
      </section>

      {/* Recent Courses Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 text-center">
            <h2 className="text-[11px] font-black text-[#137fec] uppercase tracking-[0.5em] mb-4">Novidades</h2>
            <h3 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic">
              Lançamentos <span className="text-[#ff3b9a]">Recentes.</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-[480px] bg-slate-100 rounded-[48px] animate-pulse"></div>)
              : recentCourses.map(course => (
                <div key={course.id} onClick={() => handlePurchase(course.id)} className="group cursor-pointer">
                  <div className="relative h-72 rounded-[40px] overflow-hidden mb-6 shadow-xl">
                    <img src={course.banner_url} className="size-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-6 left-6">
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">{course.area}</p>
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">{course.title}</h4>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-20 pb-16 px-10 border-t border-slate-50 flex flex-col items-center gap-12 text-center">
        <img src="/bora_passar_logo.png" alt="Logo" className="h-10 opacity-40" />
        <div className="flex gap-10">
          {['Insta', 'Tube', 'Tiktok'].map(s => (
            <a key={s} href="#" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors">{s}</a>
          ))}
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">&copy; 2026 Bora Passar Agora • Future of Education</p>
      </footer>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow { animation: bounce-slow 5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default LandingPage;
