import { Link } from 'react-router-dom';
import { ShieldCheck, Building2, CheckCircle2, Lock, Zap, Eye } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center mb-8">
          <ShieldCheck className="w-12 h-12 text-green-600 mr-3" />
          <h1 className="text-3xl font-bold text-slate-900">M-Pesa Credit Proof</h1>
        </div>

        <section className="text-center mb-16">
          <h2 className="text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
            Prove Your M-Pesa Business<br />Creditworthiness Without<br />Sharing Raw Transactions
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Generate verifiable credit proofs using zero-knowledge technology.
            Lenders see your creditworthiness, not your private transaction data.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
          <Link
            to="/onboarding"
            className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-transparent hover:border-green-500"
          >
            <div className="bg-green-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors">
              <Building2 className="w-8 h-8 text-green-600 group-hover:text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">I am a Business</h3>
            <p className="text-slate-600 mb-4">
              Upload your M-Pesa statements, generate a privacy-preserving proof, and share it with lenders.
            </p>
            <span className="text-green-600 font-semibold group-hover:underline">
              Generate Proof →
            </span>
          </Link>

          <Link
            to="/verify"
            className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-transparent hover:border-blue-500"
          >
            <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <CheckCircle2 className="w-8 h-8 text-blue-600 group-hover:text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">I am a Lender</h3>
            <p className="text-slate-600 mb-4">
              Verify creditworthiness proofs from businesses using secure verification codes.
            </p>
            <span className="text-blue-600 font-semibold group-hover:underline">
              Verify Proof →
            </span>
          </Link>
        </section>

        <section className="mb-16">
          <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                <span className="text-2xl font-bold text-green-600">1</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Upload M-Pesa Data</h4>
              <p className="text-slate-600">
                Business uploads CSV or Excel statements from their M-Pesa account
              </p>
            </div>

            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Generate ZK Proof</h4>
              <p className="text-slate-600">
                System computes credit score and generates a verifiable proof using RISC Zero zkVM
              </p>
            </div>

            <div className="text-center">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                <span className="text-2xl font-bold text-green-600">3</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Lender Verifies</h4>
              <p className="text-slate-600">
                Lender uses verification code to see metrics only, not raw transactions
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-12 mb-16 shadow-lg">
          <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Privacy-First Verification for Lenders
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <Lock className="w-12 h-12 text-green-600 mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Zero-Knowledge Proofs</h4>
              <p className="text-slate-600">
                RISC Zero zkVM technology. Mathematically verifiable without revealing data.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <Eye className="w-12 h-12 text-green-600 mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">See Metrics Only</h4>
              <p className="text-slate-600">
                Access credit scores, volume trends, and consistency metrics without transaction details.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <Zap className="w-12 h-12 text-green-600 mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Instant Verification</h4>
              <p className="text-slate-600">
                Enter a verification code and immediately see validated creditworthiness data.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 rounded-2xl p-12 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">What We Do Not Show Lenders</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="font-semibold">❌ Individual Transactions</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="font-semibold">❌ Customer Phone Numbers</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="font-semibold">❌ M-Pesa Message Details</p>
            </div>
          </div>
          <p className="mt-8 text-slate-300 max-w-2xl mx-auto">
            Your privacy is guaranteed by cryptographic proofs. Lenders gain confidence,
            you maintain control over your data.
          </p>
        </section>
      </div>
    </div>
  );
}
