// Fix: Declare Deno to satisfy the TypeScript compiler in environments without Deno types
declare const Deno: any;

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

serve(async (req) => {
  console.log("--- DÉBUT PROCESSUS NOTIFICATION ---");
  
  try {
    const payload = await req.json();
    const message = payload.record;
    
    if (!message) {
      console.error("Erreur: Payload vide");
      return new Response("Payload manquant", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Identifier le destinataire
    const { data: participantData, error: recError } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .neq("user_id", message.sender_id)
      .maybeSingle();

    if (recError || !participantData) {
      console.log("Info: Aucun destinataire distant trouvé.");
      return new Response("No recipient found", { status: 200 });
    }

    const recipientId = participantData.user_id;

    // 2. Récupérer l'abonnement
    const { data: subData, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", recipientId)
      .maybeSingle();

    if (subError || !subData) {
      console.log(`Info: Pas d'abonnement push pour ${recipientId}`);
      return new Response("No subscription", { status: 200 });
    }

    // 3. Configuration VAPID
    const pubKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!pubKey || !privKey) {
      console.error("CRITIQUE: Clés VAPID manquantes dans Supabase Secrets !");
      return new Response("VAPID keys missing", { status: 500 });
    }

    // Utilisation de la clé publique pour le logging (tronquée pour sécurité)
    console.log(`VAPID Public Key backend: ${pubKey.substring(0, 10)}...`);

    webpush.setVapidDetails(
      'mailto:ruzubadekens@gmail.com',
      pubKey,
      privKey
    );

    // 4. Envoi
    try {
      console.log("Tentative d'envoi via web-push...");
      await webpush.sendNotification(
        subData.subscription,
        JSON.stringify({
          title: "Nouveau message",
          body: message.content || "Vous avez reçu un média",
          url: `/chat/${message.conversation_id}`
        })
      );
      console.log("✅ Notification envoyée avec succès.");
      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error(`❌ Erreur Push Server: ${err.statusCode} - ${err.message}`);
      
      // Si 403 (Forbidden) ou 410 (Gone), l'abonnement est invalide
      if (err.statusCode === 403 || err.statusCode === 410 || err.statusCode === 404) {
        console.log(`Action: Suppression de l'abonnement invalide pour l'utilisateur ${recipientId}`);
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", recipientId);
        
        if (err.statusCode === 403) {
            console.log("Note: L'erreur 403 indique un mismatch de clés VAPID. L'utilisateur devra se réabonner.");
        }
      }
      
      return new Response(`Push processed with error: ${err.message}`, { status: 200 });
    }

  } catch (error) {
    console.error("❌ Erreur globale:", error.message);
    return new Response(error.message, { status: 500 });
  }
});
