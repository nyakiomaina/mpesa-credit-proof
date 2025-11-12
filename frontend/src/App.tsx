import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { SignIn } from './pages/SignIn';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { GenerateProof } from './pages/GenerateProof';
import { ProofShare } from './pages/ProofShare';
import { Upload } from './pages/Upload';
import { Verify } from './pages/Verify';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/verify" element={<Verify />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/generate-proof"
            element={
              <ProtectedRoute>
                <GenerateProof />
              </ProtectedRoute>
            }
          />
          <Route
            path="/proof/:proofId"
            element={
              <ProtectedRoute>
                <ProofShare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
