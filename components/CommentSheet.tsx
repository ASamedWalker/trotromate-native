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
import { X } from 'lucide-react-native'
import { font, themed } from '@/lib/theme'
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
  const isDark = useColorScheme() === 'dark'
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
        <CommentRow
          comment={item}
          isOwn={isOwn}
          onReply={() => handleReply(item)}
          styles={s}
        />

        {item.reply_count > 0 && (
          <TouchableOpacity
            onPress={() => toggleReplies(item.id, item.reply_count)}
            style={s.repliesToggle}
            activeOpacity={0.7}
          >
            <View style={s.repliesLine} />
            <Text style={s.repliesToggleText}>
              {isExpanded ? 'Hide' : 'View'} {item.reply_count} repl{item.reply_count === 1 ? 'y' : 'ies'}
            </Text>
          </TouchableOpacity>
        )}

        {isExpanded && (
          <View style={s.repliesContainer}>
            {isLoadingReplies ? (
              <ActivityIndicator size="small" color="#0095f6" style={{ paddingVertical: 8 }} />
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
          {/* Handle + title */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          <View style={s.titleRow}>
            <Text style={s.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
              <X size={20} color={isDark ? 'rgba(255,255,255,0.5)' : '#8e8e8e'} />
            </TouchableOpacity>
          </View>

          <View style={s.titleDivider} />

          {/* Comments list */}
          {isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator size="small" color="#0095f6" />
            </View>
          ) : comments.length === 0 ? (
            <View style={s.centered}>
              <Text style={s.emptyTitle}>No comments yet</Text>
              <Text style={s.emptyText}>Start the conversation.</Text>
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
                <X size={14} color={isDark ? 'rgba(255,255,255,0.4)' : '#8e8e8e'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input row */}
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
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#8e8e8e'}
              style={s.input}
              multiline
              maxLength={280}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={isPosting || !text.trim()}
              activeOpacity={0.7}
            >
              <Text style={[s.postBtn, (!text.trim() || isPosting) && s.postBtnDisabled]}>
                Post
              </Text>
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
  onReply?: () => void
  styles: ReturnType<typeof getStyles>
  isReply?: boolean
}) {
  return (
    <View style={[s.commentRow, isReply && s.replyRow]}>
      <InitialsAvatar
        name={comment.display_name}
        deviceId={comment.device_id}
        size={isReply ? 28 : 34}
      />
      <View style={s.commentContent}>
        <Text style={s.commentText}>
          <Text style={[s.commentName, isReply && s.commentNameSmall]}>
            {comment.display_name ?? `User-${comment.device_id.slice(-4).toUpperCase()}`}
          </Text>
          {isOwn && <Text style={s.youBadge}> You</Text>}
          {'  '}
          <Text style={isReply ? s.commentBodySmall : s.commentBody}>
            {comment.content}
          </Text>
        </Text>
        <View style={s.commentMeta}>
          <Text style={s.commentTime}>{timeAgo(comment.created_at)}</Text>
          {onReply && !isReply && (
            <TouchableOpacity onPress={onReply} activeOpacity={0.7}>
              <Text style={s.replyBtnText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const surface = themed(isDark).sheetBg
  const onSurface = isDark ? '#f5f5f4' : '#262626'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.45)' : '#8e8e8e'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5'

  return StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1 },
    sheet: {
      backgroundColor: surface,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      maxHeight: '70%',
      minHeight: 300,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    title: {
      fontSize: 15,
      fontFamily: font.bold,
      color: onSurface,
      textAlign: 'center',
    },
    closeBtn: {
      position: 'absolute',
      right: 16,
      padding: 4,
    },
    titleDivider: {
      height: 0.5,
      backgroundColor: divider,
    },
    list: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: font.bold,
      color: onSurface,
      marginBottom: 4,
    },
    emptyText: { color: onSurfaceVariant, fontSize: 14 },

    // Comment rows
    commentRow: {
      flexDirection: 'row',
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    replyRow: {
      marginBottom: 12,
      marginLeft: 12,
    },
    commentContent: { flex: 1, marginLeft: 12 },
    commentText: {
      fontSize: 14,
      color: onSurface,
      lineHeight: 20,
    },
    commentName: { fontFamily: font.bold, fontSize: 13 },
    commentNameSmall: { fontSize: 12 },
    commentBody: { fontFamily: font.regular },
    commentBodySmall: { fontFamily: font.regular, fontSize: 13 },
    youBadge: {
      fontSize: 10,
      fontFamily: font.semibold,
      color: '#0095f6',
    },
    commentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    commentTime: { fontSize: 12, color: onSurfaceVariant },

    // Reply button
    replyBtnText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: onSurfaceVariant,
    },

    // Replies toggle
    repliesToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 58,
      marginBottom: 12,
    },
    repliesLine: {
      width: 24,
      height: 0.5,
      backgroundColor: onSurfaceVariant,
    },
    repliesToggleText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: onSurfaceVariant,
    },

    // Replies container
    repliesContainer: {
      marginLeft: 46,
      marginBottom: 6,
    },

    // Reply indicator
    replyIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
      borderTopWidth: 0.5,
      borderTopColor: divider,
    },
    replyIndicatorText: { fontSize: 13, color: onSurfaceVariant },
    replyIndicatorName: { fontFamily: font.bold, color: onSurface },

    // Input
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: divider,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurface,
      backgroundColor: inputBg,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      maxHeight: 80,
    },
    postBtn: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#0095f6',
    },
    postBtnDisabled: {
      color: isDark ? 'rgba(0,149,246,0.3)' : 'rgba(0,149,246,0.4)',
    },
  })
}
