import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  role: string;
  tipoRemuneracao: 'Fixo' | 'Comissão';
  valorFixo?: number;
  periodoFixo?: 'Mensal' | 'Serviço';
  modulosPermitidos: string[];
  dataSolicitacao: string;
  avatar_url?: string;
  verTodosPagamentos?: boolean;
  receiveGeneralCommission?: boolean;
  // Extended Profile Info
  bio?: string;
  education_level?: string;
  study_area?: string;
  experiences?: any[];
  certificates?: any[];
  is_investor?: boolean;
}

const MODULOS_SISTEMA = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'cursos', label: 'Cursos', icon: 'auto_stories' },
  { id: 'apostilas', label: 'Apostilas', icon: 'description' },
  { id: 'simulados', label: 'Simulados', icon: 'assignment' },
  { id: 'questoes', label: 'Questões', icon: 'quiz' },
  { id: 'disciplinas', label: 'Disciplinas', icon: 'menu_book' },
  { id: 'assuntos', label: 'Assuntos', icon: 'topic' },
  { id: 'bancas', label: 'Bancas', icon: 'account_balance' },
  { id: 'vendas', label: 'Vendas', icon: 'payments' },
  { id: 'custos', label: 'Custos', icon: 'trending_up' },
  { id: 'pagamentos', label: 'Pagamentos Prof.', icon: 'receipt_long' },
  { id: 'balanco', label: 'Balanço Geral', icon: 'analytics' },
  { id: 'investidores', label: 'Investidores', icon: 'volunteer_activism' },
  { id: 'colaboradores', label: 'Colaboradores', icon: 'badge' },
  { id: 'inscricoes', label: 'Inscrições', icon: 'person_add' },
  { id: 'faq', label: 'FAQ', icon: 'help' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'mail', label: 'Email Marketing', icon: 'mail' },
];

const CollaboratorAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'pendentes'>('ativos');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); // New View State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null); // New Viewing ID

  const [formData, setFormData] = useState<Partial<Colaborador>>({
    cargo: '',
    status: 'Ativo',
    tipoRemuneracao: 'Comissão',
    valorFixo: 0,
    periodoFixo: 'Mensal',
    modulosPermitidos: [],
    role: 'editor'
  });

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const fetchCollaborators = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        // Filtrar no Banco apenas roles administrativos conhecidos. ISSO GARANTE QUE ALUNOS NÃO APAREÇAM.
        .in('role', ['admin', 'super', 'editor', 'teacher', 'moderator'])
        .order('full_name', { ascending: true });

      if (error) throw error;

      if (data) {
        // Redundancy check in JS to be sure
        const validProfiles = data.filter((p: any) => p.role !== 'student' && p.role !== 'user');

        const mapped: Colaborador[] = validProfiles.map((p: any) => ({
          id: p.id,
          nome: p.full_name || 'Sem Nome',
          email: p.email || 'Email não disponível',
          cargo: p.job_title || p.role,
          // Handle both English (DB) and Portuguese (UI Legagy) if mixed
          status: (p.status === 'pendente' || p.status === 'Pendente') ? 'Pendente' :
            (p.status === 'blocked' || p.status === 'Inativo') ? 'Inativo' : 'Ativo',
          role: p.role,
          tipoRemuneracao: p.payment_type || 'Comissão',
          valorFixo: p.fixed_payment_value || 0,
          periodoFixo: p.fixed_payment_period || 'Mensal',
          modulosPermitidos: p.allowed_modules || [],
          verTodosPagamentos: p.view_all_payments || false,
          receiveGeneralCommission: p.receive_general_commission || false,
          dataSolicitacao: new Date(p.created_at || p.updated_at || Date.now()).toLocaleDateString(),
          avatar_url: p.avatar_url,
          bio: p.bio,
          education_level: p.education_level,
          study_area: p.study_area,
          experiences: p.experiences || [],
          certificates: p.certificates || [],
          is_investor: p.is_investor || false
        }));
        setColaboradores(mapped);
      }
    } catch (error: any) {
      console.error('Error fetching collaborators:', error);
      alert('Erro ao carregar lista: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApprove = (colab: Colaborador) => {
    setEditingId(colab.id);
    setFormData({
      ...colab,
      status: 'Ativo',
      role: colab.role === 'user' ? 'editor' : colab.role // Suggest Upgrade if basic user
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (colab: Colaborador) => {
    setEditingId(colab.id);
    setFormData(colab);
    setIsModalOpen(true);
  };

  const handleOpenView = (colab: Colaborador) => {
    setViewingId(colab.id);
    setIsViewModalOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      // Map UI status back to DB status (English)
      const dbStatus = formData.status === 'Ativo' ? 'active' : (formData.status === 'Inativo' ? 'blocked' : 'pendente');

      const { error } = await supabase
        .from('profiles')
        .update({
          job_title: formData.cargo,
          status: dbStatus,

          payment_type: formData.tipoRemuneracao || 'Comissão',
          fixed_payment_value: Number(formData.valorFixo) || 0,
          fixed_payment_period: formData.periodoFixo || 'Mensal',
          allowed_modules: formData.modulosPermitidos || [],
          view_all_payments: Boolean(formData.verTodosPagamentos),
          receive_general_commission: Boolean(formData.receiveGeneralCommission),
          is_investor: Boolean(formData.is_investor),
          role: formData.role || 'editor'
        })
        .eq('id', editingId);

      if (error) throw error;

      alert('Colaborador atualizado com sucesso!');
      setIsModalOpen(false);
      fetchCollaborators();
    } catch (error: any) {
      console.error('Detailed Supabase Error:', error);
      const errorMsg = error.message || (error.code ? `Erro DB (${error.code})` : 'Erro desconhecido');
      alert('Erro ao atualizar: ' + errorMsg);
    }
  };

  const togglePermission = (moduleId: string) => {
    const permissions = formData.modulosPermitidos || [];
    setFormData({
      ...formData,
      modulosPermitidos: permissions.includes(moduleId)
        ? permissions.filter(id => id !== moduleId)
        : [...permissions, moduleId]
    });
  };

  const toggleAllPermissions = () => {
    if (formData.modulosPermitidos?.length === MODULOS_SISTEMA.length) {
      setFormData({ ...formData, modulosPermitidos: [] });
    } else {
      setFormData({ ...formData, modulosPermitidos: MODULOS_SISTEMA.map(m => m.id) });
    }
  };

  const pendentes = colaboradores.filter(c => c.status === 'Pendente');
  const ativos = colaboradores.filter(c => c.status !== 'Pendente');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Gestão da Equipe</h2>
          <p className="text-[#617589] font-medium">Aprovação de novos membros, funções e permissões de acesso.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`px-8 py-4 text-xs font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === 'ativos' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Membros da Equipe ({ativos.length})
          {activeTab === 'ativos' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
        </button>
        <button
          onClick={() => setActiveTab('pendentes')}
          className={`px-8 py-4 text-xs font-black uppercase tracking-[0.15em] transition-all relative flex items-center gap-2 ${activeTab === 'pendentes' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Solicitações Pendentes
          {pendentes.length > 0 && (
            <span className="bg-amber-100 text-amber-600 size-5 flex items-center justify-center rounded-full text-[10px] animate-pulse">
              {pendentes.length}
            </span>
          )}
          {activeTab === 'pendentes' && <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-600 rounded-t-full"></div>}
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="size-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400 mt-4 uppercase">Carregando equipe...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                  <th className="px-8 py-5">Colaborador</th>
                  <th className="px-8 py-5 text-center">Data Cadastro</th>

                  <th className="px-8 py-5">{activeTab === 'ativos' ? 'Acessos' : 'Status'}</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {(activeTab === 'ativos' ? ativos : pendentes).map((colab) => (
                  <tr key={colab.id} className="hover:bg-[#f8fafc] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        {colab.avatar_url ? (
                          <img src={colab.avatar_url} className="size-10 rounded-xl object-cover" alt="" />
                        ) : (
                          <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'ativos' ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-500'}`}>
                            <span className="material-symbols-outlined">{activeTab === 'ativos' ? 'person' : 'person_add'}</span>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-black text-[#111418] mb-0.5">{colab.nome}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">{colab.cargo || colab.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-medium text-slate-500">{colab.dataSolicitacao}</span>
                    </td>

                    <td className="px-8 py-6">
                      {activeTab === 'ativos' ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                          {colab.modulosPermitidos.length > 0 ? colab.modulosPermitidos.slice(0, 4).map(mId => (
                            <span key={mId} className="px-2 py-1 bg-slate-50 text-[9px] font-black text-slate-500 rounded-md border border-slate-100 uppercase">
                              {MODULOS_SISTEMA.find(m => m.id === mId)?.label || mId}
                            </span>
                          )) : (
                            <span className="text-[10px] text-slate-300 font-medium italic">Nenhum acesso especial</span>
                          )}
                          {colab.modulosPermitidos.length > 4 && (
                            <span className="px-2 py-1 bg-slate-100 text-[9px] font-bold text-slate-500 rounded-md">+{colab.modulosPermitidos.length - 4}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-amber-500 uppercase flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {activeTab === 'pendentes' ? (
                        <button
                          onClick={() => handleOpenApprove(colab)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 ml-auto shadow-md shadow-emerald-200"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Revisar & Aprovar
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenView(colab)}
                            className="size-8 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
                            title="Ver Perfil Completo"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(colab)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all text-xs font-bold flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                            Gerenciar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(activeTab === 'ativos' ? ativos : pendentes).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 text-xs font-bold italic">
                      Nenhum colaborador encontrado nesta categoria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="mb-8 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                  {editingId?.startsWith('pending') || colaboradores.find(c => c.id === editingId)?.status === 'Pendente' ? 'Aprovação de Cadastro' : 'Gestão de Colaborador'}
                </p>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                  {colaboradores.find(c => c.id === editingId)?.nome}
                </h3>
                <p className="text-sm text-slate-400 font-bold">{colaboradores.find(c => c.id === editingId)?.email}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="size-10 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 flex items-center justify-center transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cargo / Título Público</label>
                  <input
                    required
                    type="text"
                    value={formData.cargo}
                    onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Ex: Professor de Matemática"
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status da Conta</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className={`w-full h-12 px-4 border rounded-2xl font-bold outline-none ${formData.status === 'Ativo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      formData.status === 'Inativo' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}
                  >
                    <option value="Ativo">Ativo / Liberado</option>
                    <option value="Inativo">Bloqueado / Inativo</option>
                    <option value="Pendente">Pendente / Em Análise</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-blue-500">Nível de Acesso (Perfil)</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full h-12 px-4 bg-blue-50 border border-blue-100 rounded-2xl font-bold text-blue-700 outline-none focus:border-blue-500 transition-all font-black uppercase"
                  >
                    <option value="admin">Administrador (Admin)</option>
                    <option value="super">Super Administrador (Super)</option>
                    <option value="editor">Editor de Conteúdo</option>
                    <option value="teacher">Professor (Teacher)</option>
                    <option value="moderator">Moderador</option>
                    <option value="collaborator">Colaborador Geral</option>
                    <option value="student">Aluno / Usuário (Student)</option>
                  </select>
                </div>
              </div>

              {/* Permissões de Módulos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Módulos Permitidos no Menu</h4>
                  <button type="button" onClick={toggleAllPermissions} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase">
                    {formData.modulosPermitidos?.length === MODULOS_SISTEMA.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {MODULOS_SISTEMA.map(modulo => (
                    <div
                      key={modulo.id}
                      onClick={() => togglePermission(modulo.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border cursor-pointer transition-all aspect-square sm:aspect-auto sm:h-24 text-center ${formData.modulosPermitidos?.includes(modulo.id)
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <span className={`material-symbols-outlined text-[24px] ${formData.modulosPermitidos?.includes(modulo.id) ? 'text-blue-600' : 'text-slate-400'}`}>
                        {modulo.icon}
                      </span>
                      <span className={`text-[10px] font-black uppercase leading-tight ${formData.modulosPermitidos?.includes(modulo.id) ? 'text-blue-700' : 'text-slate-500'
                        }`}>{modulo.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">Configuração Financeira</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Como este colaborador será remunerado</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipoRemuneracao: 'Fixo' })}
                      className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.tipoRemuneracao === 'Fixo' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >FIXO</button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipoRemuneracao: 'Comissão' })}
                      className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.tipoRemuneracao === 'Comissão' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >COMISSÃO</button>
                  </div>
                </div>

                {formData.tipoRemuneracao === 'Fixo' ? (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-2 fade-in">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valor do Repasse (R$)</label>
                      <input
                        type="number"
                        value={formData.valorFixo}
                        onChange={e => setFormData({ ...formData, valorFixo: Number(e.target.value) })}
                        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Período</label>
                      <select
                        value={formData.periodoFixo}
                        onChange={e => setFormData({ ...formData, periodoFixo: e.target.value as any })}
                        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 transition-all"
                      >
                        <option>Mensal</option>
                        <option>Por Serviço/Entrega</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-blue-500">info</span>
                      <p className="text-xs text-blue-700 font-medium leading-relaxed">
                        A remuneração por comissão é calculada automaticamente. O colaborador recebe <strong>1 parte</strong> para cada apostila de sua autoria.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-blue-100 w-full">
                      <input
                        type="checkbox"
                        id="generalCommCheck"
                        checked={formData.receiveGeneralCommission || false}
                        onChange={e => setFormData({ ...formData, receiveGeneralCommission: e.target.checked })}
                        className="size-4 rounded border-blue-200 text-slate-900 focus:ring-0"
                      />
                      <label htmlFor="generalCommCheck" className="text-xs font-bold text-blue-800 cursor-pointer select-none">
                        Receber Comissão Geral (1 Cota Fixa)
                        <span className="block text-[10px] font-normal text-blue-600 mt-0.5">Se marcado, recebe 1 parte do rateio mesmo sem apostilas no curso (ex: coordenação, marketing).</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-blue-100 w-full mt-2">
                      <input
                        type="checkbox"
                        id="investorCheck"
                        checked={formData.is_investor || false}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          let newModules = formData.modulosPermitidos || [];
                          if (isChecked && !newModules.includes('investidores')) {
                            newModules = [...newModules, 'investidores'];
                          } else if (!isChecked && newModules.includes('investidores')) {
                            newModules = newModules.filter(m => m !== 'investidores');
                          }
                          setFormData({
                            ...formData,
                            is_investor: isChecked,
                            modulosPermitidos: newModules
                          });
                        }}
                        className="size-4 rounded border-amber-200 text-amber-600 focus:ring-0"
                      />
                      <label htmlFor="investorCheck" className="text-xs font-bold text-amber-800 cursor-pointer select-none">
                        Definir como Investidor (Cotista)
                        <span className="block text-[10px] font-normal text-amber-600 mt-0.5">Habilita o painel "Investidores" para este usuário visualizar suas cotas e rendimentos.</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* VISIBILIDADE DE PAGAMENTOS */}
                <div className="pt-6 border-t border-slate-200 mt-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">visibility</span>
                        Visualizar Todos os Pagamentos
                      </h5>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 max-w-sm leading-relaxed">
                        Habilite para que este colaborador possa ver o extrato financeiro de <strong>todos</strong> os membros da equipe no módulo de Pagamentos.
                      </p>
                    </div>
                    <div
                      onClick={() => setFormData({ ...formData, verTodosPagamentos: !formData.verTodosPagamentos })}
                      className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner flex items-center ${formData.verTodosPagamentos ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <div className={`size-6 bg-white rounded-full shadow-md transition-transform duration-300 ${formData.verTodosPagamentos ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >Cancelar</button>
                <button
                  type="submit"
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest active:scale-95"
                >
                  {colaboradores.find(c => c.id === editingId)?.status === 'Pendente' ? 'Aprovar Acesso' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PROFILE MODAL */}
      {isViewModalOpen && viewingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="relative bg-[#f8fafc] w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

            {/* Header with Cover-like background */}
            <div className="h-32 bg-slate-900 relative shrink-0">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-6 right-6 size-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-sm z-10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-10 pb-10 overflow-y-auto custom-scrollbar flex-1 -mt-16 relative z-0">
              {(() => {
                const profile = colaboradores.find(c => c.id === viewingId);
                if (!profile) return null;

                return (
                  <div className="space-y-8">
                    {/* Profile Header */}
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
                      <div className="size-32 rounded-[32px] bg-white p-1 shadow-lg">
                        <img src={profile.avatar_url || '/bora_passar_logo.png'} className="size-full rounded-[28px] object-cover bg-slate-100" />
                      </div>
                      <div className="mb-2">
                        <h2 className="text-3xl font-black text-slate-900">{profile.nome}</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">{profile.email}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">{profile.cargo || profile.role}</span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${profile.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{profile.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Left Column: Bio & Info */}
                      <div className="md:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Sobre</h4>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            {profile.bio || 'Nenhuma biografia informada.'}
                          </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Acadêmico</h4>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Escolaridade</p>
                            <p className="text-sm font-bold text-slate-800">{profile.education_level || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Área de Estudo</p>
                            <p className="text-sm font-bold text-slate-800">{profile.study_area || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Experience & Certs */}
                      <div className="md:col-span-2 space-y-6">
                        {/* Experiences */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                              <span className="material-symbols-outlined">work_history</span>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Experiência Profissional</h4>
                          </div>

                          <div className="space-y-6 relative before:absolute before:left-5 before:top-4 before:h-full before:w-0.5 before:bg-slate-100">
                            {profile.experiences && profile.experiences.length > 0 ? profile.experiences.map((exp: any, i: number) => (
                              <div key={i} className="relative z-10 pl-12">
                                <div className="absolute left-3 top-1.5 size-4 bg-amber-400 ring-4 ring-white rounded-full"></div>
                                <h5 className="font-bold text-slate-900">{exp.role}</h5>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{exp.company} • {exp.period}</p>
                                <p className="text-sm text-slate-600">{exp.description}</p>
                              </div>
                            )) : (
                              <p className="pl-12 text-slate-400 italic text-sm">Nenhuma experiência registrada.</p>
                            )}
                          </div>
                        </div>

                        {/* Certificates */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                              <span className="material-symbols-outlined">workspace_premium</span>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cursos & Certificados</h4>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {profile.certificates && profile.certificates.length > 0 ? profile.certificates.map((cert: any, i: number) => (
                              <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                                <h5 className="font-bold text-slate-800 text-sm line-clamp-1" title={cert.title}>{cert.title}</h5>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{cert.institution} • {cert.year}</p>
                              </div>
                            )) : (
                              <p className="col-span-2 text-slate-400 italic text-sm">Nenhum certificado registrado.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default CollaboratorAdmin;
