import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HEALTH_PROTOCOLS, BREED_PROFILES } from './healthData';
import { DOSAGE_RATES } from './dosageData';
import {
  Pill, Calculator, AlertCircle, History, ShieldCheck,
  HeartPulse, Package, AlertTriangle, Baby, Info, BookOpen,
  CheckCircle, Tag, Calendar, FlaskConical, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import './HealthManagement.css';

// ── helpers ────────────────────────────────────────────────────────────────
const catColor = (cat) => {
  if (cat === 'Antibiotic')           return 'bg-blue-100 text-blue-700';
  if (cat === 'Anti-protozoal')       return 'bg-purple-100 text-purple-700';
  if (cat === 'NSAID / Pain Relief')  return 'bg-orange-100 text-orange-700';
  if (cat === 'Antiparasitic')        return 'bg-teal-100 text-teal-700';
  if (cat === 'Anthelmintic')         return 'bg-lime-100 text-lime-700';
  if (cat === 'Hormone')              return 'bg-pink-100 text-pink-700';
  return 'bg-gray-100 text-gray-600';
};

const statusStyle = (s) => {
  if (s === 'Completed') return 'bg-green-50 border-green-100';
  if (s === 'Overdue')   return 'bg-red-50 border-red-200';
  if (s === 'Due Soon')  return 'bg-orange-50 border-orange-200';
  return 'bg-gray-50 border-gray-100';
};
const statusDot = (s) => {
  if (s === 'Completed') return 'bg-pfuma-green';
  if (s === 'Overdue')   return 'bg-red-500';
  if (s === 'Due Soon')  return 'bg-orange-400';
  return 'bg-gray-300';
};
const statusLabel = (s) => {
  if (s === 'Completed') return 'text-pfuma-green';
  if (s === 'Overdue')   return 'text-red-600';
  if (s === 'Due Soon')  return 'text-orange-600';
  return 'text-gray-400';
};

// ── sub-components ─────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, description, color = 'text-pfuma-green' }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className={`p-2 rounded-xl bg-gray-50 ${color} shrink-0`}><Icon size={18} /></div>
    <div>
      <h3 className="text-sm font-black text-gray-800">{title}</h3>
      <p className="text-[11px] text-gray-400 font-medium leading-snug mt-0.5">{description}</p>
    </div>
  </div>
);

const InfoRow = ({ label, value, sub }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs font-bold text-gray-500">{label}</span>
    <div className="text-right">
      <span className="text-xs font-black text-gray-800">{value}</span>
      {sub && <span className="text-[10px] text-gray-400 block">{sub}</span>}
    </div>
  </div>
);

