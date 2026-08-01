import React, { useState } from 'react';
import {
  Sprout, ShoppingBag, Truck, ArrowRight, ArrowLeft,
  Phone, Mail, MapPin, Building2, CheckCircle, Stethoscope, Shield,
  Lock, Upload, AlertTriangle, CreditCard,
} from 'lucide-react';

const API = 'http://localhost:5000';

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
    name: 'Retailer',
    icon: ShoppingBag,
    color: 'bg-purple-600',
    border: 'border-purple-600',
    desc: 'Browse certified livestock listings and acquire trade certificates.',
  },
  {
    name: 'Police',
    icon: Shield,
    color: 'bg-red-700',
    border: 'border-red-700',
    desc: 'Verify livestock papers and clear sales before they go live.',
  },
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

const SPECIES_OPTIONS = ['Cattle', 'Goat', 'Sheep', 'Pig', 'Poultry', 'Mixed'];
const SUPPLY_CATEGORIES = ['Vaccines', 'Antibiotics', 'Antiparasitcs', 'Feed Supplements', 'Equipment', 'All Products'];

const STEPS = ['Role', 'Personal', 'Organization', 'Details', 'Confirm'];

// ── helpers ────────────────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
      {label}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full p-3.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pfuma-green outline-none font-semibold text-sm text-gray-800 placeholder:text-gray-400 transition';
const selectCls = inputCls + ' appearance-none cursor-pointer';

