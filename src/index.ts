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

const getSuccessMessages = (firstName: string, isTest: boolean = false) => {
  const prefix = isTest ? "🧪 [Test Mode] " : "";
  const messages = [
    `${prefix}Swee lah! ${firstName} passed the human test. Welcome to the group!`,
    `${prefix}Wah, ${firstName} is definitely human. Can chat now!`,
    `${prefix}Steady pom pi pi! ${firstName} is verified. Say hi everyone!`,
    `${prefix}Confirm plus chop, ${firstName} is not a bot. Welcome!`,
    `${prefix}Power lah ${firstName}! Verification successful. Enjoy the chat.`,
    `${prefix}${firstName} passed! No bot can answer that. Welcome inside!`,
    `${prefix}Good job ${firstName}! You're verified. Welcome to our group!`,
    `${prefix}Huat ah! ${firstName} passed the test. Welcome!`,
    `${prefix}${firstName} is a real person! Verification complete.`,
    `${prefix}Solid! ${firstName} verified successfully. You can now chat!`,
    `${prefix}Welcome ${firstName}! You passed the bot check with flying colors.`,
    `${prefix}Aiyoh so smart, ${firstName} passed! Welcome to the group!`,
    `${prefix}${firstName} is in! Human verification cleared.`,
    `${prefix}Swee lah! ${firstName} is verified. Let the chatting begin!`,
    `${prefix}Done and dusted! ${firstName} is verified. Welcome aboard!`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

const getWelcomeMessages = (member: any, isTest: boolean = false) => {
  const name = `[${member.first_name}](tg://user?id=${member.id})`;
  const prefix = isTest ? "🧪 [Test Mode] " : "";
  const messages = [
    `${prefix}Welcome ${name}! Please tap the button below to prove you are human before you can chat.`,
    `${prefix}${name} just joined! Quickly press the button below to confirm you are not a bot.`,
    `${prefix}Hello ${name}! You want to chat? Must verify first! Just tap the Verify to Chat button below.`,
    `${prefix}${name} is here! Please press the button below to show you're a real person. Thanks!`,
    `${prefix}Awesome, ${name} joined! Before you start talking, please do the human test below.`,
    `${prefix}Welcome to the group ${name}! Click the button below to verify yourself, otherwise you cannot talk.`,
    `${prefix}Hi ${name}, welcome! Tap the button below to confirm you're human before chatting.`,
    `${prefix}Hey ${name}! Just a quick human check, press the button below to start chatting.`,
    `${prefix}Welcome aboard, ${name}! Please hit the Verify to Chat button below to verify your identity.`,
    `${prefix}${name} arrived! Don't forget to verify yourself by tapping the button below so you can send messages.`,
    `${prefix}Glad to have you here, ${name}! Please clear the human check below to unlock the chat.`,
    `${prefix}Greetings ${name}! Just one more step, press the button below to verify you're a real person.`,
    `${prefix}Hello there, ${name}! We need a quick human check, please tap the button below.`,
    `${prefix}Welcome ${name}! Verify yourself with the button below and jump right into the conversation.`,
    `${prefix}Look who's here, it's ${name}! Please press the button below to prove you're not a robot.`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") return new Response("OK", { status: 200, headers: corsHeaders });

    const url = new URL(request.url);

    // 1. Handle Verification Request from React Frontend
    if (url.pathname === '/verify' || url.pathname === '/api/verify') {
      try {
        const body = await request.json() as any;
        console.log("Verify Request Body:", JSON.stringify(body));
        const initData = body.initData;
        const bodyChatId = body.chatId;
        
        if (!initData) {
          console.log("Failing: Missing initData");
          return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const data = await verifyTelegramWebAppData(initData, env.BOT_TOKEN);
        
        if (!data || !data.user) {
          console.log("Failing: Invalid initData signature. data=", JSON.stringify(data));
          return new Response(JSON.stringify({ error: "Invalid initData signature" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const userId = data.user.id;
        const chatId = (data.chat ? data.chat.id : null) || bodyChatId; 
        
        if (!chatId) {
          console.log("Failing: Missing chat context");
          return new Response(JSON.stringify({ error: "Missing chat context" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

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

        if (body.messageId) {
          const successText = getSuccessMessages(data.user.first_name, false);
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: body.messageId,
              text: successText,
              parse_mode: "Markdown"
            })
          });
        }

        return new Response(JSON.stringify({ success: true, message: "User verified and unmuted" }), { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        });

      } catch (error) {
        console.error("Verification Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
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

          const welcomeText = getWelcomeMessages(member, false);
          
          const welcomeRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeText,
              parse_mode: "Markdown"
            })
          });

          const welcomeData = await welcomeRes.json() as any;
          if (welcomeData.ok) {
            const messageId = welcomeData.result.message_id;
            await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageReplyMarkup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [[
                    {
                      text: "Verify to Chat ✅",
                      web_app: { url: `https://confirm-plus-chop-ui.pages.dev?chatId=${chatId}&targetUserId=${member.id}&groupName=${encodeURIComponent(update.message.chat.title || 'Private Chat')}&messageId=${messageId}` } 
                    }
                  ]]
                }
              })
            });
          }
        }
      } else if (update.message && typeof update.message.text === 'string' && update.message.text.startsWith('/test')) {
        const chatId = update.message.chat.id;
        const member = update.message.from;
        
        const testText = getWelcomeMessages(member, true);
        
        const testRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: testText,
            parse_mode: "Markdown"
          })
        });

        const testData = await testRes.json() as any;
        if (testData.ok) {
          const messageId = testData.result.message_id;
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: "Verify to Chat ✅",
                    web_app: { url: `https://confirm-plus-chop-ui.pages.dev?chatId=${chatId}&targetUserId=${member.id}&groupName=${encodeURIComponent(update.message.chat.title || 'Private Chat')}&messageId=${messageId}` } 
                  }
                ]]
              }
            })
          });
        }
      }
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Worker Error:", error);
      return new Response("OK", { status: 200 });
    }
  }
};