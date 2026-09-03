import React, { useState, useCallback } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  User, ClipboardList, Package, Store, Shield, Radio,
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
import IoTScreen          from './screens/IoTScreen';
import JindaFAB    from './components/JindaFAB';

const Tab = createBottomTabNavigator();

const ROLE_TABS = {
  Farmer: [
    { name: 'Dashboard', icon: Home,          label: 'Home',    screen: DashboardScreen },
    { name: 'Herd',      icon: Users,         label: 'Herd',    screen: HerdScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'IoT',       icon: Radio,         label: 'IoT',     screen: IoTScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Messages',screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Veterinarian: [
    { name: 'Dashboard', icon: ClipboardList, label: 'Home',    screen: DashboardScreen },
    { name: 'Herd',      icon: Users,         label: 'Animals', screen: HerdScreen },
    { name: 'IoT',       icon: Radio,         label: 'IoT',     screen: IoTScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Messages',screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Supplier: [
    { name: 'Dashboard', icon: Package,       label: 'Home',    screen: DashboardScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Messages',screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'More',    screen: ProfileScreen },
  ],
  Buyer: [
    { name: 'Dashboard', icon: Store,         label: 'Home',    screen: DashboardScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Feed',      icon: Wheat,         label: 'Feed',    screen: FeedAnalyzerScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Messages',screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'Profile', screen: ProfileScreen },
  ],
  Police: [
    { name: 'Dashboard', icon: Shield,        label: 'Home',    screen: DashboardScreen },
    { name: 'Market',    icon: ShoppingCart,  label: 'Market',  screen: MarketplaceScreen },
    { name: 'Vet',       icon: MessageSquare, label: 'Messages',screen: VetMessengerScreen },
    { name: 'Profile',   icon: User,          label: 'Profile', screen: ProfileScreen },
  ],
  // Admin moderation tools are web-only (data-dense tables/charts, not a
  // phone task) — a single tab pointing at DashboardScreen's web-only
  // notice, rather than silently falling back to the Farmer tab set below.
  Admin: [
    { name: 'Dashboard', icon: Shield,        label: 'Home',    screen: DashboardScreen },
  ],
};

const ROLE_COLORS = {
  Farmer: COLORS.primary, Veterinarian: '#1565c0',
  Supplier: '#e65100',    Buyer: '#6a1b9a',
  Police: '#c62828',
};

// ── Tab icon: pill highlight on active, clean spacing ──────────────────────
const TabIcon = ({ icon: Icon, label, focused, roleColor }) => (
  <View style={styles.tabIconWrap}>
    <View style={[styles.tabPill, focused && { backgroundColor: roleColor + '1a' }]}>
      <Icon size={focused ? 21 : 19} color={focused ? roleColor : '#9aa0a6'} strokeWidth={focused ? 2.4 : 2} />
    </View>
    <Text style={[styles.tabLabel, { color: focused ? roleColor : '#aaa' }]}>{label}</Text>
    {focused && <View style={[styles.tabDot, { backgroundColor: roleColor }]} />}
  </View>
);

function RoleTabNavigator({ currentUser, onLogout, onUserUpdate }) {
  const role  = currentUser?.role || 'Farmer';
  const tabs  = ROLE_TABS[role] || ROLE_TABS.Farmer;
  const color = ROLE_COLORS[role] || COLORS.primary;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          borderTopColor: color + '25',
        },
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
        {activeRoute !== 'Vet' && <JindaFAB currentUser={currentUser} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.cardDark,
    borderTopWidth: 1,
    height: 76,
    paddingBottom: 0,
    paddingTop: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },

  // Each tab column
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    width: 50,
  },

  // Pill behind the icon when focused
  tabPill: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },

  tabLabel: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.1,
    marginBottom: 2,
  },

  // Tiny active dot below the label
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
