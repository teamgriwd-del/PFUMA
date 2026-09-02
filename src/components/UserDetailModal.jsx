import React, { useState, useEffect } from 'react';
import {
  X, FileText, Mail, Phone, MapPin, CreditCard, Calendar, Shield, AlertTriangle,
} from 'lucide-react';

import { API } from '../config';

// Every field admin_list_users'/get_verifications' SELECT * already sends
// down (minus the password hash), just not previously rendered anywhere —
// the compact row only ever showed name/role/phone/org/province. This is
// the full record, shared by Admin's Users tab and Police's verification
// queue so both reviewers see the same thing before deciding.
export const DetailRow = ({ icon: Icon, label, value }) => value ? (
  <div className="flex items-start gap-2.5 py-2 min-w-0">
    {Icon && <Icon size={13} className="text-gray-400 shrink-0 mt-0.5" />}
    <div className="min-w-0">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-bold text-gray-800 break-words">{value}</p>
    </div>
  </div>
) : null;

const UserDetailModal = ({ user, currentUser, onClose }) => {
  const [docBusy, setDocBusy] = useState(null);
  const [idMatches, setIdMatches] = useState(undefined); // undefined = loading, [] = checked clean

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/admin/users/${user.id}/id-check`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
        if (res.ok && !cancelled) setIdMatches((await res.json()).matches || []);
      } catch { if (!cancelled) setIdMatches([]); }
    })();
    return () => { cancelled = true; };
  }, [user.id, currentUser.token]);

  const viewDocument = async (doctype) => {
    setDocBusy(doctype);
    try {
      const res = await fetch(`${API}/documents/${user.id}/${doctype}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
      if (!res.ok) { window.alert('No document on file, or not authorized to view it.'); setDocBusy(null); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { window.alert('Could not reach the PFUMA API.'); }
    setDocBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-black text-xs shrink-0 overflow-hidden">
              {user.avatar_url ? <img src={`${API}${user.avatar_url}`} className="w-full h-full object-cover" alt="" /> : (user.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-gray-900 truncate">{user.full_name}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{user.role} · Account #{user.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 transition shrink-0"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 min-w-0">
          {/* National ID cross-check — the same ID captured under a
              different account is exactly the kind of thing a reviewer
              should see before verifying, not discover afterward. */}
          {idMatches === undefined ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <p className="text-[11px] text-gray-400 font-medium italic">Checking national ID against other accounts…</p>
            </div>
          ) : idMatches.length > 0 ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                <p className="text-[11px] font-black text-red-700 uppercase tracking-wide">Same National ID on {idMatches.length} other account{idMatches.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="space-y-1">
                {idMatches.map(m => (
                  <p key={m.id} className="text-[11px] text-red-700 font-medium">
                    {m.full_name} — {m.role} · {m.phone} · {m.verification_status} · registered {new Date(m.created_at).toLocaleDateString()}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 flex items-center gap-2">
              <Shield size={13} className="text-green-600 shrink-0" />
              <p className="text-[11px] text-green-700 font-bold">No other account shares this National ID.</p>
            </div>
          )}

          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Identity</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={Phone} label="Phone" value={user.phone} />
              <DetailRow icon={Mail} label="Email" value={user.email} />
              <DetailRow icon={CreditCard} label="National ID" value={user.national_id_number} />
              <DetailRow icon={Calendar} label="Registered" value={user.created_at ? new Date(user.created_at).toLocaleString() : null} />
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Location & Organisation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={MapPin} label="Org / Farm / Business Name" value={user.org_name} />
              <DetailRow icon={MapPin} label="Province" value={user.province} />
              <DetailRow icon={MapPin} label="District" value={user.district} />
              <DetailRow icon={MapPin} label="Address" value={user.address} />
            </div>
          </section>

          {(user.farm_size_ha || user.species_farmed) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Farmer Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Farm Size" value={user.farm_size_ha ? `${user.farm_size_ha} ha` : null} />
                <DetailRow label="Species Farmed" value={user.species_farmed} />
              </div>
            </section>
          )}

          {(user.license_number || user.speciality) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Veterinary Credentials</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Licence Number" value={user.license_number} />
                <DetailRow label="Speciality" value={user.speciality} />
              </div>
            </section>
          )}

          {(user.business_reg || user.supply_categories || user.trading_areas) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Business Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Business Registration" value={user.business_reg} />
                <DetailRow label="Supply Categories" value={user.supply_categories} />
                <DetailRow label="Trading Areas" value={user.trading_areas} />
              </div>
            </section>
          )}

          {user.institution_type && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Institution Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Institution Type" value={user.institution_type} />
                <DetailRow label="Registration / License No." value={user.business_reg} />
              </div>
            </section>
          )}

          {(user.badge_number || user.station) && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Police Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Badge Number" value={user.badge_number} />
                <DetailRow label="Station" value={user.station} />
                <DetailRow label="Jurisdiction Province" value={user.jurisdiction_province} />
                <DetailRow label="Nominated By" value={user.requested_by_name ? `${user.requested_by_name}${user.requested_by_badge ? ` (${user.requested_by_badge})` : ''}` : null} />
              </div>
            </section>
          )}

          <section>
            <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Verification & Account Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
              <DetailRow icon={Shield} label="Verification Status" value={user.verification_status} />
              <DetailRow icon={Shield} label="Account Status" value={user.account_status} />
              <DetailRow label="Verification Notes" value={user.verification_notes} />
              <DetailRow label="Suspension Reason" value={user.suspension_reason} />
            </div>
            <div className="flex gap-2 mt-2">
              {user.id_document_path && (
                <button onClick={() => viewDocument('id')} disabled={docBusy === 'id'} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-600 transition disabled:opacity-50">
                  <FileText size={12} /> {docBusy === 'id' ? 'Opening…' : 'View ID Document'}
                </button>
              )}
              {user.credential_document_path && (
                <button onClick={() => viewDocument('credential')} disabled={docBusy === 'credential'} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-600 transition disabled:opacity-50">
                  <FileText size={12} /> {docBusy === 'credential' ? 'Opening…' : 'View Credential Document'}
                </button>
              )}
            </div>
          </section>

          {user.next_of_kin_name && (
            <section>
              <h4 className="text-[10px] font-black text-pfuma-green uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">Next of Kin</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 min-w-0">
                <DetailRow label="Name" value={user.next_of_kin_name} />
                <DetailRow label="Phone" value={user.next_of_kin_phone} />
                <DetailRow label="Relationship" value={user.next_of_kin_relationship} />
                <DetailRow label="National ID" value={user.next_of_kin_national_id} />
                <DetailRow icon={Shield} label="Verification Status" value={user.next_of_kin_verification_status} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
