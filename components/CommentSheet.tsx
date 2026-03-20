import { useState, useCallback } from 'react'
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
import { X, Send, CornerDownRight } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useComments } from '@/lib/hooks/useComments'
import { useApp } from '@/lib/contexts/AppContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import { timeAgo } from '@/lib/utils/time'
import type { TaleComment } from '@/lib/types'

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
  const {
    comments, repliesMap, isLoading, isPosting,
    loadingReplies, addComment, loadReplies,
  } = useComments(postId, deviceId)

  const [text, setText] = useState('')
  const [replyTarget, setReplyTarget] = useState<TaleComment | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())

  const handleSend = async () => {
    if (!text.trim()) return
    const success = await addComment(
      text.trim(),
      profile?.display_name ?? null,
      replyTarget?.id ?? null
    )
    if (success) {
      setText('')
      // Auto-expand replies for the parent we just replied to
      if (replyTarget) {
        setExpandedReplies((prev) => new Set(prev).add(replyTarget.id))
      }
      setReplyTarget(null)
    }
  }

  const handleReply = useCallback((comment: TaleComment) => {
    setReplyTarget(comment)
  }, [])

  const toggleReplies = useCallback((commentId: string, replyCount: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
        // Fetch replies if not already loaded
        if (!repliesMap.has(commentId) && replyCount > 0) {
          loadReplies(commentId)
        }
      }
      return next
    })
  }, [repliesMap, loadReplies])

  const renderComment = ({ item }: { item: TaleComment }) => {
    const isOwn = item.device_id === deviceId
    const isExpanded = expandedReplies.has(item.id)
    const replies = repliesMap.get(item.id) || []
    const isLoadingReplies = loadingReplies.has(item.id)

    return (
      <View>
        {/* Parent comment */}
        <CommentRow
          comment={item}
          isOwn={isOwn}
          onReply={() => handleReply(item)}
          styles={s}
        />

        {/* Reply count toggle */}
        {item.reply_count > 0 && (
          <TouchableOpacity
            onPress={() => toggleReplies(item.id, item.reply_count)}
            style={s.repliesToggle}
            activeOpacity={0.7}
          >
            <CornerDownRight size={14} color={c.amber500} />
            <Text style={s.repliesToggleText}>
              {isExpanded ? 'Hide' : 'View'} {item.reply_count} repl{item.reply_count === 1 ? 'y' : 'ies'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Expanded replies */}
        {isExpanded && (
          <View style={s.repliesContainer}>
            {isLoadingReplies ? (
              <ActivityIndicator size="small" color={c.amber500} style={{ paddingVertical: 8 }} />
            ) : (
              replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isOwn={reply.device_id === deviceId}
                  styles={s}
                  isReply
                />
              ))
            )}
          </View>
        )}
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

          {/* Reply indicator */}
          {replyTarget && (
            <View style={s.replyIndicator}>
              <Text style={s.replyIndicatorText} numberOfLines={1}>
                Replying to{' '}
                <Text style={s.replyIndicatorName}>
                  {replyTarget.display_name ?? `User-${replyTarget.device_id.slice(-4).toUpperCase()}`}
                </Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)} hitSlop={8}>
                <X size={16} color={t.textSecondary} />
              </TouchableOpacity>
            </View>
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
              placeholder={replyTarget ? 'Write a reply...' : 'Add a comment...'}
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

function CommentRow({
  comment,
  isOwn,
  onReply,
  styles: s,
  isReply,
}: {
  comment: TaleComment
  isOwn: boolean
  isDark?: boolean
  onReply?: () => void
  styles: ReturnType<typeof getStyles>
  themed?: ReturnType<typeof themed>
  isReply?: boolean
}) {
  return (
    <View style={[s.commentRow, isReply && s.replyRow]}>
      <InitialsAvatar
        name={comment.display_name}
        deviceId={comment.device_id}
        size={isReply ? 26 : 32}
      />
      <View style={s.commentContent}>
        <View style={s.commentHeader}>
          <Text style={[s.commentName, isReply && s.commentNameSmall]}>
            {comment.display_name ?? `User-${comment.device_id.slice(-4).toUpperCase()}`}
          </Text>
          {isOwn && <Text style={s.youBadge}>You</Text>}
          <Text style={s.commentTime}>{timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={[s.commentText, isReply && s.commentTextSmall]}>{comment.content}</Text>
        {onReply && !isReply && (
          <TouchableOpacity onPress={onReply} activeOpacity={0.7} style={s.replyBtn}>
            <Text style={s.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
      maxHeight: '75%',
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

    // Comment rows
    commentRow: {
      flexDirection: 'row',
      marginBottom: 14,
      alignItems: 'flex-start',
    },
    replyRow: {
      marginBottom: 10,
      marginLeft: 8,
    },
    commentContent: { flex: 1, marginLeft: 10 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commentName: { fontFamily: font.semibold, fontSize: 13, color: t.text },
    commentNameSmall: { fontSize: 12 },
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
    commentTextSmall: { fontSize: 13, lineHeight: 18 },

    // Reply button
    replyBtn: { marginTop: 4 },
    replyBtnText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.textTertiary,
    },

    // Replies toggle
    repliesToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 42,
      marginBottom: 10,
    },
    repliesToggleText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // Replies container
    repliesContainer: {
      marginLeft: 42,
      borderLeftWidth: 2,
      borderLeftColor: isDark ? 'rgba(245,158,11,0.2)' : c.amber100,
      paddingLeft: 12,
      marginBottom: 6,
    },

    // Reply indicator
    replyIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : c.amber50,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    replyIndicatorText: { fontSize: 13, color: t.textSecondary },
    replyIndicatorName: { fontFamily: font.semibold, color: c.amber500 },

    // Input
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
