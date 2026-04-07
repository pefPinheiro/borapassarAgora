
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  progress?: number;
  imageUrl: string;
  price?: number;
  lastAccess?: string;
}

export interface Notice {
  id: string;
  title: string;
  date: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Question {
  id: string;
  text: string;
  subject: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  banca: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: 'Aberto' | 'Em Andamento' | 'Resolvido';
  date: string;
}

export interface Disciplina {
  id: string;
  name: string;
  cat: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
  topics?: number; // Calculated field for UI
}

export interface Assunto {
  id: string;
  name: string;
  disciplina_id: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
}

export interface Subassunto {
  id: string;
  name: string;
  assunto_id: string;
  status: 'Ativo' | 'Inativo';
  created_at?: string;
}

export interface Subsubassunto {
  id: string;
  name: string;
  subassunto_id: string;
  status: 'Ativo' | 'Inativo';
  created_at?: string;
}

export interface Alternativa {
  id: string;
  texto: string;
  isCorreta: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  status: string;
  boras_wallet?: number;
}

export interface TextBase {
  id: string;
  content: string;
  title?: string;
  created_at: string;
}

export interface Questao {
  id: string;
  enunciado: string;
  texto_base?: string;
  text_base_id?: string;
  resposta_professor?: string;
  disciplina_id: string;
  assunto_id: string;
  subassunto_id?: string;
  subsubassunto_id?: string;
  banca_id: string;
  ano: string;
  dificuldade: 'Fácil' | 'Médio' | 'Difícil';
  modalidade: string;
  alternativas: Alternativa[];
  is_validada: boolean;
  validator_id?: string;
  created_at?: string;
  // Joins
  disciplinas?: { name: string };
  assuntos?: { name: string };
  subassuntos?: { name: string };
  subsubassuntos?: { name: string };
  bancas?: { name: string; sigla?: string };
  text_bases?: { content: string; title?: string };
  validator?: { full_name: string };
}
export interface Simulado {
  id: string;
  title: string;
  banca_id?: string;
  duration: number;
  penalty: number;
  status: 'Ativo' | 'Inativo';
  created_at: string;
  // Joins
  bancas?: { name: string; sigla?: string };
  questions_count?: number;
}

export interface SimuladoQuestion {
  id: string;
  simulado_id: string;
  question_id: string;
  position: number;
  created_at: string;
  // Joins
  questao?: Questao;
}

export interface Apostila {
  id: string;
  title: string;
  description?: string;
  category?: string;
  banner_url?: string;
  estimated_time?: string; // Tempo estimado de leitura
  status: 'Ativo' | 'Inativo';
  content?: string;
  disciplina_id: string | null;
  assunto_id: string | null;
  author_id?: string;
  assigned_editor_id?: string;
  filters: {
    banca_id: string | null;
    disciplina_id: string | null;
    assunto_id: string | null;
    modalidade: string | null;
    ano: string | null;
    subassuntos_ids?: string[];
    subsubassuntos_ids?: string[];
  };
  created_at: string;
  updated_at: string;
  // Joins/Calculated
  units_count?: number;
  author?: { full_name: string };
  assigned_editor?: { full_name: string };
  disciplinas?: { name: string };
  commission_valid_until?: string;
  professor_id?: string;
  teacher?: Teacher;
  validation?: {
    structure: boolean;
    images: boolean;
    notebooks: boolean;
    questions: boolean;
  };
}

export interface Teacher {
  id: string;
  name: string;
  description?: string;
  disciplines_ids: string[];
  ad_images: string[];
  avatar_url?: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
  updated_at: string;
  // Joins
  disciplinas?: Disciplina[];
}


