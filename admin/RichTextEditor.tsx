import React from 'react';
import TiptapEditor from './TiptapEditor';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, minHeight = '250px' }) => {
  return (
    <div className="rich-text-editor-container">
      <TiptapEditor
        content={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    </div>
  );
};

export default RichTextEditor;
