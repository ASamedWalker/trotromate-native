import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { X, Send } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useComments } from '@/lib/hooks/useComments'
import { useApp } from '@/lib/contexts/AppContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import { timeAgo } from '@/lib/utils/time'
import type { TaleComment } from '@/lib/services/comments'

interface CommentSheetProps {
  postId: string | null
  visible: boolean
  onClose: () => void
}

export default function CommentSheet({ postId, visible, onClose }: CommentSheetProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { deviceId, profile } = useApp()
  const { comments, isLoading, isPosting, addComment } = useComments(postId, deviceId)
  const [text, setText] = useState('')

  const handleSend = async () => {
    if (!text.trim()) return
    const success = await addComment(text.trim(), profile?.display_name ?? null)
    if (success) setText('')
  }

  const renderComment = ({ item }: { item: TaleComment }) => {
    const isOwn = item.device_id === deviceId
    return (
      <View style={s.commentRow}>
        <InitialsAvatar
          name={item.display_name}
          deviceId={item.device_id}
          size={32}
        />
        <View style={s.commentContent}>
          <View style={s.commentHeader}>
            <Text style={s.commentName}>
              {item.display_name ?? `User-${item.device_id.slice(-4).toUpperCase()}`}
            </Text>
            {isOwn && <Text style={s.youBadge}>You</Text>}
            <Text style={s.commentTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={s.commentText}>{item.content}</Text>
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalContainer}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={20} color={t.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={s.title}>Comments</Text>

          {/* Comments list */}
          {isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator size="small" color={c.amber500} />
            </View>
          ) : comments.length === 0 ? (
            <View style={s.centered}>
              <Text style={s.emptyText}>No comments yet. Be the first!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              style={s.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Input */}
          <View style={s.inputRow}>
            <InitialsAvatar
              name={profile?.display_name}
              deviceId={deviceId ?? undefined}
              size={32}
            />
            <TextInput
              value={text}
              onChangeText={(val) => setText(val.slice(0, 280))}
              placeholder="Add a comment..."
              placeholderTextColor={t.textSecondary}
              style={s.input}
              multiline
              maxLength={280}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={isPosting || !text.trim()}
              activeOpacity={0.7}
              style={[s.sendBtn, (!text.trim() || isPosting) && s.sendBtnDisabled]}
            >
              <Send size={18} color={c.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1 },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '70%',
      minHeight: 300,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    handleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 12,
      paddingHorizontal: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.border,
    },
    closeBtn: {
      position: 'absolute',
      right: 16,
      top: 12,
      padding: 4,
    },
    title: {
      fontSize: 16,
      fontFamily: font.bold,
      color: t.text,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 12,
    },
    list: { flex: 1, paddingHorizontal: 16 },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: { color: t.textSecondary, fontSize: 14 },
    commentRow: {
      flexDirection: 'row',
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    commentContent: { flex: 1, marginLeft: 10 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commentName: { fontFamily: font.semibold, fontSize: 13, color: t.text },
    youBadge: {
      fontSize: 10,
      fontFamily: font.semibold,
      color: c.amber500,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : c.amber50,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    commentTime: { fontSize: 11, color: t.textTertiary },
    commentText: { fontSize: 14, color: t.text, marginTop: 2, lineHeight: 20 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.border,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: t.text,
      backgroundColor: t.cardAlt,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 80,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: c.stone400 },
  })
}
