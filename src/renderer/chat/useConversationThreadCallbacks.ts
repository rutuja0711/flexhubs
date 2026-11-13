import { useCallback, type MutableRefObject } from 'react';
import type { GifPickerItem } from '../../shared/gifs';
import type { ConversationScrollSnapshot } from '../conversationScrollCache';

export type ConversationThreadActions = {
  handleSendMessage: (replyToMessageId?: string) => void;
  handleRetryMessage: (messageId: string) => void;
  handleSendMedia: (
    item: GifPickerItem,
    kind: 'gif' | 'sticker',
    replyToId?: string,
    threadRootId?: string,
  ) => void;
  handleSendFile: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  handleSendVoice: (file: File, caption?: string, replyToId?: string, threadRootId?: string) => void;
  handleAddReaction: (messageId: string, emoji: string, options?: { remove?: boolean }) => void;
  handleEditMessage: (messageId: string, content: string) => void | Promise<boolean>;
  handleDeleteMessage: (messageId: string, scope: 'me' | 'everyone') => void;
  handleForwardMessage: (
    messageId: string,
    targetConversationIds: string[],
  ) => Promise<string | null>;
  handlePinMessage: (messageId: string, isPinned: boolean) => void;
  handleSaveMessage: (messageId: string) => void;
  handleUnsaveMessage: (messageId: string) => void;
  handleVotePoll: (messageId: string, optionId: string) => void;
  handleDraftChange: (value: string) => void;
  handleComposerBlur: () => void;
  handleDraftReplyToIdChange: (replyToId: string | null) => void;
  handleUnauthorized: (status?: number) => boolean;
  refreshConversations: () => void;
  loadThread: (conversationId: string) => void;
  applyConversationSnoozed: (conversationId: string, snoozed: boolean) => void;
  handleToggleConversationPin: (conversationId: string, isPinned: boolean) => void;
  loadCalendarData: () => void;
  openCalendarFromChat: (eventId: string) => void;
  setSelectedId: (id: string | null) => void;
  setMainView: (view: import('../../shared/nav').MainView) => void;
  setFlexAiOpen: (updater: (current: boolean) => boolean) => void;
  loadOlderMessages: () => boolean;
  setFocusMessageId: (id: string | null) => void;
  bumpThreadReplyCount: (messages: import('../../shared/messages').MessageItem[], threadRootId: string) => import('../../shared/messages').MessageItem[];
  filterMainChatMessages: (
    messages: import('../../shared/messages').MessageItem[],
  ) => import('../../shared/messages').MessageItem[];
  handleSummarizeUnread: () => void;
  refreshBlockedUserIds: () => void;
  refreshPresenceForPeer: (peerUserId: string) => void;
  handleOpenDirectChat: (userId: string, options?: { displayName?: string }) => void;
  handleHubMemberDirectCall: (
    userId: string,
    displayName: string,
    video: boolean,
  ) => void;
  startDirectCall: (conversation: import('../../shared/chat').ConversationItem, video: boolean) => void;
  startGroupMeeting: (conversation: import('../../shared/chat').ConversationItem, video: boolean) => void;
  getSelectedConversation: () => import('../../shared/chat').ConversationItem | null;
  getSelectedConversationId: () => string | null;
  getDirectChatPeerUserId: (conversationId: string) => string | null;
  applyThreadReplySent: (threadRootId: string) => void;
  applyThreadMessagesRegistered: () => void;
  saveConversationScroll: (conversationId: string, snapshot: ConversationScrollSnapshot) => void;
  applyAfterConversationHistoryCleared: (conversationId: string) => void;
};

