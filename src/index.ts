export interface Env {
  BOT_TOKEN: string;
}

// Cryptographically verify the initData against the bot token
async function verifyTelegramWebAppData(initData: string, botToken: string): Promise<{ user: any, chat: any } | null> {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return null;
  
  urlParams.delete('hash');
  
  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');
  
  const encoder = new TextEncoder();
  
  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const secretKeyBuffer = await crypto.subtle.sign(
    'HMAC',
    webAppDataKey,
    encoder.encode(botToken)
  );
  
  const dataKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    dataKey,
    encoder.encode(dataCheckString)
  );
  
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  if (signatureHex === hash) {
    const userStr = urlParams.get('user');
    const chatStr = urlParams.get('chat');
    return {
      user: userStr ? JSON.parse(userStr) : null,
      chat: chatStr ? JSON.parse(chatStr) : null,
    };
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    const url = new URL(request.url);

    // 1. Handle Verification Request from React Frontend
    if (url.pathname === '/verify' || url.pathname === '/api/verify') {
      try {
        const body = await request.json() as any;
        const initData = body.initData;
        
        if (!initData) {
          return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        
        const data = await verifyTelegramWebAppData(initData, env.BOT_TOKEN);
        
        if (!data || !data.user) {
          return new Response(JSON.stringify({ error: "Invalid initData signature" }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        
        const userId = data.user.id;
        // In some Telegram Mini App flows, chat info might be in the query, or we rely on a known chat ID.
        // Assuming 'chat' is part of initData when opened from an inline button in the group.
        const chatId = data.chat ? data.chat.id : null; 
        
        if (!chatId) {
          console.warn("Could not determine chatId from initData.");
          // If chatId isn't available, you would need to pass it from frontend or store it.
          // For now, we'll return an error if it's missing, though we might need to handle it differently if your app uses a single group.
          return new Response(JSON.stringify({ error: "Missing chat context" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // Unmute the user
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/restrictChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: userId,
            permissions: {
              can_send_messages: true,
              can_send_media_messages: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true
            }
          })
        });

        return new Response(JSON.stringify({ success: true, message: "User verified and unmuted" }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" } 
        });

      } catch (error) {
        console.error("Verification Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // 2. Handle Telegram Webhook Updates
    try {
      const update = await request.json() as any;

      // Check if this update is someone joining the group
      if (update.message && update.message.new_chat_members) {
        const chatId = update.message.chat.id;
        const newMembers = update.message.new_chat_members;

        for (const member of newMembers) {
          // Skip if the new member is a bot
          if (member.is_bot) continue;

          // Mute the user via restrictChatMember
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/restrictChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              user_id: member.id,
              permissions: {
                can_send_messages: false, // Muted!
                can_send_media_messages: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false
              }
            })
          });

          // Send the Welcome Message with the Mini App button
          const welcomeText = `Welcome [${member.first_name}](tg://user?id=${member.id})! \n\nPlease tap the button below to prove you are human before you can chat.`;
          
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeText,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: "Confirm Plus Chop! 🛑",
                    // We will replace this placeholder URL with your React Mini App later!
                    web_app: { url: "https://confirm-plus-chop-ui.pages.dev" } 
                  }
                ]]
              }
            })
          });
        }
      } else if (update.message && typeof update.message.text === 'string' && update.message.text.startsWith('/test')) {
        const chatId = update.message.chat.id;
        const member = update.message.from;
        
        const testText = `Test mode, [${member.first_name}](tg://user?id=${member.id})! \n\nTap the button below to open the mini app.`;
        
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: testText,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "Confirm Plus Chop! 🛑",
                  web_app: { url: "https://confirm-plus-chop-ui.pages.dev" } 
                }
              ]]
            }
          })
        });
      }
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Worker Error:", error);
      return new Response("OK", { status: 200 });
    }
  }
};