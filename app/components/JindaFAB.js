import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, X, Send } from 'lucide-react-native';
import { COLORS, FONTS, API } from '../config';
import { authFetch } from '../api';
import { SPECIES_COMPLIANCE, SIGNUP_REQUIREMENTS } from '../data/complianceData';

const { width } = Dimensions.get('window');

// --- Species/role detection, ported from the web Jinda (PfumaIntelAI.jsx) ---
const SPECIES_ALIASES = {
  Cattle: ['cattle', 'cow', 'cows', 'bull', 'bulls', 'calf', 'calves'],
  Pig:    ['pig', 'pigs', 'swine', 'hog', 'hogs', 'piglet'],
  Sheep:  ['sheep', 'lamb', 'lambs', 'ewe'],
  Goat:   ['goat', 'goats', 'kid', 'kids'],
};
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

// Lightweight language signals (common words a farmer would actually type),
// not a real language detector — good enough to pick which canned reply to
// use. Shona takes priority if a message somehow matches both marker lists.
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

const NDEBELE_MARKERS = [
  'sawubona', 'salibonani', 'linjani', 'unjani', 'kunjani',
  'ngiyabonga', 'siyabonga', 'ngicela', 'siyacela', 'yebo', 'hatshi', 'qha',
  'kuyini', 'kungani', 'kanjani', 'ngaphi', 'nini',
  'imali', 'intengo', 'inkomo', 'izinkomo', 'imbuzi', 'izimbuzi', 'izimvu',
  'ingulube', 'izingulube', 'impilo', 'umkhuhlane', 'amayeza', 'umuthi',
  'ebiwe', 'kwebiwe', 'isela', 'ngiyaxolisa', 'kulungile', 'akulunganga',
];
const isNdebele = (t) => NDEBELE_MARKERS.some(w => hasWord(t, w));

// Bottom-tab route names that actually exist per role (see ROLE_TABS in
// App.js) — keyed by keyword so a nav intent can try navigation.navigate().
// Screens that aren't a top-level tab for any role (Health, Diagnostics,
// Compliance, etc.) are deliberately left out: they aren't safely reachable
// from here, so those questions get answered in text instead of a jump.
// Offline/first-paint fallback only — the live rate comes from the
// backend's market_rates table (see getMarketRates below), refreshed from
// AMA Zimbabwe's real weekly market bulletin, and is the same source the
// app's own Estimated Market Value figures and valuation certificates use.
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

const NAV_TARGETS = {
  Dashboard: ['home', 'dashboard', 'overview', 'main', 'start'],
  Herd:      ['herd', 'animals', 'my cattle', 'my goats', 'register'],
  Market:    ['sell', 'buy', 'market', 'listing', 'price', 'clearance', 'permit', 'trade'],
  Feed:      ['feed', 'nutrition', 'ration'],
  Vet:       ['vet', 'doctor', 'advisor', 'expert', 'emergency', 'outbreak', 'agritex', 'chat', 'messenger'],
  Profile:   ['profile', 'account', 'settings'],
};

const KNOWLEDGE = {
  greetings: [
    'hi', 'hello', 'hey',
    'mangwanani', 'maswera', 'mwauya', 'manheru', 'masikati',
    'makadii', 'makadini', 'wakadii', 'ndeipi', 'unofara', 'hesi', 'zvirisei',
    'sawubona', 'salibonani', 'linjani', 'unjani', 'kunjani',
  ],
  quickTips: [
    'Follow the 5-5-4 dipping schedule to prevent January Disease.',
    'Cattle weaning should happen around 7 months (210 days).',
    'Isolate any animal with blisters or lameness immediately.',
    "Keep a brand mark on every animal's record — police cannot clear the sale of an unbranded beast.",
  ],
  quickTipsShona: [
    'Teverai gwara re-5-5-4 rekunyika kuti mudzivirire Chirwere cheJanuary (January Disease).',
    'Kurumurwa kwemombe kunofanira kuitika panenge mwedzi minomwe (mazuva 210).',
    'Paradzanisai mhuka ipi neipi ine mabhindauko kana kukamhina nekukurumidza.',
    "Chengetai chiratidzo (brand) parekodhi yemhuka imwe neimwe — mapurisa haabvumire kutengeswa kwemhuka isina chiratidzo.",
  ],
  quickTipsNdebele: [
    'Landela uhlelo lokugezisa i-5-5-4 ukuvikela uMkhuhlane weJanuary (January Disease).',
    'Ukulumula amankonyana kumele kwenzeke emva kwezinyanga eziyisi-7 (insuku ezingu-210).',
    'Hlukanisa masinyane loba yisiphi isifuyo esilamathumba kumbe esiqhulayo.',
    'Gcina uphawu (brand) kurekhodi yesifuyo ngasinye — amaphoyisa awakwazi ukuvumela ukuthengiswa kwesifuyo esingelaphawu.',
  ],
};

