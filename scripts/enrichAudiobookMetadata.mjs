import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  resolveAudiobookMetadata,
  shouldReplaceExistingMetadata,
} from "../lib/audiobookMetadata.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadLocalEnv() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getSupabaseClient() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function enrichAudiobooks() {
  const supabase = getSupabaseClient();
  const { data: audiobooks, error } = await supabase
    .from("audiobooks")
    .select("id, title, author, cover_url, cover_source, description, audio_url, embedded_cover_url, embedded_artwork_url, artwork_url");

  if (error) {
    throw error;
  }

  for (const audiobook of audiobooks || []) {
    if (!audiobook?.title || !audiobook?.author) {
      continue;
    }

    const enrichment = await resolveAudiobookMetadata(audiobook);
    if (!enrichment) {
      console.log(`Skipped ${audiobook.title}: no suitable metadata match.`);
      continue;
    }

    if (!shouldReplaceExistingMetadata(audiobook.cover_source, enrichment.coverSource)) {
      console.log(
        `Preserved existing Japanese cover for ${audiobook.title}; skipped ${enrichment.coverSource}.`,
      );
      continue;
    }

    const updatePayload = {
      cover_url: enrichment.coverUrl,
      cover_source: enrichment.coverSource,
    };

    if (enrichment.description && !audiobook.description) {
      updatePayload.description = enrichment.description;
    }

    const { error: updateError } = await supabase
      .from("audiobooks")
      .update(updatePayload)
      .eq("id", audiobook.id);

    if (updateError) {
      console.error(`Failed to update ${audiobook.title}:`, updateError.message);
      continue;
    }

    console.log(`Updated ${audiobook.title} with ${enrichment.coverSource}.`);
  }
}

enrichAudiobooks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
