import React, { useState, useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Home, Users, ShoppingCart, Wheat, MessageSquare,
  User, ClipboardList, Package, Store, Shield, Radio, Landmark,
} from 'lucide-react-native';
import { COLORS, FONTS } from './config';

SplashScreen.preventAutoHideAsync().catch(() => {});

import LoginScreen        from './screens/LoginScreen';
import DashboardScreen    from './screens/DashboardScreen';
import HerdScreen         from './screens/HerdScreen';
import MarketplaceScreen  from './screens/MarketplaceScreen';
import FeedAnalyzerScreen from './screens/FeedAnalyzerScreen';
import VetMessengerScreen from './screens/VetMessengerScreen';
import ProfileScreen      from './screens/ProfileScreen';
import HealthManagementScreen  from './screens/HealthManagementScreen';
import ComplianceScreen        from './screens/ComplianceScreen';
import DiseaseDetectionScreen  from './screens/DiseaseDetectionScreen';
import CooperativeScreen       from './screens/CooperativeScreen';
import PoliceScreen            from './screens/PoliceScreen';
import InstitutionScreen       from './screens/InstitutionScreen';
import VetComplianceScreen     from './screens/VetComplianceScreen';
import SupplierStockScreen     from './screens/SupplierStockScreen';
import TradingJournalScreen    from './screens/TradingJournalScreen';
import JindaFAB    from './components/JindaFAB';

const Tab = createBottomTabNavigator();

