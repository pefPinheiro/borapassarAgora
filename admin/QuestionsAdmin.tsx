import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Questao, Alternativa, Disciplina, Assunto, Subassunto, Subsubassunto, TextBase, Profile } from '../types';
import TiptapEditor from './TiptapEditor';
import InteractiveQuestion from '../components/InteractiveQuestion';

// Interfaces extras para os selects
interface Banca {
  id: string;
  name: string;
}

interface SubassuntoExtended extends Subassunto {
  name: string;
  subsubassuntos?: Subsubassunto[];
}

interface AssuntoExtended extends Assunto {
  name: string;
  subassuntos?: SubassuntoExtended[];
}

const QuestionsAdmin: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);

  // Dados para os selects
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [assuntos, setAssuntos] = useState<AssuntoExtended[]>([]);
  const [bancas, setBancas] = useState<Banca[]>([]);
  const [textBases, setTextBases] = useState<TextBase[]>([]);
  const [validators, setValidators] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Filtros
  const [filteredAssuntos, setFilteredAssuntos] = useState<AssuntoExtended[]>([]);
  const [baseTextMode, setBaseTextMode] = useState<'manual' | 'shared'>('manual');
  const [selectedValidatorFilter, setSelectedValidatorFilter] = useState<string>('all');
  const [filterDisciplina, setFilterDisciplina] = useState<string>('');
  const [filterAssuntos, setFilterAssuntos] = useState<string[]>([]);
  const [filterSubassuntos, setFilterSubassuntos] = useState<string[]>([]);
  const [filterSubsubassuntos, setFilterSubsubassuntos] = useState<string[]>([]);
  const [filterBanca, setFilterBanca] = useState<string>('');
  const [filterAno, setFilterAno] = useState<string>('');
  const [filterDificuldade, setFilterDificuldade] = useState<string>('');
  const [filterModalidade, setFilterModalidade] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [isTreeFilterOpen, setIsTreeFilterOpen] = useState(false);
  const [treeExpandedIds, setTreeExpandedIds] = useState<Set<string>>(new Set());

  // Sorting
  const [sortBy, setSortBy] = useState<'created_at' | 'enunciado'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const [editingQuestao, setEditingQuestao] = useState<Questao | null>(null);
  const [saveAsShared, setSaveAsShared] = useState(false);
  const [newSharedTitle, setNewSharedTitle] = useState('');

  // Preview & Selection State
  const [previewQuestion, setPreviewQuestion] = useState<Questao | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    disciplina_id: '',
    assunto_id: '',
    subassunto_id: '',
    subsubassunto_id: '',
    banca_id: '',
    is_validada: undefined as boolean | undefined
  });

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
    is_validada: true,
    validator_id: '',
    subassunto_id: '',
    subsubassunto_id: '',
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
    filterAssuntos,
    filterSubassuntos,
    filterSubsubassuntos,
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
    filterAssuntos,
    filterSubassuntos,
    filterSubsubassuntos,
    filterBanca,
    filterAno,
    filterDificuldade,
    filterModalidade,
    filterStatus,
    filterSearch,
    sortBy,
    sortAsc
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
        supabase.from('assuntos').select('*, subassuntos(*, subsubassuntos(*))').order('name'),
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
          subassuntos (name),
          subsubassuntos (name),
          bancas (name, sigla),
          text_bases (content, title),
          validator:profiles!validator_id (full_name)
        `, { count: 'exact' });

      if (selectedValidatorFilter === 'me' && currentUser) {
        query = query.eq('validator_id', currentUser.id);
      } else if (selectedValidatorFilter !== 'all' && selectedValidatorFilter !== 'me') {
        query = query.eq('validator_id', selectedValidatorFilter);
      }

      if (filterDisciplina) query = query.eq('disciplina_id', filterDisciplina);
      
      const subjectFilters = [];
      if (filterAssuntos.length > 0) subjectFilters.push(`assunto_id.in.(${filterAssuntos.join(',')})`);
      if (filterSubassuntos.length > 0) subjectFilters.push(`subassunto_id.in.(${filterSubassuntos.join(',')})`);
      if (filterSubsubassuntos.length > 0) subjectFilters.push(`subsubassunto_id.in.(${filterSubsubassuntos.join(',')})`);
      
      if (subjectFilters.length > 0) {
        query = query.or(subjectFilters.join(','));
      }

      if (filterBanca) query = query.eq('banca_id', filterBanca);
      if (filterAno) query = query.eq('ano', filterAno);
      if (filterDificuldade) query = query.eq('dificuldade', filterDificuldade);
      if (filterModalidade) query = query.eq('modalidade', filterModalidade);
      if (filterStatus === 'validada') query = query.eq('is_validada', true);
      if (filterStatus === 'pendente') query = query.eq('is_validada', false);
      if (filterSearch) {
        query = query.or(`enunciado.ilike.%${filterSearch}%,assuntos.name.ilike.%${filterSearch}%,subassuntos.name.ilike.%${filterSearch}%,subsubassuntos.name.ilike.%${filterSearch}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order(sortBy, { ascending: sortAsc })
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
      is_validada: true,
      validator_id: '',
      subassunto_id: '',
      subsubassunto_id: '',
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Excluir as ${selectedIds.size} questões selecionadas permanentemente?`)) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from('questions')
          .delete()
          .in('id', Array.from(selectedIds));
        
        if (error) throw error;
        
        alert(`${selectedIds.size} questões excluídas com sucesso.`);
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        fetchQuestions();
      } catch (error) {
        console.error('Error deleting multiple questions:', error);
        alert('Erro ao excluir algumas questões.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    
    setLoading(true);
    try {
      const updates: any = {};
      if (bulkFormData.disciplina_id) updates.disciplina_id = bulkFormData.disciplina_id;
      if (bulkFormData.assunto_id) updates.assunto_id = bulkFormData.assunto_id;
      if (bulkFormData.subassunto_id) updates.subassunto_id = bulkFormData.subassunto_id;
      if (bulkFormData.subsubassunto_id) updates.subsubassunto_id = bulkFormData.subsubassunto_id;
      if (bulkFormData.banca_id) updates.banca_id = bulkFormData.banca_id;
      if (bulkFormData.is_validada !== undefined) updates.is_validada = bulkFormData.is_validada;

      if (Object.keys(updates).length === 0) {
        alert('Nenhuma alteração selecionada.');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('questions')
        .update(updates)
        .in('id', Array.from(selectedIds));
      
      if (error) throw error;
      
      alert(`${selectedIds.size} questões atualizadas com sucesso.`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setIsBulkModalOpen(false);
      setBulkFormData({
        disciplina_id: '',
        assunto_id: '',
        subassunto_id: '',
        subsubassunto_id: '',
        banca_id: '',
        is_validada: undefined
      });
      fetchQuestions();
    } catch (error) {
      console.error('Error updating multiple questions:', error);
      alert('Erro ao atualizar algumas questões.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questoes.length && questoes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questoes.map(q => q.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
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
    const selectedDisciplina = disciplinas.find(d => d.id === filterDisciplina);
    const disciplinaName = selectedDisciplina?.name || "Todas as Disciplinas";
    
    // Construir lista de assuntos
    const relevantAssuntos = assuntos.filter(a => !filterDisciplina || a.disciplina_id === filterDisciplina);
    let hierarchyText = "";
    relevantAssuntos.forEach(a => {
      hierarchyText += `- ${a.name}\n`;
      a.subassuntos?.forEach(sa => {
        hierarchyText += `  -- ${sa.name}\n`;
        sa.subsubassuntos?.forEach(ssa => {
          hierarchyText += `    --- ${ssa.name}\n`;
        });
      });
    });

    const prompt = `VOCÊ É UM ESPECIALISTA EM EXTRAÇÃO DE DADOS DE CONCURSOS PÚBLICOS.
