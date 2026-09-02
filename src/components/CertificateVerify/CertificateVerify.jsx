import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';

import { API } from '../../config';

const speciesEmoji = { Cattle: '🐄', Goat: '🐐', Sheep: '🐑', Pig: '🐖' };

// The counterparty half of the valuation-certificate feature — a bank or
// insurer's loan officer lands here straight from the printed certificate
// or a QR code, with no PFUMA account and no login. Rendered standalone
// from main.jsx before the authenticated app ever mounts, since this page
// must work for someone who has never touched PFUMA before.
const CertificateVerify = ({ code }) => {
  const [result, setResult] = useState(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/verify/certificate/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!cancelled) setResult(res.ok ? data : { valid: false, error: data.error });
      } catch {
        if (!cancelled) setResult({ valid: false, error: 'Could not reach the PFUMA verification service — try again shortly.' });
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="min-h-screen bg-pfuma-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs font-black text-pfuma-green uppercase tracking-[3px]">PFUMA Certificate Verification</p>
          <p className="text-[11px] text-gray-400 font-medium mt-1">Independent lookup — no account required</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {result === undefined ? (
            <div className="p-10 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-pfuma-green animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Checking code {code}…</p>
            </div>
          ) : result.valid ? (
            <>
              <div className="bg-pfuma-green px-6 py-5 flex items-center gap-3">
                <ShieldCheck size={26} className="text-white shrink-0" />
                <div>
                  <p className="text-white font-black text-sm uppercase tracking-wide">Certificate Valid</p>
                  <p className="text-green-100 text-[11px] font-medium">Issued {new Date(result.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-2xl p-5 text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Certified Estimated Value</p>
                  <p className="text-3xl font-black text-gray-900">USD {Number(result.estimated_value).toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Animal', result.name],
                    ['Species / Breed', `${speciesEmoji[result.species] || ''} ${result.species}${result.breed ? ' — ' + result.breed : ''}`],
                    ['Ear Tag', result.tag_id ? `#${result.tag_id}` : '—'],
                    ['Registered Owner', result.owner_name],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                      <p className="text-sm font-black text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 font-medium pt-3 border-t border-gray-100">
                  This value was computed by PFUMA at the time of issue from the animal's recorded weight, species, and certified health history. It is not a live re-appraisal.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-800 px-6 py-5 flex items-center gap-3">
                <ShieldX size={26} className="text-red-400 shrink-0" />
                <p className="text-white font-black text-sm uppercase tracking-wide">Certificate Not Found</p>
              </div>
              <div className="p-6">
                <p className="text-xs text-gray-500 font-medium">
                  {result.error || 'No certificate matches this code'}. Double-check the code printed on the certificate, or contact the issuing farmer to confirm it was actually issued through PFUMA.
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-400 font-medium mt-6">PFUMA — Zimbabwe Livestock Platform</p>
      </div>
    </div>
  );
};

export default CertificateVerify;
