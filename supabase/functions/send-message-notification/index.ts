// supabase/functions/send-message-notification/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use esm.sh version of web-push which is more compatible with Deno Deploy/Edge Functions
import webpush from "https://esm.sh/web-push@3.6.7";

// Fix: Add Deno type declaration for Supabase edge function environment.
declare const Deno: any;

// Manually define the PushSubscription type as it's a standard interface
// This avoids type import issues from the web-push module in Deno.
interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    media_url?: string;
    media_type?: string;
  };
}

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();
    const message = payload.record;

    // Create a Supabase client with the service_role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find the recipient
    const { data: recipientData, error: recipientError } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .neq("user_id", message.sender_id)
      .single();

    if (recipientError || !recipientData) {
      console.error("Error finding recipient:", recipientError?.message || "Recipient not found");
      return new Response(JSON.stringify({ error: "Recipient not found" }), { status: 404 });
    }
    const recipientId = recipientData.user_id;

    // 2. Get recipient's push subscription
    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", recipientId);
      
    if (subscriptionError) throw subscriptionError;
    if (!subscriptionData || subscriptionData.length === 0) {
      console.log(`No push subscription found for user ${recipientId}.`);
      return new Response(JSON.stringify({ message: "No subscription to send to." }), { status: 200 });
    }

    // 3. Get sender's profile
    const { data: senderProfile, error: senderError } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", message.sender_id)
      .single();
      
    if (senderError) throw senderError;
    const senderName = senderProfile?.full_name || "Quelqu'un";
    
    // 4. Prepare and send notifications
    let body = message.content;
    if (!body) {
        if (message.media_type?.startsWith('image/')) {
            body = '📷 Image';
        } else if (message.media_url) {
            body = '📎 Fichier joint';
        } else {
            body = 'Nouveau message';
        }
    }

    const notificationPayload = JSON.stringify({
      title: `Nouveau message de ${senderName}`,
      body: body,
      url: `/chat/${message.conversation_id}`,
    });

    const vapidKeys = {
      publicKey: VAPID_PUBLIC_KEY!,
      privateKey: VAPID_PRIVATE_KEY!,
    };

    for (const sub of subscriptionData) {
      try {
        await webpush.sendNotification(sub.subscription as PushSubscription, notificationPayload, {
           vapidDetails: {
              subject: 'mailto:ruzubadekens@gmail.com', // Replace with your contact email
              ...vapidKeys,
           },
           ttl: 60 * 60 * 24 // 1 day
        });
      } catch (pushError) {
        console.error(`Error sending push notification for user ${recipientId}:`, pushError);
        // If subscription is expired or invalid (e.g., 410 Gone), delete it
        if (pushError.statusCode === 410) {
            console.log(`Subscription for user ${recipientId} is expired. Deleting.`);
            await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('user_id', recipientId)
                .match({ subscription: sub.subscription });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});