// ── component ──────────────────────────────────────────────────────────────
const AuthPortal = ({ onLogin }) => {
  const [step, setStep] = useState(0);          // 0-4
  const [isReturning, setIsReturning] = useState(true);  // login vs register
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [form, setForm] = useState({
    // step 0
    role: 'Farmer',
    // step 1 — personal
    fullName: '', phone: '', nationalId: '', email: '', password: '', confirmPassword: '',
    // step 2 — organisation
    orgName: '', province: 'Mashonaland West', district: '', physicalAddress: '',
    // step 3 — role-specific
    // farmer
    farmSize: '', species: [],
    // vet
    licenseNumber: '', speciality: '',
    // supplier
    businessReg: '', supplyCategories: [],
    // retailer
    retailerReg: '', tradingAreas: '',
    // police
    badgeNumber: '', station: '', jurisdictionProvince: 'Mashonaland West',
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
    verificationStatus: apiUser.verification_status,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${apiUser.full_name || 'PFUMA'}`,
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
      setAuthError('Could not reach the PFUMA API. Is the Flask backend running?');
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
      fd.append('farm_size_ha', form.farmSize || '');
      fd.append('species_farmed', form.species.join(','));
      fd.append('license_number', form.licenseNumber);
      fd.append('speciality', form.speciality);
      fd.append('business_reg', form.businessReg || form.retailerReg);
      fd.append('supply_categories', form.supplyCategories.join(','));
      fd.append('trading_areas', form.tradingAreas);
      if (form.idDocument) fd.append('id_document', form.idDocument);
      if (form.credentialDocument) fd.append('credential_document', form.credentialDocument);

      const res = await fetch(`${API}/auth/register`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Registration failed.'); return; }
      onLogin(userFromApi(data.user, data.token));
    } catch {
      setAuthError('Could not reach the PFUMA API. Is the Flask backend running?');
    } finally {
      setAuthBusy(false);
    }
  };

  // ── step validation ──
  const canAdvance = () => {
    if (step === 1) return form.fullName.trim() && isValidZwPhone(form.phone) && isValidZwNationalId(form.nationalId) && form.password.length >= 8 && form.password === form.confirmPassword;
    if (step === 2) return form.orgName.trim() && form.province;
    return true;
  };

  const advance  = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back     = () => setStep(s => Math.max(s - 1, 0));
  const confirm  = () => register();

  // ── step renderers ──
  const renderStep0 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-gray-900 mb-1">Choose Your Role</h3>
        <p className="text-sm text-gray-400 font-medium">Your role determines what you can see and do on PFUMA.</p>
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
            <p className="text-sm font-black text-gray-800 mb-1">{r.name}</p>
            <p className="text-[10px] text-gray-400 font-medium leading-snug">{r.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-gray-900 mb-1">Your Personal Details</h3>
        <p className="text-sm text-gray-400 font-medium">This is how other stakeholders will identify and contact you.</p>
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
          <p className="text-[10px] text-red-500 font-bold mt-1">Enter a valid Zimbabwean mobile number (Econet 077/078, NetOne 071, or Telecel 073).</p>
        )}
      </Field>
      <Field label="National ID Number" required>
        <div className="relative">
          <CreditCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="text" placeholder="e.g. 63-1234567A00" value={form.nationalId} onChange={e => set('nationalId', e.target.value)} />
        </div>
        {form.nationalId.trim() && !isValidZwNationalId(form.nationalId) && (
          <p className="text-[10px] text-red-500 font-bold mt-1">Doesn't match the Zimbabwe ID format (district-serial-checkletter-citizenship code), e.g. 63-1234567A00.</p>
        )}
        <p className="text-[10px] text-gray-400 font-medium mt-1">Used alongside your uploaded ID document so a reviewer can confirm they match.</p>
      </Field>
      <Field label="Email Address">
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
      </Field>
      <Field label="Password" required>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="password" placeholder="At least 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
      </Field>
      <Field label="Confirm Password" required>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
        </div>
      </Field>
      {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
        <p className="text-[10px] text-red-500 font-bold">Passwords don't match.</p>
      )}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-700 font-medium">
        Your phone number is used so farmers, vets, and suppliers can reach you directly through the PFUMA directory.
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-gray-900 mb-1">Your Organisation</h3>
        <p className="text-sm text-gray-400 font-medium">
          {form.role === 'Farmer' ? 'Your farm name and location.' :
           form.role === 'Veterinarian' ? 'Your practice or government department.' :
           form.role === 'Supplier' ? 'Your supply business details.' :
           form.role === 'Police' ? 'Your unit and posting.' :
           'Your trading business details.'}
        </p>
      </div>
      <Field label={form.role === 'Farmer' ? 'Farm Name' : form.role === 'Police' ? 'Unit Name' : 'Organisation / Business Name'} required>
        <div className="relative">
          <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={inputCls + ' pl-10'} type="text"
            placeholder={form.role === 'Farmer' ? 'e.g. Moyo Family Farm' : form.role === 'Veterinarian' ? 'e.g. DVS Mashonaland West' : form.role === 'Police' ? 'e.g. ZRP Stock Theft Unit' : 'e.g. AgroChem Zimbabwe'}
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
    </div>
  );

  const roleFields = () => {
    if (form.role === 'Farmer') return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Farm Details</h3>
          <p className="text-sm text-gray-400 font-medium">Help vets and suppliers understand the scale of your operation.</p>
        </div>
        <Field label="Farm Size (hectares)">
          <input className={inputCls} type="number" min="0" placeholder="e.g. 50" value={form.farmSize} onChange={e => set('farmSize', e.target.value)} />
        </Field>
        <Field label="Main Livestock Species (select all that apply)">
          <div className="flex flex-wrap gap-2 mt-1">
            {SPECIES_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleArr('species', s)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black uppercase tracking-wide transition ${form.species.includes(s) ? 'bg-pfuma-green text-white border-pfuma-green' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-pfuma-green/40'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-[11px] text-green-700 font-medium">
          This helps the PFUMA AI recommend the right vaccine schedules and dosages for your specific livestock.
        </div>
      </div>
    );

    if (form.role === 'Veterinarian') return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Professional Details</h3>
          <p className="text-sm text-gray-400 font-medium">Your credentials verify your authority to issue health certificates.</p>
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
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 font-medium">
          Your license number is verified against the DVS Zimbabwe registry. Farmers can search for you by name and speciality.
        </div>
      </div>
    );

    if (form.role === 'Supplier') return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Supply Details</h3>
          <p className="text-sm text-gray-400 font-medium">Farmers search for suppliers by product category and province.</p>
        </div>
        <Field label="Business Registration Number">
          <input className={inputCls} type="text" placeholder="e.g. BP 12345/2024" value={form.businessReg} onChange={e => set('businessReg', e.target.value)} />
        </Field>
        <Field label="Product Categories (select all that apply)">
          <div className="flex flex-wrap gap-2 mt-1">
            {SUPPLY_CATEGORIES.map(s => (
              <button key={s} type="button" onClick={() => toggleArr('supplyCategories', s)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black uppercase tracking-wide transition ${form.supplyCategories.includes(s) ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-orange-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-[11px] text-orange-700 font-medium">
          Farmers search the supplier directory when they need to restock. Your product categories determine when you appear.
        </div>
      </div>
    );

    if (form.role === 'Retailer') return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Trading Details</h3>
          <p className="text-sm text-gray-400 font-medium">Farmers and vets verify your trading identity before completing a sale.</p>
        </div>
        <Field label="Business Registration Number">
          <input className={inputCls} type="text" placeholder="e.g. BP 67890/2023" value={form.retailerReg} onChange={e => set('retailerReg', e.target.value)} />
        </Field>
        <Field label="Trading Areas / Provinces Served">
          <input className={inputCls} type="text" placeholder="e.g. Mashonaland West, Midlands, Harare" value={form.tradingAreas} onChange={e => set('tradingAreas', e.target.value)} />
        </Field>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-[11px] text-purple-700 font-medium">
          Your registration number is attached to every bid you place, ensuring farmers know they are selling to a verified trader.
        </div>
      </div>
    );

    if (form.role === 'Police') return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Officer Details</h3>
          <p className="text-sm text-gray-400 font-medium">Police accounts are provisioned and verified out-of-band (via ZRP/DVS liaison), not self-service — these details go into your verification request.</p>
        </div>
        <Field label="Badge / Service Number" required>
          <input className={inputCls} type="text" placeholder="e.g. ZRP-STU-0231" value={form.badgeNumber} onChange={e => set('badgeNumber', e.target.value)} />
        </Field>
        <Field label="Station">
          <input className={inputCls} type="text" placeholder="e.g. Chegutu Police Station" value={form.station} onChange={e => set('station', e.target.value)} />
        </Field>
        <Field label="Jurisdiction Province" required>
          <select className={selectCls} value={form.jurisdictionProvince} onChange={e => set('jurisdictionProvince', e.target.value)}>
            {PROVINCES.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-medium">
          You will review pending Farmer/Supplier/Retailer signups and livestock sale-clearance requests for {form.jurisdictionProvince}. Your own account is activated by an existing verified officer, not automatically.
        </div>
      </div>
    );
    return null;
  };

  const FileField = ({ label, field, required }) => (
    <Field label={label} required={required}>
      <label className={`${inputCls} flex items-center gap-2.5 cursor-pointer`}>
        <Upload size={15} className="text-gray-400 shrink-0" />
        <span className="truncate">{form[field] ? form[field].name : 'Choose a PDF, JPG, or PNG...'}</span>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => set(field, e.target.files?.[0] || null)} />
      </label>
    </Field>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      {roleFields()}
      <div className="pt-2 border-t border-gray-100 space-y-4">
        <div>
          <h4 className="text-sm font-black text-gray-900 mb-1">Verification Documents</h4>
          <p className="text-[11px] text-gray-400 font-medium">Required so Police (or, for vets, an existing verified vet) can confirm you're who you say you are before you get full access. See <span className="font-bold">compliance/signup-verification-requirements.md</span> for what's expected per role.</p>
        </div>
        <FileField label="National ID Document" field="idDocument" required />
        <FileField
          label={form.role === 'Farmer' ? 'Proof of Land / Farm (title, lease, or allocation letter)'
            : form.role === 'Veterinarian' ? 'DVS Practice License'
            : form.role === 'Police' ? 'Service Attestation Letter'
            : 'Business Registration Certificate'}
          field="credentialDocument"
        />
      </div>
    </div>
  );

  const renderStep4 = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-1">Confirm Your Identity</h3>
          <p className="text-sm text-gray-400 font-medium">Review your details before creating your PFUMA Digital ID.</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
          {/* Role badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black text-white ${role.color}`}>
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
              (form.businessReg || form.retailerReg) && { label: 'Business Reg', value: form.businessReg || form.retailerReg },
              form.supplyCategories.length && { label: 'Products', value: form.supplyCategories.join(', ') },
              form.tradingAreas   && { label: 'Trading Areas', value: form.tradingAreas },
              form.badgeNumber    && { label: 'Badge Number', value: form.badgeNumber },
              form.station        && { label: 'Station', value: form.station },
              form.role === 'Police' && { label: 'Jurisdiction', value: form.jurisdictionProvince },
              { label: 'ID Document',         value: form.idDocument ? form.idDocument.name : 'Not attached' },
              { label: 'Credential Document',  value: form.credentialDocument ? form.credentialDocument.name : 'Not attached' },
            ].filter(Boolean).map(f => f && (
              <div key={f.label}>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{f.label}</p>
                <p className="font-bold text-gray-800 truncate">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-pfuma-green/5 border border-pfuma-green/20 rounded-xl p-3 text-[11px] text-gray-600 font-medium leading-relaxed">
          Your account starts <span className="font-black">pending verification</span> — {form.role === 'Veterinarian' ? 'an existing verified vet' : 'Police'} reviews your documents before you get full access. Your profile is only visible in the PFUMA directory once verified.
        </div>
        {authError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-bold">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {authError}
          </div>
        )}
      </div>
    );
  };

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  // ── render ──
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-gray-950 overflow-hidden font-sans p-0 sm:p-4">
      {/* Background glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-pfuma-green/20 rounded-full blur-[140px]" aria-hidden="true" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-yellow-400/10 rounded-full blur-[140px]" aria-hidden="true" />

      <div className="bg-white w-full max-w-5xl rounded-none sm:rounded-[40px] shadow-2xl overflow-y-auto sm:overflow-hidden flex flex-col md:flex-row relative z-10 animate-in fade-in zoom-in duration-400 h-full sm:h-auto sm:max-h-[95vh] md:h-[680px]">

        {/* ── Left branding panel ── */}
        <div className="w-full md:w-[38%] bg-pfuma-green p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3 md:mb-8">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-pfuma-green font-black text-2xl shadow-lg shrink-0">P</div>
              <div>
                <p className="text-base font-black tracking-tight leading-none">PFUMA</p>
              </div>
            </div>
            <h2 className="text-xl md:text-3xl font-black leading-tight mb-2 md:mb-4">Zimbabwe's Livestock Intelligence Platform</h2>
            <p className="hidden md:block text-green-200 text-sm font-medium leading-relaxed opacity-80">
              Connecting farmers, veterinarians, suppliers, and retailers into one verified digital ecosystem.
            </p>
          </div>

          {/* Stakeholder roles preview — full detail on desktop; a compact
              horizontal strip on mobile to save vertical space, since the
              form below is what actually matters most on a small screen. */}
          <div className="relative z-10 hidden md:block space-y-2">
            {ROLES.map(r => (
              <div key={r.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${form.role === r.name && !isReturning ? 'bg-white/20 border border-white/30' : 'opacity-40'}`}>
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <r.icon size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-white leading-none">{r.name}</p>
                  <p className="text-[9px] text-green-200 font-medium leading-none mt-0.5">{r.desc.split('.')[0]}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="relative z-10 flex md:hidden gap-2 overflow-x-auto pb-1 mt-3 scrollbar-hide">
            {ROLES.map(r => (
              <div key={r.name} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 transition ${form.role === r.name && !isReturning ? 'bg-white/20 border border-white/30' : 'opacity-40'}`}>
                <r.icon size={12} className="text-white shrink-0" />
                <p className="text-[10px] font-black text-white leading-none whitespace-nowrap">{r.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {isReturning ? (
            /* ── Quick Login ── */
            <div className="flex-1 overflow-y-auto p-6 md:p-12 text-left">
              <h3 className="text-2xl font-black text-gray-900 mb-1">Welcome Back</h3>
              <p className="text-sm text-gray-400 font-medium mb-8">Sign in with your phone number and password. Your role comes from your verified PFUMA account.</p>

              <form onSubmit={handleLogin} className="space-y-5">
                <Field label="Phone Number" required>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className={inputCls + ' pl-10'} type="tel" placeholder="+263 77 123 4567" required value={loginPhone} onChange={e => setLoginPhone(e.target.value)} />
                  </div>
                </Field>
                <Field label="Password" required>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className={inputCls + ' pl-10'} type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                  </div>
                </Field>

                {authError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700 font-bold">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {authError}
                  </div>
                )}

                <button type="submit" disabled={authBusy} className="w-full py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {authBusy ? 'Signing In…' : 'Enter Portal'} {!authBusy && <ArrowRight size={15} />}
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-gray-400 font-medium">
                New to PFUMA?{' '}
                <button onClick={() => { setIsReturning(false); setStep(0); setAuthError(''); }} className="text-pfuma-green font-black hover:underline uppercase tracking-widest">
                  Create Digital ID
                </button>
              </p>
            </div>

          ) : (
            /* ── Multi-step Registration ── */
            <>
              {/* Progress bar */}
              <div className="px-5 md:px-10 pt-5 md:pt-8 pb-0">
                <div className="flex items-center gap-1 mb-2">
                  {STEPS.map((s, i) => (
                    <React.Fragment key={s}>
                      <div className={`flex items-center gap-1.5 ${i <= step ? 'text-pfuma-green' : 'text-gray-300'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition ${
                          i < step  ? 'bg-pfuma-green border-pfuma-green text-white' :
                          i === step ? 'border-pfuma-green text-pfuma-green' :
                          'border-gray-200 text-gray-300'
                        }`}>
                          {i < step ? '✓' : i + 1}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wide hidden sm:block ${i === step ? 'text-gray-700' : 'text-gray-300'}`}>{s}</span>
                      </div>
                      {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-pfuma-green' : 'bg-gray-100'}`} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-y-auto px-5 md:px-10 py-6">
                {stepContent[step]()}
              </div>

              {/* Navigation */}
              <div className="px-5 md:px-10 pb-5 md:pb-8 flex gap-3">
                {step > 0 && (
                  <button onClick={back} className="flex items-center gap-2 px-5 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition">
                    <ArrowLeft size={14} /> Back
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button
                    onClick={advance}
                    disabled={!canAdvance()}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-pfuma-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={confirm}
                    disabled={authBusy}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-pfuma-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <CheckCircle size={15} /> {authBusy ? 'Creating…' : 'Create Digital ID & Enter'}
                  </button>
                )}
              </div>

              <p className="pb-5 text-center text-xs text-gray-400 font-medium">
                Already registered?{' '}
                <button onClick={() => setIsReturning(true)} className="text-pfuma-green font-black hover:underline uppercase tracking-widest">
                  Sign In
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPortal;
