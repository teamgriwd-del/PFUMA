import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageCircle, Navigation, Search, HelpCircle, ShieldCheck } from 'lucide-react';
import { diseaseDatabase } from '../DiseaseDetection/diseaseData';
import { HEALTH_PROTOCOLS } from '../HealthManagement/healthData';
import { ZIMBABWE_REGIONS, LOCAL_ADVISORY } from '../VetCommunication/vetData';
import { SPECIES_COMPLIANCE, SIGNUP_REQUIREMENTS } from './complianceData';
import './PfumaIntelAI.css';

const SPECIES_ALIASES = {
  Cattle: ['cattle', 'cow', 'cows', 'bull', 'bulls', 'calf', 'calves'],
  Pig:    ['pig', 'pigs', 'swine', 'hog', 'hogs', 'piglet'],
  Sheep:  ['sheep', 'lamb', 'lambs', 'ewe'],
  Goat:   ['goat', 'goats', 'kid', 'kids'],
};
const detectSpecies = (t) => Object.entries(SPECIES_ALIASES).find(([, words]) => words.some(w => t.includes(w)))?.[0] || null;

const ROLE_ALIASES = {
  Farmer: ['farmer'], Veterinarian: ['vet', 'veterinarian'], Supplier: ['supplier'],
  Retailer: ['retailer'], Police: ['police', 'officer'],
};
const detectRole = (t) => Object.entries(ROLE_ALIASES).find(([, words]) => words.some(w => t.includes(w)))?.[0] || null;

