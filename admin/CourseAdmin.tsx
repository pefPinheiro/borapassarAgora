
import React from 'react';

interface CourseAdminProps {
  type: 'cursos' | 'apostilas' | 'simulados' | 'assuntos';
}

const CourseAdmin: React.FC<CourseAdminProps> = ({ type }) => {
  const titles = {
    cursos: 'Gestão de Cursos',
    apostilas: 'Gestão de Apostilas',
    simulados: 'Gestão de Simulados',
    assuntos: 'Gestão de Assuntos'
  };

  const data = [
    { id: 1, name: `Exemplo de ${type} 01`, category: 'Direito', status: 'Ativo', date: '10/01/2026' },
    { id: 2, name: `Exemplo de ${type} 02`, category: 'Português', status: 'Pendente', date: '12/01/2026' },
    { id: 3, name: `Exemplo de ${type} 03`, category: 'Informática', status: 'Ativo', date: '15/01/2026' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900">{titles[type]}</h2>
          <p className="text-slate-500">Adicione, edite ou remova conteúdos da plataforma.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          <span className="material-symbols-outlined">add</span>
          Novo Item
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Categoria</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Data</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-bold text-slate-900">{item.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">{item.category}</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{item.date}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CourseAdmin;