// ── main ───────────────────────────────────────────────────────────────────
const HealthManagement = ({ animals, completedTasks, setCompletedTasks, auditLog, setAuditLog, inventory, setInventory }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [gestationStart, setGestationStart]     = useState('');
  const [selectedMeds, setSelectedMeds]         = useState('Oxytetracycline (LA)');
  const [activeInfoTab, setActiveInfoTab]       = useState('lifecycle');
  const [feedbackMsg, setFeedbackMsg]           = useState(null);
  const [showMedDetail, setShowMedDetail]       = useState(false);
  const feedbackTimerRef = useRef(null);

  useEffect(() => () => { if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); }, []);

  const selectedAnimal = useMemo(
    () => animals.find(a => a.id === parseInt(selectedAnimalId, 10)),
    [animals, selectedAnimalId]
  );

  const showFeedback = (msg, type = 'success') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackMsg({ msg, type });
    feedbackTimerRef.current = setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const calculateGestation = (startDate, species) => {
    if (!startDate || !species) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    const period = HEALTH_PROTOCOLS[species]?.gestation || 283;
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + period);
    const now = new Date();
    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    return { date: dueDate.toDateString(), daysRemaining: diffDays, isUrgent: diffDays <= 14 && diffDays > 0, isOverdue: diffDays < 0, period };
  };

  const getLifecycleStats = (animal) => {
    if (!animal?.birthDate) return null;
    const birth = new Date(animal.birthDate);
    if (isNaN(birth.getTime())) return null;
    const weaningDays = HEALTH_PROTOCOLS[animal.species]?.weaningAge || 210;
    const weaningDate = new Date(birth);
    weaningDate.setDate(birth.getDate() + weaningDays);
    const now = new Date();
    const ageInDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
    const ageYears  = Math.floor(ageInDays / 365);
    const ageMonths = Math.floor((ageInDays % 365) / 30);
    return {
      weaningDate: weaningDate.toDateString(),
      isWeaned: now > weaningDate,
      daysUntilWeaning: Math.ceil((weaningDate - now) / (1000 * 60 * 60 * 24)),
      ageDisplay: ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageInDays}d`,
      ageInDays
    };
  };

  const calculateDosage = (medName, weight) => {
    if (!weight || weight <= 0) return '0.0';
    const med = DOSAGE_RATES[medName];
    if (!med) return '0.0';
    const dose = (weight / med.per) * med.rate;
    return (med.maxDose ? Math.min(dose, med.maxDose) : dose).toFixed(1);
  };

  const getDynamicSchedule = (animal) => {
    if (!animal?.birthDate) return [];
    const birth = new Date(animal.birthDate);
    if (isNaN(birth.getTime())) return [];
    return (HEALTH_PROTOCOLS[animal.species]?.vaccines || []).map(v => {
      const dueDate = new Date(birth);
      dueDate.setDate(birth.getDate() + v.age);
      const now = new Date();
      const taskId = `${animal.id}-${v.name}`;
      const isCompleted = completedTasks.includes(taskId);
      const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      const status = isCompleted ? 'Completed' : now > dueDate ? 'Overdue' : daysUntil <= 14 ? 'Due Soon' : 'Upcoming';
      return { ...v, dueDate: dueDate.toDateString(), daysUntil, status, taskId };
    });
  };

  const handleCompleteTask = (taskName, taskId) => {
    if (completedTasks.includes(taskId) || !selectedAnimal) return;
    setCompletedTasks([...completedTasks, taskId]);
    setAuditLog([{ id: Date.now(), animalId: selectedAnimal.id, animal: selectedAnimal.name, action: taskName, date: new Date().toLocaleString() }, ...auditLog]);
    showFeedback(`✓ ${taskName} marked done for ${selectedAnimal.name}.`);
  };

  const deductInventory = () => {
    if (!selectedAnimal?.currentWeight || selectedAnimal.currentWeight <= 0) {
      showFeedback('Animal weight not recorded. Update the animal profile first.', 'error'); return;
    }
    const dose = parseFloat(calculateDosage(selectedMeds, selectedAnimal.currentWeight));
    const item = inventory.find(i => i.name === selectedMeds);
    if (!item) { showFeedback(`${selectedMeds} is not in the medicine cabinet.`, 'error'); return; }
    if (item.stock < dose) { showFeedback(`Insufficient stock. Only ${item.stock.toFixed(1)}ml left.`, 'error'); return; }
    setInventory(inventory.map(i => i.name === selectedMeds ? { ...i, stock: parseFloat((i.stock - dose).toFixed(1)) } : i));
    setAuditLog([{ id: Date.now(), animalId: selectedAnimal.id, animal: selectedAnimal.name, action: `Treatment: ${selectedMeds} (${dose}ml)`, date: new Date().toLocaleString() }, ...auditLog]);
    showFeedback(`${dose}ml of ${selectedMeds} administered and deducted from cabinet.`);
  };

  const gestationInfo  = calculateGestation(gestationStart, selectedAnimal?.species);
  const lifecycle      = getLifecycleStats(selectedAnimal);
  const schedule       = getDynamicSchedule(selectedAnimal);
  const currentMed     = DOSAGE_RATES[selectedMeds];
  const breedInfo      = BREED_PROFILES[selectedAnimal?.species]?.find(b => b.breed === selectedAnimal?.breed);
  const overdueCount   = schedule.filter(s => s.status === 'Overdue').length;
  const dueSoonCount   = schedule.filter(s => s.status === 'Due Soon').length;
  const doneCount      = schedule.filter(s => s.status === 'Completed').length;
  const isCapped       = currentMed?.maxDose && parseFloat(calculateDosage(selectedMeds, selectedAnimal?.currentWeight)) >= currentMed.maxDose;

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6 text-left">

      {/* ── PURPOSE BANNER ── */}
      <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #1b5e20 0%, transparent 60%)' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse size={15} className="text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-[3px]">Animal Health Lifecycle Manager</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight mb-1">Vaccinations, Pregnancy & Medication</h2>
            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
              Pick an animal from your herd to see its full health schedule — what vaccines are due, when it was last treated, whether it's pregnant, and the exact medicine dose calculated from its body weight.
            </p>
          </div>
          {/* Alert badges */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-full">
                <AlertTriangle size={13} className="text-red-400 animate-pulse" />
                <span className="text-xs font-black text-red-400 uppercase">{overdueCount} Overdue</span>
              </div>
            )}
            {dueSoonCount > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-400/20 border border-orange-400/30 px-4 py-2 rounded-full">
                <AlertCircle size={13} className="text-orange-400" />
                <span className="text-xs font-black text-orange-400 uppercase">{dueSoonCount} Due Soon</span>
              </div>
            )}
            {overdueCount === 0 && dueSoonCount === 0 && selectedAnimal && (
              <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-full">
                <CheckCircle size={13} className="text-green-400" />
                <span className="text-xs font-black text-green-400 uppercase">All Protocols Current</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ANIMAL SELECTOR ── */}
      <div className={`bg-white border-2 rounded-2xl p-5 transition ${selectedAnimal ? 'border-pfuma-green' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Tag size={14} className="text-pfuma-green" />
          <h3 className="text-sm font-black text-gray-800">Which animal are you managing?</h3>
        </div>
        {animals.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium italic">No animals registered. Go to Herd Registry to add animals first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {animals.map(a => {
              const lc = getLifecycleStats(a);
              const sch = getDynamicSchedule(a);
              const od = sch.filter(s => s.status === 'Overdue').length;
              const ds = sch.filter(s => s.status === 'Due Soon').length;
              return (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAnimalId(String(a.id)); setGestationStart(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition text-left ${
                    String(selectedAnimalId) === String(a.id)
                      ? 'bg-pfuma-green text-white border-pfuma-green shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-pfuma-green/40'
                  }`}
                >
                  <div>
                    <p className="text-xs font-black leading-none">{a.name}</p>
                    <p className={`text-[10px] font-medium leading-none mt-0.5 ${String(selectedAnimalId) === String(a.id) ? 'text-white/70' : 'text-gray-400'}`}>
                      {a.species} · {a.age}
                      {od > 0 && <span className="ml-1 text-red-400 font-black">· {od} overdue</span>}
                      {od === 0 && ds > 0 && <span className="ml-1 text-orange-400 font-black">· {ds} due soon</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FEEDBACK TOAST ── */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${feedbackMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`} role="alert">
          {feedbackMsg.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {feedbackMsg.msg}
        </div>
      )}

      {/* ── NO ANIMAL SELECTED ── */}
      {!selectedAnimal ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center text-center">
            <HeartPulse size={40} className="text-gray-200 mb-3" />
            <p className="text-sm font-black text-gray-400">Select an animal above to view its health schedule</p>
            <p className="text-[11px] text-gray-300 font-medium mt-1">{animals.length} animal{animals.length !== 1 ? 's' : ''} in your herd</p>
          </div>
          <InventoryCabinet inventory={inventory} />
        </div>
      ) : (

        <div className="space-y-6">
          {/* ── ROW 1: Lifecycle + Medication + Cabinet ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LIFECYCLE & BREED */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col shadow-sm">
              {/* tabs */}
              <div className="flex gap-1 bg-gray-50 rounded-xl p-1 mb-5">
                {[
                  { id: 'lifecycle', label: '🗓 Lifecycle',  icon: History },
                  { id: 'breed',     label: '📖 Breed Info', icon: BookOpen },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveInfoTab(t.id)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition ${activeInfoTab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeInfoTab === 'lifecycle' ? (
                <div className="space-y-4 flex-1">
                  <SectionHeader
                    icon={Calendar}
                    title="Age & Weaning Status"
                    description="Weaning is when a young animal is separated from its mother and switched to solid feed."
                  />

                  {lifecycle && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Current Age</p>
                          <p className="text-xl font-black text-gray-900">{lifecycle.ageDisplay}</p>
                        </div>
                        <div className={`rounded-xl p-3 ${lifecycle.isWeaned ? 'bg-green-50' : 'bg-blue-50'}`}>
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Weaning</p>
                          <p className={`text-sm font-black ${lifecycle.isWeaned ? 'text-pfuma-green' : 'text-blue-600'}`}>
                            {lifecycle.isWeaned ? '✓ Complete' : `${lifecycle.daysUntilWeaning}d left`}
                          </p>
                        </div>
                      </div>

                      {!lifecycle.isWeaned && lifecycle.daysUntilWeaning <= 14 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2.5">
                          <Baby size={15} className="text-orange-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-black text-orange-700">⚠ Weaning Due in {lifecycle.daysUntilWeaning} days</p>
                            <p className="text-[11px] text-orange-600 font-medium mt-0.5">Prepare a separate pen and introduce creep feed now so the transition is gradual.</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Pregnancy tracker */}
                  <div className="pt-4 border-t border-gray-50">
                    <SectionHeader
                      icon={Baby}
                      title="Pregnancy Tracker"
                      description="Enter the mating date to calculate the expected birth date and get a countdown."
                    />
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5" htmlFor="gest-date">
                      Mating / Insemination Date
                    </label>
                    <input
                      id="gest-date"
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent font-bold text-sm outline-none focus:border-pfuma-green transition"
                      value={gestationStart}
                      onChange={e => setGestationStart(e.target.value)}
                    />

                    {gestationInfo && (
                      <div className={`mt-3 p-4 rounded-2xl ${gestationInfo.isOverdue ? 'bg-red-50 border border-red-200' : gestationInfo.isUrgent ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                        <p className={`text-[10px] font-black uppercase mb-1 ${gestationInfo.isOverdue ? 'text-red-600' : gestationInfo.isUrgent ? 'text-orange-600' : 'text-pfuma-green'}`}>
                          {gestationInfo.isOverdue ? '⚠ Overdue — Check Animal Now' : gestationInfo.isUrgent ? '🔔 Birth Imminent' : '🐄 Expected Birth Date'}
                        </p>
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-black text-gray-800">{gestationInfo.date}</p>
                          <div className="text-right">
                            <p className={`text-2xl font-black leading-none ${gestationInfo.isOverdue ? 'text-red-600' : gestationInfo.isUrgent ? 'text-orange-600' : 'text-pfuma-green'}`}>
                              {Math.abs(gestationInfo.daysRemaining)}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">{gestationInfo.isOverdue ? 'days over' : 'days left'}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium mt-2">{selectedAnimal.species} gestation period: {gestationInfo.period} days</p>
                      </div>
                    )}
                  </div>

                  {/* Species quick facts */}
                  <div className="pt-4 border-t border-gray-50 space-y-0.5">
                    <InfoRow label="Species"         value={selectedAnimal.species} />
                    <InfoRow label="Weaning Age"     value={`${HEALTH_PROTOCOLS[selectedAnimal.species]?.weaningAge} days`} sub="Days after birth when weaning is due" />
                    <InfoRow label="Gestation Period" value={`${HEALTH_PROTOCOLS[selectedAnimal.species]?.gestation} days`} sub="From mating to birth" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 flex-1">
                  <SectionHeader
                    icon={BookOpen}
                    title="Breed Profile"
                    description="Breed characteristics help you understand feed needs, heat tolerance, and expected growth rate."
                  />
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Registered Breed</p>
                    <p className="text-lg font-black text-gray-900">{selectedAnimal.breed || <span className="text-gray-400 italic text-sm">Not recorded</span>}</p>
                  </div>
                  {breedInfo ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Origin</p>
                          <p className="text-xs font-black text-gray-700">{breedInfo.origin}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Mature Weight</p>
                          <p className="text-xs font-black text-gray-700">{breedInfo.mature_weight_kg} kg</p>
                        </div>
                        {breedInfo.heat_tolerance && (
                          <div className="bg-gray-50 p-3 rounded-xl col-span-2">
                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Heat Tolerance</p>
                            <p className={`text-xs font-black ${breedInfo.heat_tolerance === 'Excellent' ? 'text-pfuma-green' : breedInfo.heat_tolerance === 'Moderate' ? 'text-orange-500' : 'text-red-500'}`}>
                              {breedInfo.heat_tolerance}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex gap-2">
                        <Info size={13} className="text-pfuma-green mt-0.5 shrink-0" />
                        <p className="text-[11px] text-green-800 font-medium leading-relaxed">{breedInfo.notes}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic font-medium">No breed profile found. Update the animal's breed in Herd Registry.</p>
                  )}
                </div>
              )}
            </div>

            {/* MEDICATION CALCULATOR */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <SectionHeader
                icon={FlaskConical}
                title="Medication Calculator"
                description={`Calculates the exact dose for ${selectedAnimal.name} based on its ${selectedAnimal.currentWeight}kg body weight. Press "Administer" to log the treatment and deduct the amount from your stock.`}
                color="text-blue-500"
              />

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5" htmlFor="med-sel">Select Medicine</label>
                  <select
                    id="med-sel"
                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm border-2 border-transparent outline-none focus:border-blue-400 transition appearance-none"
                    value={selectedMeds}
                    onChange={e => { setSelectedMeds(e.target.value); setShowMedDetail(false); }}
                  >
                    {Object.keys(DOSAGE_RATES).map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Dose display */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Required Dose</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-blue-700">{calculateDosage(selectedMeds, selectedAnimal.currentWeight)}</span>
                      <span className="text-sm font-black text-blue-500">ml</span>
                    </div>
                    {isCapped && <p className="text-[9px] text-orange-600 font-black uppercase mt-1">⚠ Capped at max safe dose</p>}
                  </div>
                  <Calculator size={28} className="text-blue-200" />
                </div>

                {/* Med detail collapsible */}
                {currentMed && (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-black text-gray-600 uppercase tracking-wide hover:bg-gray-50 transition"
                      onClick={() => setShowMedDetail(p => !p)}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${catColor(currentMed.category)}`}>{currentMed.category}</span>
                        Medicine Info
                      </span>
                      {showMedDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {showMedDetail && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-50 pt-2">
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed italic">{currentMed.note}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Frequency: {currentMed.frequency}</p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={deductInventory}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-700 active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <CheckCircle size={15} /> Administer & Deduct Stock
                </button>

                <p className="text-[10px] text-gray-400 font-medium text-center">
                  Calculated for {selectedAnimal.name} · {selectedAnimal.currentWeight} kg
                </p>
              </div>
            </div>

            {/* MEDICINE CABINET */}
            <InventoryCabinet inventory={inventory} />
          </div>

          {/* ── ROW 2: Vaccination Schedule ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div>
                <SectionHeader
                  icon={ShieldCheck}
                  title="Vaccination Schedule"
                  description={`Required and recommended vaccines for ${selectedAnimal.name} (${selectedAnimal.species}), calculated from its birth date. Overdue vaccines need immediate attention.`}
                />
              </div>
              {/* Progress summary */}
              {schedule.length > 0 && (
                <div className="flex gap-3 text-[10px] font-black uppercase shrink-0">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pfuma-green" />{doneCount} Done</span>
                  {overdueCount > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />{overdueCount} Overdue</span>}
                  {dueSoonCount > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" />{dueSoonCount} Due Soon</span>}
                </div>
              )}
            </div>

            {schedule.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium italic text-center py-8">No vaccination protocol available for {selectedAnimal.species}.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {schedule.map((task, i) => (
                  <div key={i} className={`flex items-start justify-between p-4 rounded-2xl border-2 transition ${statusStyle(task.status)}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                        <div className={`w-3 h-3 rounded-full ${statusDot(task.status)}`} />
                        {task.mandatory && <span className="text-[7px] font-black text-red-500 uppercase">REQ</span>}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 leading-snug">{task.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{task.dueDate}</p>
                        {task.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">{task.notes}</p>}
                        {task.status !== 'Completed' && (
                          <p className={`text-[10px] font-black mt-1 uppercase ${statusLabel(task.status)}`}>
                            {task.status === 'Overdue' ? `${Math.abs(task.daysUntil)}d overdue — act now` :
                             task.status === 'Due Soon' ? `Due in ${task.daysUntil} days` :
                             `Due in ${task.daysUntil} days`}
                          </p>
                        )}
                      </div>
                    </div>
                    {task.status === 'Completed'
                      ? <CheckCircle size={16} className="text-pfuma-green shrink-0 mt-0.5" />
                      : (
                        <button
                          onClick={() => handleCompleteTask(task.name, task.taskId)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition ml-2 ${
                            task.status === 'Overdue'  ? 'bg-red-600 text-white hover:bg-red-700' :
                            task.status === 'Due Soon' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                            'bg-white text-gray-500 border border-gray-200 hover:border-pfuma-green hover:text-pfuma-green'
                          }`}
                        >
                          Mark Done
                        </button>
                      )
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Medicine Cabinet sub-component ─────────────────────────────────────────
const InventoryCabinet = ({ inventory }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-left">
    <SectionHeader
      icon={Package}
      title="Medicine Cabinet"
      description="Current stock levels. The bar turns red when stock drops below the minimum — reorder before it runs out."
    />
    <div className="space-y-3.5">
      {inventory.map(item => {
        const pct     = Math.min(100, (item.stock / 1000) * 100);
        const isLow   = item.stock <= item.min;
        return (
          <div key={item.id} className={`p-3.5 rounded-xl border transition ${isLow ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
            <div className="flex justify-between items-start mb-1.5">
              <p className="text-xs font-black text-gray-700 leading-tight">{item.name}</p>
              {isLow && (
                <span className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase animate-pulse">
                  <AlertTriangle size={8} /> Low Stock
                </span>
              )}
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <strong className={`text-lg font-black ${isLow ? 'text-red-600' : 'text-pfuma-green'}`}>
                {item.stock.toFixed(0)} <small className="text-[10px] uppercase font-bold">{item.unit}</small>
              </strong>
              <span className="text-[10px] text-gray-400 font-bold">Min: {item.min} {item.unit}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : pct > 50 ? 'bg-pfuma-green' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
            </div>
            {isLow && <p className="text-[10px] text-red-500 font-medium mt-1.5">Reorder from {item.supplier}</p>}
          </div>
        );
      })}
    </div>
  </div>
);

export default HealthManagement;