const Jinda = ({ setActiveTab, animals, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `Mwauya nei? I am Jinda, your loyal messenger. I am here to help you manage your own PFUMA herd${currentUser?.role ? ` as a ${currentUser.role}` : ''}, and I know the compliance rules for cattle and goats. Ask me anything in simple terms, or tell me where you want to go. I'll only ever discuss your own animals and account — not other users' data.`,
      type: 'text'
    }
  ]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- KNOWLEDGE BASE TRAINING DATA ---
  const knowledgeBase = {
    greetings: ['hi', 'hello', 'mangwanani', 'maswera', 'mwauya'],
    navigation: {
      dashboard: ['home', 'dashboard', 'overview', 'main', 'start'],
      profiles: ['herd', 'animals', 'profiles', 'list', 'cow', 'goat', 'sheep', 'id', 'tag'],
      health: ['vaccine', 'health', 'lifecycle', 'born', 'pregnant', 'gestation', 'weaning', 'calendar', 'dosage', 'inventory', 'medicine', 'stock'],
      diagnostics: ['sick', 'symptoms', 'illness', 'check', 'diagnose', 'disease', 'medicine', 'radar', 'outbreak'],
      vet: ['vet', 'doctor', 'advisor', 'expert', 'help', 'emergency', 'outbreak', 'agritex'],
      marketplace: ['sell', 'buy', 'market', 'listing', 'price', 'clearance', 'permit', 'trade']
    },
    quickTips: [
      "Follow the 5-5-4 dipping schedule to prevent January Disease.",
      "Cattle weaning should happen around 7 months (210 days).",
      "Isolate any animal with blisters or lameness immediately.",
      "Keep a brand mark on every animal's record — police cannot clear the sale of an unbranded beast."
    ]
  };

  const processNLP = (text) => {
    const lowerText = text.toLowerCase();
    const role = currentUser?.role;

    // 1. Simple Greetings
    if (knowledgeBase.greetings.some(g => lowerText.includes(g))) {
        return { text: "Salutations! How can I serve you and your herd today?", type: 'text' };
    }

    // 2. Data-privacy guard — never discuss another user's animals, contacts, or
    // financial data, regardless of who's asking. Only the current user's own
    // herd/cases, or public marketplace listings, are fair game.
    const asksAboutOthers = /(other|another|someone else'?s|everyone'?s|all (farmers|users|vets|retailers|suppliers)'?)\s*(farmer|user|vet|retailer|supplier|animal|herd|contact|phone|account|data|record)/i.test(lowerText)
      || /\bwhose\b.*(animal|herd|account)/i.test(lowerText);
    if (asksAboutOthers) {
      return {
        text: "I can only discuss your own herd, cases, and account — not another user's private data. That keeps everyone's information protected on PFUMA. If you're trying to reach another farmer, vet, or trader, use the Messenger or a public Marketplace listing instead.",
        type: 'info'
      };
    }

    // 3. Police-only intents — clearance/verification queues are only meaningful
    // (and only visible) to the Police role; redirect everyone else.
    const asksAboutQueues = /(clearance queue|verification queue|pending (clearance|verification)|approve (a )?signup|review (an )?applicant)/i.test(lowerText);
    if (asksAboutQueues) {
      if (role === 'Police') {
        setActiveTab('dashboard');
        return { text: "Taking you to your Police Dashboard — the Signup Verification and Sale Clearance queues are both there.", type: 'nav' };
      }
      return {
        text: role === 'Farmer' || role === 'Supplier'
          ? "Clearance review is done by Police, not visible here — but you can check your own listing's status on the Marketplace tab; it'll show as pending until a police clearance is granted."
          : "The clearance and signup-verification queues are only visible to the Police role, to keep that review process trustworthy.",
        type: 'info'
      };
    }

    // 4. Compliance / legal-requirements knowledge (per species), sourced from
    // /compliance research — what you need to legally keep & sell each species.
    const asksCompliance = /(requirement|legal|law|compliance|regulation|allowed to keep|need to keep|papers|permit|licen[cs]e|movement permit)/i.test(lowerText);
    if (asksCompliance) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return {
          text: `To legally keep and sell ${species.toLowerCase()} in Zimbabwe:\n${c.legalRequirements.map(r => `• ${r}`).join('\n')}\n\nThis is a summary, not legal advice — see the compliance folder for full sources.`,
          type: 'info'
        };
      }
      return {
        text: "I have compliance summaries for Cattle, Pigs, Sheep, and Goats — tell me which species and I'll list what's legally required to keep and sell them in Zimbabwe (brand/ID registration, movement permits, disease reporting, and police clearance before a sale).",
        type: 'help'
      };
    }

    // 5. Signup / verification-document requirements, per role.
    const asksSignup = /(sign ?up|register(ing)?|verification document|what document|which document|id document)/i.test(lowerText);
    if (asksSignup) {
      const targetRole = detectRole(lowerText) || role;
      if (targetRole && SIGNUP_REQUIREMENTS[targetRole]) {
        return {
          text: `To sign up as a ${targetRole} on PFUMA, you'll need:\n${SIGNUP_REQUIREMENTS[targetRole].map(r => `• ${r}`).join('\n')}`,
          type: 'info'
        };
      }
      return { text: "Every role needs a National ID plus role-specific documents (land proof for Farmers, a CVSZ number for Vets, business registration for Suppliers/Retailers). Police accounts aren't self-service — tell me which role you mean and I'll give the full list.", type: 'help' };
    }

    // 6. Disease/diagnosis lookup by species — points to the Diagnostics tab
    // and lists what to watch for, drawn from the expanded disease database.
    const asksDisease = /(disease|sick|illness|symptom|diagnos)/i.test(lowerText);
    if (asksDisease) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return {
          text: `Key diseases to watch for in ${species.toLowerCase()}: ${c.diseases.join(', ')}.\n\n${c.diagnosisBasics}\n\nUse the Diagnostics tab to run a full symptom check.`,
          type: 'info'
        };
      }
    }

    // 7. Trained Navigation Intents
    for (const [tab, keywords] of Object.entries(knowledgeBase.navigation)) {
      if (keywords.some(k => lowerText.includes(k))) {
        const targetTab = tab === 'diagnostics' ? 'disease' : (tab === 'profiles' ? 'profile' : tab);
        setActiveTab(targetTab);
        return { text: `Understood. I am taking you to the ${tab.charAt(0).toUpperCase() + tab.slice(1)} section now.`, type: 'nav' };
      }
    }

    // 8. Deep Knowledge: Cattle Health & Regional Logic
    if (lowerText.includes('january') || lowerText.includes('tick') || lowerText.includes('theiler')) {
      return { 
        text: "January Disease (Theileriosis) is a major threat in Zimbabwe. You must follow the 5-5-4 dipping cycle and apply tick grease in the ears and under the tail. Check your Diagnostics tab for a full action plan.",
        type: 'info' 
      };
    }

    // 9. Valuation & Economic Logic
    if (lowerText.includes('worth') || lowerText.includes('value') || lowerText.includes('price') || lowerText.includes('money')) {
        const totalValue = animals.reduce((acc, a) => {
            const base = a.species === 'Cattle' ? 500 : 100;
            return acc + base + (a.currentWeight * 1.5);
        }, 0);
        return { text: `Your royal herd is currently valued at approximately USD $${totalValue.toLocaleString()}. This is based on current weight and genetic potential.`, type: 'info' };
    }

    // 10. Theft & Security Logic
    if (lowerText.includes('thief') || lowerText.includes('stole') || lowerText.includes('where') || lowerText.includes('security') || lowerText.includes('mbavha')) {
        return {
          text: "Report it to the police straight away, then flag the animal here so its record shows as disputed. Because every listing needs police clearance before buyers can see it, a stolen beast on your record is very hard for anyone else to sell on.",
          type: 'info'
        };
    }

    if (lowerText.includes('how many') || lowerText.includes('total') || lowerText.includes('size')) {
        return { text: `Your PFUMA enterprise currently manages ${animals.length} animals.`, type: 'info' };
    }

    if (
        lowerText.includes('help') || 
        lowerText.includes('what can you do') || 
        lowerText.includes('what do you do') || 
        lowerText.includes('unoitei')
    ) {
        return { 
          text: "I am Jinda. I can help you: \n1. Run Visual Diagnostics (Upload photos)\n2. Check Herd Valuation & Statistics\n3. Manage Medicine Stock Levels\n4. Monitor Security 24/7\n5. Navigate all PFUMA modules.\n\nNdinogona kukubatsira kuchengetedza mhuka dzako.", 
          type: 'help' 
        };
    }

    const randomTip = knowledgeBase.quickTips[Math.floor(Math.random() * knowledgeBase.quickTips.length)];
    return { text: `I'm not exactly sure, but remember: ${randomTip}`, type: 'help' };
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), sender: 'user', text: input, type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTimeout(() => {
      const response = processNLP(input);
      const aiMsg = { id: Date.now() + 1, sender: 'ai', ...response };
      setMessages(prev => [...prev, aiMsg]);
    }, 600);
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className={`pfuma-ai-toggle shadow-2xl transition-all duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`} style={{ background: '#1b5e20', border: '4px solid #fbc02d' }}>
        <MessageCircle size={28} />
        <span className="ping-online"></span>
      </button>

      <div className={`pfuma-ai-panel shadow-2xl transition-all duration-500 ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'}`}>
        <div className="ai-header" style={{ background: 'linear-gradient(to bottom, #1b5e20, #2e7d32)' }}>
          <div className="flex items-center space-x-3 text-left">
            <div className="ai-avatar bg-yellow-400 text-pfuma-green p-2 rounded-xl shadow-lg"><ShieldCheck size={24} /></div>
            <div>
              <h3 className="font-black text-white leading-none text-lg">Jinda</h3>
              <span className="text-[9px] text-yellow-400 font-black uppercase tracking-[2px]">Farm Assistant</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition"><X size={20} /></button>
        </div>
        <div className="ai-messages scrollbar-hide">
          {messages.map(m => (
            <div key={m.id} className={`ai-msg-wrapper ${m.sender}`}>
              <div className={`ai-bubble ${m.type}`}><p>{m.text}</p></div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="ai-input-area">
          <input type="text" placeholder="Ask Jinda anything..." value={input} onChange={(e) => setInput(e.target.value)} className="focus:outline-none font-bold text-sm" />
          <button type="submit" className="bg-pfuma-green text-white p-2.5 rounded-xl hover:bg-green-700 transition shadow-lg"><Send size={18} /></button>
        </form>
      </div>
    </>
  );
};

export default Jinda;
