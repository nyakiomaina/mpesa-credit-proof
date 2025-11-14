import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  DollarSign,
  Lock,
  Eye,
  Zap
} from 'lucide-react';

interface ProofData {
  id: string;
  verification_code: string;
  credit_score: number;
  monthly_volume: number;
  average_ticket_size: number;
  customer_diversity_score: number;
  growth_trend: 'growing' | 'stable' | 'declining';
  consistency_score: number;
  activity_frequency: 'high' | 'medium' | 'low';
  circuit_version: string;
  status: 'generating' | 'valid' | 'expired' | 'failed';
  generated_at: string;
  expires_at: string;
}

export function Verify() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [proof, setProof] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      handleVerify(urlCode);
    }
  }, [searchParams]);

  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code;
    if (!codeToVerify) return;

    setLoading(true);
    setError('');
    setProof(null);

    try {
      const { data, error: queryError } = await (supabase
        .from('proofs')
        .select('*')
        .eq('verification_code', codeToVerify.toUpperCase())
        .maybeSingle() as any) as any;

      if (queryError) throw queryError;

      if (!data) {
        setError('Verification code not found');
        await (supabase.from('verification_logs').insert({
          proof_id: '00000000-0000-0000-0000-000000000000',
          verification_code: codeToVerify,
          success: false,
        } as any) as any);
      } else {
        const now = new Date();
        const expiresAt = new Date((data as any).expires_at);

        if (expiresAt < now) {
          setError('Proof has expired');
        } else if ((data as any).status !== 'valid') {
          setError('Proof is not valid');
        } else {
          setProof(data);
          setVerified(true);

          await (supabase.from('verification_logs').insert({
            proof_id: (data as any).id,
            verification_code: codeToVerify,
            success: true,
          } as any) as any);
        }
      }
    } catch (err) {
      setError('Failed to verify proof. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const getGrowthLabel = (trend: string) => {
    const labels = {
      growing: 'Growing',
      stable: 'Stable',
      declining: 'Declining',
    };
    return labels[trend as keyof typeof labels] || trend;
  };

  const getActivityLabel = (activity: string) => {
    const labels = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    return labels[activity as keyof typeof labels] || activity;
  };

  const getDiversityBucket = (score: number) => {
    if (score >= 75) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-green-600" />
              <span className="text-xl font-bold text-slate-900">M-Pesa Credit Proof</span>
            </Link>
            {user && (
              <Link
                to="/dashboard"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!verified ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-slate-900 mb-4">Verify Credit Proof</h1>
              <p className="text-lg text-slate-600">
                Enter a verification code to view creditworthiness data
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 mb-1">Verification Failed</h3>
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MPC-XXXX"
                    className="w-full px-4 py-4 border border-slate-300 rounded-lg text-center text-xl font-bold tracking-wider focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-2 text-center">
                    Enter the code provided by the business
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !code}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Verify Proof
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-4 text-center">
                  Why Use Zero-Knowledge Proofs?
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center text-center p-4">
                    <Lock className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-sm text-slate-700 font-medium">Privacy Protected</p>
                    <p className="text-xs text-slate-500 mt-1">Raw transaction data stays private</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4">
                    <Eye className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-sm text-slate-700 font-medium">Metrics Only</p>
                    <p className="text-xs text-slate-500 mt-1">See scores without sensitive details</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4">
                    <Zap className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-sm text-slate-700 font-medium">Instant Trust</p>
                    <p className="text-xs text-slate-500 mt-1">Cryptographically verifiable</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          proof && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2">Proof Verified</h1>
                <p className="text-lg text-slate-600">Creditworthiness data validated successfully</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">Summary</h2>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 mb-6">
                    <p className="text-sm text-green-800 mb-2">Credit Score</p>
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-6xl font-bold text-green-900">{proof.credit_score}</span>
                      <span className="text-3xl text-green-700 mb-2">/100</span>
                    </div>
                    <StatusBadge status={proof.status} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Date of Proof:</span>
                      <span className="font-semibold text-slate-900">
                        {formatDate(proof.generated_at)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Expires:</span>
                      <span className="font-semibold text-slate-900">
                        {formatDate(proof.expires_at)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Verification Code:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {proof.verification_code}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">Derived Metrics</h2>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Monthly Volume Range</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(proof.monthly_volume)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Last 30 days</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Consistency Score</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{proof.consistency_score}/100</p>
                      <p className="text-xs text-slate-600 mt-1">Payment regularity</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Growth Trend</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {getGrowthLabel(proof.growth_trend)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Business trajectory</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Activity Frequency</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {getActivityLabel(proof.activity_frequency)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Transaction frequency</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Customer Diversity</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {getDiversityBucket(proof.customer_diversity_score)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Customer base spread</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl p-8 text-white">
                <h2 className="text-2xl font-bold mb-6 text-center">What We Did Not Show You</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-800 p-4 rounded-lg text-center">
                    <p className="font-semibold">Individual Transactions</p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg text-center">
                    <p className="font-semibold">Customer Phone Numbers</p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg text-center">
                    <p className="font-semibold">M-Pesa Message Details</p>
                  </div>
                </div>
                <p className="text-slate-300 text-center mt-6 max-w-2xl mx-auto">
                  This business's privacy is guaranteed by cryptographic proofs generated in a RISC Zero zkVM.
                  You received verified creditworthiness metrics without accessing sensitive transaction data.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Proof Metadata</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Proof ID:</span>
                    <span className="text-slate-900 font-mono">{proof.id.substring(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Circuit Version:</span>
                    <span className="text-slate-900 font-semibold">RISC Zero {proof.circuit_version}</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    setVerified(false);
                    setProof(null);
                    setCode('');
                  }}
                  className="px-8 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
                >
                  Verify Another Proof
                </button>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