const now = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function JindaFAB({ currentUser, navRef }) {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [animals, setAnimals] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'ai',
      text: `Mwauya nei? I am Jinda, your loyal messenger. I am here to help you manage your own PFUMA/INGCEBO herd${currentUser?.role ? ` as a ${currentUser.role}` : ''}, and I know the compliance rules for cattle and goats. Ask me anything in simple terms, or tell me where you want to go. I'll only ever discuss your own animals and account — not other users' data.`,
      time: now(),
    },
  ]);
  const scrollRef  = useRef(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  // Pulse the FAB when closed
  React.useEffect(() => {
    if (open) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [open]);

  // Fetch the signed-in user's own herd once, on opening the chat, so
  // valuation/herd-count questions answer from real data instead of a
  // hardcoded placeholder. Best-effort — if it fails, those two intents
  // just fall through to the generic answer below.
  useEffect(() => {
    if (!open || !currentUser) return;
    (async () => {
      try {
        const res = await authFetch(currentUser, '/animals');
        if (res.ok) setAnimals(await res.json());
      } catch { /* offline or not reachable — herd questions degrade gracefully */ }
    })();
  }, [open, currentUser]);

  const processNLP = (text) => {
    const lowerText = text.toLowerCase();
    const role = currentUser?.role;
    // Only covers the general-purpose replies below (greeting, what-is-PFUMA/INGCEBO,
    // help, valuation, herd count, theft/security, privacy guard) — legal
    // compliance requirements and disease/vaccine names stay English-only,
    // since a machine-translated mistake there could actually mislead a
    // farmer about what the law or a vet protocol requires.
    const sn = isShona(lowerText);
    const nd = !sn && isNdebele(lowerText);

    // 1. Simple greetings
    if (KNOWLEDGE.greetings.some(g => hasWord(lowerText, g))) {
      return sn
        ? 'Ndiripo, ndatenda kubvunza! Ndingakubatsirai sei nemhuka dzenyu nhasi?'
        : nd
        ? 'Ngikhona, ngiyabonga ngokubuza! Ngingakusiza njani ngezifuyo zakho lamuhla?'
        : 'Salutations! How can I serve you and your herd today?';
    }

    // 2. "What is PFUMA/INGCEBO" — onboarding question.
    const asksWhatIsPfuma = /(what is pfuma|about pfuma|what does pfuma do|explain pfuma|purpose of pfuma|pfuma mean|what('?s| is) this (app|system|platform)|what does this (app|system|platform) do|pfuma chii|pfuma inoreveiko|pfuma i chii)/i.test(lowerText);
    if (asksWhatIsPfuma) {
      return sn
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
          + "Every animal gets a digital passport — ear tag, breed, vaccination history — so a sale can be trusted from farm to market. Ask me about your own herd, compliance rules, or where to find something in the app.";
    }

    // 3. Data-privacy guard.
    const asksAboutOthers = /(other|another|someone else'?s|everyone'?s|all (farmers|users|vets|buyers|suppliers)'?)\s*(farmer|user|vet|buyer|supplier|animal|herd|contact|phone|account|data|record)/i.test(lowerText)
      || /\bwhose\b.*(animal|herd|account)/i.test(lowerText);
    if (asksAboutOthers) {
      return sn
        ? "Ndinogona kutaura nezvemhuka dzenyu, nyaya dzenyu, uye account yenyu chete — kwete ruzivo rwemumwe munhu. Izvi zvinochengetedza ruzivo rwemunhu wese pamusoro pePFUMA. Kana muchida kusvika kune mumwe mupfuwi, va-vet, kana mutengesi, shandisai Messenger kana zvakaiswa paMarketplace."
        : nd
        ? "Ngingakhuluma kuphela ngezifuyo zakho, izindaba zakho, le-akhawunti yakho — hatshi ulwazi lomunye umuntu. Lokhu kuvikela ulwazi lwomuntu wonke ku-PFUMA/INGCEBO. Nxa ufuna ukufinyelela komunye umlimi, udokotela wezilwane, kumbe umthengisi, sebenzisa i-Messenger kumbe okufakwe kuMarketplace."
        : "I can only discuss your own herd, cases, and account — not another user's private data. That keeps everyone's information protected on PFUMA/INGCEBO. If you're trying to reach another farmer, vet, or trader, use the Messenger or a public Marketplace listing instead.";
    }

    // 4. Police-only intents.
    const asksAboutQueues = /(clearance queue|verification queue|pending (clearance|verification)|approve (a )?signup|review (an )?applicant)/i.test(lowerText);
    if (asksAboutQueues) {
      if (role === 'Police') {
        try { navRef?.current?.navigate('Dashboard'); } catch { /* not on a screen with that route */ }
        return 'Taking you to your Police Dashboard — the Signup Verification and Sale Clearance queues are both there.';
      }
      return role === 'Farmer' || role === 'Supplier'
        ? "Clearance review is done by Police, not visible here — but you can check your own listing's status on the Market tab; it'll show as pending until a police clearance is granted."
        : 'The clearance and signup-verification queues are only visible to the Police role, to keep that review process trustworthy.';
    }

    // 5. Compliance / legal-requirements knowledge (per species).
    const asksCompliance = /(requirement|rule|legal|law|compliance|regulation|allowed to keep|need to keep|papers|permit|licen[cs]e|movement permit)/i.test(lowerText);
    if (asksCompliance) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return (sn ? "(Ndinokupai izvi muChirungu nekuti ndiwo mazwi chaiwo emitemo — kuti ndisakanganise. Kumbirai muVet kana Admin kukushandurirai kana muchida.)\n\n" : nd ? "(Ngikunika lokhu ngesiNgisi ngoba yiwo amazwi aqondileyo omthetho — ukuze ngingaphosisi. Cela uDokotela wezilwane kumbe uMphathi ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
          + `To legally keep and sell ${species.toLowerCase()} in Zimbabwe:\n${c.legalRequirements.map(r => `• ${r}`).join('\n')}\n\nThis is a summary, not legal advice — see the compliance folder for full sources.`;
      }
      return 'I have compliance summaries for Cattle, Pigs, Sheep, and Goats — tell me which species and I\'ll list what\'s legally required to keep and sell them in Zimbabwe (brand/ID registration, movement permits, disease reporting, and police clearance before a sale).';
    }

    // 6. Signup / verification-document requirements, per role.
    const asksSignup = /(sign ?up|register(ing)?|verification document|what document|which document|id document)/i.test(lowerText);
    if (asksSignup) {
      const targetRole = detectRole(lowerText) || role;
      if (targetRole && SIGNUP_REQUIREMENTS[targetRole]) {
        return (sn ? "(Ndinokupai izvi muChirungu kuti ndisakanganise pamazita emapepa anodiwa. Kumbirai muVet kana Admin kukushandurirai kana muchida.)\n\n" : nd ? "(Ngikunika lokhu ngesiNgisi ukuze ngingaphosisi emabizweni amaphepha adingakalayo. Cela uDokotela wezilwane kumbe uMphathi ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
          + `To sign up as a ${targetRole} on PFUMA/INGCEBO, you'll need:\n${SIGNUP_REQUIREMENTS[targetRole].map(r => `• ${r}`).join('\n')}`;
      }
      return "Every role needs a National ID plus role-specific documents (land proof for Farmers, a CVSZ number for Vets, business registration for Suppliers/Buyers). Police accounts aren't self-service — tell me which role you mean and I'll give the full list.";
    }

    // 7. Disease/diagnosis lookup by species.
    const asksDisease = /(disease|sick|illness|symptom|diagnos)/i.test(lowerText);
    if (asksDisease) {
      const species = detectSpecies(lowerText);
      if (species && SPECIES_COMPLIANCE[species]) {
        const c = SPECIES_COMPLIANCE[species];
        return (sn ? "(Mazita echirwere ari muChirungu kuti ndisakanganise pane zita chairo. Kumbirai muVet kukushandurirai kana muchida.)\n\n" : nd ? "(Amabizo ezifo asesiNgisini ukuze ngingaphosisi ebizweni eliqondileyo. Cela uDokotela wezilwane ukuthi akuhumushele nxa uyafuna.)\n\n" : "")
          + `Key diseases to watch for in ${species.toLowerCase()}: ${c.diseases.join(', ')}.\n\n${c.diagnosisBasics}`;
      }
    }

    // 8. Deep knowledge: January Disease / ticks — common enough to answer directly.
    if (lowerText.includes('january') || lowerText.includes('tick') || lowerText.includes('theiler')) {
      return 'January Disease (Theileriosis) is a major threat in Zimbabwe. You must follow the 5-5-4 dipping cycle and apply tick grease in the ears and under the tail. Isolate any lame or feverish animal immediately and contact a vet.';
    }

    // 9. Valuation, theft/security, herd-count — checked before generic
    // navigation since "how much is my HERD worth" overlaps with the 'herd'
    // navigation keyword and would otherwise just jump to the Herd tab.
    if (lowerText.includes('worth') || lowerText.includes('value') || lowerText.includes('price') || lowerText.includes('money') || lowerText.includes('mari') || lowerText.includes('mutengo') || lowerText.includes('imali')) {
      const rates = getMarketRates();
      const totalValue = animals.reduce((acc, a) => {
        const pricePerKg = rates[a.species] ?? rates.Cattle ?? LIVESTOCK_PRICE_PER_KG_USD.Cattle;
        return acc + (a.current_weight || 0) * pricePerKg;
      }, 0);
      return sn
        ? `Mhuka dzenyu dzinoverengwa kuva nemutengo weUSD $${totalValue.toLocaleString()} pari zvino. Izvi zvinoenderana nehuremu hwadzo pari zvino.`
        : nd
        ? `Izifuyo zakho zibalwa ukuthi ziyimali engu-USD $${totalValue.toLocaleString()} khathesi. Lokhu kususelwa ebunzimeni bazo bakhathesi.`
        : `Your herd is currently valued at approximately USD $${totalValue.toLocaleString()}. This is based on current weight.`;
    }

    if (lowerText.includes('thief') || lowerText.includes('stole') || lowerText.includes('missing') || lowerText.includes('lost') || lowerText.includes('security') || lowerText.includes('mbavha') || lowerText.includes('akabiwa') || lowerText.includes('yakabiwa') || lowerText.includes('isela') || lowerText.includes('ebiwe')) {
      return sn
        ? "Mhan'arirei kumapurisa uye musimise mhuka iyi pano kuti rekodhi yayo iratidze kuti pane mhosva. Nekuti mutengo wega wega unoda kutenderwa nemapurisa, mhuka yakabiwa yakaoma kuti itengeswe nemumwe munhu."
        : nd
        ? "Bika emaphoyiseni njalo ufake uphawu kulesisifuyo lapha ukuze irekhodi yaso itshengise ukuthi kulengxabano. Ngoba isithengiso ngasinye sidinga imvumo yamaphoyisa, isifuyo esebiweyo kunzima ukuthi omunye umuntu asithengise."
        : "Report it to the police and flag the animal here so its record shows as disputed. Because every listing needs police clearance before buyers can see it, a stolen beast on your record is very hard for anyone else to sell on.";
    }

    if (lowerText.includes('how many') || lowerText.includes('total') || lowerText.includes('size') || lowerText.includes('mangani')) {
      return sn
        ? `Bhizinesi renyu rePFUMA rinotarisira mhuka ${animals.length} pari zvino.`
        : nd
        ? `Ibhizimusi lakho le-PFUMA/INGCEBO likhangela izifuyo ezingu-${animals.length} khathesi.`
        : `Your PFUMA/INGCEBO enterprise currently manages ${animals.length} animals.`;
    }

    // 10. Trained navigation intents — jump to a real bottom tab where one
    // exists for the signed-in role; React Navigation just no-ops (with a
    // dev warning) if the route isn't registered for this role, so this is
    // safe to attempt even when we can't know the role's exact tab set here.
    for (const [routeName, keywords] of Object.entries(NAV_TARGETS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        try { navRef?.current?.navigate(routeName); } catch { /* route not on this role's tab bar */ }
        return `Understood. I am taking you to the ${routeName} tab now.`;
      }
    }

    // 11. Capability / meta help.
    if (
      lowerText.includes('help') ||
      lowerText.includes('what can you do') ||
      lowerText.includes('what do you do') ||
      lowerText.includes('unoitei') ||
      lowerText.includes('wenzani')
    ) {
      return sn
        ? "Ndini Jinda. Ndinogona kukubatsirai ne:\n1. Kuongorora mutengo nemamiriro emhuka dzenyu\n2. Kutarisa nharaunda kuti mhuka dziri pachivimbo\n3. Kukutungamirirai kunzvimbo dzese dzePFUMA\n4. Kukutsanangurirai kuti PFUMA/INGCEBO chii uye kuti inobatanidza vanaani — bvunzai chete kuti \"PFUMA/INGCEBO chii?\"\n\nNdinogona kukubatsirai kuchengetedza mhuka dzenyu."
        : nd
        ? "NginguJinda. Ngingakusiza nge:\n1. Ukuhlola inani lezifuyo zakho\n2. Ukuqapha ukuphepha kwezifuyo\n3. Ukukuqondisa kuzo zonke izigaba ze-PFUMA/INGCEBO\n4. Ukuchasisa ukuthi i-PFUMA/INGCEBO iyini lokuthi ihlanganisa obani — buza nje ukuthi \"PFUMA/INGCEBO iyini?\"\n\nNgingakusiza ukugcina izifuyo zakho ziphephile."
        : 'I am Jinda. I can help you:\n1. Check your herd\'s value & statistics\n2. Answer livestock health & compliance questions\n3. Navigate all PFUMA/INGCEBO screens\n4. Explain what PFUMA/INGCEBO is and who it connects — just ask "what is PFUMA/INGCEBO?"';
    }

    const tipList = sn ? KNOWLEDGE.quickTipsShona : nd ? KNOWLEDGE.quickTipsNdebele : KNOWLEDGE.quickTips;
    const randomTip = tipList[Math.floor(Math.random() * tipList.length)];
    return sn
      ? `Handina chokwadi zvachose, asi rangarirai kuti: ${randomTip}`
      : nd
      ? `Kangiqiniseki impela, kodwa khumbula ukuthi: ${randomTip}`
      : `I'm not exactly sure, but remember: ${randomTip}`;
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg = { id: Date.now(), from: 'user', text, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTimeout(() => {
      const reply = processNLP(text);
      setMessages(prev => [...prev, { id: Date.now() + 1, from: 'ai', text: reply, time: now() }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }, 600);
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <Animated.View style={[s.fab, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={s.fabInner} onPress={() => setOpen(true)} activeOpacity={0.85}>
            <Bot size={26} color="#fff" strokeWidth={2} />
            <View style={s.fabOnlineDot} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Chat modal */}
      <Modal visible={open} animationType="slide" transparent statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.sheet}>

            {/* Header */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.aiAvatar}>
                  <Bot size={22} color={COLORS.primary} strokeWidth={2} />
                </View>
                <View>
                  <Text style={s.headerName}>Jinda</Text>
                  <Text style={s.headerSub}>Farm Assistant · Online</Text>
                </View>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setOpen(false)} activeOpacity={0.8}>
                <X size={16} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Suggested prompts */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.promptsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
              {['How do I sell an animal?', 'January Disease?', 'What vaccines do I need?', 'Contact a vet'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={s.promptChip}
                  onPress={() => {
                    setInput(p);
                    setTimeout(() => {
                      const userMsg = { id: Date.now(), from: 'user', text: p, time: now() };
                      setMessages(prev => [...prev, userMsg]);
                      setInput('');
                      setTimeout(() => {
                        const reply = processNLP(p);
                        setMessages(prev => [...prev, { id: Date.now() + 1, from: 'ai', text: reply, time: now() }]);
                        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
                      }, 600);
                    }, 0);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={s.promptChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={s.messages}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map(msg => (
                <View key={msg.id} style={[s.msgRow, msg.from === 'user' && s.msgRowUser]}>
                  {msg.from === 'ai' && (
                    <View style={s.msgAiAvatar}><Bot size={14} color={COLORS.primary} strokeWidth={2.2} /></View>
                  )}
                  <View style={[s.bubble, msg.from === 'user' ? s.bubbleUser : s.bubbleAi]}>
                    <Text style={[s.bubbleText, msg.from === 'user' && { color: '#fff' }]}>{msg.text}</Text>
                    <Text style={[s.bubbleTime, msg.from === 'user' && { color: 'rgba(255,255,255,0.55)' }]}>{msg.time}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  placeholder="Ask Jinda anything…"
                  placeholderTextColor="#aaa"
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[s.sendBtn, { opacity: input.trim() ? 1 : 0.35 }]}
                  onPress={send}
                  activeOpacity={0.8}
                  disabled={!input.trim()}
                >
                  <Send size={18} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>

          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab:         { position: 'absolute', bottom: 90, right: 18, zIndex: 999 },
  fabInner:    {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.primary,
    borderWidth: 3.5, borderColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  fabEmoji:    { fontSize: 26, lineHeight: 30 },
  fabOnlineDot:{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#8A9C68', borderWidth: 2, borderColor: '#fff' },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', minHeight: '60%' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#EFE8DD', backgroundColor: COLORS.primary, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiAvatar:    { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  headerName:  { color: '#fff', fontSize: 16, fontFamily: FONTS.extrabold },
  headerSub:   { color: '#DEC9AE', fontSize: 10, fontFamily: FONTS.semibold, marginTop: 1 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ color: '#fff', fontSize: 16, fontFamily: FONTS.bold },

  promptsRow:  { borderBottomWidth: 1, borderBottomColor: '#EFE8DD', maxHeight: 52 },
  promptChip:  { backgroundColor: '#F0E6D9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#E3E8D6' },
  promptChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.primary },

  messages:    { flex: 1 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  msgRowUser:  { flexDirection: 'row-reverse' },
  msgAiAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F0E6D9', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 2 },
  bubble:      { maxWidth: width * 0.72, borderRadius: 18, padding: 12 },
  bubbleAi:    { backgroundColor: '#EFE8DD', borderBottomLeftRadius: 4 },
  bubbleUser:  { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText:  { fontSize: 14, color: '#29231E', lineHeight: 20 },
  bubbleTime:  { fontSize: 10, color: '#968C82', marginTop: 4, textAlign: 'right' },

  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#EFE8DD', gap: 10 },
  input:       { flex: 1, backgroundColor: '#EFE8DD', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#29231E', maxHeight: 90 },
  sendBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20 },
});
