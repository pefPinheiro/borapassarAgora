import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import TiptapEditor from './TiptapEditor';

interface Landpage {
  id: string;
  titulo: string;
  slug: string;
  formato: 'Venda Direta' | 'Captura' | 'Vídeo';
  curso_id: string;
  header_content: string;
  body_content: string;
  footer_content: string;
  status: 'Publicado' | 'Rascunho';
  seo_title: string;
  seo_description: string;
}

interface Course {
  id: string;
  title: string;
}

const LandpageAdmin: React.FC = () => {
  const [landpages, setLandpages] = useState<Landpage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Landpage>>({
    titulo: '',
    slug: '',
    formato: 'Venda Direta',
    curso_id: '',
    header_content: '',
    body_content: '',
    footer_content: '',
    status: 'Rascunho',
    seo_title: '',
    seo_description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lpRes, cRes] = await Promise.all([
        supabase.from('landpages').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('id, title').eq('status', 'Ativo')
      ]);
      if (lpRes.data) setLandpages(lpRes.data);
      if (cRes.data) setCourses(cRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo || !formData.slug) {
      alert('Título e Slug são obrigatórios.');
      return;
    }
    setLoading(true);
    try {
      const { error } = formData.id
        ? await supabase.from('landpages').update(formData).eq('id', formData.id)
        : await supabase.from('landpages').insert(formData);

      if (error) throw error;
      alert('Página salva com sucesso!');
      setIsEditing(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar página.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta página permanentemente?')) return;
    try {
      await supabase.from('landpages').delete().eq('id', id);
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[#111418] text-3xl font-black tracking-tighter uppercase">Marketing: Landpages</h2>
          <p className="text-[#617589] font-medium">Crie páginas de alta conversão vinculadas aos seus cursos.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setFormData({ status: 'Rascunho', formato: 'Venda Direta', titulo: '', slug: '', body_content: '' }); }}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Nova Campanha
          </button>
        )}
      </div>

      {loading && !isEditing ? (
        <div className="py-20 text-center"><div className="size-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>
      ) : !isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {landpages.length === 0 && <div className="col-span-full py-20 bg-white border-2 border-dashed border-slate-100 rounded-[32px] text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">Nenhuma campanha ativa.</div>}
          {landpages.map(lp => (
            <div key={lp.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${lp.status === 'Publicado' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                  {lp.status}
                </div>
                <button onClick={() => handleDelete(lp.id)} className="text-slate-200 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
              </div>
              <h4 className="text-lg font-black text-slate-900 truncate mb-1">{lp.titulo}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-6">bora.com/lp/{lp.slug}</p>

              <div className="flex gap-2">
                <button onClick={() => { setFormData(lp); setIsEditing(true); }} className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-blue-50 hover:text-blue-600 transition-all">
                  Editar Página
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4">Status & Alvo</h3>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                {['Rascunho', 'Publicado'].map(s => (
                  <button key={s} onClick={() => setFormData({ ...formData, status: s as any })} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{s}</button>
                ))}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Identificação</label>
                  <input value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} placeholder="Nome..." className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Link (Slug)</label>
                  <input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="slug" className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl uppercase tracking-widest text-[10px] disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar Campanha'}</button>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[500px]">
              <div className="px-8 py-4 bg-slate-50 border-b border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Editor de Conteúdo</h4>
              </div>
              <div className="p-4 flex-1">
                <TiptapEditor
                  content={formData.body_content || ''}
                  onChange={(val) => setFormData({ ...formData, body_content: val })}
                  placeholder="Crie o conteúdo da sua landing page..."
                  minHeight="400px"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandpageAdmin;
