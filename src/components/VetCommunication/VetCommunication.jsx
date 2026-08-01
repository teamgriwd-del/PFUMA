import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZIMBABWE_REGIONS, EMERGENCY_HOTLINES } from './vetData';
import {
  Send, Plus, MapPin, Phone, ShieldCheck, Video,
  BellRing, Zap, Clock, X, Search, ChevronDown, MoreVertical, ArrowLeft, Paperclip,
  Check, CheckCheck, PhoneCall, Stethoscope, Pill,
  Sprout, Store, Users, Lock, Loader2
} from 'lucide-react';
import './VetCommunication.css';

const API = 'http://localhost:5000';

// Backend role strings, used consistently — no more separate "type" vocabulary.
const ROLE_META = {
  Veterinarian: { icon: Stethoscope, color: 'bg-emerald-600', label: 'Vets' },
  Supplier:     { icon: Pill,        color: 'bg-amber-500',   label: 'Suppliers' },
  Farmer:       { icon: Sprout,      color: 'bg-green-600',   label: 'Farmers' },
  Retailer:     { icon: Store,       color: 'bg-purple-700',  label: 'Retailers' },
  Police:       { icon: ShieldCheck, color: 'bg-red-700',     label: 'Police' },
};

const FILTERS = [
  { key: 'All',          label: 'All' },
  { key: 'Veterinarian', label: 'Vets' },
  { key: 'Supplier',     label: 'Suppliers' },
  { key: 'Farmer',       label: 'Farmers' },
  { key: 'Retailer',     label: 'Retailers' },
];

const sanitize = (str) => str.replace(/[<>]/g, '').trim().slice(0, 2000);

// Deterministic colour + initials for a real user, since we don't fabricate
// avatars — same person always renders the same colour.
const AVATAR_COLORS = ['bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-lime-600', 'bg-violet-600'];
const colorForId = (id) => AVATAR_COLORS[Math.abs(id || 0) % AVATAR_COLORS.length];
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

// The backend (Flask/PyMySQL) serializes MySQL TIMESTAMP columns as RFC 2822
// strings, e.g. "Sat, 19 Jul 2026 10:02:06 GMT" — the native Date
// constructor parses that correctly on its own, no reformatting needed.
const fmtTime = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toLocaleDateString();
};

const Avatar = ({ user, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;
  const meta = ROLE_META[user?.role];
  const Icon = meta?.icon;
  return (
    <div className={`${sizeClass} ${meta?.color || 'bg-gray-500'} rounded-full flex items-center justify-center text-white font-black shrink-0`}>
      {Icon ? <Icon size={iconSize} /> : initials(user?.full_name)}
    </div>
  );
};

const MessageBubble = ({ msg, isOwn }) => (
  <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
    <div className="max-w-[72%] group">
      <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
        isOwn ? 'bg-pfuma-green text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
      }`}>
        {msg.message}
      </div>
      <div className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <span className="text-[10px] text-gray-400 font-medium">{fmtTime(msg.sent_at)}</span>
        {isOwn && (msg.read_at ? <CheckCheck size={12} className="text-blue-400" /> : <Check size={12} className="text-gray-400" />)}
      </div>
    </div>
  </div>
);

// Debounced live search against real registered users, by name or phone.
// The sidebar quick-search and the composer's "who do you want to message"
// search are two INDEPENDENTLY visible inputs (the sidebar stays on screen
// while the composer is open) — each needs its own query/results/loading
// state. Sharing one set of state between them was the bug: clearing the
// composer's search after a successful send also silently wiped the
// sidebar's results while leaving its typed text behind.
function useUserSearch(query, excludeUserId, authHeaders) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API}/users?q=${encodeURIComponent(query.trim())}`, { headers: authHeaders });
        const data = res.ok ? await res.json() : [];
        setResults(data.filter(u => u.id !== excludeUserId));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, excludeUserId]);

  return { results, searching };
}

