
import React from 'react';

interface SupportAdminProps {
  type: 'faq' | 'tickets';
}

const SupportAdmin: React.FC<SupportAdminProps> = ({ type }) => {
  const tickets = [
    { id: '#1289', user: 'Marcos P.', subject: 'Erro ao baixar PDF', priority: 'Alta', status: 'Pendente' },
    { id: '#1290', user: 'Ana Julia', subject: 'Dúvida aula 03', priority: 'Normal', status: 'Em Atendimento' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black">{type === 'faq' ? 'Gestão de FAQ' : 'Tickets de Suporte'}</h2>
          <p className="text-slate-500">Responda dúvidas e gerencie o conteúdo de ajuda.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          {type === 'faq' ? 'Nova Pergunta' : 'Ver Chat Online'}
        </button>
      </div>

      {type === 'tickets' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticket</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Aluno</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Assunto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prioridade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 text-sm font-black text-primary">{t.id}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{t.user}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.subject}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase ${t.priority === 'Alta' ? 'text-red-500' : 'text-slate-400'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-600 text-[10px] font-black uppercase">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-start gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 mb-2">Como resetar minha senha de acesso?</h4>
                <p className="text-sm text-slate-500">Para resetar sua senha, basta clicar em "Esqueci minha senha" na tela de login e seguir os passos enviados por e-mail.</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-slate-300 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                <button className="p-2 text-slate-300 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportAdmin;
