
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface CourseData {
  id: string;
  title: string;
  area: string;
  banner_url: string;
  is_notice_open: boolean;
  test_date: string;
  access_days: number;
  study_plan_json?: any[];
}

interface Notice {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const CourseView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('apostilas');
  const [course, setCourse] = useState<CourseData | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [simulados, setSimulados] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [readItems, setReadItems] = useState<string[]>([]);
  const [collapsedDisciplines, setCollapsedDisciplines] = useState<string[]>([]);
  const [simuladoAttempts, setSimuladoAttempts] = useState<any[]>([]);

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isNoticesCollapsed, setIsNoticesCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Course Info
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', id).single();
      if (courseData) {
        // Normalize study plan structure (migration from old flat array to new session/group structure)
        if (Array.isArray(courseData.study_plan_json)) {
            const firstItem = courseData.study_plan_json[0] as any;
            if (firstItem && !firstItem.items && firstItem.type) {
                // It's the old format (flat array of items)
                courseData.study_plan_json = [{
                    id: 'migration-default',
                    title: 'Guia de Estudos',
                    items: courseData.study_plan_json as any
                }];
            }
        }
        setCourse(courseData);
      }

      // Fetch Items (Apostilas) linked to this course
      const { data: itemsData } = await supabase
        .from('course_items')
        .select(`
            *,
            apostila:apostilas (
                id,
                title,
                is_resolution_notebook,
                is_resumo_8020,
                disciplina:disciplinas (name)
            )
        `)
        .eq('course_id', id)
        .order('position', { ascending: true });

      setItems(itemsData || []);

      // Fetch Simulados
      const { data: simsData } = await supabase
        .from('course_simulados')
        .select(`
            id,
            release_days,
            simulado:simulados (
                id,
                title,
                duration,
                penalty,
                banca:bancas (name),
                questions:simulado_questions(count)
            )
        `)
        .eq('course_id', id);
      setSimulados(simsData || []);

      // Fetch Materials
      const { data: matsData } = await supabase.from('course_materials').select('*').eq('course_id', id).order('position', { ascending: true });
      setMaterials(matsData || []);

      // Fetch Enrollment and previously read items
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Buscando matrícula para curso:', id, 'e profile:', user.id);
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('course_id', id)
          .eq('profile_id', user.id)
          .maybeSingle();