const VetCommunication = ({ animals = [], currentUser }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [apiOnline, setApiOnline] = useState(true);

  const [isComposing, setIsComposing] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [peopleQuery, setPeopleQuery] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showHotlines, setShowHotlines] = useState(false);
  const [formError, setFormError] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [newCase, setNewCase] = useState({ category: 'General', animalId: '', province: '', district: '', subject: '', description: '' });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${currentUser?.token}` };

  // ── Conversation list (polls every 8s so unread counts / new messages
  // from the other person show up without a manual refresh) ──
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/conversations`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      setConversations(await res.json());
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.token]);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 8000);
    return () => clearInterval(t);
  }, [loadConversations]);

  // ── Active conversation's messages (polls every 4s while open) ──
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await fetch(`${API}/conversations/${convId}/messages`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      setActiveMessages(await res.json());
    } catch { /* offline — keep last known messages */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.token]);

  useEffect(() => {
    if (!activeConvId) { setActiveMessages([]); return; }
    loadMessages(activeConvId);
    const t = setInterval(() => loadMessages(activeConvId), 4000);
    return () => clearInterval(t);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // Two fully independent live searches — see useUserSearch's comment above
  // for why they must not share state.
  const sidebarSearch  = useUserSearch(searchQuery, currentUser?.id, authHeaders);
  const composerSearch = useUserSearch(peopleQuery, currentUser?.id, authHeaders);

  const activeConv = conversations.find(c => c.id === activeConvId);

  const filteredConvs = conversations.filter(c => {
    const matchesFilter = activeFilter === 'All' || c.other_user?.role === activeFilter;
    const matchesSearch = !searchQuery || c.other_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const openConversation = async (convId) => {
    setActiveConvId(convId);
    setIsComposing(false);
    setSelectedContact(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Plain click on a non-vet person: start (or reuse) a general chat immediately.
  const startGeneralChat = async (person) => {
    setFormError('');
    try {
      const res = await fetch(`${API}/conversations`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: person.id, category: 'General' }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Could not start conversation.'); return; }
      await loadConversations();
      openConversation(data.id);
    } catch {
      setFormError('Could not reach the PFUMA API.');
    }
  };

  const handlePickPerson = (person) => {
    if (person.role === 'Veterinarian') {
      // Structured intake — matches how a real DVS case would be opened.
      setSelectedContact(person);
      setIsComposing(true);
      setActiveConvId(null);
      setNewCase(p => ({ ...p, category: 'Emergency', province: person.province || '' }));
      return;
    }
    startGeneralChat(person);
  };

  const handleSend = async () => {
    const text = sanitize(chatInput);
    if (!text || !activeConvId || sendBusy) return;
    setSendBusy(true);
    setChatInput('');
    try {
      const res = await fetch(`${API}/conversations/${activeConvId}/messages`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        await loadMessages(activeConvId);
        await loadConversations();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Message could not be sent.');
      }
    } catch {
      setFormError('Could not reach the PFUMA API — message not sent.');
    } finally {
      setSendBusy(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!selectedContact) { setFormError('Pick a vet to message first.'); return; }
    if (!newCase.subject.trim()) { setFormError('Please provide a subject.'); return; }
    setFormError('');
    const animalId = newCase.animalId ? parseInt(newCase.animalId, 10) : null;
    try {
      const res = await fetch(`${API}/conversations`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          other_user_id: selectedContact.id, category: newCase.category,
          subject: newCase.subject.trim(), animal_id: animalId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Could not open case.'); return; }

      if (newCase.description.trim()) {
        await fetch(`${API}/conversations/${data.id}/messages`, {
          method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: sanitize(newCase.description) }),
        });
      }
      await loadConversations();
      setIsComposing(false);
      setSelectedContact(null);
      setPeopleQuery('');
      setNewCase({ category: 'General', animalId: '', province: '', district: '', subject: '', description: '' });
      openConversation(data.id);
    } catch {
      setFormError('Could not reach the PFUMA API.');
    }
  };

  const closeComposer = () => { setIsComposing(false); setSelectedContact(null); setPeopleQuery(''); setFormError(''); };

  return (
    <div className="flex h-full bg-gray-100 overflow-hidden">

      {/* ── LEFT PANEL ── Full width on mobile (this IS the mobile home
          view); fixed-width column alongside the right panel from md up.
          On mobile it hides entirely once a conversation/composer is open —
          master-detail, not squeezed side-by-side. */}
      <div className={`w-full md:w-[360px] shrink-0 flex-col bg-white border-r border-gray-200 h-full ${(activeConvId || isComposing) ? 'hidden md:flex' : 'flex'}`}>

        <div className="px-5 pt-6 pb-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl font-black text-gray-900">PFUMA Messenger</h2>
            <button
              onClick={() => { setIsComposing(true); setSelectedContact(null); setActiveConvId(null); setPeopleQuery(''); }}
              className="w-9 h-9 bg-pfuma-green text-white rounded-full flex items-center justify-center hover:bg-green-700 transition shadow-md"
              aria-label="New message"
            >
              <Plus size={18} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Any verified PFUMA member can message any other — vets, suppliers, farmers &amp; retailers.</p>
          {!apiOnline && (
            <div className="mb-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-xl text-[11px] font-bold text-yellow-700">
              Can't reach the PFUMA API — check the Flask backend is running.
            </div>
          )}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-pfuma-green/30"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition shrink-0 ${
                  activeFilter === f.key ? 'bg-pfuma-green text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Live people search results — only while the search box has real input */}
          {searchQuery.trim().length >= 2 && (
            <div className="px-5 pt-4 pb-2 border-b border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                People {sidebarSearch.searching && <Loader2 size={11} className="animate-spin" />}
              </p>
              {sidebarSearch.results.filter(p => activeFilter === 'All' || p.role === activeFilter).length === 0 && !sidebarSearch.searching ? (
                <p className="text-[11px] text-gray-400 font-medium pb-2">No verified members match "{searchQuery}".</p>
              ) : (
                <div className="space-y-1 pb-2">
                  {sidebarSearch.results.filter(p => activeFilter === 'All' || p.role === activeFilter).map(person => (
                    <button
                      key={person.id}
                      onClick={() => handlePickPerson(person)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left"
                    >
                      <Avatar user={person} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{person.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-medium truncate">{person.role}{person.org_name ? ` · ${person.org_name}` : ''}{person.province ? ` · ${person.province}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Conversations</p>
          </div>
          <div className="space-y-0">
            {filteredConvs.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400 font-medium px-6">
                {conversations.length === 0
                  ? 'No conversations yet — search above for someone to message.'
                  : 'No conversations match this search/filter.'}
              </p>
            ) : filteredConvs.map(conv => {
              const other = conv.other_user;
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 transition text-left ${isActive ? 'bg-green-50 border-r-4 border-pfuma-green' : 'hover:bg-gray-50'}`}
                >
                  <div className="relative shrink-0">
                    <Avatar user={other} />
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-pfuma-green rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-black">{conv.unread_count}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-sm font-bold text-gray-900 truncate">{other?.full_name || 'Unknown'}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">{fmtDate(conv.last_message_at)}</span>
                    </div>
                    <p className={`text-[11px] font-medium truncate ${conv.unread_count > 0 ? 'text-gray-800 font-bold' : 'text-gray-500'}`}>
                      {conv.last_message ? `${conv.last_message_is_own ? 'You: ' : ''}${conv.last_message}` : 'Start the conversation...'}
                    </p>
                    {conv.category !== 'General' && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-blue-100 text-blue-600">{conv.category}</span>
                        {conv.subject && <span className="text-[10px] text-gray-400 truncate">· {conv.subject}</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button onClick={() => setShowHotlines(p => !p)} className="flex items-center gap-2 text-[11px] font-bold text-gray-500 hover:text-pfuma-green transition w-full">
            <Phone size={12} />
            <span>Emergency Hotlines</span>
            <ChevronDown size={12} className={`ml-auto transition ${showHotlines ? 'rotate-180' : ''}`} />
          </button>
          {showHotlines && (
            <div className="mt-2 space-y-1.5">
              {EMERGENCY_HOTLINES.map((h, i) => (
                <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-500 font-medium">{h.label}</span>
                  <a href={`tel:${h.number}`} className="text-[11px] font-black text-pfuma-green hover:underline flex items-center gap-1">
                    <PhoneCall size={10} />{h.number}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── Hidden on mobile until a conversation/composer is
          actually open, since the left panel is the mobile home view. */}
      <div className={`flex-1 flex-col h-full overflow-hidden ${(activeConvId || isComposing) ? 'flex' : 'hidden md:flex'}`}>

        {/* COMPOSE / NEW CASE */}
        {isComposing && (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-xl mx-auto px-6 py-8">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={closeComposer} className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-100 transition">
                  <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    {selectedContact ? `Message ${selectedContact.full_name}` : 'New Message'}
                  </h3>
                  {selectedContact && <p className="text-xs text-gray-400 font-medium">{selectedContact.role}{selectedContact.speciality ? ` · ${selectedContact.speciality}` : ''}{selectedContact.province ? ` · ${selectedContact.province}` : ''}</p>}
                </div>
                {selectedContact && <Avatar user={selectedContact} size="md" />}
              </div>

              {formError && (
                <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold" role="alert">{formError}</div>
              )}

              {!selectedContact ? (
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-search">Who do you want to message? <span className="text-red-400">*</span></label>
                  <div className="relative mb-3">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cc-search" type="text" autoFocus
                      placeholder="Search by name or phone number..."
                      className="w-full pl-10 p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30"
                      value={peopleQuery}
                      onChange={e => setPeopleQuery(e.target.value)}
                    />
                  </div>
                  {peopleQuery.trim().length >= 2 && (
                    <div className="space-y-1 bg-white rounded-xl border border-gray-100 p-2">
                      {composerSearch.searching ? (
                        <p className="text-xs text-gray-400 font-medium p-3 text-center">Searching...</p>
                      ) : composerSearch.results.length === 0 ? (
                        <p className="text-xs text-gray-400 font-medium p-3 text-center">No verified members found.</p>
                      ) : composerSearch.results.map(person => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => handlePickPerson(person)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition text-left"
                        >
                          <Avatar user={person} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{person.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-medium truncate">{person.role}{person.org_name ? ` · ${person.org_name}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedContact.role !== 'Veterinarian' ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 font-medium">
                  Starting a direct message with {selectedContact.full_name}...
                </div>
              ) : (
                <form onSubmit={handleCreateCase} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-type">Case Type</label>
                      <select id="cc-type" className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30" value={newCase.category} onChange={e => setNewCase(p => ({ ...p, category: e.target.value }))}>
                        <option>Emergency</option>
                        <option>Vaccination</option>
                        <option>Trade Certification</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-animal">Animal</label>
                      <select id="cc-animal" className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30" value={newCase.animalId} onChange={e => setNewCase(p => ({ ...p, animalId: e.target.value }))}>
                        <option value="">Select animal...</option>
                        {animals.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-province">Province</label>
                      <select id="cc-province" className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30" value={newCase.province} onChange={e => setNewCase(p => ({ ...p, province: e.target.value, district: '' }))}>
                        <option value="">Select province...</option>
                        {Object.keys(ZIMBABWE_REGIONS).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-district">District</label>
                      <select id="cc-district" className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30" value={newCase.district} onChange={e => setNewCase(p => ({ ...p, district: e.target.value }))} disabled={!newCase.province}>
                        <option value="">Select district...</option>
                        {(ZIMBABWE_REGIONS[newCase.province] || []).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-subject">Subject <span className="text-red-400">*</span></label>
                    <input
                      id="cc-subject" type="text" required maxLength={120}
                      placeholder="e.g. Suspected FMD — Chegutu Farm"
                      className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30"
                      value={newCase.subject}
                      onChange={e => setNewCase(p => ({ ...p, subject: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5" htmlFor="cc-desc">Initial Message</label>
                    <textarea
                      id="cc-desc" rows={4} maxLength={2000}
                      placeholder="Describe symptoms, timeline, and animals affected..."
                      className="w-full p-3 bg-white rounded-xl border border-gray-200 font-medium text-sm outline-none focus:ring-2 focus:ring-pfuma-green/30 resize-none"
                      value={newCase.description}
                      onChange={e => setNewCase(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>

                  <button type="submit" className="w-full py-4 bg-pfuma-green text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                    <Send size={16} /> Send to {selectedContact?.full_name}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE CONVERSATION */}
        {!isComposing && activeConv && (
          <>
            <div className="px-5 py-3.5 bg-white border-b border-gray-100 flex items-center gap-3 shadow-sm">
              <button onClick={() => setActiveConvId(null)} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800" aria-label="Back to conversations">
                <ArrowLeft size={18} />
              </button>
              <Avatar user={activeConv.other_user} size="md" />
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-gray-900 text-sm leading-none mb-0.5">{activeConv.other_user?.full_name}</h4>
                <p className="text-[11px] text-gray-500 font-medium">
                  {activeConv.other_user?.role}{activeConv.other_user?.org_name ? ` · ${activeConv.other_user.org_name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeConv.category === 'Emergency' && (
                  <span className="flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest animate-pulse">
                    <Zap size={10} /> URGENT
                  </span>
                )}
                <button className="w-9 h-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 transition" aria-label="Voice call">
                  <PhoneCall size={17} />
                </button>
                <button className="w-9 h-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 transition" aria-label="More options">
                  <MoreVertical size={17} />
                </button>
              </div>
            </div>

            {activeConv.category !== 'General' && (
              <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-black uppercase text-[10px] bg-blue-100 text-blue-600">{activeConv.category}</span>
                  <span className="text-gray-500 font-medium">{activeConv.subject}</span>
                </div>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
              style={{ background: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.3\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E"), #f0f2f5' }}
              role="log"
              aria-label="Conversation"
            >
              <div className="flex justify-center">
                <span className="bg-white text-[10px] font-bold text-gray-400 px-3 py-1 rounded-full shadow-sm border border-gray-100">{fmtDate(activeConv.created_at)}</span>
              </div>

              {activeMessages.length === 0 ? (
                <p className="text-center text-xs text-gray-400 font-medium py-8">No messages yet — say hello.</p>
              ) : activeMessages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_id === currentUser?.id} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* pr-24 keeps the send button clear of the fixed Jinda AI chat
                bubble, which sits at bottom-right of the whole viewport and
                would otherwise sit on top of it and block clicks. */}
            <div className="px-4 pr-24 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 focus-within:border-pfuma-green/50 focus-within:shadow-md transition">
                <button className="text-gray-400 hover:text-pfuma-green transition shrink-0" aria-label="Attach file"><Paperclip size={18} /></button>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-800 placeholder:text-gray-400 min-w-0"
                  value={chatInput}
                  maxLength={2000}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  aria-label="Message"
                />
                <button
                  onClick={handleSend}
                  disabled={!chatInput.trim() || sendBusy}
                  className="w-9 h-9 bg-pfuma-green text-white rounded-full flex items-center justify-center hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="flex items-center justify-center gap-1 text-center text-[10px] text-gray-400 font-medium mt-2">
                <Lock size={10} /> Messages are stored on your PFUMA account
              </p>
            </div>
          </>
        )}

        {/* EMPTY STATE */}
        {!isComposing && !activeConv && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center px-8">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 border border-gray-100">
              <Users size={40} className="text-pfuma-green" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">PFUMA Messenger</h3>
            <p className="text-gray-400 font-medium text-sm max-w-xs leading-relaxed mb-8">
              Search for anyone by name or phone number — vets, suppliers, farmers, or retailers — and start a real conversation.
            </p>
            <button
              onClick={() => { setIsComposing(true); setSelectedContact(null); setPeopleQuery(''); }}
              className="flex items-center gap-2 px-6 py-3 bg-pfuma-green text-white rounded-2xl font-black text-sm shadow-lg hover:bg-green-700 transition"
            >
              <Plus size={16} /> New Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VetCommunication;
