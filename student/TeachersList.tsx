
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TeachersList: React.FC = () => {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [disciplinas, setDisciplinas] = useState<any[]>([]);

    useEffect(() => {
        fetchTeachers();
        fetchDisciplinas();
    }, []);

    const fetchDisciplinas = async () => {
        const { data } = await supabase.from('disciplinas').select('id, name');
        if (data) setDisciplinas(data);
    };

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('teachers')
                .select('*')
                .eq('status', 'Ativo')
                .order('name');
            
            if (error) throw error;
            setTeachers(data || []);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenProfile = (id: string) => {
        setSelectedTeacherId(id);
        setIsModalOpen(true);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Convocando o Corredor dos Professores...</p>
        </div>
    );

    return (
        <div className="space-y-12 pb-20 animate-in fade-in duration-700">
            <header className="space-y-4">
                <h1 className="text-4xl font-black text-slate-900 uppercase italic leading-none tracking-tighter">
                    Corredor dos <span className="text-[#137fec]">Mestres</span>
                </h1>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest max-w-2xl">
                    Conheça a equipe de especialistas dedicada à sua aprovação. Clique no perfil para ver a trajetória e o método de cada professor.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {teachers.map(teacher => {
                    const teacherBanner = teacher.banner_url || (teacher.ad_images && teacher.ad_images.length > 0 ? teacher.ad_images[0] : null);
                    
                    return (
                        <div 
                            key={teacher.id}
                            onClick={() => handleOpenProfile(teacher.id)}
                            className="group bg-white rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-[#137fec]/10 transition-all duration-500 overflow-hidden cursor-pointer flex flex-col hover:-translate-y-2"
                        >
                            {/* Banner Section */}
                            <div className="h-40 absolute inset-0 w-full overflow-hidden bg-slate-900 z-0">
                                {teacherBanner ? (
                                    <img src={teacherBanner} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Banner" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-6xl text-white/5 font-thin tracking-widest uppercase italic">BORA PASSAR</span>
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white via-white/50 to-transparent" />
                            </div>

                        {/* Profile Info Overlay Positioned */}
                        <div className="px-8 pb-8 -mt-12 relative z-10 flex flex-col items-center text-center space-y-4 flex-1">
                            <div className="size-24 rounded-[30px] bg-white p-2 shadow-xl group-hover:rotate-3 transition-transform duration-500">
                                <div className="size-full rounded-[22px] bg-slate-100 overflow-hidden">
                                     {teacher.avatar_url ? (
                                        <img src={teacher.avatar_url} className="size-full object-cover" alt={teacher.name} />
                                     ) : (
                                        <div className="size-full flex items-center justify-center text-slate-300">
                                            <span className="material-symbols-outlined text-4xl">person</span>
                                        </div>
                                     )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{teacher.name}</h3>
                                <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                                    {(teacher.disciplines_ids || []).slice(0, 2).map((did: string) => (
                                        <span key={did} className="px-3 py-1 bg-blue-50 text-[8px] font-black text-blue-600 uppercase tracking-widest rounded-full">
                                            {disciplinas.find(d => d.id === did)?.name || 'Especialista'}
                                        </span>
                                    ))}
                                    {(teacher.disciplines_ids || []).length > 2 && (
                                        <span className="px-3 py-1 bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest rounded-full">
                                            +{(teacher.disciplines_ids || []).length - 2}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight line-clamp-2 px-2">
                                {teacher.description?.replace(/<[^>]*>/g, '').substring(0, 100) || 'Dedicado à excelência no ensino e aprovação recorde.'}...
                            </p>

                            <div className="pt-6 w-full mt-auto">
                                <div className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 rounded-[20px] text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] group-hover:bg-[#137fec] group-hover:text-white transition-all duration-500">
                                    Ver Perfil Completo
                                    <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>

            {/* Reuse Teacher Profile Modal */}
            {selectedTeacherId && (
                <TeacherProfileModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    teacherId={selectedTeacherId}
                />
            )}
        </div>
    );
};

// Internal Modal Component for Teacher Profile (Same as in ApostilaReader for consistency)
const TeacherProfileModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    teacherId?: string;
}> = ({ isOpen, onClose, teacherId }) => {
    const [teacher, setTeacher] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [disciplinas, setDisciplinas] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && teacherId) {
            fetchTeacher();
        }
    }, [isOpen, teacherId]);

    const fetchTeacher = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('teachers')
                .select('*')
                .eq('id', teacherId)
                .single();
            setTeacher(data);

            const { data: dData } = await supabase.from('disciplinas').select('id, name');
            if (dData) setDisciplinas(dData);
        } catch (e) {
            console.error('Error fetching teacher for modal:', e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const teacherBanner = teacher?.banner_url || (teacher?.ad_images && teacher?.ad_images.length > 0 ? teacher?.ad_images[0] : null);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 no-scrollbar">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-20 size-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-full flex items-center justify-center transition-all shadow-xl"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {loading ? (
                    <div className="h-96 flex items-center justify-center">
                        <div className="size-10 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : teacher ? (
                    <div className="flex flex-col">
                        <div className="h-48 md:h-80 relative bg-slate-900 overflow-hidden rounded-t-[40px]">
                            {teacherBanner ? (
                                <img src={teacherBanner} className="absolute inset-0 w-full h-full object-cover" alt="Banner" />
                            ) : (
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[120px] text-white/5 font-thin tracking-widest uppercase italic">BORA PASSAR</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />
                            
                            <div className="absolute -bottom-10 left-10 flex items-end gap-6">
                                <div className="size-24 md:size-32 rounded-[32px] bg-white p-2 shadow-2xl relative z-10">
                                    <div className="size-full rounded-[24px] bg-slate-100 overflow-hidden">
                                        {teacher.avatar_url ? (
                                            <img src={teacher.avatar_url} className="size-full object-cover" alt={teacher.name} />
                                        ) : (
                                            <div className="size-full flex items-center justify-center text-slate-300">
                                                <span className="material-symbols-outlined text-4xl">person</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="pb-4 block">
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight italic">{teacher.name}</h2>
                                    <p className="text-[10px] font-black text-[#137fec] uppercase tracking-[0.3em]">Professor Oficial</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-20 p-10 space-y-12">
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
                                    <span className="w-8 h-[2px] bg-[#137fec]" />
                                    Apresentação
                                </h3>
                                <div 
                                    className="text-slate-600 leading-relaxed ql-editor p-0 text-sm md:text-base bio-content"
                                    dangerouslySetInnerHTML={{ __html: teacher.description || '<p className="italic text-slate-300">Este professor preza pela discrição absoluta em seu método.</p>' }}
                                />
                                <style>{`
                                    .bio-content h2 { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem; }
                                    .bio-content h3 { font-size: 1.2rem; font-weight: 800; color: #137fec; margin: 1.5rem 0 0.75rem 0; text-transform: uppercase; }
                                    .bio-content p { margin-bottom: 1rem; }
                                    .bio-content blockquote { border-left: 4px solid #137fec; background: #f8fafc; padding: 1.5rem; border-radius: 0 16px 16px 0; font-style: italic; margin: 1.5rem 0; }
                                `}</style>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined">school</span>
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Especialidades</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {disciplinas.filter(d => teacher.disciplines_ids?.includes(d.id)).map(d => (
                                            <div key={d.id} className="px-4 py-2 bg-white border border-slate-100 rounded-2xl flex items-center gap-2">
                                                <div className="size-2 rounded-full bg-blue-400" />
                                                <span className="font-black text-[10px] uppercase tracking-wider text-slate-600">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">
                                            <span className="material-symbols-outlined">alternate_email</span>
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Contato Direto</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-xl font-black truncate">{teacher.corporate_email || "contato@borapassar.com"}</p>
                                        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                            <div className="size-2 rounded-full bg-emerald-400" />
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Docente Oficial Verificado</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default TeachersList;
