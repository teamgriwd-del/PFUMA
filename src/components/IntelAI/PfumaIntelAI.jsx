import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageCircle, Navigation, Search, HelpCircle, ShieldCheck } from 'lucide-react';
import { diseaseDatabase } from '../DiseaseDetection/diseaseData';
import { HEALTH_PROTOCOLS } from '../HealthManagement/healthData';
import { ZIMBABWE_REGIONS, LOCAL_ADVISORY } from '../VetCommunication/vetData';
import { SPECIES_COMPLIANCE, SIGNUP_REQUIREMENTS } from './complianceData';
import { API } from '../../config';
import './PfumaIntelAI.css';

const SPECIES_ALIASES = {
  Cattle: ['cattle', 'cow', 'cows', 'bull', 'bulls', 'calf', 'calves'],
  Pig:    ['pig', 'pigs', 'swine', 'hog', 'hogs', 'piglet'],
  Sheep:  ['sheep', 'lamb', 'lambs', 'ewe'],
  Goat:   ['goat', 'goats', 'kid', 'kids'],
};

// Offline/first-paint fallback only — the live rate comes from the
// backend's market_rates table (see getMarketRates below), refreshed from
// AMA Zimbabwe's real weekly market bulletin, and is the same source the
// app's own Estimated Market Value figures and valuation certificates use,
// so Jinda's answer always matches what the app itself shows.
const LIVESTOCK_PRICE_PER_KG_USD = { Cattle: 1.79, Goat: 1.02, Sheep: 1.25, Pig: 1.66 };

let _marketRatesCache = null;
let _marketRatesFetching = false;
function getMarketRates() {
  if (!_marketRatesCache && !_marketRatesFetching) {
    _marketRatesFetching = true;
    fetch(`${API}/market-rates`)
      .then(r => r.json())
      .then(data => { if (data?.rates) _marketRatesCache = data.rates; })
      .catch(() => { /* offline — falls back to LIVESTOCK_PRICE_PER_KG_USD */ })
      .finally(() => { _marketRatesFetching = false; });
  }
  return _marketRatesCache || LIVESTOCK_PRICE_PER_KG_USD;
}
// Plain .includes() matches substrings anywhere — 'hi' inside 'think', 'ship',
// 'chicken' — so keyword checks that should mean "this whole word" need a
// word-boundary match instead.
const hasWord = (text, word) => new RegExp(`\\b${word}\\b`, 'i').test(text);
const detectSpecies = (t) => Object.entries(SPECIES_ALIASES).find(([, words]) => words.some(w => hasWord(t, w)))?.[0] || null;

const ROLE_ALIASES = {
  Farmer: ['farmer'], Veterinarian: ['vet', 'veterinarian'], Supplier: ['supplier'],
  Buyer: ['buyer'], Police: ['police', 'officer'],
};
const detectRole = (t) => Object.entries(ROLE_ALIASES).find(([, words]) => words.some(w => hasWord(t, w)))?.[0] || null;

// A farmer typing in Shona was getting an English answer back — the Shona
// words in knowledgeBase.greetings were only ever used to *recognise* a
// greeting, never to pick a Shona reply. This is a lightweight signal (common
// Shona words a farmer would actually type asking about their herd), not a
// real language detector — good enough to pick which canned reply to use.
const SHONA_MARKERS = [
  'mangwanani', 'maswera', 'mwauya', 'manheru', 'masikati',
  'makadii', 'makadini', 'wakadii', 'ndeipi', 'unofara', 'hesi', 'zvirisei',
  'ndinoda', 'ndinotenda', 'tatenda', 'tinotenda', 'ndapota', 'tapota',
  'chii', 'sei', 'papi', 'kupi', 'ndeapi', 'zvakadii', 'unoitei',
  'mari', 'mutengo', 'mombe', 'mhuka', 'mhuru', 'mbudzi', 'gwai', 'makwai',
  'nguruve', 'utano', 'chirwere', 'mushonga', 'mishonga',
  'akabiwa', 'yakabiwa', 'mbavha', 'hongu', 'kwete', 'zvakanaka', 'kubatsira',
];
const isShona = (t) => SHONA_MARKERS.some(w => hasWord(t, w));

