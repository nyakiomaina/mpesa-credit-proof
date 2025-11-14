import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  TrendingUp,
  Upload,
  Share2,
  Loader2,
  Plus,
  Calendar,
  DollarSign,
  Trash2
} from 'lucide-react';

interface Business {
  business_name: string;
}

interface Upload {
  id: string;
  file_name: string;
  transaction_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  total_volume: number;
  uploaded_at: string;
}

interface Proof {
  id: string;
  credit_score: number;
  status: 'generating' | 'valid' | 'expired' | 'failed';
  generated_at: string;
  verification_code: string;
}

export function Dashboard() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [latestUpload, setLatestUpload] = useState<Upload | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [businessRes, uploadsRes, proofsRes] = await Promise.all([
        supabase.from('businesses').select('business_name').eq('id', user.id).single() as any,
        supabase
          .from('transaction_uploads')
          .select('*')
          .eq('business_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(1) as any,
        supabase
          .from('proofs')
          .select('id, credit_score, status, generated_at, verification_code')
          .eq('business_id', user.id)
          .order('generated_at', { ascending: false }) as any,
      ]) as any;

      if (businessRes.data) setBusiness(businessRes.data as any);
      if (uploadsRes.data && uploadsRes.data.length > 0) setLatestUpload(uploadsRes.data[0] as any);
      if (proofsRes.data) setProofs((proofsRes.data as any) as any[]);

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const handleDeleteProof = async (proofId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this proof? This action cannot be undone.')) {
      return;
    }

    setDeletingProofId(proofId);
    try {
      const { data, error } = await supabase
        .from('proofs')
        .delete()
        .eq('id', proofId)
        .eq('business_id', user.id)
        .select();

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      console.log('Delete result:', data);

      // Remove from local state
      setProofs(proofs.filter(p => p.id !== proofId));

      // Refresh the list to ensure it's in sync
      const { data: updatedProofs } = await supabase
        .from('proofs')
        .select('id, credit_score, status, generated_at, verification_code')
        .eq('business_id', user.id)
        .order('generated_at', { ascending: false });

      if (updatedProofs) {
        setProofs(updatedProofs as any);
      }
    } catch (error: any) {
      console.error('Error deleting proof:', error);
      const errorMessage = error?.message || error?.details || 'Failed to delete proof. Please check if the DELETE policy is enabled in Supabase.';
      alert(`Failed to delete proof: ${errorMessage}`);
    } finally {
      setDeletingProofId(null);
    }
  };

  const handleClearAllProofs = async () => {
    if (!user || proofs.length === 0 || clearingAll) return;

    if (!confirm(`Are you sure you want to delete all ${proofs.length} proofs? This action cannot be undone.`)) {
      return;
    }

    setClearingAll(true);
    try {
      console.log('Attempting to delete all proofs for user:', user.id);

      // First, get all proof IDs to verify we can access them
      const { data: allProofs, error: fetchError } = await (supabase
        .from('proofs')
        .select('id')
        .eq('business_id', user.id) as any) as any;

      if (fetchError) {
        console.error('Error fetching proofs:', fetchError);
        throw fetchError;
      }

      console.log('Found proofs to delete:', allProofs?.length || 0);

      if (!allProofs || allProofs.length === 0) {
        setProofs([]);
        return;
      }

      // Delete proofs one by one and verify each deletion
      console.log('Deleting proofs individually...');
      let deletedCount = 0;
      const errors: any[] = [];

      for (const proof of allProofs) {
        const { data: deletedData, error: deleteError } = await supabase
          .from('proofs')
          .delete()
          .eq('id', proof.id)
          .eq('business_id', user.id)
          .select();

        if (deleteError) {
          console.error(`Error deleting proof ${proof.id}:`, deleteError);
          errors.push({ id: proof.id, error: deleteError });
        } else if (deletedData && deletedData.length > 0) {
          deletedCount++;
          console.log(`✓ Deleted proof ${proof.id}`);
        } else {
          // No error but also no data returned - might be RLS blocking
          console.warn(`⚠ No data returned for proof ${proof.id} - might be blocked by RLS`);
          errors.push({ id: proof.id, error: { message: 'Delete returned no data - RLS policy may be blocking' } });
        }
      }

      console.log(`Deleted ${deletedCount} out of ${allProofs.length} proofs`);

      if (errors.length > 0) {
        console.warn('Some proofs failed to delete:', errors);
        if (errors.length === allProofs.length) {
          throw new Error(`All ${allProofs.length} delete operations failed. The DELETE policy may not be enabled. Please run the SQL script in Supabase to enable it.`);
        } else {
          throw new Error(`${errors.length} proofs could not be deleted. ${deletedCount} were deleted successfully.`);
        }
      }

      // Wait a moment for database to commit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh to confirm deletion
      const { data: updatedProofs, error: refreshError } = await supabase
        .from('proofs')
        .select('id, credit_score, status, generated_at, verification_code')
        .eq('business_id', user.id)
        .order('generated_at', { ascending: false });

      if (refreshError) {
        console.error('Error refreshing proofs list:', refreshError);
        throw refreshError;
      }

      // Update local state with remaining proofs
      if (updatedProofs) {
        setProofs(updatedProofs as any);
        if (updatedProofs.length > 0) {
          console.error(`❌ Deletion failed! ${updatedProofs.length} proofs still remain.`);
          throw new Error(`${updatedProofs.length} proofs could not be deleted. The DELETE policy is likely not enabled. Please run this SQL in Supabase:\n\nDROP POLICY IF EXISTS "Users can delete own proofs" ON proofs;\nCREATE POLICY "Users can delete own proofs" ON proofs FOR DELETE TO authenticated USING (business_id = auth.uid());`);
        } else {
          console.log('✅ All proofs deleted successfully!');
        }
      } else {
        // No proofs returned, assume all deleted
        setProofs([]);
        console.log('✅ All proofs deleted successfully!');
      }
    } catch (error: any) {
      console.error('Error clearing proofs:', error);
      let errorMessage = 'Failed to clear proofs. ';

      if (error?.code === '42501') {
        errorMessage += 'Permission denied. Please ensure the DELETE policy is enabled in Supabase.';
      } else if (error?.message) {
        errorMessage += error.message;
      } else if (error?.details) {
        errorMessage += error.details;
      } else {
        errorMessage += 'Please check the browser console for details.';
      }

      alert(errorMessage);

      // Refresh the list to show current state
      const { data: currentProofs } = await supabase
        .from('proofs')
        .select('id, credit_score, status, generated_at, verification_code')
        .eq('business_id', user.id)
        .order('generated_at', { ascending: false });

      if (currentProofs) {
        setProofs(currentProofs as any);
      }
    } finally {
      setClearingAll(false);
    }
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

  const latestProof = proofs.length > 0 ? proofs[0] : null;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {business?.business_name}
          </h1>
          <p className="text-slate-600">Manage your credit proofs and M-Pesa data</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-green-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Credit Overview</h2>
                <p className="text-sm text-slate-600">Your latest proof status</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>

            {latestProof ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-bold text-slate-900">
                      {latestProof.credit_score}
                    </span>
                    <span className="text-xl text-slate-600 mb-1">/100</span>
                  </div>
                  <StatusBadge status={latestProof.status} />
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Generated {formatDate(latestProof.generated_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-600 mb-4">No proofs generated yet</p>
              </div>
            )}

            <button
              onClick={() => navigate('/generate-proof')}
              className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Generate New Proof
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-slate-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Data Status</h2>
                <p className="text-sm text-slate-600">M-Pesa transaction data</p>
              </div>
              <FileText className="w-8 h-8 text-slate-600" />
            </div>

            {latestUpload ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {latestUpload.date_range_start && latestUpload.date_range_end
                      ? `${formatDate(latestUpload.date_range_start)} - ${formatDate(latestUpload.date_range_end)}`
                      : 'Date range not available'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {latestUpload.transaction_count} transactions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {formatCurrency(latestUpload.total_volume)} total volume
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Uploaded {formatDate(latestUpload.uploaded_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-600 mb-4">No data uploaded yet</p>
              </div>
            )}

            <button
              onClick={() => navigate('/upload')}
              className="w-full mt-4 bg-slate-600 text-white py-3 rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload New Data
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Recent Proofs</h2>
            {proofs.length > 0 && (
              <button
                onClick={handleClearAllProofs}
                disabled={clearingAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </>
                )}
              </button>
            )}
          </div>

          {proofs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Proof ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Generated On
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proofs.map((proof) => (
                    <tr key={proof.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">
                        {proof.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(proof.generated_at)}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-slate-900">
                        {proof.credit_score}/100
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={proof.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-6">
                        <button
                          onClick={() => navigate(`/proof/${proof.id}`)}
                          className="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-sm"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                          <button
                            onClick={() => handleDeleteProof(proof.id)}
                            disabled={deletingProofId === proof.id}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Delete proof"
                          >
                            {deletingProofId === proof.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No proofs generated yet</p>
              <button
                onClick={() => navigate('/generate-proof')}
                className="mt-4 text-green-600 font-semibold hover:underline"
              >
                Generate your first proof
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
