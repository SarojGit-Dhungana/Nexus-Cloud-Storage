import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Key, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { authApi } from "../api";

export function TwoFactorDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"password" | "scan">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [setup, setSetup] = useState<{ secret: string; provisioning_uri: string; qr_code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    if (!password) return toast.error("Enter your password");
    setBusy(true);
    try {
      const result = await authApi.setupTwoFactor(password);
      // #region agent log
      fetch('http://127.0.0.1:7882/ingest/795b83e6-b33a-400f-860a-455a02972299',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbe2cb'},body:JSON.stringify({sessionId:'cbe2cb',runId:'pre-fix',hypothesisId:'D,E',location:'TwoFactorDialog.tsx:startSetup',message:'2fa setup response received',data:{secretLen:result?.secret?.length??0,hasQr:Boolean(result?.qr_code),qrPrefix:String(result?.qr_code||'').slice(0,32),uriLen:result?.provisioning_uri?.length??0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setSetup(result);
      setOtp("");
      setStep("scan");
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7882/ingest/795b83e6-b33a-400f-860a-455a02972299',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbe2cb'},body:JSON.stringify({sessionId:'cbe2cb',runId:'pre-fix',hypothesisId:'D',location:'TwoFactorDialog.tsx:startSetup',message:'2fa setup failed',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(error instanceof Error ? error.message : "Could not start setup");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) return toast.error("Enter the 6-digit code from your authenticator");
    setBusy(true);
    // #region agent log
    fetch('http://127.0.0.1:7882/ingest/795b83e6-b33a-400f-860a-455a02972299',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbe2cb'},body:JSON.stringify({sessionId:'cbe2cb',runId:'pre-fix',hypothesisId:'B,E',location:'TwoFactorDialog.tsx:confirm',message:'2fa confirm sending',data:{otpLen:code.length,otpAllDigits:/^\d{6}$/.test(code),secretLen:setup?.secret?.length??0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      await authApi.confirmTwoFactor(code);
      // #region agent log
      fetch('http://127.0.0.1:7882/ingest/795b83e6-b33a-400f-860a-455a02972299',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbe2cb'},body:JSON.stringify({sessionId:'cbe2cb',runId:'pre-fix',hypothesisId:'C',location:'TwoFactorDialog.tsx:confirm',message:'2fa confirm success',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.success("Two-factor authentication enabled");
      onDone();
      onClose();
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7882/ingest/795b83e6-b33a-400f-860a-455a02972299',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbe2cb'},body:JSON.stringify({sessionId:'cbe2cb',runId:'pre-fix',hypothesisId:'B,C,E',location:'TwoFactorDialog.tsx:confirm',message:'2fa confirm failed',data:{error:error instanceof Error?error.message:String(error),otpLen:code.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(error instanceof Error ? error.message : "Invalid code");
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Set up Google Authenticator</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === "password" ? (
            <>
              <p className="text-sm text-muted-foreground">Confirm your password to generate a secret for your authenticator app.</p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && startSetup()} placeholder="Your password" className="w-full text-sm px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50" />
              <button onClick={startSetup} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
              </button>
            </>
          ) : (
            <>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-4">
                <li>Remove any previous Cloud Based Storage System entry from your authenticator app.</li>
                <li>Scan the QR code (or enter the key manually).</li>
                <li>Enter the current 6-digit code — it changes every 30 seconds.</li>
              </ol>
              {setup?.qr_code && (
                <div className="flex justify-center">
                  <img src={setup.qr_code} alt="Authenticator QR code" className="w-44 h-44 rounded-lg border border-border bg-white p-2" />
                </div>
              )}
              <div className="text-center space-y-1.5">
                <p className="text-[11px] text-muted-foreground">Can't scan? Enter this key manually:</p>
                <code className="block text-xs font-mono break-all bg-secondary rounded-lg px-3 py-2">{setup?.secret}</code>
                <button
                  type="button"
                  onClick={() => { if (setup?.secret) { navigator.clipboard.writeText(setup.secret); toast.success("Key copied"); } }}
                  className="text-xs text-primary hover:underline"
                >
                  Copy key
                </button>
              </div>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && otp.length === 6 && confirm()}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full text-center tracking-[0.4em] text-lg px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:border-primary/50"
              />
              <button onClick={confirm} disabled={busy || otp.length !== 6} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify &amp; enable
              </button>
              <button type="button" onClick={startSetup} disabled={busy} className="w-full text-xs text-muted-foreground hover:text-foreground">
                QR not working? Generate a new code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
