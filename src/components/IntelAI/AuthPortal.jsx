import React, { useState } from 'react';
import pfumaMark from '../../assets/pfuma-mark.svg';
import {
  Sprout, ShoppingBag, Truck, ArrowRight, ArrowLeft,
  Phone, Mail, MapPin, Building2, CheckCircle, Stethoscope,
  Lock, Upload, AlertTriangle, CreditCard, Eye, EyeOff, Landmark,
} from 'lucide-react';

import { API } from '../../config';
import { photo, AUTH_HERO } from '../../theme/imagery';
import { Button } from '../ui';

// ── Zimbabwe-specific format validation (mirrors backend/app.py so the user
// sees the same feedback before submitting, not just after a 400 comes back) ──
// Mobile prefixes per POTRAZ's national numbering plan: Econet 077/078,
// NetOne 071, Telecel 073.
const ZW_MOBILE_PREFIXES = ['071', '073', '077', '078'];
function isValidZwPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  let n = digits;
  if (n.startsWith('263')) n = '0' + n.slice(3);
  else if (!n.startsWith('0') && n.length === 9) n = '0' + n;
  return n.length === 10 && ZW_MOBILE_PREFIXES.some(p => n.startsWith(p));
}
// Zimbabwe national ID: NN-NNNNNNN L NN (district-serial-checkletter-citizenship).
// This checks structure only — the check letter's computation isn't publicly
// documented anywhere verifiable, so we don't pretend to validate it
// mathematically. Format-checking still catches typos/made-up numbers; a
// Police or Vet reviewer cross-checks the uploaded ID photo during verification.
const ZW_ID_RE = /^\d{2}[\s-]?\d{4,7}[\s-]?[A-Za-z][\s-]?\d{2}$/;
function isValidZwNationalId(raw) {
  return ZW_ID_RE.test((raw || '').trim());
}

// ── data ───────────────────────────────────────────────────────────────────
const ROLES = [
  {
    name: 'Farmer',
    icon: Sprout,
    color: 'bg-pfuma-green',
    border: 'border-pfuma-green',
    desc: 'Register your herd, track health, sell livestock and order medicines.',
  },
  {
    name: 'Veterinarian',
    icon: Stethoscope,
    color: 'bg-blue-600',
    border: 'border-blue-500',
    desc: 'Issue health certificates, manage outbreaks and consult farmers.',
  },
  {
    name: 'Supplier',
    icon: Truck,
    color: 'bg-orange-500',
    border: 'border-orange-500',
    desc: 'Supply vaccines, medicines and feed to registered farms.',
  },
  {
    name: 'Buyer',
    icon: ShoppingBag,
    color: 'bg-purple-600',
    border: 'border-purple-600',
    desc: 'Browse certified livestock listings and acquire trade certificates.',
  },
  {
    name: 'Institution',
    icon: Landmark,
    color: 'bg-teal-700',
    border: 'border-teal-700',
    desc: 'Verify livestock valuation certificates presented as loan or insurance collateral.',
  },
  // Police is deliberately not a self-signup role — an officer account can
  // only come from an existing officer's nomination, approved by PFUMA/INGCEBO
  // Admin (see PoliceDashboard's "Add Officer" and AdminDashboard's Users
  // tab). Listing it here would invite exactly the fraud path that flow
  // exists to close.
];

const PROVINCES = [
  'Mashonaland West', 'Mashonaland Central', 'Mashonaland East',
  'Matabeleland North', 'Matabeleland South', 'Midlands',
  'Manicaland', 'Masvingo', 'Harare', 'Bulawayo'
];

const DISTRICTS = {
  'Mashonaland West':    ['Chegutu', 'Hurungwe', 'Kariba', 'Makonde', 'Mhondoro-Ngezi', 'Sanyati', 'Zvimba'],
  'Mashonaland Central': ['Bindura', 'Centenary', 'Guruve', 'Mount Darwin', 'Mazowe', 'Shamva'],
  'Mashonaland East':    ['Chikomba', 'Goromonzi', 'Marondera', 'Mudzi', 'Murehwa', 'Mutoko'],
  'Matabeleland North':  ['Binga', 'Hwange', 'Lupane', 'Nkayi', 'Tsholotsho'],
  'Matabeleland South':  ['Beitbridge', 'Bulilima', 'Gwanda', 'Insiza', 'Matobo'],
  'Midlands':            ['Chirumhanzu', 'Gokwe North', 'Gokwe South', 'Gweru', 'Kwekwe', 'Shurugwi'],
  'Manicaland':          ['Buhera', 'Chimanimani', 'Chipinge', 'Makoni', 'Mutare', 'Nyanga'],
  'Masvingo':            ['Bikita', 'Chiredzi', 'Chivi', 'Gutu', 'Masvingo', 'Mwenezi'],
  'Harare':              ['Harare Urban', 'Epworth', 'Seke Rural'],
  'Bulawayo':            ['Bulawayo Urban', 'Umguza'],
};