        if (enrollData) {
          if (enrollData.status === 'Ativo') {
            console.log('Matrícula ativa encontrada:', enrollData.id);
            setEnrollment(enrollData);
            const completed = Array.isArray(enrollData.completed_items) ? enrollData.completed_items : [];
            setReadItems(completed);
          } else if (enrollData.status === 'Pendente') {
            console.log('Matrícula pendente encontrada. Tentando verificar status real...');
            // Tenta verificar se o pagamento já foi aprovado mas o webhook ainda não chegou
            try {
              const verifyRes = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollment_id: enrollData.id })
              });
              const verifyData = await verifyRes.json();
              
              if (verifyData.status === 'Ativo') {
                console.log('Pagamento verificado manualmente com sucesso!');
                setEnrollment({ ...enrollData, status: 'Ativo' });
                const completed = Array.isArray(enrollData.completed_items) ? enrollData.completed_items : [];
                setReadItems(completed);
              } else {
                console.warn('Pagamento ainda pendente no Mercado Pago. Redirecionando para checkout.');
                navigate(`/aluno/curso/${id}/checkout`);
              }
            } catch (vErr) {
              console.error('Erro ao verificar pagamento:', vErr);
              navigate(`/aluno/curso/${id}/checkout`);
            }
          } else {
             navigate(`/aluno/curso/${id}/comprar`);
          }
        } else {
          console.warn('Matrícula inexistente. Redirecionando para compra.');
          navigate(`/aluno/curso/${id}/comprar`);
        }

        // Fetch Simulado Attempts
        const { data: attempts } = await supabase
          .from('student_simulado_attempts')
          .select('*')
          .eq('student_id', user.id);
        setSimuladoAttempts(attempts || []);
      }

      // Fetch Notices
      const { data: noticesData } = await supabase.from('course_notices').select('*').eq('course_id', id).order('created_at', { ascending: false });
      setNotices(noticesData || []);

    } catch (e) {
      console.error('Error fetching course view data:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleRead = async (apostilaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enrollment) {
      alert('Você precisa estar matriculado para salvar o progresso.');
      return;
    }

    const isCurrentlyRead = readItems.includes(apostilaId);
    const newReadItems = isCurrentlyRead
      ? readItems.filter(i => i !== apostilaId)
      : [...readItems, apostilaId];

    setReadItems(newReadItems);

    // Calculate progress based on valid items only (intersection of read items and current course items)
    // This prevents deleted items from counting towards > 100%
    const currentApostilaIds = items.map(i => i.apostila_id);
    const validReadItems = newReadItems.filter(id => currentApostilaIds.includes(id));

    const progressValue = Math.round((validReadItems.length / (items.length || 1)) * 100);

    try {
      // console.log('Salvando progresso no banco...', newReadItems);
      const { error } = await supabase
        .from('enrollments')
        .update({
          completed_items: newReadItems,
          progress: progressValue
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      // Atualiza o estado da matrícula localmente
      setEnrollment((prev: any) => prev ? ({ ...prev, completed_items: newReadItems, progress: progressValue }) : null);
    } catch (err) {
      console.error('Falha técnica ao salvar progresso:', err);
      setReadItems(readItems); // Reverte visualmente
      alert('Erro ao salvar progresso. Verifique sua conexão ou permissões RLS.');
    }
  };

  const togglePlanItemRead = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enrollment) {
      alert('Você precisa estar matriculado para salvar o progresso.');
      return;
    }

    const currentProgress = enrollment.study_plan_progress || {};
    const isCurrentlyRead = currentProgress[itemId];
    
    const newProgress = { ...currentProgress, [itemId]: !isCurrentlyRead };

    try {
      const { error } = await supabase
        .from('enrollments')
        .update({
          study_plan_progress: newProgress
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      setEnrollment((prev: any) => prev ? ({ ...prev, study_plan_progress: newProgress }) : null);
    } catch (err) {
      console.error('Falha técnica ao salvar progresso do organizador:', err);
      alert('Erro ao salvar progresso.');
    }
  };

  // ... (aux functions)

  // Helper for progress display
  const getCourseProgress = () => {
    if (!items.length) return 0;
    const currentApostilaIds = items.map(i => i.apostila_id);
    const validReadCount = readItems.filter(id => currentApostilaIds.includes(id)).length;
    return Math.round((validReadCount / items.length) * 100);
  };

  const studyPlanStats = useMemo(() => {
    const planItems = course?.study_plan_json?.flatMap((s: any) => s.items || []) || [];
    const total = planItems.length;
    const completed = planItems.filter((item: any) => enrollment?.study_plan_progress?.[item.id]).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [course?.study_plan_json, enrollment?.study_plan_progress]);

  // ... (rest of code)

  // In the return JSX, find the stats header:
  // <p className="text-2xl font-black text-emerald-500 leading-none">{Math.round((readItems.length / (items.length || 1)) * 100)}%</p>
  // Replace with:
  // <p className="text-2xl font-black text-emerald-500 leading-none">{getProgressPercentage()}%</p>

  // And in the list mapping:
  // const isRead = readItems.includes(item.id); -> const isRead = readItems.includes(item.apostila_id);
  // toggleRead(item.id, e) -> toggleRead(item.apostila_id, e)


  const calculateDaysLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const calculateAccessRemaining = () => {
    if (!enrollment || !course?.access_days) return null;
    const startDate = new Date(enrollment.created_at);
    const endDate = new Date(startDate.getTime() + (course.access_days * 24 * 60 * 60 * 1000));
    const diff = endDate.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Group standard apostilas
  const groupedItems = useMemo(() => items.filter(i => !i.apostila?.is_resolution_notebook).reduce((acc: any, curr) => {
    const disciplineName = curr.apostila?.disciplina?.name || 'Geral';
    if (!acc[disciplineName]) acc[disciplineName] = [];
    acc[disciplineName].push(curr);
    return acc;
  }, {}), [items]);

  // Group resolution cadernos
  const groupedResolutions = useMemo(() => items.filter(i => i.apostila?.is_resolution_notebook).reduce((acc: any, curr) => {
    const disciplineName = curr.apostila?.disciplina?.name || 'Geral';
    if (!acc[disciplineName]) acc[disciplineName] = [];
    acc[disciplineName].push(curr);
    return acc;
  }, {}), [items]);

  const collapsedInitialized = useRef(false);

  useEffect(() => {
    const disciplineKeys = Object.keys(groupedItems);
    // Só inicializa o collapsed se tiver itens e AINDA NÃO tiver sido inicializado
    if (disciplineKeys.length > 0 && !collapsedInitialized.current) {
      setCollapsedDisciplines(disciplineKeys);
      collapsedInitialized.current = true;
    }
  }, [groupedItems]);

  // Função para renderizar conteúdo processando placeholders de questões e vídeos de forma resiliente
  const renderProcessedContent = (content: string) => {
    if (!content) return null;

    let cleanContent = content.replace(/<div class="ap-placeholder[^>]*>([\s\S]*?)<\/div>/gi, '$1');

    cleanContent = cleanContent.replace(/<div[^>]*data-youtube-video[^>]*>[\s\S]*?<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, '[VÍDEO AULA: "$1"]');
    cleanContent = cleanContent.replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, (match, src) => {
      if (src.includes('youtube') || src.includes('youtu.be') || src.includes('vimeo')) {
        return `[VÍDEO AULA: "${src}"]`;
      }
      return match;
    });

    const processMath = (text: string) => {
      return text
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
          try { return katex.renderToString(tex, { displayMode: true, throwOnError: false }); } catch { return _; }
        })
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
          try { return katex.renderToString(tex, { displayMode: true, throwOnError: false }); } catch { return _; }
        })
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
          try { return katex.renderToString(tex, { displayMode: false, throwOnError: false }); } catch { return _; }
        });
    };

    cleanContent = processMath(cleanContent);

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
      .replace(/\[--BORA-PRATICAR--\]([\s\S]*?)\[\/--BORA-PRATICAR--\]/g, '<div class="custom-tag tag-praticar"><div class="tag-icon-box"><span class="material-symbols-outlined">fitness_center</span></div><div class="tag-content-wrapper"><div class="tag-body"><strong>Bora Praticar!</strong></div><div class="tag-text">$1</div></div></div>')
      .replace(/\[--TITULO--\]([\s\S]*?)\[\/--TITULO--\]/g, '<div class="custom-tag tag-titulo"><div class="tag-content-wrapper"><div class="tag-text">$1</div></div></div>');


    const tagRegex = /\[\s*(?:QUESTÃO INTERATIVA ID|QUESTÃO INTERATIVA|VÍDEO AULA|quest_id)\s*[:=]\s*(?:")?([^"\]]+)(?:")?\s*\]/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(cleanContent)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = cleanContent.substring(lastIndex, match.index);
        if (textBefore.replace(/<br\s*\/?>/g, '').trim()) {
          parts.push(<div key={`text-${lastIndex}`} className="ql-editor p-0 mb-8" dangerouslySetInnerHTML={{ __html: textBefore }} />);
        }
      }

      const rawId = match[1].trim().replace(/<[^>]*>/g, '');

      if (match[0].toUpperCase().includes('VÍDEO AULA')) {
        let embedUrl = rawId;
        if (rawId.includes('youtube.com/watch?v=')) embedUrl = rawId.replace('watch?v=', 'embed/');
        else if (rawId.includes('youtu.be/')) embedUrl = rawId.replace('youtu.be/', 'youtube.com/embed/');

        parts.push(
          <div key={`v-wrap-${rawId}-${match.index}`} className="custom-tag tag-video my-8 mx-auto w-full aspect-video bg-black relative rounded-xl overflow-hidden shadow-xl">
            <iframe src={embedUrl} title="Vídeo" className="absolute inset-0 w-full h-full" allowFullScreen />
          </div>
        );
      } else {
        parts.push(<div key={`d-${match.index}`} className="my-4 p-4 bg-slate-50 border rounded text-slate-500 text-xs text-center">[Elemento Interativo: Visível na Apostila Completa]</div>);
      }
      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < cleanContent.length) {
      const remaining = cleanContent.substring(lastIndex);
      if (remaining.trim()) parts.push(<div key={`text-${lastIndex}`} className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: remaining }} />);
    }

    return parts.length > 0 ? parts : <div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: cleanContent }} />;
  };

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-300">
      <div className="size-10 border-4 border-slate-200 border-t-[#137fec] rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando trilha...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-10 pb-20 animate-in fade-in duration-500 course-view-page">
      <style>{`
            .course-view-page .custom-tag { margin: 2rem 0; background: #fff; border: 1px solid rgba(0,0,0,0.03); display: flex; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.08); }
            .course-view-page .tag-icon-box { min-width: 60px; display: flex; justify-content: center; align-items: center; }
            .course-view-page .tag-content-wrapper { padding: 1.5rem; flex: 1; }
            .course-view-page .tag-body strong { display: block; text-transform: uppercase; font-size: 0.8rem; margin-bottom: 0.5rem; }
            
            .course-view-page .tag-aviso { border-right: 4px solid #ef4444; }
            .course-view-page .tag-aviso .tag-icon-box { background: #fee2e2; color: #ef4444; }
            .course-view-page .tag-importante { border-right: 4px solid #f59e0b; }
            .course-view-page .tag-importante .tag-icon-box { background: #fef3c7; color: #d97706; }
            .course-view-page .tag-link { border-right: 4px solid #3b82f6; }
            .course-view-page .tag-link .tag-icon-box { background: #dbeafe; color: #2563eb; }
            .course-view-page .tag-observe { border-right: 4px solid #0891b2; }
            .course-view-page .tag-observe .tag-icon-box { background: #cffafe; color: #0891b2; }

            .course-view-page .ql-editor p { margin-bottom: 1em; line-height: 1.6; }
            .course-view-page .ql-editor img { max-width: 100%; border-radius: 12px; margin: 1em 0; }
            .course-view-page blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #64748b; }
            .course-view-page ul, .course-view-page ol { padding-left: 1.5rem; margin: 1rem 0; }
            .course-view-page ul li { list-style: disc; margin-bottom: 0.5rem; }
            .course-view-page ol li { list-style: decimal; margin-bottom: 0.5rem; }
      `}</style>

      {/* Premium Course Header */}
      <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/50 rounded-full blur-3xl -z-10 group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="flex gap-8 items-center flex-col md:flex-row text-center md:text-left">
          <div className="size-24 rounded-[32px] overflow-hidden shadow-2xl relative">
            <img src={course?.banner_url || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1470&auto=format&fit=crop'} className="size-full object-cover" />
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 bg-[#137fec]/5 text-[#137fec] text-[9px] font-black rounded-lg uppercase tracking-[0.2em]">{course?.area || 'Trilha Ativa'}</span>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{course?.title}</h1>
            <div className="flex items-center gap-6 justify-center md:justify-start">
              <div className="flex items-center gap-2">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Acesso: {calculateAccessRemaining()} dias restantes
                </p>
              </div>
              {course?.is_notice_open && course.test_date && (
                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                  <span className="material-symbols-outlined text-sm text-amber-600 animate-pulse">event_upcoming</span>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">
                    {calculateDaysLeft(course.test_date)} dias para a prova
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 items-center lg:items-end w-full lg:w-auto">
          <div className="flex bg-slate-50 p-6 rounded-[32px] border border-slate-100 gap-8 w-full justify-between lg:justify-start">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900 leading-none">{items.length}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ligas/Apostilas</p>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900 leading-none">{simulados.length}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Simulados</p>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-500 leading-none">{getCourseProgress()}%</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Progresso</p>
            </div>
          </div>

          <button 
            onClick={() => setIsGuideModalOpen(true)}
            className={`w-full py-5 rounded-[32px] flex items-center justify-center gap-4 transition-all duration-500 shadow-2xl relative overflow-hidden group/btn bg-[#ff2d92] text-white shadow-pink-500/40 hover:scale-105 hover:bg-[#e62681]`}
          >
            <div className={`size-10 rounded-xl flex items-center justify-center transition-colors`}>
              <span className="material-symbols-outlined text-3xl font-black">account_tree</span>
            </div>
            <div className="text-left">
              <p className={`text-[7px] font-black uppercase tracking-[0.3em] leading-none mb-1 ${activeTab === 'organizador' ? 'text-white/80' : 'text-pink-300'}`}>Acessar Agora</p>
              <p className="text-xs font-black uppercase italic tracking-widest leading-none">Guia de Estudo</p>
            </div>
            <div className="absolute top-0 -right-4 w-12 h-full bg-white/10 skew-x-12 translate-x-full group-hover/btn:translate-x-[-200%] transition-transform duration-1000"></div>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          {/* Navigation Tabs Multi-Action */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-2 flex gap-2">
            {[
              { id: 'apostilas', label: 'Manual de Estudo', icon: 'auto_stories' },
              { id: 'simulados', label: 'Laboratório (Simulados)', icon: 'speed' },
              { id: 'resolucoes', label: 'Cadernos Resolvidos', icon: 'menu_book' },
              { id: 'materiais', label: 'Arsenal Extra', icon: 'token' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 rounded-[24px] flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-2xl scale-100' : 'text-slate-400 hover:bg-slate-50'
                  }`}
              >
                <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {(activeTab === 'apostilas' || activeTab === 'resolucoes') && (
              <div className="space-y-10">
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#137fec] transition-colors">search</span>
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome do material..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-16 bg-white border border-slate-100 rounded-[24px] pl-16 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-[#137fec] focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
                  />
                </div>
                {(() => {
                  let currentGroups = activeTab === 'apostilas' ? groupedItems : groupedResolutions;
                  
                  // Apply search filter
                  if (searchTerm) {
                    const filtered: any = {};
                    Object.entries(currentGroups).forEach(([discipline, items]: [string, any]) => {
                      const matchingItems = items.filter((item: any) => 
                        item.apostila?.title?.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                      if (matchingItems.length > 0) {
                        filtered[discipline] = matchingItems;
                      }
                    });
                    currentGroups = filtered;
                  }

                  return (
                    <>
                      {Object.keys(currentGroups).length === 0 && (
                        <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                          <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">inventory_2</span>
                          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                            {activeTab === 'apostilas' ? 'Nesta trilha ainda não há materiais.' : 'Nesta trilha ainda não há cadernos de resolução.'}
                          </p>
                        </div>
                      )}
                      {Object.entries(currentGroups).map(([discipline, disciplineItems]: [string, any]) => {
                  const isCollapsed = collapsedDisciplines.includes(discipline);
                  return (
                    <div key={discipline} className="space-y-4 bg-white/50 rounded-[40px] border border-slate-100 p-2 overflow-hidden shadow-sm">
                      <button
                        onClick={() => setCollapsedDisciplines(prev => isCollapsed ? prev.filter(d => d !== discipline) : [...prev, discipline])}
                        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-all rounded-[32px]"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-xl flex items-center justify-center ${isCollapsed ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white shadow-lg'}`}>
                            <span className="material-symbols-outlined text-xl">{isCollapsed ? 'folder' : 'folder_open'}</span>
                          </div>
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{discipline}</h3>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[9px] font-black text-slate-300 uppercase">{disciplineItems.length} Itens</span>
                          <span className={`material-symbols-outlined transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`}>expand_more</span>
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="flex flex-col p-2 pt-0 animate-in slide-in-from-top-2 duration-300">
                          {disciplineItems.map((item: any) => {
                            const isRead = readItems.includes(item.apostila_id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => navigate(`/aluno/apostila/${item.apostila_id}`)}
                                className={`group flex items-center gap-4 px-6 py-4 rounded-[24px] transition-all cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${isRead ? 'bg-emerald-50/10' : ''}`}
                              >
                                <div className={`size-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm ${isRead ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-[#137fec] group-hover:text-white'}`}>
                                  <span className="material-symbols-outlined text-xl">
                                    {isRead ? 'check_circle' : 'menu_book'}
                                  </span>
                                </div>

                                <div className="flex-1">
                                  <p className={`font-bold text-xs uppercase tracking-tight ${isRead ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {item.apostila?.title}
                                  </p>
                                  {item.apostila?.is_resumo_8020 && (
                                    <span className="mt-1 px-2 py-0.5 bg-emerald-500 text-white text-[7px] font-black rounded uppercase tracking-widest w-fit block animate-pulse">80/20 Summary</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-6">
                                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest hidden sm:block">Apostila Interativa</span>
                                  <button
                                    onClick={(e) => toggleRead(item.apostila_id, e)}
                                    className={`size-8 rounded-lg flex items-center justify-center transition-all ${isRead ? 'bg-emerald-100 text-emerald-600' : 'text-slate-200 hover:text-[#137fec] hover:bg-blue-50'}`}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">
                                      {isRead ? 'verified' : 'radio_button_unchecked'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                    </>
                  );
                })()}
              </div>
            )}

            {activeTab === 'organizador' && (
              <div className="space-y-12">
                {(!course?.study_plan_json || course.study_plan_json.length === 0) ? (
                  <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">account_tree</span>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhum guia de estudo configurado para esta trilha.</p>
                  </div>
                ) : (
                  course.study_plan_json.map((session: any, sIndex: number) => (
                    <div key={session.id} className="space-y-6">
                      <div className="flex items-center gap-4 px-2">
                        <div className="size-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm italic">
                          {sIndex + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{session.title}</h3>
                          {session.comment && <p className="text-xs font-medium text-slate-500 italic mt-0.5">{session.comment}</p>}
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{session.items?.length || 0} Materiais nesta sessão</p>
                        </div>
                      </div>

                      <div className="space-y-4 relative">
                        <div className="absolute left-[39px] top-4 bottom-4 w-0.5 bg-slate-100 z-0"></div>
                        {session.items?.map((item: any) => {
                          const isCompleted = enrollment?.study_plan_progress?.[item.id];
                          
                          let icon = 'menu_book';
                          let typeLabel = item.type;
                          if (item.type === 'simulado') icon = 'speed';
                          if (item.type === 'revisao') icon = 'draw';
                          if (item.type === 'caderno') icon = 'library_books';
                          if (item.type === 'resolvido') icon = 'fact_check';
                          if (item.type === 'questao') icon = 'quiz';
                          if (item.type === 'extra') icon = 'add_circle';
                          if (item.type === 'outro') icon = 'link';

                          return (
                            <div key={item.id} className={`relative z-10 flex items-center gap-6 p-6 rounded-[32px] border transition-all ${isCompleted ? 'bg-emerald-50/30 border-emerald-100/50 opacity-80' : 'bg-white border-slate-100 hover:shadow-xl hover:border-[#137fec]/20'}`}>
                              <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                <span className="material-symbols-outlined text-2xl">{isCompleted ? 'check_circle' : icon}</span>
                              </div>
                              
                              <div className="flex-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">{typeLabel}</span>
                                <h4 className={`text-base font-black uppercase italic tracking-tight leading-tight ${isCompleted ? 'text-emerald-900' : 'text-slate-900'}`}>{item.title}</h4>
                              </div>

                              <div className="flex items-center gap-4">
                                {(item.type === 'apostila' || item.type === 'resolvido') && item.ref_id && (
                                  <button onClick={() => navigate(`/aluno/apostila/${item.ref_id}`)} className="size-10 bg-slate-50 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-xl flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                  </button>
                                )}
                                {item.type === 'simulado' && item.ref_id && (
                                  <button onClick={() => navigate(`/aluno/simulado/${item.ref_id}`)} className="size-10 bg-slate-50 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-xl flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                  </button>
                                )}
                                {item.type === 'caderno' && item.ref_id && (
                                  <button onClick={() => navigate(`/aluno/caderno/${item.ref_id}`)} className="size-10 bg-slate-50 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-xl flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                  </button>
                                )}
                                {(item.type === 'outro' || item.type === 'extra' || item.type === 'revisao') && item.url && (
                                  <a href={item.url} target="_blank" rel="noreferrer" className="size-10 bg-slate-50 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-xl flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">open_in_new</span>
                                  </a>
                                )}
                                
                                <div className="w-px h-8 bg-slate-100"></div>
                                
                                <button onClick={(e) => togglePlanItemRead(item.id, e)} className={`px-6 py-2.5 rounded-[16px] text-[9px] font-black uppercase tracking-widest transition-all border ${isCompleted ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-[#137fec] hover:text-white hover:border-[#137fec]'}`}>
                                  {isCompleted ? 'Concluído' : 'Marcar Feito'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'simulados' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {simulados.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-100">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum simulado disponível para esta trilha.</p>
                  </div>
                ) : simulados.map(simItem => {
                  const releaseDays = simItem.release_days || 0;
                  const enrollmentDate = enrollment ? new Date(enrollment.created_at) : new Date();
                  const unlockDate = new Date(enrollmentDate.getTime() + (releaseDays * 24 * 60 * 60 * 1000));
                  const isLocked = new Date() < unlockDate;

                  // Find latest attempt
                  const attempts = simuladoAttempts.filter(a => a.simulado_id === simItem.simulado.id);
                  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

                  let statusLabel = isLocked ? 'Bloqueado' : 'Disponível';
                  let statusColor = isLocked ? 'bg-slate-100 text-slate-400' : 'bg-[#137fec]/5 text-[#137fec]';
                  let icon = isLocked ? 'lock' : 'speed';

                  if (latestAttempt) {
                    const total = latestAttempt.correct + latestAttempt.wrong + latestAttempt.blank;
                    const percentage = total > 0 ? Math.round((latestAttempt.correct / total) * 100) : 0;
                    statusLabel = `Resolvido: ${percentage}%`;
                    statusColor = 'bg-emerald-50 text-emerald-600';
                    icon = 'check_circle';
                  }

                  return (
                    <div key={simItem.id} className={`group bg-white p-8 rounded-[40px] border border-slate-100 transition-all ${isLocked ? 'grayscale opacity-70' : 'hover:border-[#137fec] hover:shadow-2xl hover:shadow-blue-500/5'}`}>
                      <div className="flex items-start justify-between mb-8">
                        <div className={`size-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${isLocked ? 'bg-slate-100 text-slate-400' :
                          latestAttempt ? 'bg-emerald-100 text-emerald-500' : 'bg-slate-50 text-slate-400 group-hover:bg-[#137fec] group-hover:text-white'}`}>
                          <span className="material-symbols-outlined text-3xl">{icon}</span>
                        </div>
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{simItem.simulado?.title}</h4>
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            {simItem.simulado?.duration} minutos
                            <span className="mx-1">•</span>
                            <span className="material-symbols-outlined text-sm">list</span>
                            {simItem.simulado?.questions?.[0]?.count || 0} Questões
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">account_balance</span>
                            Banca {simItem.simulado?.banca?.name || 'Geral'}
                          </p>
                          {simItem.simulado?.penalty > 0 && (
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">warning</span>
                              Penalidade: {simItem.simulado?.penalty} por erro
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => !isLocked && navigate(`/aluno/simulado/${simItem.simulado?.id}`)}
                        disabled={isLocked}
                        className={`w-full mt-8 py-4 rounded-[20px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all ${isLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' :
                          latestAttempt ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-[#137fec] active:scale-95'}`}
                      >
                        {isLocked ? `Libera em ${unlockDate.toLocaleDateString()}` : (latestAttempt ? 'Refazer Simulado' : 'Iniciar Laboratório')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'materiais' && (
              <div className="bg-slate-900 p-10 rounded-[48px] text-white space-y-8 overflow-hidden relative">
                <div className="absolute -top-20 -right-20 size-60 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
                <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                  <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center text-[#137fec]">
                    <span className="material-symbols-outlined">api</span>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight">Arsenal de Suporte</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {materials.length === 0 && <p className="text-center py-10 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Prepare seu arsenal, em breve materiais extras aqui.</p>}
                  {materials.map(mat => (
                    <a
                      key={mat.id}
                      href={mat.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-between group/mat"
                    >
                      <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-slate-500 group-hover/mat:text-[#137fec] transition-colors">
                          {mat.type === 'video' ? 'play_circle' : 'attachment'}
                        </span>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight">{mat.title}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{mat.type}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-700 group-hover/mat:text-white transition-colors">arrow_right_alt</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-full lg:w-96 space-y-8">
          {/* Active Notices Section - Collapsible */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsNoticesCollapsed(!isNoticesCollapsed)}
              className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Notificações</h4>
                {!isNoticesCollapsed && <span className="size-2 bg-amber-500 rounded-full animate-ping"></span>}
              </div>
              <span className={`material-symbols-outlined text-slate-400 transition-transform duration-300 ${isNoticesCollapsed ? '-rotate-90' : 'rotate-0'}`}>expand_more</span>
            </button>

            {!isNoticesCollapsed && (
              <div className="p-8 pt-0 space-y-4 animate-in slide-in-from-top-4 duration-300">
                {notices.length === 0 ? (
                  <div className="py-10 text-center opacity-30 grayscale"><span className="material-symbols-outlined text-4xl">notifications_off</span><p className="text-[8px] font-black uppercase tracking-widest mt-2">Sem avisos críticos</p></div>
                ) : notices.map(notice => (
                  <div
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className="p-5 bg-slate-50 rounded-3xl border border-slate-100 group/notice hover:border-amber-200 hover:bg-amber-50/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">{new Date(notice.created_at).toLocaleDateString()}</p>
                      <span className="material-symbols-outlined text-slate-300 text-sm group-hover/notice:text-amber-500">open_in_new</span>
                    </div>
                    <h5 className="text-sm font-black text-slate-900 group-hover/notice:text-[#137fec] transition-colors line-clamp-2">{notice.title}</h5>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-indigo-900 p-8 rounded-[40px] text-white space-y-6 relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-300 mb-2">Banco de Questões</h4>
              <h3 className="text-3xl font-black italic leading-none tracking-tighter">Treine sua <br /> performance.</h3>
              <p className="text-indigo-200/70 text-sm font-medium mt-4 leading-relaxed italic">Filtre por banca, ano e nível de dificuldade para dominar o edital.</p>
              <button
                onClick={() => navigate('/aluno/questoes')}
                className="w-full mt-8 py-5 bg-white text-indigo-950 rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                Ir para Questões
              </button>
            </div>
          </div>

          <div
            onClick={() => navigate(`/aluno/curso/${id}/relax`)}
            className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 rounded-[40px] text-white space-y-4 relative overflow-hidden group cursor-pointer border border-orange-400 shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all"
          >
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:rotate-12 transition-transform duration-700">
              <span className="material-symbols-outlined text-8xl">sports_esports</span>
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md">Novo</span>
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Relax Zone</h3>
              <p className="text-white/80 text-xs font-bold leading-relaxed max-w-[80%]">Aprenda jogando e ganhe moedas virtuais para desbloquear conquistas.</p>

              <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-white/10 w-fit px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 group-hover:bg-white group-hover:text-orange-600 transition-colors">
                <span>Entrar</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Notice Popup Modal with RICH RENDER */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative flex flex-col max-h-[85vh]">
            <div className="bg-[#137fec] p-8 flex items-start justify-between shrink-0">
              <div className="text-white">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md mb-3 inline-block">Comunicado Oficial</span>
                <h3 className="text-2xl font-black leading-tight">{selectedNotice.title}</h3>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-2">{new Date(selectedNotice.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setSelectedNotice(null)} className="size-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-10 overflow-y-auto custom-scrollbar bg-slate-50/50 grow">
              <div className="apostila-content">
                {renderProcessedContent(selectedNotice.content)}
              </div>
            </div>

            <div className="bg-white p-6 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setSelectedNotice(null)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#137fec] transition-colors">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Premium Study Guide Modal */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsGuideModalOpen(false)}></div>
          
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[40px] shadow-huge flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Modal Header */}
            <div className="p-8 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="relative size-20 flex items-center justify-center">
                  <svg className="size-full transform -rotate-90">
                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                    <circle 
                      cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" 
                      strokeDasharray={2 * Math.PI * 36} 
                      strokeDashoffset={2 * Math.PI * 36 * (1 - studyPlanStats.percent / 100)} 
                      className="text-[#ff2d92] transition-all duration-1000" 
                    />
                  </svg>
                  <span className="absolute text-lg font-black text-slate-900 tracking-tighter">{studyPlanStats.percent}%</span>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Roteiro de Estudo</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Status: {studyPlanStats.completed} / {studyPlanStats.total} concluídos</p>
                </div>
              </div>
              <button onClick={() => setIsGuideModalOpen(false)} className="size-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-100 transition-all shadow-sm">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-slate-50/20">
              {course?.study_plan_json?.map((session: any, sIndex: number) => {
                const isExpanded = expandedSessions.includes(session.id);
                const sessionProgress = session.items?.filter((item: any) => enrollment?.study_plan_progress?.[item.id]).length || 0;
                const totalItems = session.items?.length || 0;
                const percent = totalItems > 0 ? Math.round((sessionProgress / totalItems) * 100) : 0;

                return (
                  <div key={session.id} className="space-y-6">
                    {/* Session Card (Collapsed) */}
                    <button 
                      onClick={() => setExpandedSessions(prev => prev.includes(session.id) ? prev.filter(id => id !== session.id) : [...prev, session.id])}
                      className={`w-full p-8 bg-white rounded-[32px] border-2 transition-all flex items-center justify-between text-left group ${isExpanded ? 'border-pink-200 shadow-huge shadow-pink-500/5' : 'border-slate-100 hover:border-pink-100 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`size-14 rounded-2xl flex items-center justify-center font-black text-xl italic transition-all duration-500 ${isExpanded ? 'bg-[#ff2d92] text-white shadow-lg shadow-pink-500/20' : 'bg-slate-50 text-slate-300 group-hover:bg-pink-50 group-hover:text-pink-400'}`}>
                          {sIndex + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter group-hover:text-pink-500 transition-colors">{session.title}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{percent}% Concluído • {totalItems} Materiais</p>
                          </div>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined text-slate-200 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-pink-500' : ''}`}>expand_more</span>
                    </button>

                    {/* Timeline Items (Expanded) */}
                    {isExpanded && (
                      <div className="pl-10 space-y-8 relative ml-7">
                        <div className="absolute left-[-1px] top-4 bottom-4 w-0.5 bg-slate-100 z-0"></div>
                        
                        {session.items?.map((item: any, iIndex: number) => {
                          const isDone = enrollment?.study_plan_progress?.[item.id];
                          const isPreviousDone = iIndex === 0 || enrollment?.study_plan_progress?.[session.items[iIndex-1].id];
                          const isLocked = !isDone && !isPreviousDone && iIndex > 0;
                          const isInProgress = !isDone && !isLocked;

                          const typeStyles: any = {
                            apostila: {
                              border: "border-pink-100",
                              accent: "text-pink-500",
                              tag: "bg-pink-50 text-pink-600",
                              icon: "auto_stories",
                              label: "Apostila",
                              highlight: true
                            },
                            simulado: {
                              border: "border-orange-100",
                              accent: "text-orange-500",
                              tag: "bg-orange-50 text-orange-600",
                              icon: "speed",
                              label: "Simulado"
                            },
                            caderno: {
                              border: "border-cyan-100",
                              accent: "text-cyan-500",
                              tag: "bg-cyan-50 text-cyan-600",
                              icon: "library_books",
                              label: "Caderno"
                            },
                            resolvido: {
                              border: "border-emerald-100",
                              accent: "text-emerald-500",
                              tag: "bg-emerald-50 text-emerald-600",
                              icon: "fact_check",
                              label: "Resolução"
                            },
                            questao: {
                              border: "border-violet-100",
                              accent: "text-violet-500",
                              tag: "bg-violet-50 text-violet-600",
                              icon: "quiz",
                              label: "Questão"
                            }
                          };

                          const style = typeStyles[item.type] || {
                            border: "border-slate-100",
                            accent: "text-slate-400",
                            tag: "bg-slate-50 text-slate-500",
                            icon: "link",
                            label: "Extra"
                          };

                          return (
                            <div key={item.id} className={`relative z-10 flex items-start gap-8 group ${isLocked ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                              {/* Timeline Icon */}
                              <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-6 z-10 shadow-md border-2 border-white transition-all duration-500 ${isDone ? 'bg-emerald-500 text-white' : (isInProgress ? 'bg-pink-500 text-white animate-pulse' : 'bg-slate-50 text-slate-300')}`}>
                                <span className="material-symbols-outlined text-xs font-black">{isDone ? 'check' : style.icon}</span>
                              </div>

                              {/* Card */}
                              <div className={`flex-1 p-6 bg-white rounded-[24px] border transition-all duration-300 ${isDone ? 'border-emerald-100 shadow-sm' : `border-slate-100 ${style.highlight ? 'border-pink-200' : ''}`} hover:shadow-lg`}>
                                <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[8px] font-black px-2 py-1 rounded-md tracking-widest uppercase ${style.tag}`}>
                                      {style.label}
                                    </span>
                                    {isDone && <span className="text-[8px] font-black px-2 py-1 rounded-md tracking-widest uppercase bg-emerald-50 text-emerald-600">Concluído</span>}
                                  </div>
                                  
                                  <button 
                                    onClick={(e) => togglePlanItemRead(item.id, e)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                                      isDone 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                      : 'bg-slate-50 text-slate-400 hover:bg-[#ff2d92] hover:text-white border border-slate-100 hover:border-[#ff2d92]'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-xs">{isDone ? 'check_circle' : 'circle'}</span>
                                    {isDone ? 'Concluir' : 'Marcar Feito'}
                                  </button>
                                </div>

                                <h4 className={`text-lg font-black uppercase italic tracking-tighter mb-2 ${style.highlight ? 'text-pink-600' : 'text-slate-800'}`}>
                                  {item.title}
                                </h4>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6 line-clamp-2">{item.type === 'apostila' ? 'Leitura teórica completa com questões interativas.' : 'Prática focada no assunto para fixação.'}</p>

                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => {
                                      if (item.type === 'apostila' || item.type === 'resolvido') navigate(`/aluno/apostila/${item.ref_id}`);
                                      else if (item.type === 'simulado') navigate(`/aluno/simulado/${item.ref_id}`);
                                      else if (item.type === 'caderno') navigate(`/aluno/caderno/${item.ref_id}`);
                                      else if (item.type === 'questao') {
                                        const params = new URLSearchParams();
                                        if (item.filters?.disciplina_id) params.append('disciplinas', item.filters.disciplina_id);
                                        if (item.filters?.assunto_id) params.append('assuntos', item.filters.assunto_id);
                                        if (item.filters?.subassunto_id) params.append('subassuntos', item.filters.subassunto_id);
                                        if (item.filters?.banca_id) params.append('bancas', item.filters.banca_id);
                                        if (item.filters?.ano) params.append('anos', item.filters.ano);
                                        if (item.filters?.modalidade) params.append('modalidades', item.filters.modalidade);
                                        navigate(`/aluno/questoes?${params.toString()}`);
                                      }
                                      else if (item.url) window.open(item.url, '_blank');
                                    }}
                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${
                                      isInProgress 
                                      ? 'bg-[#ff2d92] text-white hover:bg-[#e62681]' 
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-200 hover:text-pink-500'
                                    }`}
                                  >
                                    {isInProgress ? 'Acessar Agora' : 'Revisar'}
                                  </button>
                                  
                                  {item.type === 'simulado' && isDone && (
                                    <button onClick={() => navigate(`/aluno/simulado/${item.ref_id}`)} className="px-4 py-3 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
                                      Erros
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseView;
