import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send, MapPin, ShieldCheck, ClipboardList, MessageSquare, FileText, CheckCircle,
  Siren, Stethoscope, Pill, Sprout, Store, Users, ArrowLeft, Phone,
} from 'lucide-react-native';
import { COLORS } from '../config';

// ── Platform-wide contact directory ─────────────────────────────────────────
const CONTACTS = [
  // Veterinary officers
  { id: 'v1', type: 'Vet',      name: 'Dr. T. Moyo',          role: 'DVS Duty Officer',         province: 'Mashonaland West',  avatar: 'TM', color: COLORS.primary, online: true,  speciality: 'Tick-borne Diseases' },
  { id: 'v2', type: 'Vet',      name: 'Dr. R. Chikwanda',     role: 'Regional Vet Officer',     province: 'Harare',            avatar: 'RC', color: '#1565c0',       online: true,  speciality: 'Reproductive Health' },
  { id: 'v3', type: 'Vet',      name: 'Dr. S. Ndlovu',        role: 'Emergency Response',       province: 'Bulawayo',          avatar: 'SN', color: '#6a1b9a',       online: false, speciality: 'FMD & CBPP' },
  { id: 'v4', type: 'Vet',      name: 'DVS Emergency Line',   role: 'Ministry of Agriculture',  province: 'National',          icon: Siren,  color: '#c62828',       online: true,  speciality: 'All Emergencies' },

  // Suppliers
  { id: 's1', type: 'Supplier', name: 'AgroChem Zim',         role: 'Medicine & Vaccine Supplier', province: 'Harare',         avatar: 'AC', color: COLORS.gold,     online: true,  speciality: 'Vaccines, dewormers & vitamins' },
  { id: 's2', type: 'Supplier', name: 'VetDirect Wholesale',  role: 'Animal Health Distributor', province: 'Bulawayo',          avatar: 'VD', color: '#e65100',       online: false, speciality: 'Bulk medicine & feed orders' },

  // Other farmers
  { id: 'f1', type: 'Farmer',   name: 'P. Banda',             role: 'Dairy Farmer',             province: 'Mashonaland East',  avatar: 'PB', color: '#16a34a',       online: true,  speciality: 'Dairy herd management' },
  { id: 'f2', type: 'Farmer',   name: 'L. Sibanda',           role: 'Poultry & Goat Farmer',    province: 'Matabeleland South',avatar: 'LS', color: '#65a30d',       online: false, speciality: 'Small livestock & feed swaps' },

  // Retailers / buyers
  { id: 'r1', type: 'Retailer', name: 'Harare Meat Wholesalers', role: 'Livestock Buyer',       province: 'Harare',            avatar: 'HM', color: COLORS.purple,   online: true,  speciality: 'Beef cattle & feedlot buyer' },
  { id: 'r2', type: 'Retailer', name: 'Bulawayo Livestock Market', role: 'Auction House',       province: 'Bulawayo',          avatar: 'BL', color: '#7c3aed',       online: true,  speciality: 'Weekly cattle auctions' },
];

const ROLE_META = {
  Vet:      { icon: Stethoscope, color: COLORS.primary, label: 'Vets' },
  Supplier: { icon: Pill,        color: COLORS.gold,    label: 'Suppliers' },
  Farmer:   { icon: Sprout,      color: '#16a34a',       label: 'Farmers' },
  Retailer: { icon: Store,       color: COLORS.purple,  label: 'Retailers' },
};

const FILTERS = [
  { key: 'All',      label: 'All',       icon: Users },
  { key: 'Vet',      label: 'Vets',      icon: Stethoscope },
  { key: 'Supplier', label: 'Suppliers', icon: Pill },
  { key: 'Farmer',   label: 'Farmers',   icon: Sprout },
  { key: 'Retailer', label: 'Retailers', icon: Store },
];

