import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import QuestionSolver from '../components/QuestionSolver';
import { Questao, Disciplina, Assunto, Subassunto } from '../types';

interface Resolution {
  id: string;
  title: string;
  questions: string[];
  disciplina_id?: string;
  assunto_id?: string;
  subassunto_id?: string;
  created_at: string;
  disciplinas?: { name: string };
  assuntos?: { name: string };
  subassuntos?: { name: string };
}

const ResolverQuestoes: React.FC = () => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [isSolverOpen, setIsSolverOpen] = useState(false);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auxiliary Data
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [subassuntos, setSubassuntos] = useState<Subassunto[]>([]);
  
  // Status Popup State
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [assuntoId, setAssuntoId] = useState('');
  const [subassuntoId, setSubassuntoId] = useState('');
  const [questionIdInput, setQuestionIdInput] = useState('');
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  
  // Filters State
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDisciplinaId, setFilterDisciplinaId] = useState('');

  const [profile, setProfile] = useState<any>(null);
  const [activeResolution, setActiveResolution] = useState<Resolution | null>(null);
  const [activeQuestaoObjects, setActiveQuestaoObjects] = useState<Questao[]>([]);

  useEffect(() => {
    fetchProfileAndResolutions();
    fetchAuxiliaryData();
  }, []);

  const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [dRes, aRes, sRes] = await Promise.all([
        supabase.from('disciplinas').select('*').order('name'),
        supabase.from('assuntos').select('*').order('name'),
        supabase.from('subassuntos').select('*').order('name')
      ]);
      if (dRes.data) setDisciplinas(dRes.data);
      if (aRes.data) setAssuntos(aRes.data);
      if (sRes.data) setSubassuntos(sRes.data);
    } catch (error) {
      console.error('Error fetching auxiliary data:', error);
    }
  };

  const fetchProfileAndResolutions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(prof);

        const { data: res, error } = await supabase
          .from('question_resolutions')
          .select('*, disciplinas(name), assuntos(name), subassuntos(name)')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setResolutions(res || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddId = () => {
    if (!questionIdInput.trim()) return;
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const matches = questionIdInput.match(uuidRegex);
    if (matches && matches.length > 0) {
      const newIds = matches.filter(id => !questionIds.includes(id));
      setQuestionIds(prev => [...prev, ...newIds]);
      setQuestionIdInput('');
    } else if (!questionIdInput.includes(' ') && questionIdInput.length > 20) {
      setQuestionIds(prev => [...prev, questionIdInput.trim()]);
      setQuestionIdInput('');
    }
  };

  const removeId = (idx: number) => {
    setQuestionIds(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim() || questionIds.length === 0) {
      showStatus('error', 'Preencha o título e adicione questões.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload = {
        title,
        questions: questionIds,
        disciplina_id: disciplinaId || null,
        assunto_id: assuntoId || null,
        subassunto_id: subassuntoId || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('question_resolutions')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        showStatus('success', 'Aula atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('question_resolutions')
          .insert({ ...payload, user_id: user?.id });
        if (error) throw error;
        showStatus('success', 'Aula salva na biblioteca!');
      }

      resetForm();
      fetchProfileAndResolutions();
    } catch (error) {
      console.error('Error saving resolution:', error);
      showStatus('error', 'Erro ao salvar resolução.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDisciplinaId('');
    setAssuntoId('');
    setSubassuntoId('');
    setQuestionIds([]);
    setEditingId(null);
    setView('list');
  };

  const handleEdit = (res: Resolution) => {
    setTitle(res.title);
    setDisciplinaId(res.disciplina_id || '');
    setAssuntoId(res.assunto_id || '');
    setSubassuntoId(res.subassunto_id || '');
    setQuestionIds(res.questions);
    setEditingId(res.id);
    setView('create');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta resolução permanentemente?')) return;
    try {
      const { error } = await supabase
        .from('question_resolutions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showStatus('success', 'Removido da biblioteca.');
      fetchProfileAndResolutions();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const startResolution = async (res: Resolution) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*, disciplinas(name), assuntos(name), bancas(name), text_bases(content, title)')
        .in('id', res.questions);

      if (error) throw error;

      const orderedData = res.questions.map(id => data.find(q => q.id === id)).filter(Boolean) as Questao[];
      
      setActiveQuestaoObjects(orderedData);
      setActiveResolution(res);
      setIsSolverOpen(true);
    } catch (error) {
      console.error('Error loading questions:', error);
      showStatus('error', 'Falha ao carregar lousa.');
    } finally {
      setLoading(false);
    }
  };

  const filteredResolutions = resolutions.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesDisciplina = filterDisciplinaId ? res.disciplina_id === filterDisciplinaId : true;
    return matchesSearch && matchesDisciplina;
  });

  if (view === 'create') {
    return (
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={resetForm} className="size-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="text-3xl font-black text-[#111418] uppercase tracking-tight">{editingId ? 'Editar Aula' : 'Nova Aula Inteligente'}</h2>
              <p className="text-[#617589] font-medium">Configure as categorias e o roteiro da aula.</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={loading} className="px-10 py-4 bg-[#137fec] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center gap-3 disabled:opacity-50">
            {loading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined">save</span>}
            {editingId ? 'Atualizar Aula' : 'Salvar Aula'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8 bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Informações Gerais</label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da Aula (Ex: Revisão de Direito Civil)"
                className="w-full h-16 px-8 bg-slate-50 border-none rounded-[24px] text-lg font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select 
                  value={disciplinaId} 
                  onChange={(e) => {
                    setDisciplinaId(e.target.value);
                    setAssuntoId('');
                    setSubassuntoId('');
                  }}
                  className="h-14 px-6 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                >
                  <option value="">Disciplina</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select 
                  value={assuntoId} 
                  onChange={(e) => {
                    setAssuntoId(e.target.value);
                    setSubassuntoId('');
                  }}
                  disabled={!disciplinaId}
                  className="h-14 px-6 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                >
                  <option value="">Assunto</option>
                  {assuntos.filter(a => a.disciplina_id === disciplinaId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select 
                  value={subassuntoId} 
                  onChange={(e) => setSubassuntoId(e.target.value)}
                  disabled={!assuntoId}
                  className="h-14 px-6 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                >
                  <option value="">Subassunto</option>
                  {subassuntos.filter(s => s.assunto_id === assuntoId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">IDs das Questões (Extrator Inteligente)</label>
              <div className="flex gap-4">
                <input 
                  type="text"
                  value={questionIdInput}
                  onChange={(e) => setQuestionIdInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddId()}
                  placeholder='Cole aqui... Ex: [QUESTÃO INTERATIVA ID: "uuid-aqui"]'
                  className="flex-1 h-14 px-6 bg-slate-50 border-none rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
                <button 
                  onClick={handleAddId}
                  className="px-6 bg-[#137fec] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  Extrair
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Roteiro da Aula ({questionIds.length})</label>
              <div className="grid grid-cols-1 gap-3">
                {questionIds.map((id, i) => (
                  <div key={`${id}-${i}`} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group animate-in slide-in-from-left-2 transition-all hover:bg-white hover:border-blue-100">
                    <div className="flex items-center gap-4">
                      <span className="size-8 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-blue-100">{i + 1}</span>
                      <span className="text-xs font-bold text-slate-700 font-mono tracking-tighter">{id}</span>
                    </div>
                    <button onClick={() => removeId(i)} className="size-8 text-slate-300 hover:text-red-500 transition-all">
                      <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-gradient-to-br from-[#111418] to-[#2d343c] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="size-14 rounded-2xl bg-blue-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                   <span className="material-symbols-outlined text-3xl">psychology</span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">Poder da Inteligência</h3>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">Seu roteiro integrado à base oficial.</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-[#111418] uppercase tracking-tighter">Biblioteca de Aulas</h2>
          <p className="text-[#617589] font-medium text-lg">Gerencie e inicie suas resoluções preparadas.</p>
        </div>
        <button onClick={() => setView('create')} className="px-10 py-5 bg-[#137fec] text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-600 transition-all flex items-center gap-3">
          <span className="material-symbols-outlined">add_circle</span>
          Nova Aula
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <div className="flex-1 min-w-[300px] relative">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Buscar pelo título da aula..." 
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full h-14 pl-14 pr-6 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
         </div>
         <select 
           value={filterDisciplinaId}
           onChange={(e) => setFilterDisciplinaId(e.target.value)}
           className="h-14 px-6 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
         >
            <option value="">Filtrar Disciplina</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
         </select>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden pb-10">
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="border-b border-slate-50">
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aula / Categorias</th>
                  <th className="px-6 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatísticas</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {filteredResolutions.map((res) => (
                  <tr key={res.id} className="hover:bg-blue-50/20 transition-all group">
                     <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                           <div className="size-12 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-all">
                              <span className="material-symbols-outlined text-2xl">movie_edit</span>
                           </div>
                           <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-sm">{res.title}</span>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[9px] font-black text-blue-500 uppercase">{res.disciplinas?.name || 'Geral'}</span>
                                 <span className="size-1 bg-slate-200 rounded-full"></span>
                                 <span className="text-[9px] font-bold text-slate-400 truncate max-w-[200px]">{res.assuntos?.name || 'Conteúdo livre'}</span>
                              </div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex flex-col gap-1">
                           <span className="text-[10px] font-black text-slate-900 flex items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-500"></span>
                              {res.questions.length} Questões
                           </span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(res.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                     </td>
                     <td className="px-10 py-6">
                        <div className="flex items-center justify-end gap-2">
                           <button onClick={() => startResolution(res)} title="Iniciar Lousa" className="size-11 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg shadow-black/5">
                              <span className="material-symbols-outlined">play_arrow</span>
                           </button>
                           <button onClick={() => handleEdit(res)} title="Editar" className="size-11 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 transition-all">
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                           </button>
                           <button onClick={() => handleDelete(res.id)} title="Excluir" className="size-11 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                           </button>
                        </div>
                     </td>
                  </tr>
               ))}
               {filteredResolutions.length === 0 && !loading && (
                 <tr>
                    <td colSpan={3} className="px-10 py-20 text-center">
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma aula encontrada nos filtros</p>
                    </td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>

      {/* Status Popup */}
      {status && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[10002] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-8 duration-300 ${
          status.type === 'success' ? 'bg-emerald-600 text-white' : 
          status.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
           <span className="material-symbols-outlined">
              {status.type === 'success' ? 'check_circle' : status.type === 'error' ? 'error' : 'info'}
           </span>
           <span className="text-xs font-black uppercase tracking-widest">{status.message}</span>
        </div>
      )}

      {isSolverOpen && activeResolution && (
        <QuestionSolver 
          questaoObjects={activeQuestaoObjects}
          initialTitle={activeResolution.title}
          professorAvatar={profile?.avatar_url}
          onClose={() => setIsSolverOpen(false)}
        />
      )}
    </div>
  );
};

export default ResolverQuestoes;
