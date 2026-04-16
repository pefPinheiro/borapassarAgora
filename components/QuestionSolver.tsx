import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Questao } from '../types';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  thickness: number;
  type: 'pen' | 'highlighter' | 'eraser';
}

interface PageData {
  strokes: Stroke[];
  redoStack: Stroke[];
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface QuestionSolverProps {
  questions?: string[];
  questaoObjects?: Questao[];
  initialTitle?: string;
  professorAvatar?: string;
  onSave?: (data: any) => void;
  onClose?: () => void;
}

const QuestionSolver: React.FC<QuestionSolverProps> = ({ 
  questions = [
    "Enunciado 1: \n\n Considere que a função f(x) = ax² + bx + c passa pelos pontos (1,0) e (2,3). Determine o valor de a + b.",
    "Enunciado 2: \n\n Calcule o valor da integral de x² no intervalo [0, 2].",
    "Enunciado 3: \n\n Se log(x) = 2, qual o valor de x?"
  ],
  questaoObjects,
  initialTitle = "Minha Resolução de Questões",
  professorAvatar = "https://picsum.photos/100/100?random=1",
  onSave,
  onClose 
}) => {
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser' | 'pan'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [thicknesses, setThicknesses] = useState({
    pen: 3,
    highlighter: 8,
    eraser: 20
  });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showEnunciado, setShowEnunciado] = useState(true);
  const [showAvatar, setShowAvatar] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showThicknessSlider, setShowThicknessSlider] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [showTextBase, setShowTextBase] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Derived questions length
  const totalQuestions = questaoObjects?.length || questions?.length || 0;

  // Canvas Logic State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Canvas Logic State - Indexed by [questionIndex][pageNumber]
  const [pagesData, setPagesData] = useState<Record<number, Record<number, PageData>>>({
    0: { 1: { strokes: [], redoStack: [] } }
  });
  const [questionTotalPages, setQuestionTotalPages] = useState<Record<number, number>>({
    0: 1
  });

  const totalPages = questionTotalPages[currentQuestionIndex] || 1;

  // Full Screen Logic
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const colors = theme === 'dark' ? [
    { name: 'Branco', hex: '#ffffff' },
    { name: 'Amarelo', hex: '#fbbf24' },
    { name: 'Vermelho', hex: '#ef4444' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Verde', hex: '#22c55e' },
  ] : [
    { name: 'Preto', hex: '#1e293b' },
    { name: 'Azul Profundo', hex: '#1e40af' },
    { name: 'Vermelho', hex: '#dc2626' },
    { name: 'Marrom', hex: '#78350f' },
    { name: 'Verde', hex: '#166534' },
  ];

  // Adjust default color when theme changes
  useEffect(() => {
    setColor(theme === 'dark' ? '#ffffff' : '#1e293b');
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Drawing Handlers
  const startDrawing = (e: React.PointerEvent) => {
    if (showTextBase) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    const currentThickness = toolScales[activeTool as keyof typeof toolScales] || 1;
    const baseThickness = thicknesses[activeTool as keyof typeof thicknesses] || 3;

    const newStroke: Stroke = {
      points: [{ x, y }],
      color: activeTool === 'eraser' ? 'transparent' : color,
      thickness: baseThickness * currentThickness,
      type: activeTool as any
    };

    setPagesData(prev => {
      const qData = prev[currentQuestionIndex] || { 1: { strokes: [], redoStack: [] } };
      const pData = qData[currentPage] || { strokes: [], redoStack: [] };
      return {
        ...prev,
        [currentQuestionIndex]: {
          ...qData,
          [currentPage]: {
            ...pData,
            strokes: [...pData.strokes, newStroke],
            redoStack: []
          }
        }
      };
    });
  };

  const draw = (e: React.PointerEvent) => {
    if (showTextBase) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeTool === 'pan') {
      if (!isPanning) return;
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    setPagesData(prev => {
      const qData = prev[currentQuestionIndex];
      const pData = qData[currentPage];
      const strokes = [...pData.strokes];
      if (strokes.length === 0) return prev;
      
      const lastStroke = { ...strokes[strokes.length - 1] };
      lastStroke.points = [...lastStroke.points, { x, y }];
      strokes[strokes.length - 1] = lastStroke;

      return {
        ...prev,
        [currentQuestionIndex]: {
          ...qData,
          [currentPage]: { ...pData, strokes }
        }
      };
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setIsPanning(false);
  };

  const undo = () => {
    setPagesData(prev => {
      const qData = prev[currentQuestionIndex];
      const pData = qData[currentPage];
      if (pData.strokes.length === 0) return prev;

      const strokes = [...pData.strokes];
      const lastStroke = strokes.pop();
      const redoStack = [...pData.redoStack, lastStroke!];

      return {
        ...prev,
        [currentQuestionIndex]: {
          ...qData,
          [currentPage]: { ...pData, strokes, redoStack }
        }
      };
    });
  };

  const clearPage = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar Página',
      message: 'Tem certeza que deseja apagar todos os desenhos desta página?',
      onConfirm: () => {
        setPagesData(prev => ({
          ...prev,
          [currentQuestionIndex]: {
            ...(prev[currentQuestionIndex]),
            [currentPage]: { strokes: [], redoStack: [] }
          }
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const redo = () => {
    setPagesData(prev => {
      const qData = prev[currentQuestionIndex];
      const pData = qData[currentPage];
      if (pData.redoStack.length === 0) return prev;

      const redoStack = [...pData.redoStack];
      const nextStroke = redoStack.pop();
      const strokes = [...pData.strokes, nextStroke!];

      return {
        ...prev,
        [currentQuestionIndex]: {
          ...qData,
          [currentPage]: { ...pData, strokes, redoStack }
        }
      };
    });
  };

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const currentStrokes = pagesData[currentQuestionIndex]?.[currentPage]?.strokes || [];

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    currentStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      if (stroke.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1.0;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = stroke.color;
        
        if (stroke.type === 'highlighter') {
          ctx.globalAlpha = 0.4;
          ctx.globalCompositeOperation = theme === 'dark' ? 'screen' : 'multiply';
        }
      }

      ctx.lineWidth = stroke.thickness;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }
      
      if (stroke.points.length > 1) {
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
      }

      ctx.stroke();
      
      // Important for eraser: reset to source-over for next strokes or composite correctly
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    });

    ctx.restore();
  }, [pagesData, currentPage, theme, scale, offset]);

  const toolScales = { pen: 1, highlighter: 4, eraser: 2, pan: 1 };

  const containerBg = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#fcfdfd]';
  const toolbarBg = theme === 'dark' ? 'bg-white/10' : 'bg-slate-900/5';
  const toolbarBorder = theme === 'dark' ? 'border-white/20' : 'border-slate-200';
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const glassEffect = theme === 'dark' ? 'backdrop-blur-md' : 'backdrop-blur-sm';

  const currentQuestao = questaoObjects ? questaoObjects[currentQuestionIndex] : null;

  return (
    <div className={`fixed inset-0 ${containerBg} z-[9999] flex flex-col font-sans overflow-hidden select-none transition-colors duration-500`}>
      {/* Landscape Warning Overlay */}
      <div className="fixed inset-0 z-[10000] bg-slate-900 flex flex-col items-center justify-center p-6 text-center lg:hidden portrait:flex hidden">
        <span className="material-symbols-outlined text-6xl text-amber-400 animate-bounce mb-4">screen_rotation</span>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Gire o Celular</h2>
        <p className="text-slate-400 mt-2">Para uma melhor experiência de escrita, use o modo horizontal.</p>
      </div>

      {/* Top Bar */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-[98%] max-w-7xl h-14 ${toolbarBg} ${glassEffect} border ${toolbarBorder} rounded-2xl flex items-center justify-between px-6 z-50 shadow-2xl transition-all`}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`bg-transparent border-none ${textColor} font-black text-[10px] uppercase tracking-[0.1em] outline-none w-48 truncate`}
              placeholder="Título da Resolução"
            />
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} uppercase`}>Ativa</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
                    setCurrentPage(1);
                  }}
                  className={`${textColor} opacity-60 hover:opacity-100 disabled:opacity-20`}
                  disabled={currentQuestionIndex === 0}
                >
                  <span className="material-symbols-outlined text-sm">arrow_back_ios</span>
                </button>
                <span className={`text-[10px] font-black ${textColor}`}>{currentQuestionIndex + 1} / {totalQuestions}</span>
                <button 
                  onClick={() => {
                    setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1));
                    setCurrentPage(1);
                    // Init question data if doesn't exist
                    const nextIdx = currentQuestionIndex + 1;
                    if (!pagesData[nextIdx]) {
                      setPagesData(prev => ({ ...prev, [nextIdx]: { 1: { strokes: [], redoStack: [] } } }));
                      setQuestionTotalPages(prev => ({ ...prev, [nextIdx]: 1 }));
                    }
                  }}
                  className={`${textColor} opacity-60 hover:opacity-100 disabled:opacity-20`}
                  disabled={currentQuestionIndex === totalQuestions - 1}
                >
                  <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'} mx-2`}></div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowEnunciado(!showEnunciado)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${showEnunciado ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : `${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} ${textColor} hover:opacity-80`}`}
            >
              <span className="material-symbols-outlined text-[18px]">{showEnunciado ? 'visibility' : 'visibility_off'}</span>
              <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Questão</span>
            </button>

            {currentQuestao?.text_bases && (
              <button 
                onClick={() => setShowTextBase(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95`}
              >
                <span className="material-symbols-outlined text-[18px]">format_align_left</span>
                <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Texto Base</span>
              </button>
            )}
            
            <button 
              onClick={toggleFullScreen}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${isFullScreen ? 'bg-indigo-600 text-white' : `${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} ${textColor} hover:opacity-80`}`}
            >
              <span className="material-symbols-outlined text-[18px]">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
              <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Tela Cheia</span>
            </button>
          </div>
          
          <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'} mx-2`}></div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-100'} px-2 py-1 rounded-lg border ${toolbarBorder}`}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={`${textColor} opacity-60 hover:opacity-100 disabled:opacity-20`}
                disabled={currentPage === 1}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className={`text-[10px] font-black tabular-nums min-w-[3rem] text-center ${textColor}`}>{currentPage} / {totalPages}</span>
              <button 
                onClick={() => {
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1);
                  }
                }}
                className={`${textColor} opacity-60 hover:opacity-100 disabled:opacity-20`}
                disabled={currentPage === totalPages}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
            <button 
              onClick={() => {
                const next = totalPages + 1;
                setQuestionTotalPages(prev => ({ ...prev, [currentQuestionIndex]: next }));
                setPagesData(prev => ({ 
                  ...prev, 
                  [currentQuestionIndex]: { 
                    ...prev[currentQuestionIndex],
                    [next]: { strokes: [], redoStack: [] } 
                  } 
                }));
                setCurrentPage(next);
              }}
              className={`size-8 ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} rounded-lg flex items-center justify-center hover:opacity-80 transition-all border ${toolbarBorder}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${textColor}`}>add</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className={`size-9 rounded-xl flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-indigo-600 text-white shadow-lg'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}></div>
          <button onClick={undo} className={`${textColor} opacity-40 hover:opacity-100 transition-colors tooltip`} title="Desfazer">
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button onClick={redo} className={`${textColor} opacity-40 hover:opacity-100 transition-colors tooltip`} title="Refazer">
            <span className="material-symbols-outlined">redo</span>
          </button>
          <button onClick={clearPage} className="px-4 h-9 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20 gap-2" title="Limpar Tudo">
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Limpar Tudo</span>
          </button>
          <button onClick={onClose} className="px-5 h-9 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20 gap-2">
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </div>

      {/* Floating Toolbar (Left) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
        <div className={`${theme === 'dark' ? 'bg-white/10' : 'bg-white shadow-2xl'} backdrop-blur-xl border ${toolbarBorder} p-2 rounded-[2.5rem] flex flex-col gap-2 shadow-2xl ring-1 ring-white/10`}>
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
                if (tool.id !== 'pan') {
                  setShowThicknessSlider(!showThicknessSlider);
                } else {
                  setShowThicknessSlider(false);
                }
              }}
              className={`size-14 rounded-full flex flex-col items-center justify-center transition-all relative group ${
                activeTool === tool.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40 scale-110' 
                  : `${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">{tool.icon}</span>
              <span className="text-[7px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-1">{tool.label}</span>
              {activeTool === tool.id && (tool.id === 'pen' || tool.id === 'highlighter') && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full"></div>
              )}
            </button>
          ))}
          
          <div className={`h-[1px] w-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'} my-1`}></div>
        </div>

        {/* Thickness Slider */}
        {showThicknessSlider && activeTool !== 'pan' && (
          <div className={`absolute left-20 top-0 ${theme === 'dark' ? 'bg-white/10' : 'bg-white border-slate-200 shadow-2xl'} backdrop-blur-xl border p-4 rounded-2xl flex flex-col items-center gap-4 shadow-2xl animate-in slide-in-from-left-4 duration-200`}>
            <div className="flex flex-col items-center gap-1">
               <span className="text-[10px] font-black text-blue-500">{thicknesses[activeTool as keyof typeof thicknesses]}px</span>
               <div className={`h-32 w-1.5 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'} rounded-full relative`}>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={thicknesses[activeTool as keyof typeof thicknesses]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setThicknesses(prev => ({ ...prev, [activeTool]: val }));
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [writing-mode:bt-lr] appearance-none" 
                  style={{ appearance: 'slider-vertical' }}
                />
                <div 
                  className="absolute bottom-0 w-full bg-blue-500 rounded-full" 
                  style={{ height: `${(thicknesses[activeTool as keyof typeof thicknesses] / 100) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className={`size-8 rounded-full border ${toolbarBorder} flex items-center justify-center`}>
              <div 
                className={`rounded-full ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'}`} 
                style={{ width: Math.min(thicknesses[activeTool as keyof typeof thicknesses], 24), height: Math.min(thicknesses[activeTool as keyof typeof thicknesses], 24) }}
              ></div>
            </div>
          </div>
        )}

        {/* Color Palette */}
        <div className={`${theme === 'dark' ? 'bg-white/10' : 'bg-white shadow-2xl'} backdrop-blur-xl border ${toolbarBorder} p-2 rounded-full flex flex-col gap-2 shadow-2xl`}>
          {colors.map((c) => (
            <button
              key={c.hex}
              onClick={() => setColor(c.hex)}
              className={`size-10 rounded-full flex items-center justify-center transition-all ${color === c.hex ? `ring-2 ${theme === 'dark' ? 'ring-white' : 'ring-blue-600'} ring-offset-2 ${theme === 'dark' ? 'ring-offset-[#1e1e1e]' : 'ring-offset-white'} scale-110` : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <span className={`material-symbols-outlined ${theme === 'dark' ? 'text-black' : 'text-white'} text-[18px] font-bold`}>check</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Professor Avatar */}
      <div className="absolute right-6 top-24 z-50 flex flex-col items-end gap-2">
        <button 
          onClick={() => setShowAvatar(!showAvatar)}
          className={`size-8 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'} flex items-center justify-center ${textColor} hover:opacity-80 transition-all`}
        >
          <span className="material-symbols-outlined text-sm">{showAvatar ? 'person_off' : 'person'}</span>
        </button>
        {showAvatar && (
          <div className="relative group p-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div 
              className="size-24 rounded-[22px] bg-cover bg-center border-2 border-white/20"
              style={{ backgroundImage: `url('${professorAvatar}')` }}
            ></div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg border border-slate-100 whitespace-nowrap">
               <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Professor Online</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Drawing Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        
        {/* Discrete Scratch Indicator (Only Page 2+) */}
        {currentPage > 1 && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-6 py-2 bg-blue-500/5 rounded-full border border-blue-500/10 z-20 animate-in fade-in slide-in-from-top-2">
             <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Área de Rascunho Livre • Página {currentPage}</span>
          </div>
        )}

        {/* Layer 0: Question Background (Only Page 1) */}
        <div 
          className={`absolute inset-0 flex items-center justify-center p-24 transition-opacity duration-500 ${showEnunciado && currentPage === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          <div className={`max-w-4xl w-full ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'} backdrop-blur-sm border p-12 rounded-[3.5rem] shadow-inner max-h-[85vh] overflow-y-auto custom-scrollbar`}>
            {currentQuestao ? (
              <div className="space-y-6">
                  <div 
                    className={`text-[22px] font-medium ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'} font-serif leading-relaxed q-content`}
                    dangerouslySetInnerHTML={{ __html: currentQuestao.enunciado }}
                  />
                  {currentQuestao.alternativas && (
                    <div className="grid grid-cols-1 gap-3 mt-8">
                      {currentQuestao.alternativas.map((alt, idx) => (
                        <div key={alt.id} className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/60' : 'bg-slate-50 border-slate-200 text-slate-500'} flex gap-4 text-sm font-medium`}>
                            <span className="font-black opacity-40">{String.fromCharCode(65 + idx)})</span>
                            <div dangerouslySetInnerHTML={{ __html: alt.texto }} />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ) : (
              <h1 className={`text-3xl font-medium ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'} font-serif leading-relaxed`}>
                  {questions ? questions[currentQuestionIndex] : 'Carregando enunciado...'}
              </h1>
            )}
          </div>
        </div>

        {/* Layer 1: Drawing Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className={`absolute inset-0 z-10 touch-none ${activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        />

        {/* Zoom Indicator */}
        <div className={`absolute right-8 bottom-8 z-50 flex items-center gap-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'} backdrop-blur-md border p-2 rounded-2xl`}>
           <button 
            onClick={() => setScale(prev => Math.max(0.2, prev - 0.1))}
            className={`size-10 rounded-xl hover:bg-blue-500/10 ${theme === 'dark' ? 'text-white/60' : 'text-slate-400'} hover:text-blue-500 transition-all`}
           >
             <span className="material-symbols-outlined">zoom_out</span>
           </button>
           <span className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} uppercase tracking-widest min-w-[40px] text-center`}>
            {Math.round(scale * 100)}%
           </span>
           <button 
            onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
            className={`size-10 rounded-xl hover:bg-blue-500/10 ${theme === 'dark' ? 'text-white/60' : 'text-slate-400'} hover:text-blue-500 transition-all`}
           >
             <span className="material-symbols-outlined">zoom_in</span>
           </button>
        </div>
      </div>

      {/* Text Base Modal */}
      {showTextBase && currentQuestao?.text_bases && (
        <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className={`max-w-4xl w-full max-h-[90vh] ${theme === 'dark' ? 'bg-[#2d343c] border-white/10' : 'bg-white border-slate-200'} border rounded-[40px] shadow-2xl overflow-hidden flex flex-col`}>
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white">
                       <span className="material-symbols-outlined text-3xl">format_align_left</span>
                    </div>
                    <div>
                       <h3 className={`text-xl font-black uppercase tracking-tight ${textColor}`}>Texto de Apoio</h3>
                       <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Referência para a questão ativa</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setShowTextBase(false)}
                  className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-all"
                 >
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1">
                 <div 
                   className={`text-lg font-medium leading-relaxed font-serif ${textColor} opacity-90 q-content`}
                   dangerouslySetInnerHTML={{ __html: currentQuestao.text_bases.content }}
                 />
              </div>
              <div className="p-6 bg-black/5 text-center">
                 <button 
                   onClick={() => setShowTextBase(false)}
                   className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-blue-600/20"
                 >
                    Entendido, Voltar à Lousa
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10005] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className={`max-w-md w-full ${theme === 'dark' ? 'bg-[#2d343c] border-white/10' : 'bg-white border-slate-200'} border p-8 rounded-[3.5rem] shadow-2xl space-y-6`}>
              <div className="size-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center">
                 <span className="material-symbols-outlined text-4xl">warning</span>
              </div>
              <div>
                 <h3 className={`text-xl font-black uppercase tracking-tight ${textColor}`}>{confirmModal.title}</h3>
                 <p className={`text-sm font-medium ${textColor} opacity-60 mt-2`}>{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                 <button 
                   onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                   className={`flex-1 py-4 ${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-900'} rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-all`}
                 >
                    Cancelar
                 </button>
                 <button 
                   onClick={confirmModal.onConfirm}
                   className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                 >
                    Sim, Limpar
                 </button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .q-content img {
          max-width: 100%;
          border-radius: 12px;
          margin: 1rem 0;
          display: block;
        }
        .q-content p {
          margin-bottom: 1rem;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default QuestionSolver;