Sua tarefa é extrair questões de um PDF e formatá-las EXATAMENTE no formato JSON aceito pelo nosso sistema.

ESTRUTURA JSON EXIGIDA:
[
  {
    "enunciado": "HTML com o texto da questão",
    "texto_base": "HTML com o texto de apoio/contexto (se houver, senão null)",
    "resposta_professor": "HTML com o comentário detalhado e explicação da resposta (OBRIGATÓRIO)",
    "disciplina": "${disciplinaName}",
    "assunto": "Escolha um da lista abaixo",
    "subassunto": "Escolha um da lista abaixo (se houver correspondência)",
    "subsubassunto": "Escolha um da lista abaixo (se houver correspondência)",
    "banca": "Nome da Banca (ex: FGV, Cebraspe, FCC)",
    "ano": "2024",
    "dificuldade": "Fácil, Médio ou Difícil",
    "modalidade": "Multipla Escolha (5), Multipla Escolha (4) ou Certo/Errado",
    "alternativas": [
      { "id": "1", "texto": "Texto da alternativa", "isCorreta": true/false },
      ...
    ]
  }
]

REGRAS CRÍTICAS:
1. DISCIPLINA: Todas as questões extraídas pertencem à disciplina: ${disciplinaName}
2. HIERARQUIA DE ASSUNTOS (USE APENAS ESTES NOMES):
${hierarchyText || "- Sem classificação"}

