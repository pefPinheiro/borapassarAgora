import React, { useState } from 'react';

interface QuestionSolverProps {
  questionText?: string;
  onSave?: (data: any) => void;
  onClose?: () => void;
}

const QuestionSolver: React.FC<QuestionSolverProps> = ({ 
  questionText = "Enunciado da Questão: \n\n Considere que a função f(x) = ax² + bx + c passa pelos pontos (1,0) e (2,3). Determine o valor de a + b.",
  onSave,
  onClose 
}) => {
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser' | 'pan'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [thickness, setThickness] = useState(3);
  const [showEnunciado, setShowEnunciado] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showThicknessSlider, setShowThicknessSlider] = useState(false);

  const colors = [
    { name: 'Branco', hex: '#ffffff' },
    { name: 'Amarelo', hex: '#fbbf24' },
    { name: 'Vermelho', hex: '#ef4444' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Verde', hex: '#22c55e' },
  ];

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] z-[9999] flex flex-col font-sans overflow-hidden select-none">
      {/* Landscape Warning Overlay */}
      <div className="fixed inset-0 z-[10000] bg-slate-900 flex flex-col items-center justify-center p-6 text-center lg:hidden portrait:flex hidden">
        <span className="material-symbols-outlined text-6xl text-amber-400 animate-bounce mb-4">screen_rotation</span>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Gire o Celular</h2>
        <p className="text-slate-400 mt-2">Para uma melhor experiência de escrita, use o modo horizontal.</p>
      </div>

      {/* Top Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-between px-6 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowEnunciado(!showEnunciado)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${showEnunciado ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{showEnunciado ? 'visibility' : 'visibility_off'}</span>
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Enunciado</span>
          </button>
          
          <div className="h-6 w-[1px] bg-white/20"></div>
          
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Página</span>
            <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="hover:text-white transition-colors disabled:opacity-30"
                disabled={currentPage === 1}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="text-sm font-bold tabular-nums min-w-[3rem] text-center">{currentPage} / {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="hover:text-white transition-colors disabled:opacity-30"
                disabled={currentPage === totalPages}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
            <button 
              onClick={() => {
                setTotalPages(prev => prev + 1);
                setCurrentPage(totalPages + 1);
              }}
              className="size-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
              title="Nova Página"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 text-white/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button className="p-2 text-white/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined">redo</span>
          </button>
          <div className="h-6 w-[1px] bg-white/20 mx-1"></div>
          <button 
            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-green-600/20 active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Finalizar
          </button>
          <button 
            onClick={onClose}
            className="size-9 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {/* Floating Toolbar (Left/Bottom depending on screen) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50 translate-x-0 transition-transform">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-2.5 rounded-[2rem] flex flex-col gap-2 shadow-2xl ring-1 ring-white/10">
          {[
            { id: 'pen', icon: 'edit', label: 'Caneta' },
            { id: 'highlighter', icon: 'stylus_note', label: 'Marca-texto' },
            { id: 'eraser', icon: 'ink_eraser', label: 'Borracha' },
            { id: 'pan', icon: 'pan_tool', label: 'Mover' },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as any);
                if (tool.id === 'pen' || tool.id === 'highlighter') {
                  setShowThicknessSlider(!showThicknessSlider);
                } else {
                  setShowThicknessSlider(false);
                }
              }}
              className={`size-14 rounded-full flex flex-col items-center justify-center transition-all relative group ${
                activeTool === tool.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40 scale-110' 
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">{tool.icon}</span>
              <span className="text-[7px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-1">{tool.label}</span>
              {activeTool === tool.id && (tool.id === 'pen' || tool.id === 'highlighter') && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full"></div>
              )}
            </button>
          ))}
          
          <div className="h-[1px] w-full bg-white/10 my-1"></div>
          
          <button 
            className="size-14 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
            onClick={() => {/* Trigger camera */}}
          >
            <span className="material-symbols-outlined text-[24px]">photo_camera</span>
          </button>
        </div>

        {/* Thickness Slider (shows when pen/highlighter is active and clicked again) */}
        {showThicknessSlider && (activeTool === 'pen' || activeTool === 'highlighter') && (
          <div className="absolute left-20 top-0 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex flex-col items-center gap-4 shadow-2xl animate-in slide-in-from-left-4 duration-200">
            <div className="h-32 w-1.5 bg-white/10 rounded-full relative">
              <input 
                type="range" 
                min="1" 
                max="20" 
                value={thickness}
                onChange={(e) => setThickness(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [writing-mode:bt-lr] appearance-none" 
                style={{ appearance: 'slider-vertical' }}
              />
              <div 
                className="absolute bottom-0 w-full bg-blue-500 rounded-full" 
                style={{ height: `${(thickness / 20) * 100}%` }}
              ></div>
            </div>
            <div className="size-8 rounded-full border border-white/20 flex items-center justify-center">
              <div 
                className="rounded-full bg-white" 
                style={{ width: thickness, height: thickness }}
              ></div>
            </div>
          </div>
        )}

        {/* Color Palette */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-full flex flex-col gap-2 shadow-2xl">
          {colors.map((c) => (
            <button
              key={c.hex}
              onClick={() => setColor(c.hex)}
              className={`size-10 rounded-full flex items-center justify-center transition-all ${color === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e1e] scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <span className="material-symbols-outlined text-black text-[18px] font-bold">check</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main Drawing Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-20 cursor-crosshair">
        {/* Layer 0: Question Background */}
        <div className={`absolute inset-0 flex items-center justify-center p-24 transition-all duration-500 ${showEnunciado ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="max-w-4xl w-full bg-white/5 backdrop-blur-sm border border-white/10 p-12 rounded-[3rem] shadow-inner">
            <h1 className="text-3xl font-medium text-white/90 font-serif leading-relaxed whitespace-pre-wrap">
              {currentPage === 1 ? questionText : `Rascunho Página ${currentPage}`}
            </h1>
          </div>
        </div>

        {/* Layer 1: Drawing Canvas (Mockup placeholder) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Real canvas would go here */}
          <svg className="w-full h-full opacity-40">
            {/* Some placeholder strokes to show it's active */}
            <path d="M 100 100 Q 150 150 200 100" stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round" />
            <path d="M 300 200 L 400 350" stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Zoom Indicator */}
        <div className="absolute right-8 bottom-8 flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl">
           <button className="size-10 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all">
             <span className="material-symbols-outlined">zoom_out</span>
           </button>
           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest min-w-[40px] text-center">100%</span>
           <button className="size-10 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all">
             <span className="material-symbols-outlined">zoom_in</span>
           </button>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};

export default QuestionSolver;
