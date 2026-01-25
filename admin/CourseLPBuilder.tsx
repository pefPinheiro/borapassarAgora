import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LPConfig {
    title_size: string;
    title_color?: string;
    show_video: boolean;
    video_url?: string;
    font_family: string;
    content_width: string;
    bg_glow_intensity: number;
    extra_items: { type: 'text' | 'image' | 'button'; content: string; style?: any }[];
}

interface Props {
    courseId: string;
    initialData: any;
    onClose: () => void;
    onSave: (config: any) => void;
}

const CourseLPBuilder: React.FC<Props> = ({ courseId, initialData, onClose, onSave }) => {
    const [config, setConfig] = useState<LPConfig>(initialData.lp_config || {
        title_size: 'text-7xl',
        show_video: false,
        font_family: 'Inter',
        content_width: 'max-w-5xl',
        bg_glow_intensity: 15,
        extra_items: []
    });

    const [activeModel, setActiveModel] = useState(initialData.lp_model || 'modelo-1');
    const [activeStyle, setActiveStyle] = useState(initialData.lp_style || 'style-blue');
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

    const saveCustomization = async () => {
        const { error } = await supabase
            .from('courses')
            .update({
                lp_config: config,
                lp_model: activeModel,
                lp_style: activeStyle
            })
            .eq('id', courseId);

        if (error) alert('Erro ao salvar: ' + error.message);
        else {
            onSave(config);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-[#050505] flex overflow-hidden font-sans">
            {/* Sidebar de Ferramentas */}
            <div className="w-80 h-full border-r border-white/10 bg-[#0a0a0a] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">LP Builder v1</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {/* Estrutura e Estilo */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelo & Cor</label>
                        <select
                            value={activeModel}
                            onChange={e => setActiveModel(e.target.value)}
                            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                        >
                            <option value="modelo-1">Elegante</option>
                            <option value="modelo-2">Minimalista</option>
                            <option value="modelo-3">Moderno</option>
                            <option value="modelo-4">Rústico</option>
                            <option value="modelo-5">Split</option>
                            <option value="modelo-6">Divertido</option>
                        </select>
                        <div className="grid grid-cols-5 gap-2">
                            {['blue', 'green', 'red', 'gold', 'purple'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setActiveStyle(`style-${c}`)}
                                    className={`size-8 rounded-full border-2 ${activeStyle === `style-${c}` ? 'border-white' : 'border-transparent'}`}
                                    style={{ backgroundColor: c === 'blue' ? '#137fec' : c === 'green' ? '#10b981' : c === 'red' ? '#f43f5e' : c === 'gold' ? '#f59e0b' : '#a855f7' }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Tipografia */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ajuste de Título</label>
                        <div className="flex flex-col gap-3">
                            <span className="text-[11px] text-slate-400">Tamanho da Fonte</span>
                            <div className="grid grid-cols-4 gap-2">
                                {['text-4xl', 'text-6xl', 'text-8xl', 'text-[120px]'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setConfig({ ...config, title_size: s })}
                                        className={`p-2 rounded-lg text-[10px] font-bold ${config.title_size === s ? 'bg-white text-black' : 'bg-white/5 text-white/50'}`}
                                    >
                                        {s.includes('[') ? 'MAX' : s.split('-')[1]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Elementos Extras */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Elementos do Hero</label>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Mostrar Vídeo</span>
                            <button
                                onClick={() => setConfig({ ...config, show_video: !config.show_video })}
                                className={`w-10 h-6 rounded-full transition-all relative ${config.show_video ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${config.show_video ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                        {config.show_video && (
                            <input
                                type="text"
                                placeholder="ID do Vídeo (YouTube/Vimeo)"
                                value={config.video_url}
                                onChange={e => setConfig({ ...config, video_url: e.target.value })}
                                className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-[10px] text-white"
                            />
                        )}
                    </div>

                    {/* Atmosfera */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atmosfera (Glow)</label>
                        <input
                            type="range" min="0" max="50"
                            value={config.bg_glow_intensity}
                            onChange={e => setConfig({ ...config, bg_glow_intensity: parseInt(e.target.value) })}
                            className="w-full accent-white"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-[#050505]">
                    <button
                        onClick={saveCustomization}
                        className="w-full py-4 bg-[#137fec] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                    >
                        Salvar Design
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-[#111] flex flex-col">
                <div className="h-16 border-b border-white/5 flex items-center justify-center gap-4">
                    <button onClick={() => setPreviewMode('desktop')} className={`px-4 py-2 rounded-lg text-xs font-bold ${previewMode === 'desktop' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Desktop</button>
                    <button onClick={() => setPreviewMode('mobile')} className={`px-4 py-2 rounded-lg text-xs font-bold ${previewMode === 'mobile' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Mobile</button>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/double_lined.png')] bg-repeat">
                    <div className={`bg-white shadow-2xl transition-all duration-500 overflow-y-auto no-scrollbar rounded-2xl ${previewMode === 'desktop' ? 'w-full h-full' : 'w-[375px] h-[667px]'}`}>
                        {/* Simulação simplificada de como vai ficar */}
                        <div className="min-h-full" style={{ backgroundColor: activeStyle === 'style-white' ? '#fff' : '#050505', backgroundImage: `radial-gradient(circle at 50% 0%, ${activeStyle === 'style-blue' ? '#137fec' : '#10b981'}15, transparent)` }}>
                            <nav className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/20">
                                <div className="size-4 bg-slate-500 rounded-full"></div>
                                <div className="flex gap-4"><div className="w-10 h-2 bg-slate-700 rounded"></div><div className="w-10 h-2 bg-slate-700 rounded"></div></div>
                            </nav>
                            <div className="p-12 text-center space-y-8">
                                <div className={`font-black uppercase italic tracking-tighter leading-none mx-auto ${config.title_size}`} style={{ color: activeStyle === 'style-white' ? '#111' : '#fff' }}>
                                    {initialData.title}
                                </div>
                                {config.show_video && (
                                    <div className="max-w-xl mx-auto aspect-video bg-black rounded-3xl flex items-center justify-center border border-white/10">
                                        <span className="material-symbols-outlined text-4xl text-white/20">play_circle</span>
                                    </div>
                                )}
                                <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-slate-100/5 border border-white/5 text-slate-400 text-sm italic">
                                    Preview da descrição formatada...
                                </div>
                                <div className="max-w-sm mx-auto p-10 bg-blue-600 rounded-[40px] text-white">
                                    <p className="font-black text-3xl">R$ {initialData.price_offer}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseLPBuilder;