const SPECIES_OPTIONS = ['Cattle', 'Goat', 'Mixed'];
const SUPPLY_CATEGORIES = ['Vaccines', 'Antibiotics', 'Antiparasitcs', 'Feed Supplements', 'Equipment', 'All Products'];

const STEPS = ['Role', 'Personal', 'Organization', 'Details', 'Confirm'];

// ── helpers ────────────────────────────────────────────────────────────────
// Labels sit at 11px/700 with open tracking rather than the 10px/900
// "font-bold uppercase tracking-wide" the app used everywhere — same
// eyebrow role, read as considered instead of shouted.
const Field = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="block text-[0.6875rem] font-bold text-gray-500 uppercase tracking-[0.1em]">
      {label}{required && <span className="text-terra-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

// Every input in the 5-step registration flows through this one string, so
// the whole form adopts the warm hairline treatment at once.
const inputCls = 'w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-bark-500/12 focus:border-bark-500/45 focus:bg-white outline-none font-medium text-sm text-gray-900 placeholder:text-gray-400 transition';
const selectCls = inputCls + ' appearance-none cursor-pointer';

// Module-scope so its identity is stable across AuthPortal re-renders — see
// the matching comment on AnimalProfile.jsx's Field for why a component
// defined inside another component's body must never wrap a live input.
const FileField = ({ label, field, required, form, set }) => (
  <Field label={label} required={required}>
    <label className={`${inputCls} flex items-center gap-2.5 cursor-pointer`}>
      <Upload size={15} className="text-gray-400 shrink-0" />
      <span className="truncate">{form[field] ? form[field].name : 'Choose a PDF, JPG, or PNG...'}</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => set(field, e.target.files?.[0] || null)} />
    </label>
  </Field>
);

// Password field with a show/hide toggle so users can check what they typed
// before submitting (registration errors on a mistyped password are otherwise
// only caught by the confirm-password mismatch check, or not at all on login).
const PasswordInput = ({ value, onChange, placeholder, required }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        className={inputCls + ' pl-10 pr-10'}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
};

