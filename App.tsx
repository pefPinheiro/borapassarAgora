
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AdminLayout from './admin/AdminLayout';
import StudentLayout from './student/StudentLayout';

// Common Pages
import NotFound from './pages/NotFound';
import AboutUs from './pages/AboutUs';
import Terms from './pages/Terms';

// Student Pages
import LandingPage from './student/LandingPage';
import CourseLandingPage from './pages/CourseLandingPage';
import Login from './student/Login';
import Register from './student/Register';
import MyCourses from './student/MyCourses';
import CourseView from './student/CourseView';
import SupportTicket from './student/SupportTicket';
import ProfileConfig from './student/ProfileConfig';
import CourseCatalog from './student/CourseCatalog';
import ChatStudent from './student/ChatStudent';
import QuestionsStudent from './student/QuestionsStudent';
import SimuladosStudent from './student/SimuladosStudent';
import PerformanceStudent from './student/PerformanceStudent';
import CoursePurchase from './student/CoursePurchase';
import CourseCheckout from './student/CourseCheckout';
import ApostilaReader from './student/ApostilaReader';
import CadernoView from './student/CadernoView';
import FaqStudent from './student/FaqStudent';

// Admin Pages
import Dashboard from './admin/Dashboard';
import Bancas from './admin/Bancas';
import Disciplinas from './admin/Disciplinas';
import QuestionsAdmin from './admin/QuestionsAdmin';
import CourseAdmin from './admin/CourseAdmin';
import SalesAdmin from './admin/SalesAdmin';
import CollaboratorAdmin from './admin/CollaboratorAdmin';
import SupportAdmin from './admin/SupportAdmin';
import CostsAdmin from './admin/CostsAdmin';
import ChatAdmin from './admin/ChatAdmin';
import Assuntos from './admin/Assuntos';
import Simulados from './admin/Simulados';
import ApostilasAdmin from './admin/ApostilasAdmin';
import Cursos from './admin/Cursos';
import InscricoesAdmin from './admin/InscricoesAdmin';
import PagamentosAdmin from './admin/PagamentosAdmin';
import FaqAdmin from './admin/FaqAdmin';
import TicketsAdmin from './admin/TicketsAdmin';
import MailAdmin from './admin/MailAdmin';
import AdminLogin from './admin/AdminLogin';
import AdminRegister from './admin/AdminRegister';
import CadernosAdmin from './admin/CadernosAdmin';
import InvestidoresAdmin from './admin/InvestidoresAdmin';
import FinancialBalance from './admin/FinancialBalance';
import ProfessorsAdmin from './admin/ProfessorsAdmin';
import ProfessorProfile from './admin/ProfessorProfile';
import StudentRedirect from './student/StudentRedirect';

import RelaxHub from './student/relax/RelaxHub';
import MillionChallenge from './student/relax/MillionChallenge';
import TrophyRoom from './student/relax/TrophyRoom';

import AuthGuard from './components/AuthGuard';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/curso/lp/:id" element={<CourseLandingPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/cadastro" element={<AdminRegister />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/quem-somos" element={<AboutUs />} />
        <Route path="/termos" element={<Terms />} />

        {/* Student Routes */}
        <Route path="/aluno" element={<StudentLayout />}>
          <Route index element={<StudentRedirect />} />
          <Route path="meus-cursos" element={<MyCourses />} />
          <Route path="catalogo" element={<CourseCatalog />} />
          <Route path="curso/:id" element={<CourseView />} />
          <Route path="curso/:id/comprar" element={<CoursePurchase />} />
          <Route path="curso/:id/checkout" element={<CourseCheckout />} />
          <Route path="suporte" element={<SupportTicket />} /> {/* Legacy/Tickets */}
          <Route path="faq" element={<FaqStudent />} />
          <Route path="config" element={<ProfileConfig />} />
        </Route>


        <Route path="/aluno/apostila/:id" element={<AuthGuard><ApostilaReader /></AuthGuard>} />
        <Route path="/aluno/caderno/:id" element={<AuthGuard><CadernoView /></AuthGuard>} />
        <Route path="/aluno/questoes" element={<AuthGuard><QuestionsStudent /></AuthGuard>} />
        <Route path="/aluno/simulado/:id" element={<AuthGuard><SimuladosStudent /></AuthGuard>} />


        {/* Relax Zone Routes */}
        <Route path="/aluno/curso/:courseId/relax" element={<RelaxHub />} />
        <Route path="/aluno/curso/:courseId/relax/desafio" element={<MillionChallenge />} />
        <Route path="/aluno/curso/:courseId/relax/trofeus" element={<TrophyRoom />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} /> {/* Corrected: Removed Navigate, directly render Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />

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

          {/* User Management */}
          <Route path="colaboradores" element={<CollaboratorAdmin />} />
          <Route path="professores" element={<ProfessorsAdmin />} />

          {/* Support */}
          <Route path="faq" element={<FaqAdmin />} />
          <Route path="tickets" element={<TicketsAdmin />} />
          <Route path="chat" element={<ChatAdmin />} />
          <Route path="mail" element={<MailAdmin />} />
          <Route path="config" element={<ProfileConfig />} />
          <Route path="perfil-professor" element={<ProfessorProfile />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
