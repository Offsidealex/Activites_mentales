import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

const allowedClasses = new Set(["3PM", "2TNE1", "2TNE2", "2TNE3", "2REMI1", "2REMI2", "1CAP"]);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function validPseudo(value: unknown): value is string {
  return typeof value === "string" && /^[\p{L}\p{N}_.-]{3,30}$/u.test(value.trim());
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

async function classAndEleve(pseudo: string, classeCode: string) {
  const { data: classe, error: classError } = await admin.from("classes").select("id,code").eq("code", classeCode).maybeSingle();
  if (classError || !classe) throw new Error("Classe introuvable.");
  const { data: eleve, error: eleveError } = await admin.from("eleves").select("id,prenom,classe_id,auth_user_id").ilike("prenom", pseudo).eq("classe_id", classe.id).maybeSingle();
  if (eleveError) throw eleveError;
  return { classe, eleve };
}

async function sessionForUser(email: string, password: string) {
  const auth = createClient(supabaseUrl, anonKey);
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("Pseudo ou mot de passe incorrect.");
  return data.session;
}

async function authenticateTeacher(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentification professeur requise.");
  const auth = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Session professeur invalide.");
  const { data: teacher } = await admin.from("enseignants").select("auth_user_id").eq("auth_user_id", userData.user.id).maybeSingle();
  if (!teacher) throw new Error("Accès professeur refusé.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "register" || action === "login") {
      const pseudo = String(body.pseudo || "").trim();
      const classeCode = String(body.classe || "").trim().toUpperCase();
      const password = body.password;
      if (!validPseudo(pseudo) || !allowedClasses.has(classeCode) || !validPassword(password)) {
        return json({ error: "Informations de connexion invalides." }, 400);
      }

      const { classe, eleve } = await classAndEleve(pseudo, classeCode);
      let account = eleve;

      if (action === "register") {
        if (eleve?.auth_user_id) return json({ error: "Ce pseudo existe déjà dans cette classe. Connecte-toi." }, 409);
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: `${crypto.randomUUID()}@eleve.activites-mentales.invalid`,
          password,
          email_confirm: true,
          user_metadata: { pseudo, classe: classeCode }
        });
        if (createError || !created.user) throw createError || new Error("Création du compte impossible.");

        if (eleve) {
          const { data, error } = await admin.from("eleves").update({ auth_user_id: created.user.id }).eq("id", eleve.id).select("id,prenom,classe_id,auth_user_id").single();
          if (error) throw error;
          account = data;
        } else {
          const { data, error } = await admin.from("eleves").insert({ prenom: pseudo, classe_id: classe.id, auth_user_id: created.user.id }).select("id,prenom,classe_id,auth_user_id").single();
          if (error) throw error;
          account = data;
        }
      }

      if (!account?.auth_user_id) return json({ error: "Compte introuvable. Crée un compte." }, 404);
      const { data: user, error: userError } = await admin.auth.admin.getUserById(account.auth_user_id);
      if (userError || !user.user?.email) throw userError || new Error("Compte incomplet.");
      const session = await sessionForUser(user.user.email, password);
      return json({ session, eleve: { id: account.id, prenom: account.prenom, classe: classeCode } });
    }

    if (action === "reset-password") {
      await authenticateTeacher(request);
      const eleveId = String(body.eleveId || "");
      if (!eleveId || !validPassword(body.password)) return json({ error: "Nouveau mot de passe invalide." }, 400);
      const { data: eleve, error } = await admin.from("eleves").select("auth_user_id").eq("id", eleveId).maybeSingle();
      if (error || !eleve?.auth_user_id) return json({ error: "Compte élève introuvable." }, 404);
      const { error: updateError } = await admin.auth.admin.updateUserById(eleve.auth_user_id, { password: body.password });
      if (updateError) throw updateError;
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Une erreur est survenue." }, 500);
  }
});
