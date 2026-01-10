
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

serve(async (req) => {
  console.log("--- NOUVELLE REQUÊTE WEBHOOK ---");
  
  try {
    const payload = await req.json();
    const message = payload.record;
    
    if (!message) {
      console.error("Payload vide ou invalide");
      return new Response("Invalid payload", { status: 400 });
    }

    console.log("Message reçu ID:", message.id);
    console.log("Conversation ID:", message.conversation_id);
    console.log("Expéditeur ID:", message.sender_id);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Chercher le destinataire (celui qui n'est pas l'expéditeur)
    const { data: recipientData, error: recError } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .neq("user_id", message.sender_id)
      .single();

    if (recError || !recipientData) {
      console.error("Destinataire non trouvé dans la conversation:", recError?.message);
      return new Response("No recipient found", { status: 200 });
    }
    console.log("Destinataire identifié:", recipientData.user_id);

    // 2. Chercher l'abonnement push du destinataire
    const { data: subData, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", recipientData.user_id)
      .single();

    if (subError || !subData) {
      console.error("AUCUN ABONNEMENT trouvé en base pour l'utilisateur:", recipientData.user_id);
      return new Response("No push subscription in DB", { status: 200 });
    }
    console.log("Abonnement push récupéré avec succès.");

    // 3. Configuration VAPID
    const pubKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!pubKey || !privKey) {
      console.error("CLÉS VAPID MANQUANTES DANS LES SECRETS SUPABASE");
      return new Response("Missing VAPID keys", { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:ruzubadekens@gmail.com',
      pubKey,
      privKey
    );

    // 4. Envoi de la notification
    console.log("Tentative d'envoi vers les serveurs Push...");
    try {
      await webpush.sendNotification(
        subData.subscription,
        JSON.stringify({
          title: "Nouveau message",
          body: message.content || "Fichier joint",
          url: `/chat/${message.conversation_id}`
        })
      );
      console.log("✅ NOTIFICATION ENVOYÉE AVEC SUCCÈS");
    } catch (pushErr) {
      console.error("Erreur lors de l'envoi push (Serveur distant):", pushErr.message);
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        console.log("Abonnement expiré, suppression de la base...");
        await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", recipientData.user_id);
      }
    }
    
    return new Response("Process completed", { status: 200 });

  } catch (error) {
    console.error("❌ ERREUR CRITIQUE DANS LA FONCTION:", error.message);
    return new Response(error.message, { status: 500 });
  }
});
