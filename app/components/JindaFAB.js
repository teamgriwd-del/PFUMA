import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const KNOWLEDGE = {
  greetings: ['hi', 'hello', 'mangwanani', 'maswera', 'mwauya', 'salut'],
  quickTips: [
    'Follow the 5-5-4 dipping schedule to prevent January Disease.',
    'Cattle weaning should happen around 7 months (210 days).',
    'Isolate any animal with blisters or lameness immediately.',
    'Check your Herd screen for overdue vaccine alerts.',
  ],
};

const NLP_RULES = [
  { keywords: ['january', 'tick', 'theiler', 'dip'],
    reply: 'January Disease (Theileriosis) is a major threat in Zimbabwe. Follow the 5-5-4 dipping cycle and apply tick grease in ears and under the tail. Isolate any lame animal immediately.' },
  { keywords: ['worth', 'value', 'price', 'money', 'cost'],
    reply: 'Animal value depends on species, weight and breed. Cattle typically value at USD $500 base + $1.50 per kg. Open the Marketplace to see current listings.' },
  { keywords: ['thief', 'stole', 'security', 'mbavha', 'where'],
    reply: 'PFUMA monitors movement 24/7. My sensors detect a "Theft Signature" — rapid movement outside the safe zone. You will be alerted instantly when this happens.' },
  { keywords: ['sell', 'list', 'market', 'trade', 'buyer'],
    reply: 'To list an animal for sale: go to the Herd tab, tap an animal, and toggle "List for Sale". Retailers on the Marketplace will immediately see it and can place a bid.' },
  { keywords: ['vaccine', 'vaccin', 'inject', 'shot', 'fmd', 'anthrax'],
    reply: 'Key vaccines for Zimbabwe livestock: FMD (annual), Anthrax (yearly in high-risk zones), Blackleg (6 months), Brucellosis (heifers only). Check your Herd screen for overdue alerts.' },
  { keywords: ['sick', 'ill', 'disease', 'symptom', 'blister', 'lame'],
    reply: 'If an animal shows symptoms: isolate it immediately, note the symptoms, and contact your DVS Duty Officer via Vet Messenger. Do not wait — disease spreads fast in a herd.' },
  { keywords: ['how many', 'total', 'count', 'size', 'herd'],
    reply: 'Open the Herd tab to see all your registered animals. You can add, edit, and manage each animal\'s health passport from there.' },
  { keywords: ['vet', 'doctor', 'expert', 'dvs', 'consult'],
    reply: 'Tap the Vet Messenger screen to connect with licensed DVS officers. Dr. T. Moyo (Mashonaland West) is currently online.' },
  { keywords: ['help', 'what can', 'what do', 'unoitei', 'guide'],
    reply: 'I am Jinda, your farm assistant. I can:\n• Answer livestock health questions\n• Guide you to the right screen\n• Give herd valuation tips\n• Explain how PFUMA works\n\nNdinogona kukubatsira kuchengetedza mhuka dzako.' },
];

function processNLP(text) {
  const t = text.toLowerCase();
  if (KNOWLEDGE.greetings.some(g => t.includes(g))) {
    return 'Salutations! How can I serve you and your herd today?';
  }
  for (const rule of NLP_RULES) {
    if (rule.keywords.some(k => t.includes(k))) return rule.reply;
  }
  const tip = KNOWLEDGE.quickTips[Math.floor(Math.random() * KNOWLEDGE.quickTips.length)];
  return `I'm not exactly sure about that, but here's a tip: ${tip}`;
}

const now = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function JindaFAB() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState([
    { id: 1, from: 'ai', text: 'Mwauya nei? I am Jinda, your loyal herd messenger. Ask me anything about livestock health, the marketplace, or how to navigate PFUMA.', time: now() },
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
            <Text style={s.fabEmoji}>🤖</Text>
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
                  <Text style={{ fontSize: 22 }}>🤖</Text>
                </View>
                <View>
                  <Text style={s.headerName}>Jinda</Text>
                  <Text style={s.headerSub}>Farm Assistant · Online</Text>
                </View>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setOpen(false)} activeOpacity={0.8}>
                <Text style={s.closeBtnText}>✕</Text>
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
                    <View style={s.msgAiAvatar}><Text style={{ fontSize: 14 }}>🤖</Text></View>
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
                  <Text style={s.sendBtnText}>➤</Text>
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
  fabOnlineDot:{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#fff' },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', minHeight: '60%' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: COLORS.primary, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiAvatar:    { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  headerName:  { color: '#fff', fontSize: 16, fontWeight: '900' },
  headerSub:   { color: '#a5d6a7', fontSize: 10, fontWeight: '600', marginTop: 1 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },

  promptsRow:  { borderBottomWidth: 1, borderBottomColor: '#f3f4f6', maxHeight: 52 },
  promptChip:  { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#c8e6c9' },
  promptChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  messages:    { flex: 1 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  msgRowUser:  { flexDirection: 'row-reverse' },
  msgAiAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 2 },
  bubble:      { maxWidth: width * 0.72, borderRadius: 18, padding: 12 },
  bubbleAi:    { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  bubbleUser:  { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText:  { fontSize: 14, color: '#111827', lineHeight: 20 },
  bubbleTime:  { fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'right' },

  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10 },
  input:       { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', maxHeight: 90 },
  sendBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20 },
});
