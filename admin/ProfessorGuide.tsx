import React from 'react';

const GuideSection: React.FC<{ id: string; title: string; icon: string; color: 'blue' | 'amber' | 'emerald' | 'purple'; children: React.ReactNode }> = ({ id, title, icon, color, children }) => {
  const colorClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    amber: 'border-amber-100 bg-amber-50 text-amber-600',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    purple: 'border-purple-100 bg-purple-50 text-purple-600',
  };

  return (
    <section id={id} className="scroll-mt-24">
      <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center">
        <div className={`w-full p-8 md:p-12 flex flex-col md:flex-row items-center gap-6 border-b border-slate-100`}>
          <div className={`size-16 rounded-2xl flex items-center justify-center shrink-0 ${colorClasses[color]}`}>
            <span className="material-symbols-outlined text-3xl">{icon}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic transition-colors text-center md:text-left">{title}</h2>
        </div>
        <div className="p-8 md:p-12 w-full text-left">
          {children}
        </div>
      </div>
    </section>
  );
};

const StepCard: React.FC<{ number: string; title: string; desc: string }> = ({ number, title, desc }) => (
  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
    <div className="size-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-black mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">{number}</div>
    <h5 className="font-black text-sm uppercase text-slate-800 mb-2">{title}</h5>
    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{desc}</p>
  </div>
);