const AUTO_RESPONSES = {
  Vet: {
    Emergency: [
      'HIGH PRIORITY: Your case has been flagged. A duty officer is being notified. Please isolate the animal immediately.',
      'Case registered. Expected response within 15 minutes. Do not move the animal or remove any discharge material.',
    ],
    Vaccination: [
      "Vaccination request received. Please confirm the animal's current weight and last vaccination date.",
      'Your vaccination schedule has been reviewed. A certificate will be issued within 24 hours.',
    ],
    'Trade Certification': [
      'Trade certification request received. A health inspection must be conducted before certificate issuance.',
      'Your export health certificate is being processed. Estimated: 2-3 working days.',
    ],
    General: [
      'Message received. A vet officer will respond shortly.',
      'Thank you for contacting PFUMA Vet Services. We aim to respond within 1 hour.',
    ],
  },
  Supplier: [
    "Thanks for reaching out! That item is in stock — would you like a quote?",
    'Order noted. We can dispatch within 2 business days to your district.',
    "Sure thing — let me check our warehouse and confirm pricing shortly.",
  ],
  Farmer: [
    'Hey, thanks for the message! Let me check with my herd and get back to you.',
    'Sounds good — happy to help. What breed are you looking for?',
    "I'll ask around the village too, will update you soon.",
  ],
  Retailer: [
    "Thanks for reaching out — could you share the animal's weight and health passport?",
    'We can offer a competitive price for that grade. Can you send a few photos?',
    "Noted — I'll review and come back with a bid shortly.",
  ],
};

const CATEGORIES = ['Emergency', 'Vaccination', 'Trade Certification', 'General'];
const CAT_COLORS  = { Emergency: '#c62828', Vaccination: COLORS.primary, 'Trade Certification': '#1565c0', General: '#555' };

const now = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const ContactCard = ({ contact, onPress }) => {
  const meta = ROLE_META[contact.type];
  return (
    <TouchableOpacity style={s.vetCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.avatar, { backgroundColor: contact.color }]}>
        {contact.icon
          ? <contact.icon size={20} color="#fff" />
          : <Text style={s.avatarText}>{contact.avatar}</Text>}
        <View style={[s.onlineDot, { backgroundColor: contact.online ? '#4caf50' : '#aaa' }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={s.vetName}>{contact.name}</Text>
          <View style={[s.typeBadge, { backgroundColor: meta.color + '1a' }]}>
            <meta.icon size={10} color={meta.color} />
          </View>
        </View>
        <Text style={s.vetRole}>{contact.role}</Text>
        <View style={s.vetProvinceRow}>
          <MapPin size={10} color="#9ca3af" />
          <Text style={s.vetProvince}>{contact.province} · {contact.speciality}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 20, color: '#ccc' }}>›</Text>
    </TouchableOpacity>
  );
};

