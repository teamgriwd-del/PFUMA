import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler, Platform, SafeAreaView, StyleSheet,
  View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { WEB_URL } from './config';

const PFUMA_GREEN = '#1b5e20';

export default function App() {
  const webviewRef = useRef(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Android hardware back button should navigate the web app's own history
  // (e.g. back out of a dashboard tab) before falling through to exiting
  // the app — matches how every native Android app is expected to behave.
  const handleAndroidBack = useCallback(() => {
    if (canGoBack.current && webviewRef.current) {
      webviewRef.current.goBack();
      return true; // handled — don't exit the app
    }
    return false; // let the default (exit) behaviour happen
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', handleAndroidBack);
    return () => sub.remove();
  }, [handleAndroidBack]);

  const retry = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey(k => k + 1); // forces a full remount if the WebView wedged
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor={PFUMA_GREEN} />

      {loadError ? (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Can't reach PFUMA</Text>
          <Text style={styles.errorBody}>
            {loadError}
            {'\n\n'}Check that the PFUMA web app is running and reachable at:
            {'\n'}{WEB_URL}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webviewRef}
          source={{ uri: WEB_URL }}
          style={styles.webview}
          domStorageEnabled // the web app keeps its login session in localStorage
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          onNavigationStateChange={(nav) => { canGoBack.current = nav.canGoBack; }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            setLoadError(e.nativeEvent?.description || 'The page failed to load.');
          }}
          onHttpError={(e) => {
            setLoading(false);
            setLoadError(`Server responded with ${e.nativeEvent?.statusCode}.`);
          }}
        />
      )}

      {loading && !loadError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={PFUMA_GREEN} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PFUMA_GREEN },
  webview: { flex: 1, backgroundColor: '#fff' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScreen: {
    flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  errorTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  errorBody: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { backgroundColor: PFUMA_GREEN, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
});
