import React, { useState, useRef } from 'react';
import { Modal, View, Image, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';

// Full-screen, uncropped photo viewer — the counterpart to every small
// resizeMode="cover" gallery thumbnail in the app, which always crops.
// Shared by the Herd/Health Passport screen and the Marketplace screen so
// "tap a photo" behaves the same everywhere: whole image, swipe through
// the rest, tap a thumbnail to jump straight to it.
export default function PhotoLightbox({ visible, photos, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef(null);
  const { width, height } = Dimensions.get('window');

  const onShow = () => setIndex(startIndex);

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const jumpTo = (i) => {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  if (!photos || photos.length === 0) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} onShow={onShow}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <X size={20} color="#fff" />
        </TouchableOpacity>

        {photos.length > 1 && (
          <Text style={styles.counter}>{index + 1} / {photos.length}</Text>
        )}

        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(url, i) => url + i}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width, height: height * 0.72, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width, height: height * 0.72 }} resizeMode="contain" />
            </View>
          )}
        />

        {photos.length > 1 && (
          <FlatList
            data={photos}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, i) => 'thumb' + url + i}
            contentContainerStyle={styles.thumbRow}
            renderItem={({ item, index: i }) => (
              <TouchableOpacity onPress={() => jumpTo(i)} activeOpacity={0.8}>
                <Image source={{ uri: item }} style={[styles.thumb, i === index && styles.thumbActive]} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn:   { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  counter:    { position: 'absolute', top: 60, left: 20, zIndex: 10, color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  thumbRow:   { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  thumb:      { width: 52, height: 52, borderRadius: 10, marginRight: 8, opacity: 0.5 },
  thumbActive:{ opacity: 1, borderWidth: 2, borderColor: '#fff' },
});
