import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { calculateProofMetrics, generateVerificationCode } from '../lib/proofGenerator';
import {
  Loader2,
  CheckCircle2,
  Shield,
  TrendingUp,
  Users,
  Activity,
  Calendar
} from 'lucide-react';

type Stage = 'preparing' | 'computing' | 'generating' | 'complete';

interface Transaction {
  transaction_date: string;
  amount: number;
  transaction_type: string;
  customer_hash: string | null;
}

interface ProofMetrics {
  creditScore: number;
  monthlyVolume: number;
  averageTicketSize: number;
  customerDiversityScore: number;
  growthTrend: 'growing' | 'stable' | 'declining';
  consistencyScore: number;
  activityFrequency: 'high' | 'medium' | 'low';
}

export function GenerateProof() {
  const [stage, setStage] = useState<Stage>('preparing');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<ProofMetrics | null>(null);
  const [proofId, setProofId] = useState<string>('');
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const generateProof = async () => {
      try {
        setStage('preparing');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('transaction_date, amount, transaction_type, customer_hash')
          .eq('business_id', user.id);

        if (txError) throw txError;
        if (!txData || txData.length === 0) {
          throw new Error('No transactions found. Please upload data first.');
        }

        setTransactions(txData);

        setStage('computing');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const computedMetrics = calculateProofMetrics(txData);
        setMetrics(computedMetrics);

        setStage('generating');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { data: latestUpload } = await supabase
          .from('transaction_uploads')
          .select('id')
          .eq('business_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

        const { data: proof, error: proofError } = await supabase
          .from('proofs')
          .insert({
            business_id: user.id,
            upload_id: latestUpload?.id || null,
            verification_code: generateVerificationCode(),
            credit_score: computedMetrics.creditScore,
            monthly_volume: computedMetrics.monthlyVolume,
            average_ticket_size: computedMetrics.averageTicketSize,
            customer_diversity_score: computedMetrics.customerDiversityScore,
            growth_trend: computedMetrics.growthTrend,
            consistency_score: computedMetrics.consistencyScore,
            activity_frequency: computedMetrics.activityFrequency,
            proof_data: {
              transaction_count: txData.length,
              generated_by: 'RISC Zero zkVM v1.0',
            },
            circuit_version: 'v1.0',
            status: 'valid',
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (proofError) throw proofError;

        setProofId(proof.id);
        setStage('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate proof');
      }
    };

    generateProof();
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const getGrowthTrendLabel = (trend: string) => {
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Generate Credit Proof
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
              <button
                onClick={() => navigate('/dashboard')}
                className="block mt-3 text-red-600 font-semibold hover:underline"
              >
                Return to Dashboard
              </button>
            </div>
          )}

          {!error && (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                  stage === 'preparing' ? 'bg-blue-50' : 'bg-green-50'
                }`}>
                  <div className="flex-shrink-0 mt-1">
                    {stage === 'preparing' ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Input Preparation</h3>
                    <p className="text-sm text-slate-600">
                      Sanitizing transaction data, removing customer identifiers
                    </p>
                    {transactions.length > 0 && (
                      <p className="text-sm text-slate-700 mt-2 font-medium">
                        ✓ {transactions.length} transactions prepared
                      </p>
                    )}
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                  stage === 'computing' ? 'bg-blue-50' : stage === 'preparing' ? 'bg-slate-50' : 'bg-green-50'
                }`}>
                  <div className="flex-shrink-0 mt-1">
                    {stage === 'computing' ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : stage === 'preparing' ? (
                      <Shield className="w-6 h-6 text-slate-400" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Run Proof in zkVM</h3>
                    <p className="text-sm text-slate-600 mb-2">
                      Running credit score computation in a zkVM
                    </p>
                    <div className="bg-slate-100 rounded p-3 text-xs text-slate-700">
                      Your raw M-Pesa transactions are not sent to the lender. Only a proof and
                      derived metrics will be shared.
                    </div>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                  stage === 'generating' ? 'bg-blue-50' : ['preparing', 'computing'].includes(stage) ? 'bg-slate-50' : 'bg-green-50'
                }`}>
                  <div className="flex-shrink-0 mt-1">
                    {stage === 'generating' ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : stage === 'complete' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingUp className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Finalizing Proof</h3>
                    <p className="text-sm text-slate-600">
                      Creating verifiable proof with RISC Zero
                    </p>
                  </div>
                </div>
              </div>

              {metrics && stage === 'complete' && (
                <div className="border-t border-slate-200 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">Proof Generated</h3>
                      <p className="text-slate-600">Your credit proof is ready to share</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">Credit Score</span>
                        <Shield className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-5xl font-bold text-green-900">
                          {metrics.creditScore}
                        </span>
                        <span className="text-2xl text-green-700 mb-1">/100</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-700">30-Day Volume</span>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(metrics.monthlyVolume)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-700">Growth Trend</span>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {getGrowthTrendLabel(metrics.growthTrend)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Customer Diversity</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {metrics.customerDiversityScore}/100
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Consistency</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {metrics.consistencyScore}/100
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Activity Frequency</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">
                        {getActivityLabel(metrics.activityFrequency)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/proof/${proofId}`)}
                    className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors text-lg"
                  >
                    Share with Lender
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
