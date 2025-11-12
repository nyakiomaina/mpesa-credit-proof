import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../lib/supabase';
import { Copy, CheckCircle2, ExternalLink, Shield, Loader2 } from 'lucide-react';

interface Proof {
  id: string;
  verification_code: string;
  credit_score: number;
  status: 'generating' | 'valid' | 'expired' | 'failed';
  generated_at: string;
  expires_at: string;
}

export function ProofShare() {
  const { proofId } = useParams<{ proofId: string }>();
  const [proof, setProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (!proofId) return;

    const fetchProof = async () => {
      const { data, error } = await supabase
        .from('proofs')
        .select('id, verification_code, credit_score, status, generated_at, expires_at')
        .eq('id', proofId)
        .single();

      if (!error && data) {
        setProof(data);
      }
      setLoading(false);
    };

    fetchProof();
  }, [proofId]);

  const handleCopy = async (type: 'link' | 'code') => {
    if (!proof) return;

    const textToCopy =
      type === 'link'
        ? `${window.location.origin}/verify?code=${proof.verification_code}`
        : proof.verification_code;

    await navigator.clipboard.writeText(textToCopy);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </Layout>
    );
  }

  if (!proof) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-slate-600 mb-4">Proof not found</p>
          <Link to="/dashboard" className="text-green-600 font-semibold hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const verificationLink = `${window.location.origin}/verify?code=${proof.verification_code}`;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Proof is Ready</h1>
            <p className="text-slate-600">Share this proof with your lender</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-green-800 mb-1">Credit Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-green-900">{proof.credit_score}</span>
                  <span className="text-xl text-green-700 mb-1">/100</span>
                </div>
              </div>
              <StatusBadge status={proof.status} />
            </div>

            <div className="border-t border-green-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-green-800">
                <span>Generated:</span>
                <span className="font-semibold">{formatDate(proof.generated_at)}</span>
              </div>
              <div className="flex justify-between text-green-800">
                <span>Expires:</span>
                <span className="font-semibold">{formatDate(proof.expires_at)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Verification Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={verificationLink}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 text-sm font-mono"
                />
                <button
                  onClick={() => handleCopy('link')}
                  className="px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  {copied === 'link' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Verification Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={proof.verification_code}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-lg font-bold text-center tracking-wider"
                />
                <button
                  onClick={() => handleCopy('code')}
                  className="px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  {copied === 'code' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">How to Share</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Send this link or code to your lender. They will see your score only, not your
                  transaction data.
                </p>
                <p className="text-sm text-blue-800">
                  This can be shared via WhatsApp, email, or any messaging platform.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              to="/dashboard"
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors text-center"
            >
              Back to Dashboard
            </Link>
            <a
              href={verificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              Preview Verification
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3">Proof Metadata</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Proof ID:</span>
                <span className="text-slate-900 font-mono">{proof.id.substring(0, 16)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Circuit Version:</span>
                <span className="text-slate-900 font-semibold">RISC Zero v1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Verification Status:</span>
                <StatusBadge status={proof.status} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
