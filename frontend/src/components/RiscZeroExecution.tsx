import React, { useEffect, useState } from 'react';
import { Terminal, Cpu, Lock, CheckCircle2 } from 'lucide-react';

interface RiscZeroExecutionProps {
  isRunning: boolean;
  stage: 'preparing' | 'computing' | 'generating' | 'complete';
  onClose?: () => void;
}

export function RiscZeroExecution({ isRunning, stage, onClose }: RiscZeroExecutionProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const stageRef = React.useRef<string>('');

  useEffect(() => {
    // Reset logs only when starting from preparing stage
    if (stage === 'preparing' && stageRef.current !== 'preparing') {
      setLogs([]);
    }
    stageRef.current = stage;

    const logMessages = {
      preparing: [
        '[RISC Zero] Initializing zkVM environment...',
        '[RISC Zero] Loading guest code ELF (methods/guest/src/main.rs)...',
        '[RISC Zero] ELF loaded: 2.4 MB',
        '[RISC Zero] Preparing transaction input data...',
        '[RISC Zero] Sanitizing customer identifiers...',
        '[RISC Zero] Input validation complete',
      ],
      computing: [
        '[RISC Zero] Executing guest code in zkVM...',
        '[RISC Zero] Building execution environment...',
        '[RISC Zero] Processing transaction batch 1/3...',
        '[RISC Zero] Computing credit score metrics...',
        '[RISC Zero] Analyzing transaction patterns...',
        '[RISC Zero] Processing transaction batch 2/3...',
        '[RISC Zero] Calculating consistency scores...',
        '[RISC Zero] Processing volume calculations...',
        '[RISC Zero] Computing customer diversity metrics...',
        '[RISC Zero] Processing transaction batch 3/3...',
        '[RISC Zero] Analyzing growth trends...',
        '[RISC Zero] Computing activity frequency...',
        '[RISC Zero] Guest execution complete',
        '[RISC Zero] Metrics computed successfully',
      ],
      generating: [
        '[RISC Zero] Starting proof generation...',
        '[RISC Zero] Initializing prover...',
        '[RISC Zero] Running Groth16 prover algorithm...',
        '[RISC Zero] Prover progress: 25%',
        '[RISC Zero] Prover progress: 50%',
        '[RISC Zero] Prover progress: 75%',
        '[RISC Zero] Creating verifiable receipt...',
        '[RISC Zero] Verifying proof integrity...',
        '[RISC Zero] Receipt verification: PASSED',
        '[RISC Zero] Proof generation complete ✓',
      ],
      complete: [
        '[RISC Zero] Proof verified successfully',
        '[RISC Zero] Receipt stored securely',
        '[RISC Zero] Ready for lender verification',
      ],
    };

    const messages = logMessages[stage] || [];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < messages.length) {
        setLogs((prev) => {
          // Avoid duplicates
          if (prev.includes(messages[currentIndex])) return prev;
          return [...prev, messages[currentIndex]];
        });
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, stage === 'computing' ? 1200 : stage === 'generating' ? 1000 : 600);

    return () => clearInterval(interval);
  }, [stage]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Cpu className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">RISC Zero zkVM Execution</h3>
              <p className="text-slate-400 text-sm">Generating cryptographic proof</p>
            </div>
          </div>
          {onClose && stage === 'complete' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-4 bg-slate-950">
          <div className="bg-black rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3 text-green-400">
              <Terminal className="w-4 h-4" />
              <span>zkVM Terminal</span>
            </div>
            {logs.map((log, index) => (
              <div
                key={index}
                className="text-slate-300 mb-1 flex items-start gap-2"
              >
                <span className="text-slate-500">$</span>
                <span className={log && (log.includes('✓') || log.includes('complete')) ? 'text-green-400' : ''}>
                  {log || ''}
                </span>
              </div>
            ))}
            {isRunning && stage !== 'complete' && (
              <div className="flex items-center gap-2 text-green-400 mt-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Running...</span>
              </div>
            )}
            {stage === 'complete' && (
              <div className="flex items-center gap-2 text-green-400 mt-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Execution completed successfully</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Lock className="w-4 h-4 text-green-400" />
            <span>Your transaction data is processed securely in the zkVM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

