import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { RiscZeroExecution } from '../components/RiscZeroExecution';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateVerificationCode } from '../lib/proofGenerator';
import { proofsAPI } from '../lib/api';
import {
  Loader2,
  CheckCircle2,
  Shield,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  Plus
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
  const [stage, setStage] = useState<Stage | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<ProofMetrics | null>(null);
  const [proofId, setProofId] = useState<string>('');
  const [error, setError] = useState('');
  const [showRiscZero, setShowRiscZero] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const componentMountedRef = useRef(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Prevent multiple component instances from running simultaneously
  if (!componentMountedRef.current) {
    componentMountedRef.current = true;
  }

  const generateProof = async () => {
    // Use ref for immediate check (prevents race conditions)
    if (!user || isGeneratingRef.current) {
      console.log('Proof generation blocked:', { user: !!user, isGenerating: isGeneratingRef.current });
      return;
    }

    console.log('Starting proof generation...');
    isGeneratingRef.current = true;
    setIsGenerating(true);
    setError('');
    setMetrics(null);
    setProofId('');
    setStage(null);

    try {
        setStage('preparing');
        setShowRiscZero(true);

        // Stage 1: Preparing - Load transactions
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('transaction_date, amount, transaction_type, customer_hash')
          .eq('business_id', user.id);

        if (txError) throw txError;
        if (!txData || txData.length === 0) {
          throw new Error('No transactions found. Please upload data first.');
        }

        setTransactions(txData);

        // Debug: Log transaction data being sent
        console.log('Transaction data being sent:', {
          count: txData.length,
          sample: (txData as any[]).slice(0, 3).map((tx: any) => ({
            date: tx.transaction_date,
            amount: tx.amount,
            type: tx.transaction_type,
            has_hash: !!tx.customer_hash
          }))
        });

        // Call the actual RISC Zero backend API (required - no fallback)
        let sessionId: string | null = null;
        let backendResult: {
          credit_score: number;
          metrics: {
            customer_diversity_score?: number;
            growth_trend?: string;
            consistency_score?: number;
            activity_frequency?: string;
          };
          receipt_data?: number[] | Uint8Array;
        } | null = null;

        try {
          // Call the backend API for actual RISC Zero proof generation
          const response = await proofsAPI.generateDirect(txData);
          sessionId = response.session_id;

          // Stage 2: Computing in zkVM - Poll for status
          setStage('computing');

          // Poll for proof generation status
          let status = 'processing';
          let pollCount = 0;
          const maxPolls = 120; // 2 minutes max (1 second intervals)

          while (status === 'processing' && pollCount < maxPolls) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Poll every second

            try {
              const statusResponse = await proofsAPI.getStatus(sessionId!);
              status = statusResponse.status.toLowerCase();

              if (status === 'completed') {
                backendResult = await proofsAPI.getResult(sessionId!);
                break;
              } else if (status === 'failed') {
                throw new Error(statusResponse.error || 'Proof generation failed');
              }
            } catch (pollError) {
              // If polling fails, throw error (no fallback)
              throw new Error(`Failed to poll proof status: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`);
            }

            pollCount++;
          }

          if (status !== 'completed') {
            throw new Error('Proof generation timed out');
          }

          if (!backendResult) {
            throw new Error('Proof generation completed but no result received');
          }
        } catch (apiError) {
          // Backend API is required for actual RISC Zero proof generation
          throw new Error(`RISC Zero proof generation failed: ${apiError instanceof Error ? apiError.message : 'Backend API unavailable. Please ensure the backend server is running.'}`);
        }

        // Stage 3: Generating final proof - creating receipt
        setStage('generating');

        // Use metrics from backend RISC Zero execution
        const backendMetrics = backendResult.metrics;

        // Calculate monthly volume from transactions (backend only returns range enum)
        // This matches the RISC Zero calculation logic
        const sortedTxns = [...(txData as Array<{ transaction_date: string; amount: number }>)].sort(
          (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        );
        const firstDate = new Date(sortedTxns[0].transaction_date);
        const lastDate = new Date(sortedTxns[sortedTxns.length - 1].transaction_date);
        const daysInPeriod = Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
        const totalVolume = (txData as Array<{ amount: number }>).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const calculatedMonthlyVolume = (totalVolume / daysInPeriod) * 30;

        const computedMetrics: ProofMetrics = {
          creditScore: backendResult.credit_score,
          monthlyVolume: calculatedMonthlyVolume, // Calculate from transactions
          averageTicketSize: totalVolume / (txData.length || 1),
          customerDiversityScore: backendMetrics.customer_diversity_score || 0,
          growthTrend: (backendMetrics.growth_trend?.toLowerCase() as 'growing' | 'stable' | 'declining') || 'stable',
          consistencyScore: backendMetrics.consistency_score || 0,
          activityFrequency: (backendMetrics.activity_frequency?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        };

        setMetrics(computedMetrics);

        const { data: latestUpload } = await supabase
          .from('transaction_uploads')
          .select('id')
          .eq('business_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

        // Verify receipt if available (receipt was already verified in backend, but we store it for future verification)
        // Also check if credit score is valid (0 is not a valid credit score)
        let proofStatus: 'valid' | 'generating' | 'failed' = 'valid';
        let receiptBase64: string | null = null;

        if (backendResult.receipt_data) {
          // Receipt was already verified in execute_zkvm_proof_direct, but we store it for future verification
          // Convert Uint8Array to base64 for storage in JSONB
          if (backendResult.receipt_data instanceof Array) {
            receiptBase64 = btoa(String.fromCharCode(...backendResult.receipt_data));
          } else if (backendResult.receipt_data instanceof Uint8Array) {
            receiptBase64 = btoa(String.fromCharCode(...Array.from(backendResult.receipt_data)));
          } else {
            console.warn('Unexpected receipt_data format:', typeof backendResult.receipt_data);
          }
        } else {
          // No receipt means proof generation failed
          proofStatus = 'failed';
          throw new Error('Proof generation completed but no receipt was generated');
        }

        // A credit score of 0 indicates no valid transactions were processed
        // This should be marked as failed, not valid
        if (computedMetrics.creditScore === 0) {
          proofStatus = 'failed';
          console.error('Credit score is 0 - no valid transactions were processed. Check transaction data and types.');
          console.error('Backend result:', backendResult);
          console.error('Computed metrics:', computedMetrics);
          console.error('Transaction count sent:', txData.length);
          // Don't throw - allow the proof to be saved with failed status so user can see the issue
        }

        const { data: proof, error: proofError } = await (supabase
          .from('proofs')
          .insert({
            business_id: user.id,
            upload_id: latestUpload ? (latestUpload as { id?: string }).id || null : null,
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
              risc_zero_verified: true,
              receipt_available: true,
              receipt_data: receiptBase64, // Store receipt as base64 in JSONB
            },
            circuit_version: 'v1.0',
            status: proofStatus,
            expires_at: expiresAt.toISOString(),
          } as any)
          .select()
          .single()) as any;

        if (proofError) throw proofError;

        setProofId((proof as { id: string }).id);
        setStage('complete');
        // Keep RISC Zero window open for a moment to show completion message
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setShowRiscZero(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate proof');
        setShowRiscZero(false);
      } finally {
        isGeneratingRef.current = false;
        setIsGenerating(false);
      }
    };

  // Remove automatic execution - user must click button

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
      {showRiscZero && stage && (
        <RiscZeroExecution
          isRunning={stage !== 'complete'}
          stage={stage}
          onClose={() => setShowRiscZero(false)}
        />
      )}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Generate Credit Proof
          </h1>

          {!stage && !error && (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-6">
                Click the button below to generate a new credit proof from your M-Pesa transaction data.
              </p>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  generateProof();
                }}
                disabled={isGenerating || isGeneratingRef.current}
                className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Generate Proof
                  </>
                )}
              </button>
            </div>
          )}

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

          {!error && stage && (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                  stage === 'preparing' ? 'bg-blue-50' : stage === 'complete' ? 'bg-green-50' : 'bg-slate-50'
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
                  stage === 'computing' ? 'bg-blue-50' : stage === 'complete' ? 'bg-green-50' : 'bg-slate-50'
                }`}>
                  <div className="flex-shrink-0 mt-1">
                    {stage === 'computing' ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : stage === 'complete' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <Shield className="w-6 h-6 text-slate-400" />
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
                  stage === 'generating' ? 'bg-blue-50' : stage === 'complete' ? 'bg-green-50' : 'bg-slate-50'
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