3. FALLBACK: Se uma questão não se encaixar em nenhum assunto acima, utilize como assunto: "Sem classificação".
4. EXPLICAÇÃO: Nunca deixe o campo "resposta_professor" vazio. Extraia ou gere um comentário sobre a resposta correta.
5. FORMATO: Retorne APENAS o array JSON, sem blocos de código Markdown ou conversas extras.

EXEMPLO DE ALTERNATIVAS:
- Multipla Escolha (5): 5 alternativas de ID 1 a 5.
- Multipla Escolha (4): 4 alternativas de ID 1 a 4.
- Certo/Errado: 2 alternativas (id: "1", texto: "Certo") e (id: "2", texto: "Errado").
`;

    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt_ia_extracao_${disciplinaName.toLowerCase().replace(/\s+/g, '_')}.txt`;
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

          // Preparar as questões com mapeamento de IDs
          const processedQuestions = [];

          for (const item of content) {
            const disciplineObj = item.disciplina ? disciplinas.find(x => x.name.trim().toLowerCase() === item.disciplina?.trim().toLowerCase()) : null;
            const bancaObj = item.banca ? bancas.find(x => x.name.trim().toLowerCase() === item.banca?.trim().toLowerCase()) : null;

            if (!disciplineObj) continue; // Pular se não tiver disciplina válida

            // 1. Mapear Assunto
            let subjectObj = assuntos.find(x =>
              x.name.trim().toLowerCase() === (item.assunto || 'Sem classificação').trim().toLowerCase() &&
              x.disciplina_id === disciplineObj.id
            );

            // 2. Mapear Subassunto (só se houver assunto e item.subassunto)
            let subSubjectObj = null;
            if (subjectObj && item.subassunto) {
              subSubjectObj = subjectObj.subassuntos?.find(sa => 
                sa.name.trim().toLowerCase() === item.subassunto?.trim().toLowerCase()
              );
            }

            // 3. Mapear Subsubassunto (só se houver subassunto e item.subsubassunto)
            let subSubSubjectObj = null;
            if (subSubjectObj && item.subsubassunto) {
              subSubSubjectObj = subSubjectObj.subsubassuntos?.find(ssa => 
                ssa.name.trim().toLowerCase() === item.subsubassunto?.trim().toLowerCase()
              );
            }

            // Se ainda não achou assunto, tenta o fallback definitivo
            if (!subjectObj) {
              subjectObj = assuntos.find(x => 
                x.name.trim().toLowerCase() === 'sem classificação' && 
                x.disciplina_id === disciplineObj.id
              );
            }

            if (item.enunciado) {
              processedQuestions.push({
                enunciado: item.enunciado,
                texto_base: item.texto_base || null,
                text_base_id: item.text_base_id || null,
                resposta_professor: item.resposta_professor || '',
                disciplina_id: disciplineObj.id,
                assunto_id: subjectObj?.id || null,
                subassunto_id: subSubjectObj?.id || null,
                subsubassunto_id: subSubSubjectObj?.id || null,
                banca_id: bancaObj?.id || null,
                ano: String(item.ano || new Date().getFullYear()),
                dificuldade: item.dificuldade || 'Médio',
                modalidade: item.modalidade || 'Multipla Escolha (5)',
                alternativas: (item.alternativas || []).map((alt: any, idx: number) => ({
                  id: alt.id || String(idx + 1),
                  texto: alt.texto || '',
                  isCorreta: !!alt.isCorreta
                })),
                is_validada: true,
                validator_id: currentUser?.id || null
              });
            }
          }

          if (processedQuestions.length === 0) {
            alert('Nenhuma questão válida encontrada no JSON (Verifique os nomes das disciplinas).');
            return;
          }

          // Tela de confirmação antes de importar
          const confirmed = window.confirm(`Deseja importar as ${processedQuestions.length} questões encontradas no arquivo?`);
          if (!confirmed) {
            if (fileInputImportRef.current) fileInputImportRef.current.value = '';
            return;
          }

          setLoading(true);
          const { error } = await supabase.from('questions').insert(processedQuestions);
          if (error) throw error;

          alert(`${processedQuestions.length} questões importadas com sucesso!`);
          fetchQuestions();
        } catch (err) {
          console.error('Import Error:', err);
          alert('Erro ao processar arquivo JSON.');
        } finally {
          setLoading(false);
          if (fileInputImportRef.current) fileInputImportRef.current.value = '';
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
        validator_id: formData.validator_id || null,
        subassunto_id: formData.subassunto_id || null,
        subsubassunto_id: formData.subsubassunto_id || null
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
                    onChange={e => setFormData({ ...formData, assunto_id: e.target.value, subassunto_id: '', subsubassunto_id: '' })}
                    disabled={!formData.disciplina_id}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none disabled:opacity-50"
                  >
                    <option value="">Selecione...</option>
                    {assuntos.filter(a => a.disciplina_id === formData.disciplina_id).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                {formData.assunto_id && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subassunto</label>
                    <select
                      value={formData.subassunto_id}
                      onChange={e => setFormData({ ...formData, subassunto_id: e.target.value, subsubassunto_id: '' })}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    >
                      <option value="">Selecione...</option>
                      {(assuntos.find(a => a.id === formData.assunto_id) as any)?.subassuntos?.map((sa: any) => (
                        <option key={sa.id} value={sa.id}>{sa.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.subassunto_id && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sub-subassunto</label>
                    <select
                      value={formData.subsubassunto_id}
                      onChange={e => setFormData({ ...formData, subsubassunto_id: e.target.value })}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    >
                      <option value="">Selecione...</option>
                      {(assuntos.find(a => a.id === formData.assunto_id) as any)?.subassuntos
                        ?.find((sa: any) => sa.id === formData.subassunto_id)?.subsubassuntos?.map((ssa: any) => (
                          <option key={ssa.id} value={ssa.id}>{ssa.name}</option>
                        ))}
                    </select>
                  </div>
                )}
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
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all uppercase text-xs tracking-widest ${isSelectionMode ? 'bg-amber-100 text-amber-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <span className="material-symbols-outlined">{isSelectionMode ? 'close' : 'checklist_rtl'}</span>
            {isSelectionMode ? 'Sair da Seleção' : 'Ação em Massa'}
          </button>

          {isSelectionMode && selectedIds.size > 0 && (
            <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 uppercase text-xs tracking-widest"
              >
                <span className="material-symbols-outlined">edit_note</span>
                Editar ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100 uppercase text-xs tracking-widest"
              >
                <span className="material-symbols-outlined">delete_sweep</span>
                Excluir
              </button>
            </div>
          )}

          {!isSelectionMode && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 uppercase text-xs tracking-widest"
            >
              <span className="material-symbols-outlined">add</span>
              Nova Questão
            </button>
          )}
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
            setFilterAssuntos([]);
            setFilterSubassuntos([]);
            setFilterSubsubassuntos([]);
          }}
          className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none"
        >
          <option value="">Disciplinas (Todas)</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="relative col-span-1 xl:col-span-2">
          <button
            onClick={() => setIsTreeFilterOpen(!isTreeFilterOpen)}
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-left flex items-center justify-between"
          >
            <span className="truncate">
              {filterAssuntos.length + filterSubassuntos.length + filterSubsubassuntos.length > 0 
                ? `${filterAssuntos.length + filterSubassuntos.length + filterSubsubassuntos.length} Selecionados` 
                : "Assuntos / Tópicos"}
            </span>
            <span className="material-symbols-outlined">expand_more</span>
          </button>

          {isTreeFilterOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-[400px] overflow-y-auto p-4 scrollbar-none">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por Assunto</span>
                <button
                  onClick={() => {
                    setFilterAssuntos([]);
                    setFilterSubassuntos([]);
                    setFilterSubsubassuntos([]);
                  }}
                  className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700"
                >
                  Limpar Tudo
                </button>
              </div>

              {assuntos.filter(a => !filterDisciplina || a.disciplina_id === filterDisciplina).map(a => {
                const hasSub = (a.subassuntos?.length || 0) > 0;
                const isSelected = filterAssuntos.includes(a.id);

                const toggleAssunto = () => {
                  if (isSelected) {
                    setFilterAssuntos(prev => prev.filter(id => id !== a.id));
                    // Deselect children too? User says "Ao marcar, subassuntos serão selecionados". 
                    // Usually this implies checking everything.
                    const subIds = (a.subassuntos || []).map(s => s.id);
                    const subSubIds = (a.subassuntos || []).flatMap(s => (s as any).subsubassuntos || []).map((ss: any) => ss.id);
                    setFilterSubassuntos(prev => prev.filter(id => !subIds.includes(id)));
                    setFilterSubsubassuntos(prev => prev.filter(id => !subSubIds.includes(id)));
                  } else {
                    setFilterAssuntos(prev => [...prev, a.id]);
                    const subIds = (a.subassuntos || []).map(s => s.id);
                    const subSubIds = (a.subassuntos || []).flatMap(s => (s as any).subsubassuntos || []).map((ss: any) => ss.id);
                    setFilterSubassuntos(prev => Array.from(new Set([...prev, ...subIds])));
                    setFilterSubsubassuntos(prev => Array.from(new Set([...prev, ...subSubIds])));
                  }
                };

                return (
                  <div key={a.id} className="space-y-1 mb-2">
                    <div className="flex items-center gap-2 group">
                      {hasSub ? (
                        <button
                          onClick={() => {
                            const next = new Set(treeExpandedIds);
                            if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                            setTreeExpandedIds(next);
                          }}
                          className="size-5 flex items-center justify-center text-slate-300 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {treeExpandedIds.has(a.id) ? 'expand_more' : 'chevron_right'}
                          </span>
                        </button>
                      ) : (
                        <div className="size-5" />
                      )}
                      <div 
                        onClick={toggleAssunto}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`size-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <span className="material-symbols-outlined text-[12px] font-black">check</span>}
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-600'}`}>
                          {a.name}
                        </span>
                      </div>
                    </div>

                    {hasSub && treeExpandedIds.has(a.id) && a.subassuntos?.map((sa: any) => {
                      const hasSubSub = (sa.subsubassuntos?.length || 0) > 0;
                      const isSubSelected = filterSubassuntos.includes(sa.id);

                      const toggleSub = () => {
                        if (isSubSelected) {
                          setFilterSubassuntos(prev => prev.filter(id => id !== sa.id));
                          const subSubIds = (sa.subsubassuntos || []).map((ss: any) => ss.id);
                          setFilterSubsubassuntos(prev => prev.filter(id => !subSubIds.includes(id)));
                        } else {
                          setFilterSubassuntos(prev => [...prev, sa.id]);
                          const subSubIds = (sa.subsubassuntos || []).map((ss: any) => ss.id);
                          setFilterSubsubassuntos(prev => Array.from(new Set([...prev, ...subSubIds])));
                        }
                      };

                      return (
                        <div key={sa.id} className="ml-5 space-y-1 border-l-2 border-slate-50 pl-2">
                          <div className="flex items-center gap-2 group">
                            {hasSubSub ? (
                              <button
                                onClick={() => {
                                  const next = new Set(treeExpandedIds);
                                  if (next.has(sa.id)) next.delete(sa.id); else next.add(sa.id);
                                  setTreeExpandedIds(next);
                                }}
                                className="size-5 flex items-center justify-center text-slate-300 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {treeExpandedIds.has(sa.id) ? 'expand_more' : 'chevron_right'}
                                </span>
                              </button>
                            ) : (
                              <div className="size-5" />
                            )}
                            <div 
                              onClick={toggleSub}
                              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${isSubSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                            >
                              <div className={`size-4 rounded border flex items-center justify-center transition-all ${isSubSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 bg-white'}`}>
                                {isSubSelected && <span className="material-symbols-outlined text-[12px] font-black">check</span>}
                              </div>
                              <span className={`text-[10px] font-bold uppercase ${isSubSelected ? 'text-indigo-600' : 'text-slate-500'}`}>
                                {sa.name}
                              </span>
                            </div>
                          </div>

                          {hasSubSub && treeExpandedIds.has(sa.id) && sa.subsubassuntos?.map((ssa: any) => {
                            const isSubSubSelected = filterSubsubassuntos.includes(ssa.id);

                            return (
                              <div 
                                key={ssa.id}
                                onClick={() => {
                                  if (isSubSubSelected) setFilterSubsubassuntos(prev => prev.filter(id => id !== ssa.id));
                                  else setFilterSubsubassuntos(prev => [...prev, ssa.id]);
                                }}
                                className={`ml-7 flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-all ${isSubSubSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                              >
                                <div className={`size-3.5 rounded border flex items-center justify-center transition-all ${isSubSubSelected ? 'bg-indigo-400 border-indigo-400 text-white' : 'border-slate-200 bg-white'}`}>
                                  {isSubSubSelected && <span className="material-symbols-outlined text-[10px] font-black">check</span>}
                                </div>
                                <span className={`text-[10px] font-medium uppercase ${isSubSubSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                                  ↳ {ssa.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
              {isSelectionMode && (
                <th className="px-8 py-5 text-left w-10">
                  <div 
                    onClick={toggleSelectAll}
                    className={`size-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${selectedIds.size === questoes.length && questoes.length > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                  >
                    {selectedIds.size === questoes.length && questoes.length > 0 && <span className="material-symbols-outlined text-xs">check</span>}
                  </div>
                </th>
              )}
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enunciado</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Metadados</th>
              <th 
                className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-500 transition-colors group"
                onClick={() => {
                  if (sortBy === 'created_at') setSortAsc(!sortAsc);
                  else { setSortBy('created_at'); setSortAsc(false); }
                }}
              >
                <div className="flex items-center gap-1">
                  Inclusão
                  <span className={`material-symbols-outlined text-[14px] transition-all ${sortBy === 'created_at' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                    {sortBy === 'created_at' ? (sortAsc ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                  </span>
                </div>
              </th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={isSelectionMode ? 5 : 4} className="p-20 text-center"><div className="size-8 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div><p className="text-xs font-black text-slate-300 uppercase tracking-widest">Sincronizando Banco...</p></td></tr>
            ) : questoes.length === 0 ? (
              <tr><td colSpan={isSelectionMode ? 5 : 4} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Nenhuma questão encontrada</td></tr>
            ) : (
              questoes.map((q) => (
                <tr key={q.id} className={`hover:bg-slate-50/30 transition-all group ${selectedIds.has(q.id) ? 'bg-blue-50/20' : ''}`}>
                  {isSelectionMode && (
                    <td className="px-8 py-6">
                      <div 
                        onClick={() => toggleSelect(q.id)}
                        className={`size-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${selectedIds.has(q.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                      >
                        {selectedIds.has(q.id) && <span className="material-symbols-outlined text-sm font-black">check</span>}
                      </div>
                    </td>
                  )}
                  <td className="px-8 py-6 max-w-md">
                    <div className="text-sm font-bold text-slate-700 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.disciplinas?.name}</span>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.assuntos?.name}</span>
                      {q.subassuntos?.name && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-wider">{q.subassuntos.name}</span>}
                      {q.subsubassuntos?.name && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-wider">↳ {q.subsubassuntos.name}</span>}
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black border border-blue-100 uppercase tracking-wider">{q.bancas?.sigla || q.bancas?.name}</span>
                      <span className="px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-bold uppercase tracking-wider">{q.ano}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${q.dificuldade === 'Fácil' ? 'bg-green-50 text-green-600' : q.dificuldade === 'Médio' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>{q.dificuldade}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-600 uppercase">
                        {q.created_at ? new Date(q.created_at).toLocaleDateString('pt-BR') : '---'}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 mt-0.5">
                        {q.created_at ? new Date(q.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
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
                      <button onClick={() => setPreviewQuestion(q)} className="size-10 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Visualizar Questão"><span className="material-symbols-outlined text-[22px]">visibility</span></button>
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
      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800">Visualizar Questão</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Modo de Teste</p>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="size-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50">
              <InteractiveQuestion
                question={{
                  id: previewQuestion.id,
                  enunciado: previewQuestion.enunciado,
                  texto_base: previewQuestion.texto_base,
                  text_bases: previewQuestion.text_bases,
                  alternativas: (previewQuestion.alternativas || []).map((alt, i) => ({
                    id: `${previewQuestion.id}-${i}`,
                    texto: alt.texto,
                    isCorreta: alt.isCorreta
                  })),
                  resposta_professor: previewQuestion.resposta_professor,
                  bancas: previewQuestion.bancas,
                  disciplinas: previewQuestion.disciplinas,
                  assuntos: previewQuestion.assuntos,
                  ano: previewQuestion.ano
                }}
              />
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button
                  onClick={async () => {
                    await toggleValidation(previewQuestion.id, previewQuestion.is_validada);
                    setPreviewQuestion(prev => prev ? ({ ...prev, is_validada: !prev.is_validada }) : null);
                  }}
                  className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${previewQuestion.is_validada ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <span className="material-symbols-outlined text-lg">{previewQuestion.is_validada ? 'check_circle' : 'pending'}</span>
                  {previewQuestion.is_validada ? 'Validada' : 'Validar Questão'}
                </button>

                <button
                  onClick={() => {
                    const tag = `[QUESTÃO INTERATIVA ID: "${previewQuestion.id}"]`;
                    navigator.clipboard.writeText(tag);
                    alert('Tag copiada para a área de transferência!');
                  }}
                  className="flex-1 md:flex-none px-6 py-2.5 bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">content_copy</span>
                  Copiar Tag Apostila
                </button>
              </div>

              <button
                onClick={() => setPreviewQuestion(null)}
                className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Edit Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800">Ação em Massa</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{selectedIds.size} questões selecionadas</p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="size-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <span className="material-symbols-outlined">category</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">Mover para Disciplina/Assunto</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <select
                    value={bulkFormData.disciplina_id}
                    onChange={e => setBulkFormData({ ...bulkFormData, disciplina_id: e.target.value, assunto_id: '', subassunto_id: '', subsubassunto_id: '' })}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="">Manter Disciplina Atual</option>
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>

                  <select
                    value={bulkFormData.assunto_id}
                    onChange={e => setBulkFormData({ ...bulkFormData, assunto_id: e.target.value, subassunto_id: '', subsubassunto_id: '' })}
                    disabled={!bulkFormData.disciplina_id}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50"
                  >
                    <option value="">Manter Assunto Atual</option>
                    {assuntos.filter(a => a.disciplina_id === bulkFormData.disciplina_id).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>

                  {bulkFormData.assunto_id && (
                    <select
                      value={bulkFormData.subassunto_id}
                      onChange={e => setBulkFormData({ ...bulkFormData, subassunto_id: e.target.value, subsubassunto_id: '' })}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="">Selecione Subassunto (Opcional)</option>
                      {(assuntos.find(a => a.id === bulkFormData.assunto_id) as any)?.subassuntos?.map((sa: any) => (
                        <option key={sa.id} value={sa.id}>{sa.name}</option>
                      ))}
                    </select>
                  )}

                  {bulkFormData.subassunto_id && (
                    <select
                      value={bulkFormData.subsubassunto_id}
                      onChange={e => setBulkFormData({ ...bulkFormData, subsubassunto_id: e.target.value })}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="">Selecione Sub-subassunto (Opcional)</option>
                      {(assuntos.find(a => a.id === bulkFormData.assunto_id) as any)?.subassuntos
                        ?.find((sa: any) => sa.id === bulkFormData.subassunto_id)?.subsubassuntos?.map((ssa: any) => (
                          <option key={ssa.id} value={ssa.id}>{ssa.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <span className="material-symbols-outlined">corporate_fare</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">Alterar Banca</span>
                </div>
                
                <select
                  value={bulkFormData.banca_id}
                  onChange={e => setBulkFormData({ ...bulkFormData, banca_id: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">Manter Banca Atual</option>
                  {bancas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-emerald-600 mb-4">
                  <span className="material-symbols-outlined">rule</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">Alterar Status de Validação</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkFormData({ ...bulkFormData, is_validada: bulkFormData.is_validada === true ? undefined : true })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bulkFormData.is_validada === true ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Validada
                  </button>
                  <button
                    onClick={() => setBulkFormData({ ...bulkFormData, is_validada: bulkFormData.is_validada === false ? undefined : false })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bulkFormData.is_validada === false ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Pendente
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold italic">* Selecione para alterar ou deixe desmarcado para manter o status original.</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={loading}
                className="flex-1 py-3 bg-[#137fec] text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-600 shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                {loading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[18px]">done_all</span>}
                Aplicar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsAdmin;
