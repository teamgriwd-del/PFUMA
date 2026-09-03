import React from 'react';
import {
  Sprout, Stethoscope, Truck, ShoppingBag, ShieldCheck, Landmark,
  ArrowRight, HeartPulse, FileText, TrendingUp, Radio, AlertTriangle,
  CheckCircle, Tag, MessageSquare,
} from 'lucide-react';
import pfumaMark from '../../assets/pfuma-mark.png';

const STAKEHOLDERS = [
  { icon: Sprout,       role: 'Farmer',       color: 'bg-green-50 border-green-100',   text: 'text-green-800',
    desc: 'Register your herd, track vaccinations and weight, and list livestock for sale — all from one Health Passport per animal.' },
  { icon: Stethoscope,  role: 'Veterinarian', color: 'bg-blue-50 border-blue-100',      text: 'text-blue-800',
    desc: 'Certify animal health, sign off on movement permits, and broadcast disease-outbreak alerts to every farmer in the province at once.' },
  { icon: Truck,        role: 'Supplier',     color: 'bg-orange-50 border-orange-100', text: 'text-orange-800',
    desc: 'List medicines, vaccines, and feed with real stock levels — orders decrement your inventory automatically, no spreadsheets.' },
  { icon: ShoppingBag,  role: 'Buyer',        color: 'bg-purple-50 border-purple-100', text: 'text-purple-800',
    desc: 'Browse verified listings with certified health records, bid with confidence, and take ownership with the animal’s full history intact.' },
  { icon: ShieldCheck,  role: 'Police',       color: 'bg-red-50 border-red-100',       text: 'text-red-800',
    desc: 'Clear livestock sales against real ownership records, verify signups before they get access, and see stock-theft patterns as they happen.' },
  { icon: Landmark,     role: 'Institution',  color: 'bg-teal-50 border-teal-100',     text: 'text-teal-800',
    desc: 'Verify a farmer’s livestock valuation certificate as loan or insurance collateral — independently, in seconds, no account needed to check one.' },
];

const FEATURES = [
  { icon: HeartPulse,   title: 'Digital Health Passports',   desc: 'Every animal carries a certified record of vaccinations, weight history, and ownership — verifiable by anyone with the code.' },
  { icon: FileText,     title: 'Real Government Forms, Digitized', desc: 'DVS Form V27 (Movement Permit) and ZRP Form 392 (Clearance Certificate) — filled, signed, and cleared inside the platform, field for field.' },
  { icon: TrendingUp,   title: 'A Real Marketplace',          desc: 'Livestock, feed, and medicine listings with live pricing trends — not a classifieds board, an actual trading system with ownership transfer built in.' },
  { icon: Landmark,     title: 'Bankable Livestock',          desc: 'A signed, independently verifiable valuation certificate turns a herd into loan or insurance collateral — without either side needing a PFUMA account.' },
  { icon: AlertTriangle,title: 'Outbreak Alerts That Reach People', desc: 'A vet reports a disease once; every farmer in the affected province gets notified — automatically, not if they happen to check the app.' },
  { icon: Radio,        title: 'IoT-Ready',                   desc: 'Built to take GPS/LoRa collar data as soon as hardware is deployed — herd location and geofence theft alerts, on the same platform.' },
];

const FLOW = [
  { icon: Sprout,       label: 'Farmer lists a healthy, certified animal' },
  { icon: ShieldCheck,  label: 'Police clear the sale against ownership records' },
  { icon: ShoppingBag,  label: 'A buyer bids and wins' },
  { icon: Stethoscope,  label: 'A vet signs the movement permit' },
  { icon: CheckCircle,  label: 'Ownership — and full history — transfers' },
];