// Same lightweight approach as SHONA_MARKERS above, for isiNdebele — common
// words a Ndebele-speaking farmer would actually type, not a real language
// detector, just enough to pick the right canned reply.
const NDEBELE_MARKERS = [
  'sawubona', 'salibonani', 'linjani', 'unjani', 'kunjani',
  'ngiyabonga', 'siyabonga', 'ngicela', 'siyacela', 'yebo', 'hatshi', 'qha',
  'kuyini', 'kungani', 'kanjani', 'ngaphi', 'nini',
  'imali', 'intengo', 'inkomo', 'izinkomo', 'imbuzi', 'izimbuzi', 'izimvu',
  'ingulube', 'izingulube', 'impilo', 'umkhuhlane', 'amayeza', 'umuthi',
  'ebiwe', 'kwebiwe', 'isela', 'ngiyaxolisa', 'kulungile', 'akulunganga',
];
const isNdebele = (t) => NDEBELE_MARKERS.some(w => hasWord(t, w));

const Jinda = ({ setActiveTab, animals, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `Mwauya nei? I am Jinda, your loyal messenger. I am here to help you manage your own PFUMA/INGCEBO herd${currentUser?.role ? ` as a ${currentUser.role}` : ''}, and I know the compliance rules for cattle and goats. Ask me anything in simple terms, or tell me where you want to go. I'll only ever discuss your own animals and account — not other users' data.`,
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
    greetings: [
      'hi', 'hello', 'hey',
      'mangwanani', 'maswera', 'mwauya', 'manheru', 'masikati',
      'makadii', 'makadini', 'wakadii', 'ndeipi', 'unofara', 'hesi', 'zvirisei',
      'sawubona', 'salibonani', 'linjani', 'unjani', 'kunjani',
    ],
    navigation: {
      dashboard: ['home', 'dashboard', 'overview', 'main', 'start'],
      profiles: ['herd', 'animals', 'profiles', 'list', 'cow', 'goat', 'sheep', 'id', 'tag'],
      health: ['vaccine', 'health', 'lifecycle', 'born', 'pregnant', 'gestation', 'weaning', 'calendar', 'dosage', 'inventory', 'medicine', 'stock'],
      diagnostics: ['sick', 'symptoms', 'illness', 'check', 'diagnose', 'disease', 'medicine', 'radar', 'outbreak'],
      vet: ['vet', 'doctor', 'advisor', 'expert', 'help', 'emergency', 'outbreak', 'agritex'],
      marketplace: ['sell', 'buy', 'market', 'listing', 'price', 'clearance', 'permit', 'trade'],
    },
    quickTips: [
      "Follow the 5-5-4 dipping schedule to prevent January Disease.",
      "Cattle weaning should happen around 7 months (210 days).",
      "Isolate any animal with blisters or lameness immediately.",
      "Keep a brand mark on every animal's record — police cannot clear the sale of an unbranded beast."
    ],
    quickTipsShona: [
      "Teverai gwara re-5-5-4 rekunyika kuti mudzivirire Chirwere cheJanuary (January Disease).",
      "Kurumurwa kwemombe kunofanira kuitika panenge mwedzi minomwe (mazuva 210).",
      "Paradzanisai mhuka ipi neipi ine mabhindauko kana kukamhina nekukurumidza.",
      "Chengetai chiratidzo (brand) parekodhi yemhuka imwe neimwe — mapurisa haabvumire kutengeswa kwemhuka isina chiratidzo."
    ],
    quickTipsNdebele: [
      "Landela uhlelo lokugezisa i-5-5-4 ukuvikela uMkhuhlane weJanuary (January Disease).",
      "Ukulumula amankonyana kumele kwenzeke emva kwezinyanga eziyisi-7 (insuku ezingu-210).",
      "Hlukanisa masinyane loba yisiphi isifuyo esilamathumba kumbe esiqhulayo.",
      "Gcina uphawu (brand) kurekhodi yesifuyo ngasinye — amaphoyisa awakwazi ukuvumela ukuthengiswa kwesifuyo esingelaphawu."
    ]
  };

  const processNLP = (text) => {
    const lowerText = text.toLowerCase();
    const role = currentUser?.role;
    // Only covers the general-purpose replies below (greeting, what-is-PFUMA/INGCEBO,
    // help, valuation, herd count, theft/security, privacy guard) — legal
    // compliance requirements and disease/vaccine names stay English-only,
    // since a machine-translated mistake there could actually mislead a
    // farmer about what the law or a vet protocol requires. Shona takes
    // priority if a message somehow matches both marker lists.
    const sn = isShona(lowerText);
    const nd = !sn && isNdebele(lowerText);

    // 1. Simple Greetings — word-boundary match; plain .includes('hi') was
    // matching 'think', 'this', 'chicken' etc. and swallowing real questions.
    // Covers both "hi"-style greetings and "how are you" style ones
    // (makadii, wakadii, unofara here) — the reply acknowledges either.
    if (knowledgeBase.greetings.some(g => hasWord(lowerText, g))) {
        return {
          text: sn ? "Ndiripo, ndatenda kubvunza! Ndingakubatsirai sei nemhuka dzenyu nhasi?" : nd ? "Ngikhona, ngiyabonga ngokubuza! Ngingakusiza njani ngezifuyo zakho lamuhla?" : "Salutations! How can I serve you and your herd today?",
          type: 'text'
        };
    }

    // 2. "What is PFUMA/INGCEBO" — onboarding question, most useful to a farmer who
    // just landed here and wants to know what the system actually does
    // before trusting it with their herd.
    const asksWhatIsPfuma = /(what is pfuma|about pfuma|what does pfuma do|explain pfuma|purpose of pfuma|pfuma mean|what('?s| is) this (app|system|platform)|what does this (app|system|platform) do|pfuma chii|pfuma inoreveiko|pfuma i chii)/i.test(lowerText);
    if (asksWhatIsPfuma) {
      return {
        text: sn
          ? "PFUMA/INGCEBO i Chirongwa Chehungwaru cheZvipfuwo muZimbabwe — rekodhi yedhijitari yechimiro nehutano hwemhuka imwe neimwe, yakavakirwa kubatanidza vose vanobatanidzwa nekutengeserana kwezvipfuwo panzvimbo imwe inovimbika:\n"
            + "• Vapfuwi vanonyoresa mhuka dzavo, vachitevedzera hutano nemajekiso, uye vachiisa mhuka pakutengeswa\n"
            + "• VaVet vanosimbisa hutano hwemhuka uye vanotonga zvirwere zvinopararira\n"
            + "• Vatengesi (Suppliers) vanotengesa majekiso, mishonga nezvokudya kuvapfuwi vakanyoreswa\n"
            + "• Vatengi vemakitini (Buyers) vanoongorora mhuka dzakasimbiswa uye vanotenga vaine chivimbo\n"
            + "• Mapurisa anosimbisa uumwe hwemhuka uye anobvumira kutengeswa kwega kwega kusati kwaitika\n\n"
            + "Mhuka imwe neimwe inowana pasipoti yedhijitari — nhamba yenzeve, mhando, nhoroondo yemajekiso — kuitira kuti kutengesa kuvimbike kubva kupurazi kusvika kumusika. Ndibvunzei nezvemhuka dzenyu, mitemo, kana kuti chinhu chiri papi mune application."
          : nd
          ? "PFUMA/INGCEBO yiHlelo Lolwazi Lwezifuyo laseZimbabwe — irekhodi yedijithali yesimo lempilo yesifuyo ngasinye, eyakhelwe ukuhlanganisa bonke abathintekayo ekuthengiselaneni kwezifuyo endaweni eyodwa ethenjiwe:\n"
            + "• Abalimi babhalisa izifuyo zabo, balandelele impilo lemigomo, njalo bafake izifuyo ekuthengisweni\n"
            + "• Odokotela bezilwane bagunyaza impilo yezifuyo njalo balawula izifo ezithathelanayo\n"
            + "• Abathengisi bathengisa imigomo, amayeza lokudla kubalimi ababhalisiweyo\n"
            + "• Abathengi bahlola izifuyo eziqinisekisiweyo njalo bathenge ngokuthemba\n"
            + "• Amaphoyisa aqinisekisa ubunikazi njalo avumela ukuthengiswa kwesifuyo ngasinye kungakenzakali\n\n"
            + "Isifuyo ngasinye sithola iphasiphothi yedijithali — inombolo yendlebe, uhlobo, umlando wemigomo — ukuze ukuthengiselana kuthenjwe kusukela epulazini kuze kuyefika emakethe. Ngibuze ngezifuyo zakho, imithetho, kumbe lapho ofuna khona kuhlelo."
          : "PFUMA/INGCEBO is Zimbabwe's Livestock Intelligence Platform — a digital identity and health record for every animal, built to connect the whole trade chain in one trusted place:\n"
            + "• Farmers register their herd, track health & vaccines, and list animals for sale\n"
            + "• Veterinarians certify animal health and manage disease outbreaks\n"
            + "• Suppliers sell vaccines, medicine and feed to registered farms\n"
            + "• Buyers browse certified listings and buy with confidence\n"
            + "• Police verify ownership and clear every sale before it can go through\n\n"
            + "Every animal gets a digital passport — ear tag, breed, vaccination history — so a sale can be trusted from farm to market. Ask me about your own herd, compliance rules, or where to find something in the app.",
        type: 'info'
      };
    }

    // 3. Data-privacy guard — never discuss another user's animals, contacts, or
    // financial data, regardless of who's asking. Only the current user's own
    // herd/cases, or public marketplace listings, are fair game.
    const asksAboutOthers = /(other|another|someone else'?s|everyone'?s|all (farmers|users|vets|buyers|suppliers)'?)\s*(farmer|user|vet|buyer|supplier|animal|herd|contact|phone|account|data|record)/i.test(lowerText)
      || /\bwhose\b.*(animal|herd|account)/i.test(lowerText);
    if (asksAboutOthers) {
      return {
        text: sn
          ? "Ndinogona kutaura nezvemhuka dzenyu, nyaya dzenyu, uye account yenyu chete — kwete ruzivo rwemumwe munhu. Izvi zvinochengetedza ruzivo rwemunhu wese pamusoro pePFUMA. Kana muchida kusvika kune mumwe mupfuwi, va-vet, kana mutengesi, shandisai Messenger kana zvakaiswa paMarketplace."
          : nd
          ? "Ngingakhuluma kuphela ngezifuyo zakho, izindaba zakho, le-akhawunti yakho — hatshi ulwazi lomunye umuntu. Lokhu kuvikela ulwazi lwomuntu wonke ku-PFUMA/INGCEBO. Nxa ufuna ukufinyelela komunye umlimi, udokotela wezilwane, kumbe umthengisi, sebenzisa i-Messenger kumbe okufakwe kuMarketplace."
          : "I can only discuss your own herd, cases, and account — not another user's private data. That keeps everyone's information protected on PFUMA/INGCEBO. If you're trying to reach another farmer, vet, or trader, use the Messenger or a public Marketplace listing instead.",
        type: 'info'
      };
    }

    // 4. Police-only intents — clearance/verification queues are only meaningful
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

    // 5. Compliance / legal-requirements knowledge (per species), sourced from
    // /compliance research — what you need to legally keep & sell each species.
    const asksCompliance = /(requirement|rule|legal|law|compliance|regulation|allowed to keep|need to keep|papers|permit|licen[cs]e|movement permit)/i.test(lowerText);
    if (asksCompliance) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return {
          // Legal requirements stay in English on purpose, even for a Shona
          // question — a machine-translated slip on a legal requirement
          // could actually mislead a farmer. The note says so instead of
          // silently ignoring the Shona.
          text: (sn ? "(Ndinokupai izvi muChirungu nekuti ndiwo mazwi chaiwo emitemo — kuti ndisakanganise. Kumbirai muVet kana Admin kukushandurirai kana muchida.)\n\n" : nd ? "(Ngikunika lokhu ngesiNgisi ngoba yiwo amazwi aqondileyo omthetho — ukuze ngingaphosisi. Cela uDokotela wezilwane kumbe uMphathi ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
            + `To legally keep and sell ${species.toLowerCase()} in Zimbabwe:\n${c.legalRequirements.map(r => `• ${r}`).join('\n')}\n\nThis is a summary, not legal advice — see the compliance folder for full sources.`,
          type: 'info'
        };
      }
      return {
        text: "I have compliance summaries for Cattle, Pigs, Sheep, and Goats — tell me which species and I'll list what's legally required to keep and sell them in Zimbabwe (brand/ID registration, movement permits, disease reporting, and police clearance before a sale).",
        type: 'help'
      };
    }

    // 6. Signup / verification-document requirements, per role.
    const asksSignup = /(sign ?up|register(ing)?|verification document|what document|which document|id document)/i.test(lowerText);
    if (asksSignup) {
      const targetRole = detectRole(lowerText) || role;
      if (targetRole && SIGNUP_REQUIREMENTS[targetRole]) {
        return {
          text: (sn ? "(Ndinokupai izvi muChirungu kuti ndisakanganise pamazita emapepa anodiwa. Kumbirai muVet kana Admin kukushandurirai kana muchida.)\n\n" : nd ? "(Ngikunika lokhu ngesiNgisi ukuze ngingaphosisi emabizweni amaphepha adingakalayo. Cela uDokotela wezilwane kumbe uMphathi ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
            + `To sign up as a ${targetRole} on PFUMA/INGCEBO, you'll need:\n${SIGNUP_REQUIREMENTS[targetRole].map(r => `• ${r}`).join('\n')}`,
          type: 'info'
        };
      }
      return { text: "Every role needs a National ID plus role-specific documents (land proof for Farmers, a CVSZ number for Vets, business registration for Suppliers/Buyers). Police accounts aren't self-service — tell me which role you mean and I'll give the full list.", type: 'help' };
    }

    // 7. Disease/diagnosis lookup by species — points to the Diagnostics tab
    // and lists what to watch for, drawn from the expanded disease database.
    const asksDisease = /(disease|sick|illness|symptom|diagnos)/i.test(lowerText);
    if (asksDisease) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return {
          // Same reasoning as the compliance branch above: disease/vaccine
          // names stay in English rather than risk a mistranslated term.
          text: (sn ? "(Mazita echirwere ari muChirungu kuti ndisakanganise pane zita chairo. Kumbirai muVet kukushandurirai kana muchida.)\n\n" : nd ? "(Amabizo ezifo asesiNgisini ukuze ngingaphosisi ebizweni eliqondileyo. Cela uDokotela wezilwane ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
            + `Key diseases to watch for in ${species.toLowerCase()}: ${c.diseases.join(', ')}.\n\n${c.diagnosisBasics}\n\nUse the Diagnostics tab to run a full symptom check.`,
          type: 'info'
        };
      }
    }

    // 8. Deep Knowledge: Cattle Health & Regional Logic
    if (lowerText.includes('january') || lowerText.includes('tick') || lowerText.includes('theiler')) {
      return {
        text: "January Disease (Theileriosis) is a major threat in Zimbabwe. You must follow the 5-5-4 dipping cycle and apply tick grease in the ears and under the tail. Check your Diagnostics tab for a full action plan.",
        type: 'info'
      };
    }

    // 9. Valuation, theft/security, and herd-count — checked BEFORE generic
    // navigation (step 11 below) on purpose. These are more specific
    // questions, but their natural phrasing ("how much is my HERD worth",
    // "someone stole my COW") overlaps with navigation keywords like 'herd'
    // and 'cow' — if navigation ran first it would just jump to Herd
    // Registry instead of actually answering. Checking the specific intents
    // first and falling back to navigation only when none of them match
    // fixes that.
    if (lowerText.includes('worth') || lowerText.includes('value') || lowerText.includes('price') || lowerText.includes('money') || lowerText.includes('mari') || lowerText.includes('mutengo')) {
        const rates = getMarketRates();
        const totalValue = animals.reduce((acc, a) => {
            const pricePerKg = rates[a.species] ?? rates.Cattle ?? LIVESTOCK_PRICE_PER_KG_USD.Cattle;
            return acc + a.currentWeight * pricePerKg;
        }, 0);
        return {
          text: sn
            ? `Mhuka dzenyu dzinoverengwa kuva nemutengo weUSD $${totalValue.toLocaleString()} pari zvino. Izvi zvinoenderana nehuremu hwadzo pari zvino.`
            : nd
            ? `Izifuyo zakho zibalwa ukuthi ziyimali engu-USD $${totalValue.toLocaleString()} khathesi. Lokhu kususelwa ebunzimeni bazo bakhathesi.`
            : `Your royal herd is currently valued at approximately USD $${totalValue.toLocaleString()}. This is based on current weight and genetic potential.`,
          type: 'info'
        };
    }

    // 'where' alone was dropped — it's too generic ("where do I check
    // vaccines") and false-triggered this as a theft answer instead of
    // navigating. 'missing'/'lost' capture the same intent more safely.
    if (lowerText.includes('thief') || lowerText.includes('stole') || lowerText.includes('missing') || lowerText.includes('lost') || lowerText.includes('security') || lowerText.includes('mbavha') || lowerText.includes('akabiwa') || lowerText.includes('yakabiwa') || lowerText.includes('isela') || lowerText.includes('ebiwe')) {
        return {
          text: sn
            ? "Mhan'arirei kumapurisa uye musimise mhuka iyi pano kuti rekodhi yayo iratidze kuti pane mhosva. Nekuti mutengo wega wega unoda kutenderwa nemapurisa, mhuka yakabiwa yakaoma kuti itengeswe nemumwe munhu."
            : nd
            ? "Bika emaphoyiseni njalo ufake uphawu kulesisifuyo lapha ukuze irekhodi yaso itshengise ukuthi kulengxabano. Ngoba isithengiso ngasinye sidinga imvumo yamaphoyisa, isifuyo esebiweyo kunzima ukuthi omunye umuntu asithengise."
            : "Report it to the police and flag the animal here so its record shows as disputed. Because every listing needs police clearance before buyers can see it, a stolen beast on your record is very hard for anyone else to sell on.",
          type: 'info'
        };
    }

    if (lowerText.includes('how many') || lowerText.includes('total') || lowerText.includes('size') || lowerText.includes('mangani')) {
        return {
          text: sn
            ? `Bhizinesi renyu rePFUMA rinotarisira mhuka ${animals.length} pari zvino.`
            : nd
            ? `Ibhizimusi lakho le-PFUMA/INGCEBO likhangela izifuyo ezingu-${animals.length} khathesi.`
            : `Your PFUMA/INGCEBO enterprise currently manages ${animals.length} animals.`,
          type: 'info'
        };
    }

    // 10. Trained Navigation Intents — the fallback for "take me to X", now
    // that the more specific intents above have first refusal.
    for (const [tab, keywords] of Object.entries(knowledgeBase.navigation)) {
      if (keywords.some(k => lowerText.includes(k))) {
        const targetTab = tab === 'diagnostics' ? 'disease' : (tab === 'profiles' ? 'profile' : tab);
        setActiveTab(targetTab);
        return { text: `Understood. I am taking you to the ${tab.charAt(0).toUpperCase() + tab.slice(1)} section now.`, type: 'nav' };
      }
    }

    // 11. Capability / meta help
    if (
        lowerText.includes('help') ||
        lowerText.includes('what can you do') ||
        lowerText.includes('what do you do') ||
        lowerText.includes('unoitei') ||
        lowerText.includes('wenzani')
    ) {
        return {
          text: sn
            ? "Ndini Jinda. Ndinogona kukubatsirai ne:\n1. Kuongorora mifananidzo yemhuka (Visual Diagnostics)\n2. Kuongorora mutengo nemamiriro emhuka dzenyu\n3. Kutarisa mishonga yamunayo\n4. Kutarisa nharaunda 24/7 kuti mhuka dziri pachivimbo\n5. Kukutungamirirai kunzvimbo dzese dzePFUMA\n6. Kukutsanangurirai kuti PFUMA/INGCEBO chii uye kuti inobatanidza vanaani — bvunzai chete kuti \"PFUMA/INGCEBO chii?\"\n\nNdinogona kukubatsirai kuchengetedza mhuka dzenyu."
            : nd
            ? "NginguJinda. Ngingakusiza nge:\n1. Ukuhlola izithombe zezifuyo (Visual Diagnostics)\n2. Ukuhlola inani lezifuyo zakho\n3. Ukuqapha amayeza akho\n4. Ukuqapha ukuphepha kwezifuyo insuku zonke, amahola angu-24\n5. Ukukuqondisa kuzo zonke izigaba ze-PFUMA/INGCEBO\n6. Ukuchasisa ukuthi i-PFUMA/INGCEBO iyini lokuthi ihlanganisa obani — buza nje ukuthi \"PFUMA/INGCEBO iyini?\"\n\nNgingakusiza ukugcina izifuyo zakho ziphephile."
            : "I am Jinda. I can help you: \n1. Run Visual Diagnostics (Upload photos)\n2. Check Herd Valuation & Statistics\n3. Manage Medicine Stock Levels\n4. Monitor Security 24/7\n5. Navigate all PFUMA/INGCEBO modules.\n6. Explain what PFUMA/INGCEBO is and who it connects — just ask \"what is PFUMA/INGCEBO?\"\n\nNdinogona kukubatsira kuchengetedza mhuka dzako.",
          type: 'help'
        };
    }

    const tipList = sn ? knowledgeBase.quickTipsShona : nd ? knowledgeBase.quickTipsNdebele : knowledgeBase.quickTips;
    const randomTip = tipList[Math.floor(Math.random() * tipList.length)];
    return {
      text: sn
        ? `Handina chokwadi zvachose, asi rangarirai kuti: ${randomTip}`
        : nd
        ? `Kangiqiniseki impela, kodwa khumbula ukuthi: ${randomTip}`
        : `I'm not exactly sure, but remember: ${randomTip}`,
      type: 'help'
    };
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
      <button onClick={() => setIsOpen(!isOpen)} aria-label="Open Jinda, the PFUMA/INGCEBO farm assistant" aria-expanded={isOpen} className={`pfuma-ai-toggle shadow-2xl transition-all duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`} style={{ background: '#7A3F0B', border: '3px solid #C99A4A' }}>
        <MessageCircle size={28} />
        <span className="ping-online"></span>
      </button>

      <div className={`pfuma-ai-panel shadow-2xl transition-all duration-500 ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'}`}>
        <div className="ai-header" style={{ background: '#542706' }}>
          <div className="flex items-center space-x-3 text-left">
            <div className="ai-avatar bg-amber-400 text-bark-700 p-2 rounded-xl"><ShieldCheck size={22} /></div>
            <div>
              <h3 className="font-bold text-white leading-none text-lg">Jinda</h3>
              <span className="text-[0.625rem] text-amber-300 font-bold uppercase tracking-[0.14em]">Farm Assistant</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} aria-label="Close Jinda" className="w-9 h-9 -mr-2 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"><X size={20} aria-hidden="true" /></button>
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
          <button type="submit" aria-label="Send" className="bg-bark-500 text-white p-2.5 rounded-xl hover:bg-bark-700 transition"><Send size={18} /></button>
        </form>
      </div>
    </>
  );
};

export default Jinda;
