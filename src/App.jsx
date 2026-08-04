import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import QuestionnaireFill from './pages/QuestionnaireFill';
import QuestionnaireManager from './pages/QuestionnaireManager';
import TaskManager from './pages/TaskManager';
import Gamification from './pages/Gamification';
import ChatCareManager from './pages/ChatCareManager';
import NotificationCenter from './pages/NotificationCenter';
import CareOutreachManager from './pages/CareOutreachManager';
import CareOutreachDetail from './pages/CareOutreachDetail';
import BackendUserManagement from './pages/BackendUserManagement';
import Login from './pages/Login';
import { useAuth } from './context/useAuth';
import { ToastProvider } from './context/ToastContext';

const careOutreachEnabled = import.meta.env.VITE_CARE_OUTREACH_ENABLED === 'true';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen w-screen flex items-center justify-center">載入中...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center text-primary font-bold">Health Task Manager 載入中...</div>;
  }

  return (
    <Router>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/patients" replace /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><PatientList /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
          <Route path="/patients/:id/questionnaires/:templateId/fill" element={<ProtectedRoute><QuestionnaireFill /></ProtectedRoute>} />
          <Route path="/questionnaires" element={<ProtectedRoute><QuestionnaireManager /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TaskManager /></ProtectedRoute>} />
          <Route path="/gamification" element={<ProtectedRoute><Gamification /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatCareManager /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
          {careOutreachEnabled && <Route path="/care-outreach" element={<ProtectedRoute><CareOutreachManager /></ProtectedRoute>} />}
          {careOutreachEnabled && <Route path="/care-outreach/cases/:caseId" element={<ProtectedRoute><CareOutreachDetail /></ProtectedRoute>} />}
          
          {/* Admin only */}
          {isAdmin && (
            <Route path="/admin/users" element={<ProtectedRoute><BackendUserManagement /></ProtectedRoute>} />
          )}

          <Route path="*" element={<Navigate to="/patients" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;
