import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Banca {
  id: string;
  name: string;
  sigla: string;
  status: 'Ativo' | 'Inativo';
  logo?: string;
  site?: string;
  created_at: string;
}

const Bancas: React.FC = () => {
  const [bancas, setBancas] = useState<Banca[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanca, setEditingBanca] = useState<Banca | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<Banca>>({
    name: '',
    sigla: '',
    status: 'Ativo',
    logo: '',
    site: ''
  });

  useEffect(() => {
    fetchBancas();
  }, []);

  const fetchBancas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bancas')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setBancas(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar bancas:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (banca?: Banca) => {
    if (banca) {
      setEditingBanca(banca);
      setFormData(banca);
    } else {
      setEditingBanca(null);
      setFormData({ name: '', sigla: '', status: 'Ativo', logo: '', site: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBanca(null);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingBanca) {
        const { error } = await supabase
          .from('bancas')
          .update({
            name: formData.name,
            sigla: formData.sigla,
            status: formData.status,
            site: formData.site,
          })
          .eq('id', editingBanca.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bancas')
          .insert([{
            name: formData.name,
            sigla: formData.sigla,
            status: formData.status,
            site: formData.site,
          }]);

        if (error) throw error;
      }

      await fetchBancas();
      handleCloseModal();
    } catch (err: any) {
      alert('Erro ao salvar banca: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta banca?')) {
      try {
        const { error } = await supabase
          .from('bancas')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchBancas();
      } catch (err: any) {
        alert('Erro ao excluir: ' + err.message);
      }
    }
  };

  const filteredBancas = bancas.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.sigla.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[#111418] text-3xl font-black tracking-tight">Bancas Examinadoras</h2>
          <p className="text-[#617589] font-medium">Cadastre e gerencie as instituições que organizam os concursos.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Banca
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-2xl border border-[#dbe0e6] shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#617589]">search</span>
          <input
            className="w-full h-12 pl-12 pr-4 bg-[#f8fafc] border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] text-sm transition-all"
            placeholder="Pesquisar por nome ou sigla..."
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="h-12 px-5 rounded-xl bg-white border border-slate-200 text-[#111418] text-sm font-bold hover:bg-slate-50 transition-all outline-none"
          >
            <option value="Todos">Status: Todos</option>
            <option value="Ativo">Ativos</option>
            <option value="Inativo">Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Bancas (Lista) */}
      <div className="bg-white rounded-2xl border border-[#dbe0e6] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center gap-4">
            <div className="size-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando bancas...</p>
          </div>
        ) : filteredBancas.length === 0 ? (
          <div className="p-20 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">account_balance</span>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhuma banca encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                  <th className="px-8 py-5">Instituição / Sigla</th>
                  <th className="px-8 py-5">Links</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredBancas.map((banca) => (
                  <tr key={banca.id} className="hover:bg-[#f8fafc] transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner uppercase font-black text-slate-300 text-sm shrink-0">
                          {banca.sigla ? banca.sigla.substring(0, 2) : <span className="material-symbols-outlined">account_balance</span>}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#111418]">{banca.name}</p>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-[#64748b] text-[9px] font-black rounded uppercase">
                            {banca.sigla}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {banca.site ? (
                        <a
                          href={banca.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#137fec] text-[10px] font-black uppercase rounded-lg hover:bg-blue-100 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">public</span>
                          Site Oficial
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold italic">Sem site</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${banca.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                        <div className={`size-1.5 rounded-full ${banca.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                        {banca.status}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenModal(banca)}
                          className="p-2 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(banca.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Section */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc]">
              <h3 className="text-xl font-black text-[#111418]">
                {editingBanca ? 'Editar Banca' : 'Nova Banca'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nome da Instituição</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Fundação Getúlio Vargas"
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Sigla</label>
                  <input
                    required
                    type="text"
                    value={formData.sigla}
                    onChange={e => setFormData({ ...formData, sigla: e.target.value })}
                    placeholder="Ex: FGV"
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Inativo' })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-bold text-slate-700"
                  >
                    <option value="Ativo">🟢 Ativo</option>
                    <option value="Inativo">⚪ Inativo</option>
                  </select>
                </div>
              </div>



              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Site Oficial</label>
                <input
                  type="url"
                  value={formData.site}
                  onChange={e => setFormData({ ...formData, site: e.target.value })}
                  placeholder="https://www.instituicao.org.br"
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 h-12 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="flex-[2] h-12 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingBanca ? 'Salvar Alterações' : 'Criar Banca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bancas;