// ── component ──────────────────────────────────────────────────────────────
const AuthPortal = ({ onLogin }) => {
  const [step, setStep] = useState(0);          // 0-4
  const [isReturning, setIsReturning] = useState(true);  // login vs register
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [form, setForm] = useState({
    // step 0
    role: 'Farmer',
    // step 1 — personal
    fullName: '', phone: '', nationalId: '', email: '', password: '', confirmPassword: '',
    // step 2 — organisation
    orgName: '', province: 'Mashonaland West', district: '', physicalAddress: '',
    // step 2 — next of kin (every role, for account succession)
    nextOfKinName: '', nextOfKinPhone: '', nextOfKinNationalId: '', nextOfKinRelationship: '',
    // step 3 — role-specific
    // farmer
    farmSize: '', species: [],
    // vet
    licenseNumber: '', speciality: '',
    // supplier
    businessReg: '', supplyCategories: [],
    // buyer
    buyerReg: '', tradingAreas: '',
    // institution (bank/insurer)
    institutionType: '',
    // verification documents (required for every role)
    idDocument: null, credentialDocument: null,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleArr = (k, v) => setForm(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));

  const role     = ROLES.find(r => r.name === form.role) || ROLES[0];
  const districts = DISTRICTS[form.province] || [];

  // Maps the backend's snake_case user record (+ JWT) into the shape the rest
  // of the app expects, so App.jsx doesn't need to know about the API layer.
  const userFromApi = (apiUser, token) => ({
    id: apiUser.id,
    token,
    name: apiUser.full_name,
    phone: apiUser.phone,
    email: apiUser.email,
    org: apiUser.org_name,
    province: apiUser.province,
    district: apiUser.district,
    address: apiUser.address,
    role: apiUser.role,
    farmSize: apiUser.farm_size_ha,
    species: (apiUser.species_farmed || '').split(',').filter(Boolean),
    licenseNumber: apiUser.license_number,
    speciality: apiUser.speciality,
    businessReg: apiUser.business_reg,
    supplyCategories: (apiUser.supply_categories || '').split(',').filter(Boolean),
    tradingAreas: apiUser.trading_areas,
    badgeNumber: apiUser.badge_number,
    station: apiUser.station,
    jurisdictionProvince: apiUser.jurisdiction_province,
    institutionType: apiUser.institution_type,
    verificationStatus: apiUser.verification_status,
    nextOfKinName: apiUser.next_of_kin_name,
    nextOfKinPhone: apiUser.next_of_kin_phone,
    nextOfKinNationalId: apiUser.next_of_kin_national_id,
    nextOfKinRelationship: apiUser.next_of_kin_relationship,
    nextOfKinVerificationStatus: apiUser.next_of_kin_verification_status,
    // Real uploaded profile photo when the user has set one; otherwise the
    // same deterministic placeholder avatar as always.
    avatar: apiUser.avatar_url ? `${API}${apiUser.avatar_url}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiUser.full_name || 'PFUMA/INGCEBO'}`,
  });

  // ── login ──
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword) return;
    setAuthError(''); setAuthBusy(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Login failed.'); return; }
      onLogin(userFromApi(data.user, data.token));
    } catch {
      setAuthError('Could not reach the PFUMA/INGCEBO API. Is the Flask backend running?');
    } finally {
      setAuthBusy(false);
    }
  };

  // ── registration ──
  const register = async () => {
    setAuthError(''); setAuthBusy(true);
    try {
      const fd = new FormData();
      fd.append('full_name', form.fullName);
      fd.append('phone', form.phone);
      fd.append('national_id_number', form.nationalId);
      fd.append('email', form.email);
      fd.append('password', form.password);
      fd.append('role', form.role);
      fd.append('org_name', form.orgName);
      fd.append('province', form.province);
      fd.append('district', form.district);
      fd.append('address', form.physicalAddress);
      fd.append('next_of_kin_name', form.nextOfKinName);
      fd.append('next_of_kin_phone', form.nextOfKinPhone);
      fd.append('next_of_kin_national_id', form.nextOfKinNationalId);
      fd.append('next_of_kin_relationship', form.nextOfKinRelationship);
      fd.append('farm_size_ha', form.farmSize || '');
      fd.append('species_farmed', form.species.join(','));
      fd.append('license_number', form.licenseNumber);
      fd.append('speciality', form.speciality);
      fd.append('business_reg', form.businessReg || form.buyerReg);
      fd.append('supply_categories', form.supplyCategories.join(','));
      fd.append('trading_areas', form.tradingAreas);
      fd.append('institution_type', form.institutionType);
      if (form.idDocument) fd.append('id_document', form.idDocument);
      if (form.credentialDocument) fd.append('credential_document', form.credentialDocument);

      const res = await fetch(`${API}/auth/register`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Registration failed.'); return; }
      onLogin(userFromApi(data.user, data.token));
    } catch {
      setAuthError('Could not reach the PFUMA/INGCEBO API. Is the Flask backend running?');
    } finally {
      setAuthBusy(false);
    }
  };

  // ── step validation ──
  const canAdvance = () => {
    if (step === 1) return form.fullName.trim() && isValidZwPhone(form.phone) && isValidZwNationalId(form.nationalId) && form.password.length >= 8 && form.password === form.confirmPassword;
    if (step === 2) return form.orgName.trim() && form.province && form.nextOfKinName.trim() && isValidZwPhone(form.nextOfKinPhone);
    return true;
  };

  const advance  = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back     = () => setStep(s => Math.max(s - 1, 0));
  const confirm  = () => { if (agreedToTerms) register(); };

  // ── step renderers ──
  const renderStep0 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="pf-display text-2xl text-gray-900">Choose Your Role</h3>
        <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Your role determines what you can see and do on PFUMA/INGCEBO.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ROLES.map(r => (
          <button
            key={r.name}
            type="button"
            onClick={() => set('role', r.name)}
            className={`p-5 rounded-2xl border-2 text-left transition hover:shadow-md ${form.role === r.name ? `${r.border} bg-gray-50 shadow-md` : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`w-10 h-10 rounded-xl ${form.role === r.name ? r.color : 'bg-gray-100'} flex items-center justify-center mb-3 transition`}>
              <r.icon size={20} className={form.role === r.name ? 'text-white' : 'text-gray-400'} />
            </div>
            <p className="text-sm font-bold text-gray-800 mb-1">{r.name}</p>
            <p className="text-xs text-gray-400 font-medium leading-snug">{r.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="pf-display text-2xl text-gray-900">Your Personal Details</h3>
        <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">This is how other stakeholders will identify and contact you.</p>
      </div>
      <Field label="Full Name" required>
        <input className={inputCls} type="text" placeholder="e.g. Tatenda Moyo" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
      </Field>
      <Field label="Phone Number" required>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="tel" placeholder="+263 77 123 4567" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        {form.phone.trim() && !isValidZwPhone(form.phone) && (
          <p className="text-xs text-red-500 font-bold mt-1">Enter a valid Zimbabwean mobile number (Econet 077/078, NetOne 071, or Telecel 073).</p>
        )}
      </Field>
      <Field label="National ID Number" required>
        <div className="relative">
          <CreditCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="text" placeholder="e.g. 63-1234567A00" value={form.nationalId} onChange={e => set('nationalId', e.target.value)} />
        </div>
        {form.nationalId.trim() && !isValidZwNationalId(form.nationalId) && (
          <p className="text-xs text-red-500 font-bold mt-1">Doesn't match the Zimbabwe ID format (district-serial-checkletter-citizenship code), e.g. 63-1234567A00.</p>
        )}
        <p className="text-xs text-gray-400 font-medium mt-1">Used alongside your uploaded ID document so a reviewer can confirm they match.</p>
      </Field>
      <Field label="Email Address">
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
      </Field>
      <Field label="Password" required>
        <PasswordInput placeholder="At least 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
      </Field>
      <Field label="Confirm Password" required>
        <PasswordInput placeholder="Re-enter your password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
      </Field>
      {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
        <p className="text-xs text-red-500 font-bold">Passwords don't match.</p>
      )}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium">
        Your phone number is used so farmers, vets, and suppliers can reach you directly through the PFUMA/INGCEBO directory.
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="pf-display text-2xl text-gray-900">Your Organisation</h3>
        <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">
          {form.role === 'Farmer' ? 'Your farm name and location.' :
           form.role === 'Veterinarian' ? 'Your practice or government department.' :
           form.role === 'Supplier' ? 'Your supply business details.' :
           'Your trading business details.'}
        </p>
      </div>
      <Field label={form.role === 'Farmer' ? 'Farm Name' : 'Organisation / Business Name'} required>
        <div className="relative">
          <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="text"
            placeholder={form.role === 'Farmer' ? 'e.g. Moyo Family Farm' : form.role === 'Veterinarian' ? 'e.g. DVS Mashonaland West' : 'e.g. AgroChem Zimbabwe'}
            value={form.orgName} onChange={e => set('orgName', e.target.value)} />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Province" required>
          <div className="relative">
            <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select className={selectCls + ' pl-9'} value={form.province} onChange={e => { set('province', e.target.value); set('district', ''); }}>
              {PROVINCES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </Field>
        <Field label="District">
          <select className={selectCls} value={form.district} onChange={e => set('district', e.target.value)} disabled={!districts.length}>
            <option value="">Select district...</option>
            {districts.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Physical Address / Farm Location">
        <input className={inputCls} type="text" placeholder="e.g. Plot 23, Chegutu Road, Zvimba" value={form.physicalAddress} onChange={e => set('physicalAddress', e.target.value)} />
      </Field>

      <div className="pt-2 border-t border-gray-100">
        <h4 className="text-sm font-bold text-gray-900 mb-1">Next of Kin</h4>
        <p className="text-xs text-gray-400 font-medium mb-3">
          Who should PFUMA/INGCEBO contact — and who can request to take over this account — if something happens to you. Required for every role.
        </p>
      </div>
      <Field label="Next of Kin Full Name" required>
        <input className={inputCls} type="text" placeholder="e.g. Rudo Moyo" value={form.nextOfKinName} onChange={e => set('nextOfKinName', e.target.value)} />
      </Field>
      <Field label="Next of Kin Phone Number" required>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="tel" placeholder="+263 77 123 4567" value={form.nextOfKinPhone} onChange={e => set('nextOfKinPhone', e.target.value)} />
        </div>
        {form.nextOfKinPhone.trim() && !isValidZwPhone(form.nextOfKinPhone) && (
          <p className="text-xs text-red-500 font-bold mt-1">Enter a valid Zimbabwean mobile number.</p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Relationship">
          <input className={inputCls} type="text" placeholder="e.g. Spouse, Sibling" value={form.nextOfKinRelationship} onChange={e => set('nextOfKinRelationship', e.target.value)} />
        </Field>
        <Field label="National ID (optional)">
          <input className={inputCls} type="text" placeholder="e.g. 63-1234567A00" value={form.nextOfKinNationalId} onChange={e => set('nextOfKinNationalId', e.target.value)} />
        </Field>
      </div>
    </div>
  );

  const roleFields = () => {
    if (form.role === 'Farmer') return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Farm Details</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Help vets and suppliers understand the scale of your operation.</p>
        </div>
        <Field label="Farm Size (hectares)">
          <input className={inputCls} type="number" min="0" placeholder="e.g. 50" value={form.farmSize} onChange={e => set('farmSize', e.target.value)} />
        </Field>
        <Field label="Main Livestock Species (select all that apply)">
          <div className="flex flex-wrap gap-2 mt-1">
            {SPECIES_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleArr('species', s)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition ${form.species.includes(s) ? 'bg-pfuma-green text-white border-pfuma-green' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-pfuma-green/40'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 font-medium">
          This helps the PFUMA/INGCEBO AI recommend the right vaccine schedules and dosages for your specific livestock.
        </div>
      </div>
    );

    if (form.role === 'Veterinarian') return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Professional Details</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Your credentials verify your authority to issue health certificates.</p>
        </div>
        <Field label="DVS License Number" required>
          <input className={inputCls} type="text" placeholder="e.g. DVS-ZIM-2024-0045" value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} />
        </Field>
        <Field label="Speciality">
          <select className={selectCls} value={form.speciality} onChange={e => set('speciality', e.target.value)}>
            <option value="">Select speciality...</option>
            {['General Practice', 'Tick-borne Diseases', 'Reproductive Health', 'Surgery', 'FMD & CBPP Specialist', 'Emergency Response'].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium">
          Your license number is verified against the DVS Zimbabwe registry. Farmers can search for you by name and speciality.
        </div>
      </div>
    );

    if (form.role === 'Supplier') return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Supply Details</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Farmers search for suppliers by product category and province.</p>
        </div>
        <Field label="Business Registration Number">
          <input className={inputCls} type="text" placeholder="e.g. BP 12345/2024" value={form.businessReg} onChange={e => set('businessReg', e.target.value)} />
        </Field>
        <Field label="Product Categories (select all that apply)">
          <div className="flex flex-wrap gap-2 mt-1">
            {SUPPLY_CATEGORIES.map(s => (
              <button key={s} type="button" onClick={() => toggleArr('supplyCategories', s)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition ${form.supplyCategories.includes(s) ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-orange-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-medium">
          Farmers search the supplier directory when they need to restock. Your product categories determine when you appear.
        </div>
      </div>
    );

    if (form.role === 'Buyer') return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Trading Details</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Farmers and vets verify your trading identity before completing a sale.</p>
        </div>
        <Field label="Business Registration Number">
          <input className={inputCls} type="text" placeholder="e.g. BP 67890/2023" value={form.buyerReg} onChange={e => set('buyerReg', e.target.value)} />
        </Field>
        <Field label="Trading Areas / Provinces Served">
          <input className={inputCls} type="text" placeholder="e.g. Mashonaland West, Midlands, Harare" value={form.tradingAreas} onChange={e => set('tradingAreas', e.target.value)} />
        </Field>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700 font-medium">
          Your registration number is attached to every bid you place, ensuring farmers know they are selling to a verified trader.
        </div>
      </div>
    );

    if (form.role === 'Institution') return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Institution Details</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Farmers share you a certificate code; you verify and track it here.</p>
        </div>
        <Field label="Institution Type" required>
          <div className="flex flex-wrap gap-2 mt-1">
            {['Bank', 'Insurer', 'Other'].map(t => (
              <button key={t} type="button" onClick={() => set('institutionType', t)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition ${form.institutionType === t ? 'bg-teal-700 text-white border-teal-700' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-teal-600/40'}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Registration / License Number">
          <input className={inputCls} type="text" placeholder="e.g. RBZ-BNK-2024-0012" value={form.businessReg} onChange={e => set('businessReg', e.target.value)} />
        </Field>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700 font-medium">
          Once verified, you can look up any PFUMA/INGCEBO valuation certificate and flag it as held collateral — so a second lender sees it's already pledged.
        </div>
      </div>
    );

    return null;
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      {roleFields()}
      <div className="pt-2 border-t border-gray-100 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">Verification Documents</h4>
          <p className="text-xs text-gray-400 font-medium">Required so Police (or, for vets, an existing verified vet) can confirm you're who you say you are before you get full access. See <span className="font-bold">compliance/signup-verification-requirements.md</span> for what's expected per role.</p>
        </div>
        <FileField label="National ID Document" field="idDocument" required form={form} set={set} />
        <FileField
          label={form.role === 'Farmer' ? 'Proof of Land / Farm (title, lease, or allocation letter)'
            : form.role === 'Veterinarian' ? 'DVS Practice License'
            : 'Business Registration Certificate'}
          field="credentialDocument"
          form={form} set={set}
        />
      </div>
    </div>
  );

  const renderStep4 = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="pf-display text-2xl text-gray-900">Confirm Your Identity</h3>
          <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">Review your details before creating your PFUMA/INGCEBO Digital ID.</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
          {/* Role badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white ${role.color}`}>
            <role.icon size={13} /> {form.role}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Full Name',     value: form.fullName   },
              { label: 'Phone',         value: form.phone      },
              { label: 'National ID',   value: form.nationalId },
              { label: 'Email',         value: form.email || '—' },
              { label: 'Organisation',  value: form.orgName    },
              { label: 'Province',      value: form.province   },
              { label: 'District',      value: form.district || '—' },
              form.physicalAddress && { label: 'Address', value: form.physicalAddress },
              form.farmSize       && { label: 'Farm Size', value: `${form.farmSize} ha` },
              form.species.length && { label: 'Species', value: form.species.join(', ') },
              form.licenseNumber  && { label: 'DVS License', value: form.licenseNumber },
              form.speciality     && { label: 'Speciality', value: form.speciality },
              (form.businessReg || form.buyerReg) && { label: 'Business Reg', value: form.businessReg || form.buyerReg },
              form.institutionType && { label: 'Institution Type', value: form.institutionType },
              form.supplyCategories.length && { label: 'Products', value: form.supplyCategories.join(', ') },
              form.tradingAreas   && { label: 'Trading Areas', value: form.tradingAreas },
              { label: 'ID Document',         value: form.idDocument ? form.idDocument.name : 'Not attached' },
              { label: 'Credential Document',  value: form.credentialDocument ? form.credentialDocument.name : 'Not attached' },
            ].filter(Boolean).map(f => f && (
              <div key={f.label}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{f.label}</p>
                <p className="font-bold text-gray-800 truncate">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-pfuma-green/5 border border-pfuma-green/20 rounded-xl p-3 text-xs text-gray-600 font-medium leading-relaxed">
          Your account starts <span className="font-bold">pending verification</span> — {form.role === 'Veterinarian' ? 'an existing verified vet' : 'Police'} reviews your documents before you get full access. Your profile is only visible in the PFUMA/INGCEBO directory once verified.
        </div>

        <div className="border border-gray-200 rounded-xl p-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-pfuma-green shrink-0"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
            />
            <span className="text-xs text-gray-600 font-medium leading-relaxed">
              I confirm the details above are accurate and I agree to PFUMA/INGCEBO's{' '}
              <button type="button" onClick={() => setShowTerms(true)} className="text-pfuma-green font-bold hover:underline">
                Terms &amp; Conditions and Privacy Policy
              </button>.
            </span>
          </label>
        </div>

        {showTerms && (
          <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm p-4" onClick={() => setShowTerms(false)}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h4 className="text-lg font-bold text-gray-900 mb-3">Terms &amp; Conditions</h4>
              <div className="space-y-3 text-xs text-gray-600 font-medium leading-relaxed">
                <p>By creating a PFUMA/INGCEBO Digital ID you agree that:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>The personal, farm/business, and identity details you provide are true and belong to you.</li>
                  <li>Your uploaded ID and credential documents may be reviewed by Police (or, for veterinarians, an existing verified vet) to verify your identity before your account is activated.</li>
                  <li>Your name, role, organisation, and province are visible to other verified PFUMA/INGCEBO members in the directory once your account is verified, so they can contact you for trade, veterinary, or supply purposes.</li>
                  <li>Livestock listings, sale data, health records, and marketplace activity you create are stored and may be reviewed by Police as part of the sale-clearance process, to prevent stock theft and fraud.</li>
                  <li>PFUMA/INGCEBO may suspend accounts found to be fraudulent, impersonating another party, or otherwise abusing the platform.</li>
                </ul>
                <p>See <span className="font-bold">docs/PRIVACY_POLICY.md</span> in the project repository for the full data-handling policy.</p>
              </div>
              <button onClick={() => setShowTerms(false)} className="w-full mt-5 py-3 bg-pfuma-green text-white rounded-2xl font-bold uppercase text-xs tracking-wide hover:bg-green-700 transition">
                Close
              </button>
            </div>
          </div>
        )}

        {authError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-bold">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {authError}
          </div>
        )}
      </div>
    );
  };

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  // ── render ──
  return (
    <div className="fixed inset-0 z-[3000] bg-ivory font-sans overflow-y-auto lg:overflow-hidden">
      <div className="min-h-full lg:h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(27rem,0.9fr)]">

        {/* ══ BRAND PANEL ══
            Full-bleed photography rather than a flat brand colour: this is
            the one screen a first-time user judges the product on, and the
            livestock has to be the thing they see. On mobile it becomes a
            shorter band above the form — the form is what matters on a
            phone, so it gets the screen. */}
        <aside className="relative isolate overflow-hidden min-h-[17rem] sm:min-h-[20rem] lg:min-h-0">
          <img
            src={photo(AUTH_HERO, { w: 1600, q: 76 })}
            alt=""
            className="absolute inset-0 w-full h-full pf-photo"
            decoding="async"
          />
          {/* Two-layer scrim: an overall warm tint to unify the photograph
              with the palette, then a bottom-weighted wash so the headline
              never sits on a bright patch of sky. */}
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{ background: 'linear-gradient(150deg, rgba(43,20,4,0.62) 0%, rgba(43,20,4,0.34) 45%, rgba(43,20,4,0.30) 100%)' }}
          />
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{ background: 'linear-gradient(0deg, rgba(26,12,2,0.92) 0%, rgba(26,12,2,0.55) 34%, rgba(26,12,2,0.05) 72%)' }}
          />

          <div className="relative h-full flex flex-col justify-between p-6 sm:p-9 lg:p-12 xl:p-14 text-white">
            <div className="flex items-center gap-3">
              <img src={pfumaMark} alt="" className="w-10 h-10 rounded-xl object-cover shadow-lg shrink-0" />
              <span className="text-lg font-extrabold tracking-tight">PFUMA/INGCEBO</span>
            </div>

            <div className="mt-10 lg:mt-0">
              <p className="pf-eyebrow-light mb-3 pf-rise">Zimbabwe · Livestock Intelligence</p>
              <h1
                className="pf-display text-[2rem] sm:text-[2.75rem] xl:text-[3.25rem] max-w-[13ch] text-balance pf-rise"
                style={{ '--pf-delay': '70ms' }}
              >
                Every animal, traceable from birth to sale.
              </h1>
              <p
                className="mt-5 text-sm sm:text-base text-white/75 leading-relaxed max-w-[38ch] pf-rise"
                style={{ '--pf-delay': '150ms' }}
              >
                One verified record connecting farmers, veterinarians, suppliers and buyers
                across all ten provinces.
              </p>

              {/* The trust strip. Describes what the platform actually
                  enforces — not badges, not partner logos we don't have. */}
              <ul
                className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-[0.8125rem] font-medium text-white/70 pf-rise"
                style={{ '--pf-delay': '230ms' }}
              >
                {['National ID verified', 'Vet-certified health', 'Police sale clearance'].map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Role preview — desktop only. During registration the chosen
                role lights up here, so the two panels stay connected. */}
            <div className="hidden lg:block mt-10">
              <p className="pf-eyebrow-light mb-3">Who PFUMA/INGCEBO is for</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {ROLES.map(r => {
                  const on = form.role === r.name && !isReturning;
                  return (
                    <div
                      key={r.name}
                      className={`flex items-center gap-2.5 py-1.5 transition-colors ${on ? 'text-amber-300' : 'text-white/55'}`}
                    >
                      <r.icon size={14} className="shrink-0" aria-hidden="true" />
                      <span className="text-[0.8125rem] font-semibold">{r.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ══ FORM PANEL ══ */}
        <main className="bg-white flex flex-col min-h-0 lg:overflow-hidden">

          {isReturning ? (
            /* ── Quick Login ── */
            <div className="flex-1 lg:overflow-y-auto flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 lg:py-12 text-left">
              <div className="w-full max-w-[26rem] mx-auto">
                <p className="pf-eyebrow mb-3">Sign in</p>
                <h2 className="pf-display text-3xl text-gray-900">Welcome back</h2>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                  Your role and permissions come from your verified PFUMA/INGCEBO account.
                </p>

                <form onSubmit={handleLogin} className="space-y-5 mt-9">
                  <Field label="Phone Number" required>
                    <div className="relative">
                      <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input className={inputCls + ' pl-11'} type="tel" placeholder="+263 77 123 4567" required value={loginPhone} onChange={e => setLoginPhone(e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Password" required>
                    <PasswordInput required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                  </Field>

                  {authError && (
                    <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 font-semibold leading-relaxed">
                      <AlertTriangle size={15} className="shrink-0 mt-px" aria-hidden="true" /> {authError}
                    </div>
                  )}

                  <Button type="submit" size="lg" disabled={authBusy} loading={authBusy} iconRight={!authBusy} className="w-full !mt-7">
                    {authBusy ? 'Signing in…' : 'Enter portal'}
                  </Button>
                </form>

                <p className="mt-9 text-sm text-gray-500">
                  New to PFUMA/INGCEBO?{' '}
                  <button onClick={() => { setIsReturning(false); setStep(0); setAuthError(''); }} className="text-bark-500 font-bold hover:text-bark-700 pf-navlink">
                    Create a Digital ID
                  </button>
                </p>
              </div>
            </div>

          ) : (
            /* ── Multi-step Registration ── */
            <>
              {/* Progress — a thin rule with a filled portion plus the
                  current step named in words. The five numbered circles it
                  replaces were the widest element on a phone and pushed the
                  actual form below the fold. */}
              <div className="px-6 sm:px-10 lg:px-14 pt-8 lg:pt-10 shrink-0">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="pf-eyebrow">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
                  <p className="text-xs font-semibold text-gray-400 hidden sm:block">
                    {STEPS.slice(step + 1).length
                      ? `Next: ${STEPS[step + 1]}`
                      : 'Final step'}
                  </p>
                </div>
                <div className="h-1 rounded-full bg-cream overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Registration progress">
                  <div
                    className="h-full rounded-full bg-bark-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 lg:overflow-y-auto px-6 sm:px-10 lg:px-14 py-8">
                <div className="w-full max-w-[30rem] mx-auto lg:mx-0">
                  {stepContent[step]()}
                </div>
              </div>

              {/* Navigation */}
              <div className="px-6 sm:px-10 lg:px-14 pb-8 shrink-0 border-t border-bark-500/8 pt-5">
                <div className="w-full max-w-[30rem] mx-auto lg:mx-0 flex gap-3">
                  {step > 0 && (
                    <Button variant="secondary" size="lg" onClick={back} icon={ArrowLeft}>
                      Back
                    </Button>
                  )}
                  {step < STEPS.length - 1 ? (
                    <Button size="lg" onClick={advance} disabled={!canAdvance()} iconRight className="flex-1">
                      Continue
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={confirm}
                      disabled={authBusy || !agreedToTerms}
                      loading={authBusy}
                      icon={CheckCircle}
                      title={!agreedToTerms ? 'Please accept the Terms & Conditions first' : undefined}
                      className="flex-1"
                    >
                      {authBusy ? 'Creating…' : 'Create Digital ID'}
                    </Button>
                  )}
                </div>
                <p className="w-full max-w-[30rem] mx-auto lg:mx-0 mt-5 text-sm text-gray-500">
                  Already registered?{' '}
                  <button onClick={() => setIsReturning(true)} className="text-bark-500 font-bold hover:text-bark-700 pf-navlink">
                    Sign in
                  </button>
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AuthPortal;
