const fs = require('fs');
const dtsPath = '/Users/macbook/Desktop/flexhubs/src/renderer/electron.d.ts';
let dts = fs.readFileSync(dtsPath, 'utf8');
if (!dts.includes('removeMessageReaction')) {
  dts = dts.replace(
    /addMessageReaction:\s*\([\s\S]*?\)\s*=>\s*Promise<ApiResult<import\('\.\.\/shared\/messages'\)\.MessageItem>>;/g,
    `$&
      removeMessageReaction: (
        token: string,
        conversationId: string,
        messageId: string,
        emoji: string
      ) => Promise<ApiResult<import('../shared/messages').MessageItem>>;`
  );
  fs.writeFileSync(dtsPath, dts);
}

const apiPath = '/Users/macbook/Desktop/flexhubs/src/renderer/chatApi.ts';
let api = fs.readFileSync(apiPath, 'utf8');
if (!api.includes('removeMessageReaction')) {
  api = api.replace(
    /export async function addMessageReaction\([\s\S]*?\}\n/g,
    `$&
export async function removeMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ApiResult<import('../shared/messages').MessageItem>> {
  if (!window.electronAPI?.removeMessageReaction) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.removeMessageReaction(token, conversationId, messageId, emoji),
  );
}
`
  );
  fs.writeFileSync(apiPath, api);
}
