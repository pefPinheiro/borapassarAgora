import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Questao, Alternativa, Disciplina, Assunto, TextBase, Profile } from '../types';
import TiptapEditor from './TiptapEditor';

// Interfaces extras para os selects
interface Banca {
  id: string;
  name: string;
}

const QuestionsAdmin: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);

  // Dados para os selects
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [bancas, setBancas] = useState<Banca[]>([]);
  const [textBases, setTextBases] = useState<TextBase[]>([]);
  const [validators, setValidators] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Filtros
  const [filteredAssuntos, setFilteredAssuntos] = useState<Assunto[]>([]);
  const [baseTextMode, setBaseTextMode] = useState<'manual' | 'shared'>('manual');
  const [selectedValidatorFilter, setSelectedValidatorFilter] = useState<string>('all');
  const [filterDisciplina, setFilterDisciplina] = useState<string>('');
  const [filterAssunto, setFilterAssunto] = useState<string>('');
  const [filterBanca, setFilterBanca] = useState<string>('');
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterDificuldade, setFilterDificuldade] = useState<string>('');
  const [filterModalidade, setFilterModalidade] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  const [editingQuestao, setEditingQuestao] = useState<Questao | null>(null);
  const [saveAsShared, setSaveAsShared] = useState(false);
  const [newSharedTitle, setNewSharedTitle] = useState('');
  const fileInputImportRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Questao>>({
    enunciado: '',
    texto_base: '',
    text_base_id: '',
    resposta_professor: '',
    disciplina_id: '',
    assunto_id: '',
    banca_id: '',
    ano: new Date().getFullYear().toString(),
    dificuldade: 'Médio',
    modalidade: 'Multipla Escolha (5)',
    is_validada: false,
    validator_id: '',
    alternativas: Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), texto: '', isCorreta: false }))
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) setCurrentUser(profile);
      }
      fetchAuxiliaryData();
      fetchQuestions();
    };
    init();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [
    selectedValidatorFilter,
    filterDisciplina,
    filterAssunto,
    filterBanca,
    filterAno,
    filterDificuldade,
    filterModalidade,
    filterStatus,
    filterSearch,
    currentPage
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedValidatorFilter,
    filterDisciplina,
    filterAssunto,
    filterBanca,
    filterAno,
    filterDificuldade,
    filterModalidade,
    filterStatus,
    filterSearch
  ]);

  // Atualiza assuntos filtrados quando a disciplina muda no formulário
  useEffect(() => {
    if (formData.disciplina_id) {
      setFilteredAssuntos(assuntos.filter(a => a.disciplina_id === formData.disciplina_id));
    } else {
      setFilteredAssuntos([]);
    }
  }, [formData.disciplina_id, assuntos]);

  const fetchAuxiliaryData = async () => {
    try {
      const [dRes, aRes, bRes, tbRes, vRes] = await Promise.all([
        supabase.from('disciplinas').select('*').order('name'),
        supabase.from('assuntos').select('*').order('name'),
        supabase.from('bancas').select('*').order('name'),
        supabase.from('text_bases').select('*').order('title'),
        supabase.from('profiles').select('*').in('role', ['admin', 'super']).order('full_name')
      ]);

      if (dRes.data) setDisciplinas(dRes.data);
      if (aRes.data) setAssuntos(aRes.data);
      if (bRes.data) setBancas(bRes.data);
      if (tbRes.data) setTextBases(tbRes.data);
      if (vRes.data) setValidators(vRes.data);
    } catch (error) {
      console.error('Error fetching auxiliary data:', error);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('questions')
        .select(`
          *,
          disciplinas (name),
          assuntos (name),
          bancas (name),
          text_bases (content, title),
          validator:profiles!validator_id (full_name)
        `, { count: 'exact' });

      if (selectedValidatorFilter === 'me' && currentUser) {
        query = query.eq('validator_id', currentUser.id);
      } else if (selectedValidatorFilter !== 'all' && selectedValidatorFilter !== 'me') {
        query = query.eq('validator_id', selectedValidatorFilter);
      }

      if (filterDisciplina) query = query.eq('disciplina_id', filterDisciplina);
      if (filterAssunto) query = query.eq('assunto_id', filterAssunto);
      if (filterBanca) query = query.eq('banca_id', filterBanca);
      if (filterAno) query = query.eq('ano', filterAno);
      if (filterDificuldade) query = query.eq('dificuldade', filterDificuldade);
      if (filterModalidade) query = query.eq('modalidade', filterModalidade);
      if (filterStatus === 'validada') query = query.eq('is_validada', true);
      if (filterStatus === 'pendente') query = query.eq('is_validada', false);
      if (filterSearch) query = query.ilike('enunciado', `%${filterSearch}%`);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setQuestoes(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Erro ao carregar questões');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleCreateNew = () => {
    setEditingQuestao(null);
    setBaseTextMode('manual');
    setSaveAsShared(false);
    setNewSharedTitle('');
    setFormData({
      enunciado: '',
      texto_base: '',
      text_base_id: '',
      resposta_professor: '',
      disciplina_id: '',
      assunto_id: '',
      banca_id: '',
      ano: new Date().getFullYear().toString(),
      dificuldade: 'Médio',
      modalidade: 'Multipla Escolha (5)',
      is_validada: false,
      validator_id: '',
      alternativas: Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), texto: '', isCorreta: false }))
    });
    setView('form');
  };

  const handleEdit = (questao: Questao) => {
    setEditingQuestao(questao);
    setFormData(questao);
    setBaseTextMode(questao.text_base_id ? 'shared' : 'manual');
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir esta questão permanentemente?')) {
      try {
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) throw error;
        fetchQuestions();
      } catch (error) {
        console.error('Error deleting question:', error);
        alert('Erro ao excluir questão');
      }
    }
  };

  const handleDownloadModel = () => {
    const questions = [
      {
        enunciado: "<p>Exemplo de questão com 5 alternativas...</p>",
        texto_base: "",
        resposta_professor: "<p>Explicação do professor...</p>",
        disciplina: "Nome Exato da Disciplina",
        assunto: "Nome Exato do Assunto",
        banca: "Nome da Banca",
        ano: new Date().getFullYear().toString(),
        dificuldade: "Médio",
        modalidade: "Multipla Escolha (5)",
        alternativas: [
          { id: "1", texto: "Alternativa A", isCorreta: false },
          { id: "2", texto: "Alternativa B", isCorreta: true },
          { id: "3", texto: "Alternativa C", isCorreta: false },
          { id: "4", texto: "Alternativa D", isCorreta: false },
          { id: "5", texto: "Alternativa E", isCorreta: false }
        ]
      },
      {
        enunciado: "<p>Exemplo de questão com 4 alternativas...</p>",
        texto_base: "",
        resposta_professor: "<p>Explicação do professor...</p>",
        disciplina: "Nome Exato da Disciplina",
        assunto: "Nome Exato do Assunto",
        banca: "Nome da Banca",
        ano: new Date().getFullYear().toString(),
        dificuldade: "Difícil",
        modalidade: "Multipla Escolha (4)",
        alternativas: [
          { id: "1", texto: "Alternativa A", isCorreta: false },
          { id: "2", texto: "Alternativa B", isCorreta: false },
          { id: "3", texto: "Alternativa C", isCorreta: true },
          { id: "4", texto: "Alternativa D", isCorreta: false }
        ]
      },
      {
        enunciado: "<p>Exemplo de questão Certo/Errado...</p>",
        texto_base: "ID_DO_TEXTO_BASE_SE_HOUVER",
        resposta_professor: "<p>Explicação do professor...</p>",
        disciplina: "Nome Exato da Disciplina",
        assunto: "Nome Exato do Assunto",
        banca: "Nome da Banca",
        ano: new Date().getFullYear().toString(),
        dificuldade: "Fácil",
        modalidade: "Certo/Errado",
        alternativas: [
          { id: "1", texto: "Certo", isCorreta: true },
          { id: "2", texto: "Errado", isCorreta: false }
        ]
      }
    ];

    const model = {
      quantity: questions.length,
      questions: questions
    };

    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_questoes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonContent = JSON.parse(event.target?.result as string);

          let content: any[] = [];

          if (Array.isArray(jsonContent)) {
            content = jsonContent;
          } else if (jsonContent.questions && Array.isArray(jsonContent.questions)) {
            content = jsonContent.questions;
          } else {
            alert('O JSON deve ser uma lista de questões ou um objeto com a propriedade "questions".');
            return;
          }

          const validQuestions: any[] = [];
          content.forEach((item: any) => {
            const d = item.disciplina ? disciplinas.find(x => x.name.trim().toLowerCase() === item.disciplina?.trim().toLowerCase()) : null;
            const b = item.banca ? bancas.find(x => x.name.trim().toLowerCase() === item.banca?.trim().toLowerCase()) : null;

            let a = null;
            if (d && item.assunto) {
              a = assuntos.find(x =>
                x.name.trim().toLowerCase() === item.assunto?.trim().toLowerCase() &&
                x.disciplina_id === d.id
              );
            }

            if (item.enunciado) {
              validQuestions.push({
                enunciado: item.enunciado,
                texto_base: item.texto_base || null,
                text_base_id: item.text_base_id || null,
                resposta_professor: item.resposta_professor || '',
                disciplina_id: d?.id || null,
                assunto_id: a?.id || null,
                banca_id: b?.id || null,
                ano: String(item.ano || new Date().getFullYear()),
                dificuldade: item.dificuldade || 'Médio',
                modalidade: item.modalidade || 'Multipla Escolha (5)',
                alternativas: (item.alternativas || []).map((alt: any, idx: number) => ({
                  id: alt.id || String(idx + 1),
                  texto: alt.texto || '',
                  isCorreta: !!alt.isCorreta
                })),
                is_validada: false,
                validator_id: currentUser?.id || null
              });
            }
          });

          if (validQuestions.length === 0) {
            alert('Nenhuma questão válida encontrada no JSON.');
            return;
          }

          const { error } = await supabase.from('questions').insert(validQuestions);
          if (error) throw error;

          alert(`${validQuestions.length} questões importadas com sucesso!`);
          fetchQuestions();
        } catch (err) {
          console.error('Import Error:', err);
          alert('Erro ao processar arquivo JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveTextBase = async () => {
    if (!formData.texto_base) {
      alert('Digite o conteúdo do texto base primeiro.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('text_bases')
        .insert({
          content: formData.texto_base,
          title: newSharedTitle || 'Texto Base Sem Título'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        alert(`Texto base salvo com sucesso!\nID Gerado: ${data.id}`);
        fetchAuxiliaryData();
        setFormData({ ...formData, text_base_id: data.id, texto_base: '' });
        setBaseTextMode('shared');
      }
    } catch (error) {
      console.error('Error saving text base:', error);
      alert('Erro ao salvar texto base.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let final_text_base_id = baseTextMode === 'shared' ? (formData.text_base_id || null) : null;
      let final_texto_base = baseTextMode === 'manual' ? formData.texto_base : null;

      const payload = {
        enunciado: formData.enunciado,
        texto_base: final_texto_base,
        text_base_id: final_text_base_id,
        resposta_professor: formData.resposta_professor,
        disciplina_id: formData.disciplina_id || null,
        assunto_id: formData.assunto_id || null,
        banca_id: formData.banca_id || null,
        ano: formData.ano,
        dificuldade: formData.dificuldade,
        modalidade: formData.modalidade,
        alternativas: formData.alternativas,
        is_validada: formData.is_validada,
        validator_id: formData.validator_id || null
      };

      const { error } = await supabase
        .from('questions')
        .upsert({
          id: editingQuestao?.id,
          ...payload
        });

      if (error) throw error;

      alert('Questão salva com sucesso!');
      fetchQuestions();
      setView('list');
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Erro ao salvar questão');
    }
  };

  const toggleValidation = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_validada: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchQuestions();
    } catch (error) {
      console.error('Error toggling validation:', error);
      alert('Erro ao atualizar status');
    }
  };

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      alert('ID copiado com sucesso!');
    }).catch(err => {
      console.error('Erro ao copiar ID: ', err);
    });
  };

  const updateModalidade = (val: string) => {
    let numAlts = 0;
    if (val === 'Multipla Escolha (5)') numAlts = 5;
    else if (val === 'Multipla Escolha (4)') numAlts = 4;
    else if (val === 'Certo/Errado') numAlts = 2;

    const newAlts = val === 'Discursiva' ? [] :
      Array.from({ length: numAlts }, (_, i) => ({
        id: String(i + 1),
        texto: val === 'Certo/Errado' ? (i === 0 ? 'Certo' : 'Errado') : '',
        isCorreta: false
      }));

    setFormData({ ...formData, modalidade: val, alternativas: newAlts });
  };

  if (view === 'form') {
    return (
      <div className="flex flex-col gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-[#111418]">{editingQuestao ? 'Editar Questão' : 'Nova Questão'}</h2>
                {editingQuestao && (
                  <button
                    onClick={() => copyToClipboard(editingQuestao.id)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    ID: {editingQuestao.id}
                  </button>
                )}
              </div>
              <p className="text-sm text-[#617589]">Configure o conteúdo rico e metadados da questão.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setView('list')} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
            <button onClick={handleSubmit} className="px-8 py-2.5 bg-[#137fec] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all">Salvar Questão</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#137fec]">
                  <span className="material-symbols-outlined">edit_square</span>
                  <h3 className="text-lg font-black text-[#111418]">Conteúdo Rico</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Validação</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_validada: !formData.is_validada })}
                    className={`h-8 px-4 rounded-lg text-[10px] font-black uppercase transition-all ${formData.is_validada ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {formData.is_validada ? 'VALIDADA ✓' : 'PENDENTE'}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Texto Base (Contexto)</label>
                      <p className="text-[10px] text-slate-500 pl-1 font-medium">Crie um novo para gerar um ID ou utilize um ID existente.</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setBaseTextMode('manual')}
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${baseTextMode === 'manual' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        + Criar Novo
                      </button>
                      <button
                        type="button"
                        onClick={() => setBaseTextMode('shared')}
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${baseTextMode === 'shared' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Vincular ID
                      </button>
                    </div>
                  </div>

                  {baseTextMode === 'manual' ? (
                    <div className="space-y-4 p-5 border-2 border-dashed border-blue-100 rounded-3xl bg-blue-50/20">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Título do Texto (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Lei 8.112..."
                          value={newSharedTitle}
                          onChange={(e) => setNewSharedTitle(e.target.value)}
                          className="w-full h-11 px-4 bg-white border border-blue-100 rounded-xl text-sm outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">2. Conteúdo do Texto</label>
                        <TiptapEditor
                          content={formData.texto_base || ''}
                          onChange={(val) => setFormData({ ...formData, texto_base: val })}
                          placeholder="Escreva o texto de apoio aqui..."
                          minHeight="150px"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveTextBase}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        Salvar e Gerar ID
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 p-5 border border-slate-200 rounded-3xl bg-slate-50/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={formData.text_base_id}
                          onChange={(e) => setFormData({ ...formData, text_base_id: e.target.value })}
                          className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                        >
                          <option value="">Selecione da lista...</option>
                          {textBases.map((tb) => (
                            <option key={tb.id} value={tb.id}>
                              {tb.title || tb.content.substring(0, 30).replace(/<[^>]*>/g, '') + '...'}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Ou cole o ID..."
                          value={formData.text_base_id || ''}
                          onChange={(e) => setFormData({ ...formData, text_base_id: e.target.value })}
                          className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Enunciado / Comando *</label>
                  <TiptapEditor
                    content={formData.enunciado || ''}
                    onChange={(val) => setFormData({ ...formData, enunciado: val })}
                    placeholder="Descreva o comando da questão..."
                    minHeight="200px"
                  />
                </div>
              </div>
            </div>

            {formData.modalidade !== 'Discursiva' && (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#137fec]">
                    <span className="material-symbols-outlined">list_alt</span>
                    <h3 className="text-lg font-black text-[#111418]">Alternativas</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {formData.alternativas?.map((alt, idx) => (
                    <div key={alt.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${alt.isCorreta ? 'bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <textarea
                        rows={2}
                        value={alt.texto}
                        onChange={(e) => {
                          const newAlts = [...(formData.alternativas || [])];
                          newAlts[idx].texto = e.target.value;
                          setFormData({ ...formData, alternativas: newAlts });
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium resize-none py-1"
                        placeholder="Texto da alternativa..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newAlts = (formData.alternativas || []).map((a, i) => ({ ...a, isCorreta: i === idx }));
                          setFormData({ ...formData, alternativas: newAlts });
                        }}
                        className={`size-8 rounded-full flex items-center justify-center transition-all shrink-0 ${alt.isCorreta ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-200 text-white hover:bg-slate-300'}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-[#137fec] mb-2">
                <span className="material-symbols-outlined">psychology</span>
                <h3 className="text-lg font-black text-[#111418]">Comentário do Professor</h3>
              </div>
              <TiptapEditor
                content={formData.resposta_professor || ''}
                onChange={(val) => setFormData({ ...formData, resposta_professor: val })}
                placeholder="Resolução comentada..."
                minHeight="150px"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-[#137fec] mb-2">
                <span className="material-symbols-outlined">settings</span>
                <h3 className="text-lg font-black text-[#111418]">Configurações</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Banca</label>
                  <select
                    value={formData.banca_id}
                    onChange={e => setFormData({ ...formData, banca_id: e.target.value })}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="">Selecione...</option>
                    {bancas.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Disciplina</label>
                  <select
                    value={formData.disciplina_id}
                    onChange={e => setFormData({ ...formData, disciplina_id: e.target.value })}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="">Selecione...</option>
                    {disciplinas.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assunto</label>
                  <select
                    value={formData.assunto_id}
                    onChange={e => setFormData({ ...formData, assunto_id: e.target.value })}
                    disabled={!formData.disciplina_id}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none disabled:opacity-50"
                  >
                    <option value="">Selecione...</option>
                    {filteredAssuntos.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Modalidade</label>
                  <select
                    value={formData.modalidade}
                    onChange={(e) => updateModalidade(e.target.value as any)}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="Multipla Escolha (5)">Múltipla Escolha (5)</option>
                    <option value="Multipla Escolha (4)">Múltipla Escolha (4)</option>
                    <option value="Certo/Errado">Certo ou Errado</option>
                    <option value="Discursiva">Discursiva</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Dificuldade</label>
                  <select
                    value={formData.dificuldade}
                    onChange={e => setFormData({ ...formData, dificuldade: e.target.value as any })}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="Fácil">Fácil</option>
                    <option value="Médio">Médio</option>
                    <option value="Difícil">Difícil</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ano</label>
                  <input
                    type="number"
                    value={formData.ano}
                    onChange={e => setFormData({ ...formData, ano: e.target.value })}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[#111418] text-3xl font-black tracking-tight">Banco de Questões</h2>
          <p className="text-[#617589] font-medium">Gerencie o acervo de questões ({totalCount}).</p>
        </div>
        <div className="flex gap-3">
          <input type="file" ref={fileInputImportRef} hidden accept=".json" onChange={handleImportJson} />
          <button
            onClick={handleDownloadModel}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all font-mono text-xs"
          >
            <span className="material-symbols-outlined">download</span>
            Modelo
          </button>
          <button
            onClick={() => fileInputImportRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all font-mono text-xs"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Importar JSON
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 uppercase text-xs tracking-widest"
          >
            <span className="material-symbols-outlined">add</span>
            Nova Questão
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="col-span-1 xl:col-span-2">
          <input
            type="text"
            placeholder="Pesquisar Enunciado..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-300 transition-all"
          />
        </div>
        <select
          value={filterDisciplina}
          onChange={(e) => {
            setFilterDisciplina(e.target.value);
            setFilterAssunto('');
          }}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Disciplinas (Todas)</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filterAssunto}
          onChange={(e) => setFilterAssunto(e.target.value)}
          disabled={!filterDisciplina}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none disabled:opacity-30"
        >
          <option value="">Assuntos (Todos)</option>
          {assuntos.filter(a => a.disciplina_id === filterDisciplina).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filterBanca}
          onChange={(e) => setFilterBanca(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Bancas (Todas)</option>
          {bancas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          type="number"
          placeholder="Ano"
          value={filterAno}
          onChange={(e) => setFilterAno(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none"
        />
        <select
          value={filterModalidade}
          onChange={(e) => setFilterModalidade(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Modalidade</option>
          <option value="Multipla Escolha (5)">Múltipla Escolha (5)</option>
          <option value="Multipla Escolha (4)">Múltipla Escolha (4)</option>
          <option value="Certo/Errado">Certo ou Errado</option>
          <option value="Discursiva">Discursiva</option>
        </select>
        <select
          value={filterDificuldade}
          onChange={(e) => setFilterDificuldade(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Dificuldade</option>
          <option value="Fácil">Fácil</option>
          <option value="Médio">Médio</option>
          <option value="Difícil">Difícil</option>
        </select>
        <select
          value={selectedValidatorFilter}
          onChange={(e) => setSelectedValidatorFilter(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="all">Criadores</option>
          <option value="me">Minhas</option>
          {validators.map(v => (
            <option key={v.id} value={v.id}>{v.full_name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Status</option>
          <option value="validada">Validada</option>
          <option value="pendente">Pendente</option>
        </select>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enunciado</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Metadados</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="p-20 text-center"><div className="size-8 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div><p className="text-xs font-black text-slate-300 uppercase tracking-widest">Sincronizando Banco...</p></td></tr>
            ) : questoes.length === 0 ? (
              <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Nenhuma questão encontrada</td></tr>
            ) : (
              questoes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6 max-w-md">
                    <div className="text-sm font-bold text-slate-700 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.disciplinas?.name}</span>
                      <span className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.bancas?.name}</span>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.ano}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${q.dificuldade === 'Fácil' ? 'bg-green-50 text-green-600' : q.dificuldade === 'Médio' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>{q.dificuldade}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <button
                      onClick={() => toggleValidation(q.id, q.is_validada)}
                      className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${q.is_validada ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
                    >
                      {q.is_validada ? 'Validada' : 'Pendente'}
                    </button>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 transition-all">
                      <button onClick={() => handleEdit(q)} className="size-10 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">edit</span></button>
                      <button onClick={() => handleDelete(q.id)} className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">delete</span></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Exibindo <span className="text-slate-900">{questoes.length}</span> de <span className="text-slate-900">{totalCount}</span> questões
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-[#137fec] transition-all"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3) pageNum = currentPage - 2 + i;
                  if (pageNum + (4 - i) > totalPages) pageNum = totalPages - 4 + i;
                }
                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`size-10 rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-[#137fec] text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-30 hover:text-[#137fec] transition-all"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsAdmin;