const ROLE_TABS = {
  Farmer: [
    { name: 'Dashboard', icon: Home,          label: 'Home',    screen: DashboardScreen },
    { name: 'Herd',      icon: Users,         label: 'Herd',    screen: HerdScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Veterinarian: [
    { name: 'Dashboard', icon: ClipboardList, label: 'Home',    screen: DashboardScreen },
    { name: 'Herd',      icon: Users,         label: 'Animals', screen: HerdScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Supplier: [
    { name: 'Dashboard', icon: Package,       label: 'Home',    screen: DashboardScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Buyer: [
    { name: 'Dashboard', icon: Store,         label: 'Home',    screen: DashboardScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'Profile', screen: ProfileScreen },
  ],
  Police: [
    { name: 'Dashboard', icon: Shield,        label: 'Home',    screen: PoliceScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'Profile', screen: ProfileScreen },
  ],
  Institution: [
    { name: 'Dashboard', icon: Landmark,      label: 'Home',    screen: InstitutionScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Chat',      screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'Profile', screen: ProfileScreen },
  ],
  // Admin moderation tools are web-only (data-dense tables/charts, not a
  // phone task) — a single tab pointing at DashboardScreen's web-only
  // notice, rather than silently falling back to the Farmer tab set below.
  Admin: [
    { name: 'Dashboard', icon: Shield,        label: 'Home',    screen: DashboardScreen },
  ],
};

// Screens that exist and are fully wired, but don't get their own bottom-tab
// slot — reached instead via a menu item (see ProfileScreen's "My Farm"
// section, which navigates to these by name like it already does for the
// visible tabs). Kept role-scoped since each of these is currently built for
// one role's view of the feature (e.g. ComplianceScreen is the farmer-facing
// case list, not the vet follow-up queue) — added to other roles as their
// own passes land.
const HIDDEN_TABS = {
  Farmer: [
    { name: 'Health',      screen: HealthManagementScreen },
    { name: 'Compliance',  screen: ComplianceScreen },
    { name: 'Disease',     screen: DiseaseDetectionScreen },
    { name: 'Cooperative', screen: CooperativeScreen },
  ],
  // HealthManagementScreen/DiseaseDetectionScreen are already role-agnostic
  // (they just fetch /animals, which a Vet sees across every farm, not only
  // their own — see GET /animals in backend/app.py) so they're reused as-is.
  // Compliance is NOT reused — a vet needs the follow-up queue's claim/
  // notice/lockout actions, not the farmer's "I can't vaccinate" flow, so
  // that's its own screen (VetComplianceScreen).
  Veterinarian: [
    { name: 'Health',      screen: HealthManagementScreen },
    { name: 'Compliance',  screen: VetComplianceScreen },
    { name: 'Disease',     screen: DiseaseDetectionScreen },
    { name: 'Feed',        screen: FeedAnalyzerScreen },
  ],
  Supplier: [
    { name: 'Stock',         screen: SupplierStockScreen },
    { name: 'TradingJournal', screen: TradingJournalScreen },
  ],
  Buyer: [
    { name: 'TradingJournal', screen: TradingJournalScreen },
  ],
};

const ROLE_COLORS = {
  Farmer: COLORS.primary, Veterinarian: COLORS.teal,
  Supplier: '#8E450E',    Buyer: COLORS.purple,
  Police: COLORS.danger,  Institution: '#465032',
};

// ── Tab icon: pill highlight on active, clean spacing ──────────────────────
// No fixed width here — the column is sized by tabBarItemStyle (flex:1,
// equal share of the bar) so every role's tab count distributes evenly, and
// the label gets numberOfLines+adjustsFontSizeToFit instead of a narrow box,
// which is what was clipping/wrapping "Messages" onto two lines.
const TabIcon = ({ icon: Icon, label, focused, roleColor }) => (
  <View style={styles.tabIconWrap}>
    <View style={[styles.tabPill, focused && { backgroundColor: roleColor + '1a' }]}>
      <Icon size={focused ? 21 : 19} color={focused ? roleColor : '#C9BFB4'} strokeWidth={focused ? 2.4 : 2} />
    </View>
    <Text
      style={[styles.tabLabel, { color: focused ? roleColor : '#D8CFC4' }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {label}
    </Text>
    {focused && <View style={[styles.tabDot, { backgroundColor: roleColor }]} />}
  </View>
);

function RoleTabNavigator({ currentUser, onLogout, onUserUpdate }) {
  const role  = currentUser?.role || 'Farmer';
  const tabs  = ROLE_TABS[role] || ROLE_TABS.Farmer;
  const hiddenTabs = HIDDEN_TABS[role] || [];
  const color = ROLE_COLORS[role] || COLORS.primary;
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          borderTopColor: color + '25',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {tabs.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={t.icon} label={t.label} focused={focused} roleColor={color} />
            ),
          }}
        >
          {props => <t.screen {...props} currentUser={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />}
        </Tab.Screen>
      ))}
      {hiddenTabs.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          options={{
            // tabBarButton hides these from view, but the navigator's default
            // tabBarItemStyle (flex:1) still allocates each of them a share
            // of the bar's width even though nothing renders there — with
            // several hidden routes that squeezed the *visible* tabs into
            // one side of the bar with dead space on the other. Zeroing
            // their own item style out of the layout is what actually fixes
            // the equal-distribution bug, not just the tabBarButton override.
            tabBarButton: () => null,
            tabBarItemStyle: { flex: 0, width: 0, padding: 0, margin: 0 },
          }}
        >
          {props => <t.screen {...props} currentUser={currentUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const navRef = useNavigationContainerRef();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  if (!currentUser) {
    return (
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <LoginScreen onLogin={setCurrentUser} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      {/* Wrap in a relative View so the FAB can be absolutely positioned above the tab bar */}
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navRef}
          onReady={() => setActiveRoute(navRef.getCurrentRoute()?.name)}
          onStateChange={() => setActiveRoute(navRef.getCurrentRoute()?.name)}
        >
          <RoleTabNavigator
            currentUser={currentUser}
            onLogout={() => setCurrentUser(null)}
            onUserUpdate={patch => setCurrentUser(prev => ({ ...prev, ...patch }))}
          />
        </NavigationContainer>
        {/* Hidden on the Messages tab — the floating bubble sits directly on
            top of the chat's own send button there (see JindaFAB's fixed
            bottom-right position), which is worse than redundant since a
            chat screen already has messaging. */}
        {activeRoute !== 'Vet' && <JindaFAB currentUser={currentUser} navRef={navRef} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.cardDark,
    borderTopWidth: 1,
    paddingTop: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },

  // Every tab gets an equal flex share of the bar's width, however many
  // tabs a role has — this is what actually guarantees even distribution
  // (a fixed-width inner column just centers within whatever react-navigation
  // gave it, it doesn't equalize the columns themselves).
  tabBarItem: {
    flex: 1,
    paddingHorizontal: 2,
  },

  // Each tab column
  tabIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingHorizontal: 2,
  },

  // Pill behind the icon when focused
  tabPill: {
    width: 42,
    height: 34,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },

  tabLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    letterSpacing: 0.1,
    marginBottom: 2,
    maxWidth: 64,
  },

  // Tiny active dot below the label
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