const ProfessorGuide: React.FC = () => {
    // We could fetch teacher data here too if needed, but the UI is mostly static instructions.
  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Header da Cartilha */}
      <div className="text-center space-y-4 max-w-4xl mx-auto mb-16">
        <div className="size-24 bg-blue-50 text-blue-600 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-sm">
          <span className="material-symbols-outlined text-5xl">auto_stories</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tight">Guia de Utilização Docente</h1>
        
        <p className="text-slate-500 font-medium text-lg pt-4">
          Preparamos este guia didático para você dominar todas as ferramentas da nossa plataforma.
          O objetivo é facilitar o seu trabalho e potencializar o aprendizado dos seus alunos.
        </p>
      </div>

      <nav className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <a href="#modulo-questoes" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-blue-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-blue-500 group-hover:scale-110 transition-transform">quiz</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Questões</span>
        </a>
        <a href="#modulo-cadernos" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-amber-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-amber-500 group-hover:scale-110 transition-transform">menu_book</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Cadernos</span>
        </a>
        <a href="#modulo-simulados" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-emerald-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-emerald-500 group-hover:scale-110 transition-transform">assignment</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Simulados</span>
        </a>
        <a href="#modulo-apostilas" className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-purple-500 hover:shadow-md transition-all group">
          <span className="material-symbols-outlined text-purple-500 group-hover:scale-110 transition-transform">description</span>
          <span className="font-black text-xs uppercase text-slate-700">Módulo de Apostilas</span>
        </a>
      </nav>

      {/* SEÇÃO: QUESTÕES */}
      <GuideSection id="modulo-questoes" title="Guia do Professor: Módulo de Questões" icon="quiz" color="blue">
        <div className="space-y-8">
          <p className="text-slate-600 leading-relaxed font-medium">
            Bem-vindo ao coração pedagógico da nossa plataforma! O módulo de Questões é onde você gerencia e cria o conteúdo acadêmico que dará vida às apostilas, simulados e aos nossos jogos (modo Relax).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-800 uppercase">1. O Banco de Questões</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Nesta tela, você visualiza todo o acervo disponível. Você pode filtrar questões por banca, disciplina, dificuldade e muito mais.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> <strong>Tipos:</strong> Bancas oficiais, inéditas, simulados ou Modo Relax.</li>
                <li className="flex gap-2"><span className="text-blue-500 font-black">•</span> <strong>Formatos:</strong> Múltipla escolha (4 ou 5 alternativas) e Certo/Errado.</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-600">visibility</span>
                <p className="text-sm font-black text-blue-900 uppercase">Visualização e o uso do ID</p>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                Ao clicar no ícone de Visualizar (o "olhinho"), você abre uma prévia da questão.
                <strong> Testar:</strong> Você pode responder para conferir a experiência do aluno.
                <strong> Copiar ID:</strong> Função vital! Clique para obter o código único e vinculá-lo a uma Apostila ou Simulado.
              </p>
            </div>
          </div>

          <div className="p-8 bg-amber-50 rounded-[32px] border-2 border-dashed border-amber-200 text-center space-y-4">
            <div className="size-12 bg-amber-200 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined">stars</span>
            </div>
            <h4 className="text-xl font-black text-amber-800 uppercase italic">Regra de Ouro (Qualidade)</h4>
            <p className="text-sm text-amber-900/70 font-medium max-w-2xl mx-auto">
              Toda questão deve, obrigatoriamente, conter o <strong>gabarito indicado</strong> e uma <strong>explicação/comentário do professor</strong>.
              Não é permitido salvar questões sem o embasamento pedagógico da resposta.
            </p>
          </div>

          <div className="space-y-6">
            <h4 className="text-lg font-black text-slate-800 uppercase border-l-4 border-blue-500 pl-4 text-left">3. Passo a Passo: Criando uma Nova Questão</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <StepCard number="A" title="Configurações" desc="Preencha Banca, Disciplina e Assunto. Escolha a Modalidade (Múltipla Escolha ou C/E) e Dificuldade." />
              <StepCard number="B" title="Conteúdo" desc="Use Texto Base para várias questões ou Enunciado Direto. Você pode Vincular IDs de textos existentes." />
              <StepCard number="C" title="Alternativas" desc="Insira o texto, marque a correta e escreva o Comentário do Professor detalhado." />
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: CADERNOS */}
      <GuideSection id="modulo-cadernos" title="Módulo de Cadernos: Teoria vs. Prática" icon="menu_book" color="amber">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">🎯 O que é um Caderno?</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  É um guia de estudos prático composto por uma lista de questões progressivas (em média 30). O objetivo é conduzir o aluno passo a passo, consolidando o aprendizado.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">📍 Onde os Cadernos ficam?</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Eles são o "gran finale" da teoria. Ficam posicionados sempre ao final de uma Apostila com o botão verde <strong>"Bora Praticar!"</strong>.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="bg-amber-100 rounded-[40px] p-8 space-y-4 border border-amber-200 shadow-inner">
                <div className="flex items-center gap-2 text-amber-800 font-black uppercase text-xs">
                  <span className="material-symbols-outlined">settings</span> Papel do Professor na criação
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">1</div>
                    <p className="text-xs text-amber-900/70 font-bold">Curadoria Pedagógica: Filtre e escolha as questões ideais no Banco.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">2</div>
                    <p className="text-xs text-amber-900/70 font-bold">Anote os IDs: Use o botão "Copiar ID" na ordem que o aluno deve responder.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 bg-amber-200 text-amber-700 rounded-lg flex items-center justify-center font-black shrink-0">3</div>
                    <p className="text-xs text-amber-900/70 font-bold">Solicite: Envie a lista de IDs e o tema para a equipe de suporte.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: SIMULADOS */}
      <GuideSection id="modulo-simulados" title="Módulo de Simulados: O Teste de Fogo" icon="assignment" color="emerald">
        <div className="space-y-10">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h4 className="text-xl font-black text-slate-800 uppercase mb-4 italic">🎯 Objetivo Pedagógico</h4>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Visa recriar a experiênica real de prova, treinando não apenas conhecimento, mas também gestão de tempo e controle emocional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">01</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Parâmetros</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Título claro, Tempo (cronômetro), Banca e Status (Ativo).</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">02</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Pontuação</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Pesos por disciplina e Peso Erro (fator de correção).</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">03</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Montagem</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Inserir as questões colando os IDs manualmente.</p>
            </div>
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center space-y-3">
              <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto font-black italic">04</div>
              <h5 className="font-black text-xs uppercase text-slate-800">Organizando</h5>
              <p className="text-[10px] text-slate-400 leading-tight">Reordenar questões ou remover as incorretas.</p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* SEÇÃO: APOSTILAS */}
      <GuideSection id="modulo-apostilas" title="Módulo de Apostilas: O Coração Interativo" icon="description" color="purple">
        <div className="space-y-12">
          <p className="text-slate-600 leading-relaxed font-medium">
            Integram teoria, prática e multimídia. O professor atua como um "garante" da qualidade técnica e pedagógica, assegurando que a experiência seja imersiva.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h4 className="text-xl font-black text-slate-800 uppercase italic">🛠️ O Editor Interativo</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Utilize botões coloridos para inserir elementos via TAGS:
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--QUESTAO--]</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--VIDEO--]</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-black uppercase tracking-wider">[--TAGS DE FORMATAÇÃO--]</span>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-[40px] p-8 shadow-2xl space-y-6">
              <h4 className="text-lg font-black uppercase tracking-tight text-white border-l-2 border-purple-400 pl-4">✅ O Fluxo de Validação</h4>
              <ul className="space-y-4 text-xs font-medium text-slate-400">
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Estrutura:</strong> Layout limpo, fontes e títulos (H1, H2) corretos.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Imagens:</strong> Avalie se precisa de mapas mentais ou gráficos adicionais.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Cadernos:</strong> Certifique-se de que estão vinculados ao final.</li>
                <li className="flex gap-3 items-start"><span className="material-symbols-outlined text-purple-400 text-sm">check_circle</span> <strong>Questões:</strong> Verifique se os IDs inseridos são pertinentes ao texto.</li>
              </ul>
            </div>
          </div>
        </div>
      </GuideSection>

      <div className="text-center pt-10 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Bora Passar Agora &copy; 2026</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ProfessorGuide;
