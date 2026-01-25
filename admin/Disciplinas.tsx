
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Disciplina } from '../types';

const Disciplinas: React.FC = () => {
  const [items, setItems] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Disciplina | null>(null);
  const [formData, setFormData] = useState<Partial<Disciplina>>({
    name: '',
    cat: '',
    status: 'Ativo'
  });

  useEffect(() => {
    fetchDisciplinas();
  }, []);

  const fetchDisciplinas = async () => {
    setLoading(true);
    try {
      // Fetch disciplinas and count topics (assuntos)
      const { data: disciplinas, error: dError } = await supabase
        .from('disciplinas')
        .select(`
          *,
          assuntos:assuntos(count)
        `)
        .order('name');

      if (dError) throw dError;

      const formattedData = disciplinas.map(d => ({
        ...d,
        topics: d.assuntos?.[0]?.count || 0
      }));

      setItems(formattedData);
    } catch (error) {
      console.error('Error fetching disciplinas:', error);
      alert('Erro ao carregar disciplinas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: Disciplina) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        cat: item.cat,
        status: item.status
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', cat: '', status: 'Ativo' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('disciplinas')
        .upsert({
          id: editingItem?.id,
          name: formData.name,
          cat: formData.cat,
          status: formData.status
        });

      if (error) throw error;

      fetchDisciplinas();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving disciplina:', error);
      alert('Erro ao salvar disciplina');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta disciplina? Todos os assuntos relacionados também serão excluídos.')) {
      try {
        const { error } = await supabase
          .from('disciplinas')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchDisciplinas();
      } catch (error) {
        console.error('Error deleting disciplina:', error);
        alert('Erro ao excluir disciplina');
      }
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[#111418] text-3xl font-black leading-tight tracking-tight">Disciplinas</h2>
          <p className="text-[#617589] text-base font-medium">Controle o catálogo de matérias e suas categorias.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl h-12 px-6 bg-[#137fec] text-white text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Nova Disciplina</span>
        </button>
      </div>

      {/* Tabela de Disciplinas */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#dbe0e6] overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-medium">Carregando disciplinas...</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#f1f5f9] text-[#64748b] text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-5">Nome da Disciplina</th>
                  <th className="px-8 py-5">Categoria</th>
                  <th className="px-8 py-5 text-center">Assuntos</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-medium">
                      Nenhuma disciplina cadastrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f8fafc] transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-[#137fec] text-xs">
                            {item.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-black text-sm text-[#111418]">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1.5 bg-slate-100 text-[#64748b] text-[10px] font-black rounded-lg uppercase transition-all group-hover:bg-white group-hover:shadow-sm">
                          {item.cat}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-sm font-black text-[#111418]">{item.topics}</span>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Tópicos</p>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${item.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                          <div className={`size-1.5 rounded-full ${item.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-2 text-slate-400 hover:text-[#137fec] hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Section */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc]">
              <h3 className="text-xl font-black text-[#111418]">
                {editingItem ? 'Editar Disciplina' : 'Nova Disciplina'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nome da Disciplina</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Direito Processual Civil"
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Categoria</label>
                <input
                  required
                  type="text"
                  value={formData.cat}
                  onChange={e => setFormData({ ...formData, cat: e.target.value })}
                  placeholder="Ex: Jurídica, Geral, Exatas..."
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] outline-none transition-all font-medium"
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
                  className="flex-[2] h-12 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                >
                  {editingItem ? 'Salvar Alterações' : 'Criar Disciplina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Disciplinas;
