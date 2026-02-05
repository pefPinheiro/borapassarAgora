import React, { useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Highlight } from '@tiptap/extension-highlight';
import { Youtube } from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { supabase } from '../lib/supabase';

const MenuButton = ({ onClick, isActive, icon, label }: any) => (
    <button
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`p-2 rounded-lg transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
        title={label}
    >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
);

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    minHeight?: string;
    uploadPath?: string;
}

export interface TiptapRef {
    insertContent: (html: string) => void;
}

const TiptapEditor = React.forwardRef<TiptapRef, TiptapEditorProps>(({ content, onChange, placeholder, minHeight = '400px', uploadPath = '' }, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const extensions = React.useMemo(() => [
        StarterKit,
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Image.configure({ inline: true, allowBase64: true }),
        Link.configure({ openOnClick: false }),
        Highlight,
        Youtube.configure({ width: 640, height: 480 }),
        Placeholder.configure({ placeholder: placeholder || 'Comece a escrever...' }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
    ], [placeholder]);

    const editor = useEditor({
        extensions,
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate max-w-none focus:outline-none p-10`,
                style: `min-height: ${minHeight};`,
            },
        },
    });

    React.useImperativeHandle(ref, () => ({
        insertContent: (html: string) => {
            editor?.chain().focus().insertContent(html).run();
        }
    }));

    if (!editor) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const upload = async () => {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                const path = uploadPath ? `${uploadPath}/${fileName}` : `apostilas/outros/${fileName}`;

                const { error: upError } = await supabase.storage
                    .from('public')
                    .upload(path, file);

                if (upError) throw upError;

                const { data: { publicUrl } } = supabase.storage
                    .from('public')
                    .getPublicUrl(path);

                editor.chain().focus().setImage({ src: publicUrl }).run();
            } catch (error: any) {
                alert('Erro upload: ' + (error.message || 'Erro desconhecido.'));
            }
        };
        upload();
    };

    return (
        <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white shadow-inner">
            <div className="flex flex-wrap items-center gap-1 p-4 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon="format_bold" label="Negrito" />
                <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon="format_italic" label="Itálico" />
                <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon="format_underlined" label="Sublinhado" />
                <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon="strikethrough_s" label="Riscado" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon="format_h1" label="Título 1" />
                <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon="format_h2" label="Título 2" />
                <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon="format_h3" label="Título 3" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon="format_align_left" label="Alinhar Esquerda" />
                <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon="format_align_center" label="Centralizar" />
                <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon="format_align_right" label="Alinhar Direita" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon="format_list_bulleted" label="Lista" />
                <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon="format_list_numbered" label="Lista Numerada" />
                <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon="format_quote" label="Citação" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <button
                    onClick={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                    title="Upload de Imagem"
                >
                    <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />

                <button
                    onClick={(e) => {
                        e.preventDefault();
                        const url = window.prompt('URL do Link:');
                        if (url) editor.chain().focus().setLink({ href: url }).run();
                    }}
                    className={`p-2 rounded-lg transition-all ${editor.isActive('link') ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <span className="material-symbols-outlined text-[20px]">link</span>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-2" />

                {/* Special BPA Tags */}
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--AVISO--] Digite o aviso aqui... [/--AVISO--]</p>').run()} icon="warning" label="Inserir Aviso" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--IMPORTANTE--] Digite o ponto importante... [/--IMPORTANTE--]</p>').run()} icon="priority_high" label="Inserir Importante" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--LEI--] Cole o texto da lei aqui... [/--LEI--]</p>').run()} icon="gavel" label="Inserir Lei" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--LINK--] Cole o link ou recurso aqui... [/--LINK--]</p>').run()} icon="add_link" label="Inserir Link Extra" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--OBSERVE--] Sua observação aqui... [/--OBSERVE--]</p>').run()} icon="visibility" label="Inserir Observação" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--FREQUENTE--] Conteúdo frequente aqui... [/--FREQUENTE--]</p>').run()} icon="local_fire_department" label="Inserir Frequente" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--EXTRA--] Conteúdo extra aqui... [/--EXTRA--]</p>').run()} icon="add_circle" label="Inserir Extra" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--EXEMPLO--] Exemplo prático... [/--EXEMPLO--]</p>').run()} icon="lightbulb" label="Inserir Exemplo" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--NOVIDADE--] Novidade aqui... [/--NOVIDADE--]</p>').run()} icon="auto_awesome" label="Inserir Novidade" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--BORA-PRATICAR--] Hora de praticar agora... [/--BORA-PRATICAR--]</p>').run()} icon="fitness_center" label="Inserir Bora Praticar Agora" />
                <MenuButton onClick={() => editor.chain().focus().insertContent('<p>[--TITULO--] TÍTULO DO CAPÍTULO [/--TITULO--]</p>').run()} icon="subject" label="Inserir Título" />

                <div className="w-px h-6 bg-slate-200 mx-2" />

                <MenuButton onClick={() => editor.chain().focus().unsetAllMarks().run()} icon="format_color_reset" label="Limpar Formatação" />
            </div>
            <EditorContent editor={editor} />
        </div>
    );
});

export default TiptapEditor;