export default function VetMessengerScreen({ currentUser, route }) {
  const [activeFilter, setActiveFilter]     = useState(route?.params?.filter || 'All');
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState('');
  const [category, setCategory]             = useState('General');
  const scrollRef = useRef(null);

  const openContact = (c) => {
    setSelectedContact(c);
    setCategory('General');
    setMessages([
      { id: 1, text: `Hi, I'm ${c.name.split(' ')[0]}${c.role ? ` from ${c.role}` : ''}. How can I help?`, from: 'them', time: now() },
    ]);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !selectedContact) return;
    const userMsg = { id: Date.now(), text, from: 'me', time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const replies = selectedContact.type === 'Vet'
      ? (AUTO_RESPONSES.Vet[category] || AUTO_RESPONSES.Vet.General)
      : (AUTO_RESPONSES[selectedContact.type] || AUTO_RESPONSES.Farmer);
    const reply = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: reply, from: 'them', time: now() }]);
    }, 1200);
  };

  // ── Contact directory view ────────────────────────────────────────────────
  if (!selectedContact) {
    const groups = activeFilter === 'All'
      ? Object.keys(ROLE_META).map(type => ({ type, meta: ROLE_META[type], contacts: CONTACTS.filter(c => c.type === type) }))
      : [{ type: activeFilter, meta: ROLE_META[activeFilter], contacts: CONTACTS.filter(c => c.type === activeFilter) }];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerSub}>PFUMA</Text>
          <Text style={s.headerTitle}>PFUMA Messenger</Text>
          <Text style={s.headerDesc}>Chat with vets, suppliers, farmers & retailers across Zimbabwe</Text>
        </View>

        {/* Role filter chips */}
        <View style={s.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {FILTERS.map(f => {
              const active = activeFilter === f.key;
              const tint = f.key === 'All' ? COLORS.primary : ROLE_META[f.key].color;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterChip, active && { backgroundColor: tint, borderColor: tint }]}
                  onPress={() => setActiveFilter(f.key)}
                  activeOpacity={0.8}
                >
                  <f.icon size={13} color={active ? '#fff' : tint} />
                  <Text style={[s.filterChipText, active && { color: '#fff' }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

          {/* Emergency hotline banner */}
          {(activeFilter === 'All' || activeFilter === 'Vet') && (
            <View style={s.emergencyBanner}>
              <View style={s.emergencyIconWrap}>
                <Siren size={20} color="#c62828" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={s.emergencyTitle}>DVS Emergency Hotline</Text>
                <Text style={s.emergencyDesc}>Available 24/7 for disease outbreaks and animal health emergencies in Zimbabwe</Text>
              </View>
              <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL('tel:+263242706331')} activeOpacity={0.8}>
                <Phone size={12} color="#fff" />
                <Text style={s.callBtnText}>Call Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {groups.map(g => (
            <View key={g.type}>
              <View style={s.sectionLabelRow}>
                <g.meta.icon size={12} color="#9ca3af" strokeWidth={2.5} />
                <Text style={s.sectionLabel}>{g.meta.label.toUpperCase()}</Text>
              </View>
              {g.contacts.map(c => (
                <ContactCard key={c.id} contact={c} onPress={() => openContact(c)} />
              ))}
            </View>
          ))}

          {/* Info panel */}
          <View style={s.infoPanel}>
            <View style={s.infoTitleRow}>
              <ShieldCheck size={15} color={COLORS.primary} />
              <Text style={s.infoTitle}>How PFUMA Messenger Works</Text>
            </View>
            {[
              { icon: ClipboardList, text: 'Pick anyone on the platform — a vet, supplier, fellow farmer, or retailer' },
              { icon: MessageSquare, text: 'Send a message describing your animal, order, or listing' },
              { icon: FileText,      text: 'Vets can issue official certificates directly in the chat' },
              { icon: CheckCircle,   text: 'DVS-certified documents are valid for all livestock trade' },
            ].map((line, i) => (
              <View key={i} style={s.infoLineRow}>
                <line.icon size={14} color={COLORS.primary} style={{ marginTop: 1 }} />
                <Text style={s.infoLine}>{line.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────
  const contactMeta = ROLE_META[selectedContact.type];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f2f5' }}>
      <StatusBar barStyle="light-content" backgroundColor={selectedContact.color} />

      {/* Chat header */}
      <View style={[s.chatHeader, { backgroundColor: selectedContact.color }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => setSelectedContact(null)} activeOpacity={0.8}>
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <View style={[s.avatarSm, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          {selectedContact.icon
            ? <selectedContact.icon size={16} color="#fff" />
            : <Text style={[s.avatarText, { fontSize: 14 }]}>{selectedContact.avatar}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.chatName}>{selectedContact.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={[s.statusDot, { backgroundColor: selectedContact.online ? '#4ade80' : 'rgba(255,255,255,0.4)' }]} />
            <Text style={s.chatStatus}>{selectedContact.online ? 'Online now' : 'Away'} · {selectedContact.speciality}</Text>
          </View>
        </View>
      </View>

      {/* Category picker (vets) or role tag (everyone else) */}
      <View style={s.catRow}>
        {selectedContact.type === 'Vet' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.catChip, category === c && { backgroundColor: CAT_COLORS[c], borderColor: CAT_COLORS[c] }]}
                onPress={() => setCategory(c)}
                activeOpacity={0.8}
              >
                <Text style={[s.catChipText, category === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[s.typeChip, { backgroundColor: contactMeta.color + '1a' }]}>
            <contactMeta.icon size={12} color={contactMeta.color} />
            <Text style={[s.typeChipText, { color: contactMeta.color }]}>{selectedContact.role}</Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={[s.msgRow, msg.from === 'me' && s.msgRowUser]}>
            {msg.from === 'them' && (
              <View style={[s.msgAvatar, { backgroundColor: selectedContact.color }]}>
                {selectedContact.icon
                  ? <selectedContact.icon size={13} color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{selectedContact.avatar}</Text>}
              </View>
            )}
            <View style={[s.bubble, msg.from === 'me' ? s.bubbleUser : s.bubbleVet]}>
              <Text style={[s.bubbleText, msg.from === 'me' && { color: '#fff' }]}>{msg.text}</Text>
              <Text style={[s.bubbleTime, msg.from === 'me' && { color: 'rgba(255,255,255,0.6)' }]}>{msg.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputBar}>
          <TextInput
            style={s.textInput}
            placeholder={`Message ${selectedContact.name}…`}
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: selectedContact.color, opacity: input.trim() ? 1 : 0.4 }]}
            onPress={sendMessage}
            activeOpacity={0.8}
            disabled={!input.trim()}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:          { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56 },
  headerSub:       { color: '#a5d6a7', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:     { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerDesc:      { color: '#a5d6a7', fontSize: 12, fontWeight: '600', marginTop: 2 },

  filterRow:       { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  filterChipText:  { fontSize: 11, fontWeight: '800', color: '#6b7280' },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 16 },
  sectionLabel:    { fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },

  emergencyBanner: { backgroundColor: '#fff5f5', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#fca5a5', marginBottom: 8 },
  emergencyIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  emergencyTitle:  { fontSize: 13, fontWeight: '900', color: '#991b1b', marginBottom: 4 },
  emergencyDesc:   { fontSize: 11, color: '#b91c1c', lineHeight: 16 },
  callBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#c62828', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  callBtnText:     { color: '#fff', fontSize: 12, fontWeight: '800' },

  vetCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatar:          { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14, position: 'relative' },
  avatarText:      { color: '#fff', fontSize: 16, fontWeight: '900' },
  onlineDot:       { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  vetName:         { fontSize: 14, fontWeight: '900', color: '#111827' },
  typeBadge:       { width: 16, height: 16, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  vetRole:         { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  vetProvinceRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  vetProvince:     { fontSize: 10, color: '#9ca3af' },

  infoPanel:       { backgroundColor: '#e8f5e9', borderRadius: 16, padding: 16, marginTop: 16 },
  infoTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  infoTitle:       { fontSize: 13, fontWeight: '900', color: COLORS.primary },
  infoLineRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoLine:        { flex: 1, fontSize: 12, color: '#2e7d32', lineHeight: 18, fontWeight: '500' },

  chatHeader:      { flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 6 },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarSm:        { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chatName:        { color: '#fff', fontSize: 15, fontWeight: '900' },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  chatStatus:      { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  catRow:          { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  catChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  catChipText:     { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  typeChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  typeChipText:    { fontSize: 12, fontWeight: '800' },

  msgRow:          { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  msgRowUser:      { flexDirection: 'row-reverse' },
  msgAvatar:       { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bubble:          { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleVet:       { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1 },
  bubbleUser:      { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText:      { fontSize: 14, color: '#111827', lineHeight: 20 },
  bubbleTime:      { fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'right' },

  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10 },
  textInput:       { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', maxHeight: 100 },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
