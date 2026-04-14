import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import LandingPage from './pages/LandingPage';
import CourseLandingPage from './pages/CourseLandingPage';
import AlunoLayout from './student/AlunoLayout';
import AlunoDashboard from './student/AlunoDashboard';
import CoursePlayer from './student/CoursePlayer';
import ApostilaReader from './student/ApostilaReader';
import SimuladoPlayer from './student/relax/SimuladoPlayer';
import SimuladoResults from './student/relax/SimuladoResults';
import NotebookPlayer from './student/relax/NotebookPlayer';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import Cursos from './admin/Cursos';
import InscricoesAdmin from './admin/InscricoesAdmin';
import ApostilasAdmin from './admin/ApostilasAdmin';
import Simulados from './admin/Simulados';
import CadernosAdmin from './admin/CadernosAdmin';
import QuestionsAdmin from './admin/QuestionsAdmin';
import Disciplinas from './admin/Disciplinas';
import Assuntos from './admin/Assuntos';
import Bancas from './admin/Bancas';
import SalesAdmin from './admin/SalesAdmin';
import CostsAdmin from './admin/CostsAdmin';
import PagamentosAdmin from './admin/PagamentosAdmin';
import FinancialBalance from './admin/FinancialBalance';
import CollaboratorAdmin from './admin/CollaboratorAdmin';
import ProfessorsAdmin from './admin/ProfessorsAdmin';
import FaqAdmin from './admin/FaqAdmin';
import TicketsAdmin from './admin/TicketsAdmin';
import ChatAdmin from './admin/ChatAdmin';
import MailAdmin from './admin/MailAdmin';
import ProfileConfig from './admin/ProfileConfig';
import InvestidoresAdmin from './admin/InvestidoresAdmin';
import ProfessorProfile from './admin/ProfessorProfile';
import ProfessorGuide from './admin/ProfessorGuide';
import FinancialDashboard from './admin/FinancialDashboard';
import StudentRedirect from './student/StudentRedirect';

import RelaxHub from './student/relax/RelaxHub';
import RelaxSimulados from './student/relax/RelaxSimulados';
import RelaxNotebooks from './student/relax/RelaxNotebooks';
import RelaxFiltros from './student/relax/RelaxFiltros';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/curso/:id" element={<CourseLandingPage />} />
      <Route path="/aluno/redirect" element={<StudentRedirect />} />
      
      {/* Aluno Routes */}
      <Route path="/aluno" element={<AlunoLayout />}>
        <Route index element={<AlunoDashboard />} />
        <Route path="curso/:id" element={<CoursePlayer />} />
        <Route path="apostila/:id" element={<ApostilaReader />} />
        <Route path="relax" element={<RelaxHub />} />
        <Route path="relax/simulados" element={<RelaxSimulados />} />
        <Route path="relax/cadernos" element={<RelaxNotebooks />} />
        <Route path="relax/filtros" element={<RelaxFiltros />} />
        <Route path="relax/simulado/:id" element={<SimuladoPlayer />} />
        <Route path="relax/simulado/resultado/:id" element={<SimuladoResults />} />
        <Route path="relax/caderno/:id" element={<NotebookPlayer />} />
      </Route>

      {/* Admin/Teacher Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        
        {/* Content Management */}
        <Route path="cursos" element={<Cursos />} />
        <Route path="inscricoes" element={<InscricoesAdmin />} />
        <Route path="apostilas" element={<ApostilasAdmin />} />
        <Route path="simulados" element={<Simulados />} />
        <Route path="cadernos" element={<CadernosAdmin />} />
        <Route path="questoes" element={<QuestionsAdmin />} />
        <Route path="disciplinas" element={<Disciplinas />} />
        <Route path="assuntos" element={<Assuntos />} />
        <Route path="bancas" element={<Bancas />} />

        {/* Financial */}
        <Route path="vendas" element={<SalesAdmin type="vendas" />} />
        <Route path="custos" element={<CostsAdmin />} />
        <Route path="pagamentos" element={<PagamentosAdmin />} />
        <Route path="balanco" element={<FinancialBalance />} />
        <Route path="investidores" element={<InvestidoresAdmin />} />
        <Route path="financeiro" element={<FinancialDashboard />} />

        {/* Teacher Specific */}
        <Route path="perfil-professor" element={<ProfessorProfile />} />
        <Route path="guia-professor" element={<ProfessorGuide />} />

        {/* User Management */}
        <Route path="colaboradores" element={<CollaboratorAdmin />} />
        <Route path="professores" element={<ProfessorsAdmin />} />

        {/* Support */}
        <Route path="faq" element={<FaqAdmin />} />
        <Route path="tickets" element={<TicketsAdmin />} />
        <Route path="chat" element={<ChatAdmin />} />
        <Route path="mail" element={<MailAdmin />} />
        <Route path="config" element={<ProfileConfig />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