// A CSS-built preview of the real Farmer Dashboard, not a screenshot —
// stays crisp at any size and never goes stale when the real UI changes.
const AppPreview = () => (
  <div className="rounded-3xl bg-white shadow-2xl border border-black/5 overflow-hidden w-full max-w-md">
    <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
      <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
      <span className="ml-3 text-[10px] font-bold text-gray-400 tracking-wide">app.pfuma.co.zw</span>
    </div>
    <div className="p-4 space-y-3 bg-pfuma-cream">
      <div className="bg-pfuma-green rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
        <p className="relative text-[9px] font-black text-green-200 uppercase tracking-widest">Good Morning, Farmer</p>
        <p className="relative text-sm font-black text-white mt-0.5">Mapindu Family Farm</p>
        <p className="relative text-[10px] text-green-100 font-medium mt-1">12 animals · 2 due for vaccination</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Herd Value', value: '$8,420', color: 'text-pfuma-green' },
          { label: 'Certified', value: '12/12', color: 'text-gray-800' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p>
            <p className={`text-base font-black mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-pfuma-gold/15 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-pfuma-gold" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-gray-800 truncate">Bessie — Health Passport</p>
          <p className="text-[9px] text-gray-400 font-medium">Certified · 420kg · Verified owner</p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <MessageSquare size={16} className="text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-gray-800 truncate">Dr T. Moyo issued a movement permit</p>
          <p className="text-[9px] text-gray-400 font-medium">2 minutes ago</p>
        </div>
      </div>
    </div>
  </div>
);

const LandingPage = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-white text-left overflow-x-hidden">

      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={pfumaMark} alt="PFUMA" className="w-9 h-9 rounded-xl object-cover" />
          <span className="text-lg font-black text-gray-900 tracking-tight">PFUMA</span>
        </div>
        <button onClick={onEnter} className="px-5 py-2.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-800 transition shadow-sm">
          Sign In
        </button>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-pfuma-green text-xs font-black uppercase tracking-[3px] mb-4">Zimbabwe's Livestock Intelligence Platform</p>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.08] mb-5" style={{ textWrap: 'balance' }}>
            Every animal, verified. Every sale, cleared. Every farmer, connected.
          </h1>
          <p className="text-base text-gray-500 font-medium leading-relaxed mb-8 max-w-lg">
            PFUMA brings farmers, vets, suppliers, buyers, police, and lenders onto one platform — digitizing the real paperwork of Zimbabwe's livestock trade instead of replacing it with something unfamiliar.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onEnter} className="flex items-center gap-2 px-6 py-3.5 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-800 transition shadow-md">
              Get Started <ArrowRight size={14} />
            </button>
            <button onClick={onEnter} className="px-6 py-3.5 bg-gray-50 text-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition">
              Sign In
            </button>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mt-6">
            Digitizes DVS Form V27 (Movement Permit) &amp; ZRP Form 392 (Livestock Clearance) — field for field, signature for signature.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <AppPreview />
        </div>
      </section>

      {/* Stakeholders */}
      <section className="bg-pfuma-cream py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-pfuma-green text-xs font-black uppercase tracking-[3px] mb-2 text-center">One Platform, Six Roles</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 text-center mb-3">Everyone in the trade, on the same record</h2>
          <p className="text-sm text-gray-500 font-medium text-center max-w-xl mx-auto mb-12">
            No role sees a different version of the truth — a certificate a farmer issues is the exact same certificate a bank verifies.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {STAKEHOLDERS.map(s => (
              <div key={s.role} className={`${s.color} border rounded-2xl p-6`}>
                <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center mb-4">
                  <s.icon size={20} className={s.text} />
                </div>
                <p className={`text-sm font-black uppercase tracking-wide mb-2 ${s.text}`}>{s.role}</p>
                <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it flows */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-pfuma-green text-xs font-black uppercase tracking-[3px] mb-2 text-center">A Real Sale, Start to Finish</p>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 text-center mb-14">How a livestock sale actually clears</h2>
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {FLOW.map((f, i) => (
              <React.Fragment key={f.label}>
                <div className="flex-1 bg-white border-2 border-gray-100 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-pfuma-green/10 flex items-center justify-center">
                    <f.icon size={20} className="text-pfuma-green" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-700 leading-snug">{f.label}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="hidden md:flex items-center justify-center shrink-0">
                    <ArrowRight size={16} className="text-gray-300" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-pfuma-slate py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-pfuma-sprout text-xs font-black uppercase tracking-[3px] mb-2 text-center">Built On Real Deliverables</p>
          <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-14">Not a demo — a working platform</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <f.icon size={22} className="text-pfuma-sprout mb-4" />
                <p className="text-sm font-black text-white mb-2">{f.title}</p>
                <p className="text-[13px] text-gray-400 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Tag size={28} className="text-pfuma-gold mx-auto mb-5" />
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4">Ready to bring your herd onto PFUMA?</h2>
          <p className="text-sm text-gray-500 font-medium mb-8 max-w-md mx-auto">
            Farmer, vet, supplier, buyer, police officer, or lending institution — there's a role built for you.
          </p>
          <button onClick={onEnter} className="inline-flex items-center gap-2 px-8 py-4 bg-pfuma-green text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-800 transition shadow-lg">
            Create Your Digital ID <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={pfumaMark} alt="PFUMA" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-sm font-black text-gray-800">PFUMA</span>
          </div>
          <p className="text-[11px] text-gray-400 font-medium text-center">
            Built in Zimbabwe, first shown at the Zimbabwe Agricultural Show 2026.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