export function useConversationThreadCallbacks(
  actionsRef: MutableRefObject<ConversationThreadActions>,
) {
  const onSend = useCallback(
    (replyToMessageId?: string) => {
      void actionsRef.current.handleSendMessage(replyToMessageId);
    },
    [actionsRef],
  );

  const onRetryMessage = useCallback(
    (messageId: string) => {
      void actionsRef.current.handleRetryMessage(messageId);
    },
    [actionsRef],
  );

  const onSendMedia = useCallback(
    (
      item: GifPickerItem,
      kind: 'gif' | 'sticker',
      replyToId?: string,
      threadRootId?: string,
    ) => {
      void actionsRef.current.handleSendMedia(item, kind, replyToId, threadRootId);
    },
    [actionsRef],
  );

  const onSendFile = useCallback(
    (file: File, caption?: string, replyToId?: string, threadRootId?: string) => {
      void actionsRef.current.handleSendFile(file, caption, replyToId, threadRootId);
    },
    [actionsRef],
  );

  const onSendVoice = useCallback(
    (file: File, caption?: string, replyToId?: string, threadRootId?: string) => {
      void actionsRef.current.handleSendVoice(file, caption, replyToId, threadRootId);
    },
    [actionsRef],
  );

  const onAddReaction = useCallback(
    (messageId: string, emoji: string, options?: { remove?: boolean }) => {
      void actionsRef.current.handleAddReaction(messageId, emoji, options);
    },
    [actionsRef],
  );

  const onEditMessage = useCallback(
    (messageId: string, content: string) => {
      void actionsRef.current.handleEditMessage(messageId, content);
    },
    [actionsRef],
  );

  const onDeleteMessage = useCallback(
    (messageId: string, scope: 'me' | 'everyone') => {
      void actionsRef.current.handleDeleteMessage(messageId, scope);
    },
    [actionsRef],
  );

  const onForwardMessage = useCallback(
    (messageId: string, targetConversationIds: string[]) =>
      actionsRef.current.handleForwardMessage(messageId, targetConversationIds),
    [actionsRef],
  );

  const onPinMessage = useCallback(
    (messageId: string, isPinned: boolean) => {
      void actionsRef.current.handlePinMessage(messageId, isPinned);
    },
    [actionsRef],
  );

  const onSaveMessage = useCallback(
    (messageId: string) => {
      void actionsRef.current.handleSaveMessage(messageId);
    },
    [actionsRef],
  );

  const onUnsaveMessage = useCallback(
    (messageId: string) => {
      void actionsRef.current.handleUnsaveMessage(messageId);
    },
    [actionsRef],
  );

  const onVotePoll = useCallback(
    (messageId: string, optionId: string) => {
      void actionsRef.current.handleVotePoll(messageId, optionId);
    },
    [actionsRef],
  );

  const onDraftChange = useCallback(
    (value: string) => {
      actionsRef.current.handleDraftChange(value);
    },
    [actionsRef],
  );

  const onComposerBlur = useCallback(() => {
    actionsRef.current.handleComposerBlur();
  }, [actionsRef]);

  const onDraftReplyToIdChange = useCallback(
    (replyToId: string | null) => {
      actionsRef.current.handleDraftReplyToIdChange(replyToId);
    },
    [actionsRef],
  );

  const onConversationUpdated = useCallback(() => {
    const actions = actionsRef.current;
    void actions.refreshConversations();
    const selectedId = actions.getSelectedConversation()?.id;
    if (selectedId) {
      void actions.loadThread(selectedId);
    }
  }, [actionsRef]);

  const onHistoryCleared = useCallback(
    (conversationId: string) => {
      actionsRef.current.applyAfterConversationHistoryCleared(conversationId);
    },
    [actionsRef],
  );

  const onNotificationsSnoozedChange = useCallback(
    (snoozed: boolean) => {
      const conversationId = actionsRef.current.getSelectedConversation()?.id;
      if (conversationId) {
        actionsRef.current.applyConversationSnoozed(conversationId, snoozed);
      }
    },
    [actionsRef],
  );

  const onTogglePin = useCallback(
    (conversationId: string, isPinned: boolean) => {
      void actionsRef.current.handleToggleConversationPin(conversationId, isPinned);
    },
    [actionsRef],
  );

  const onOpenCalendar = useCallback(() => {
    actionsRef.current.setMainView('calendar');
    void actionsRef.current.loadCalendarData();
  }, [actionsRef]);

  const onOpenCalendarEvent = useCallback(
    (eventId: string) => {
      actionsRef.current.openCalendarFromChat(eventId);
    },
    [actionsRef],
  );

  const onHubDeleted = useCallback(() => {
    actionsRef.current.setSelectedId(null);
    void actionsRef.current.refreshConversations();
  }, [actionsRef]);

  const onLoadOlder = useCallback((): boolean => {
    return actionsRef.current.loadOlderMessages();
  }, [actionsRef]);

  const onFocusMessageHandled = useCallback(() => {
    actionsRef.current.setFocusMessageId(null);
  }, [actionsRef]);

  const onOpenFlexAi = useCallback(() => {
    actionsRef.current.setFlexAiOpen((current) => !current);
  }, [actionsRef]);

  const onThreadReplySent = useCallback(
    (threadRootId: string) => {
      actionsRef.current.applyThreadReplySent(threadRootId);
    },
    [actionsRef],
  );

  const onThreadMessagesRegistered = useCallback(() => {
    actionsRef.current.applyThreadMessagesRegistered();
  }, [actionsRef]);

  const onSummarizeUnread = useCallback(() => {
    actionsRef.current.handleSummarizeUnread();
  }, [actionsRef]);

  const onSaveScrollPosition = useCallback(
    (snapshot: ConversationScrollSnapshot) => {
      const conversationId = actionsRef.current.getSelectedConversationId();
      if (conversationId) {
        actionsRef.current.saveConversationScroll(conversationId, snapshot);
      }
    },
    [actionsRef],
  );

  const onRefreshPeerPresence = useCallback(
    (peerUserId: string) => {
      void actionsRef.current.refreshPresenceForPeer(peerUserId);
    },
    [actionsRef],
  );

  const onBlockedUsersChanged = useCallback(() => {
    void actionsRef.current.refreshBlockedUserIds();
  }, [actionsRef]);

  const onStartVoiceCall = useCallback(() => {
    const conversation = actionsRef.current.getSelectedConversation();
    if (!conversation) {
      return;
    }

    if (conversation.kind === 'hub') {
      void actionsRef.current.startGroupMeeting(conversation, false);
      return;
    }

    const peerUserId =
      conversation.peerUserId ??
      actionsRef.current.getDirectChatPeerUserId(conversation.id) ??
      null;

    void actionsRef.current.startDirectCall(
      peerUserId ? { ...conversation, peerUserId, kind: 'direct' as const } : conversation,
      false,
    );
  }, [actionsRef]);

  const onStartVideoCall = useCallback(() => {
    const conversation = actionsRef.current.getSelectedConversation();
    if (!conversation) {
      return;
    }

    if (conversation.kind === 'hub') {
      void actionsRef.current.startGroupMeeting(conversation, true);
      return;
    }

    const peerUserId =
      conversation.peerUserId ??
      actionsRef.current.getDirectChatPeerUserId(conversation.id) ??
      null;

    void actionsRef.current.startDirectCall(
      peerUserId ? { ...conversation, peerUserId, kind: 'direct' as const } : conversation,
      true,
    );
  }, [actionsRef]);

  const onMessageHubMember = useCallback(
    (userId: string, displayName: string) => {
      void actionsRef.current.handleOpenDirectChat(userId, { displayName });
    },
    [actionsRef],
  );

  const onVoiceCallHubMember = useCallback(
    (userId: string, displayName: string) => {
      void actionsRef.current.handleHubMemberDirectCall(userId, displayName, false);
    },
    [actionsRef],
  );

  const onVideoCallHubMember = useCallback(
    (userId: string, displayName: string) => {
      void actionsRef.current.handleHubMemberDirectCall(userId, displayName, true);
    },
    [actionsRef],
  );

  return {
    onSend,
    onRetryMessage,
    onSendMedia,
    onSendFile,
    onSendVoice,
    onAddReaction,
    onEditMessage,
    onDeleteMessage,
    onForwardMessage,
    onPinMessage,
    onSaveMessage,
    onUnsaveMessage,
    onVotePoll,
    onDraftChange,
    onComposerBlur,
    onDraftReplyToIdChange,
    onConversationUpdated,
    onHistoryCleared,
    onNotificationsSnoozedChange,
    onTogglePin,
    onOpenCalendar,
    onOpenCalendarEvent,
    onHubDeleted,
    onLoadOlder,
    onFocusMessageHandled,
    onOpenFlexAi,
    onThreadReplySent,
    onThreadMessagesRegistered,
    onSummarizeUnread,
    onSaveScrollPosition,
    onRefreshPeerPresence,
    onBlockedUsersChanged,
    onStartVoiceCall,
    onStartVideoCall,
    onMessageHubMember,
    onVoiceCallHubMember,
    onVideoCallHubMember,
  };
}
