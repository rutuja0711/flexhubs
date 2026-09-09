import { extractTypingUpdate } from './src/shared/realtime';

const payload = { userId: "user123", conversationId: "conv123", isTyping: true, username: "Bob" };
const res = extractTypingUpdate(payload, "conv123");
console.log(res);
