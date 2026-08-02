// Supabase Edge Function: knowledge-ingest (v2)
// -----------------------------------------------------------------------------
// CI-5.2 · Knowledge Engine / RAG — document ingestion pipeline.
//
// Reads .md knowledge files from a private Storage bucket ('knowledge'),
// parses each into self-contained chunks, embeds them with OpenAI
// text-embedding-3-small (1536-dim), and upserts them into knowledge_corpus.
// File-level change detection (sha256) in knowledge_sources means re-runs only
// touch new or edited files. This is the SINGLE path for all knowledge — the
// curated seed and astrologers'/books' material all arrive as .md files here.
//
// AuthZ: x-admin-secret header must equal KNOWLEDGE_INGEST_SECRET (also used by
//        the scheduled cron job).
// Request:  POST { dry_run?, force?, only_path?, max_files?, prune? }
// Response: 200 { ok, files_seen, files_processed, files_skipped,
//                 chunks_upserted, chunks_deleted, remaining, done,
//                 dry_run, results, errors }

// @ts-ignore - esm.sh import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const BUCKET = "knowledge";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const EMBED_BATCH = 64; // OpenAI accepts arrays; keep batches modest
const DEFAULT_MAX_FILES = 10;

// Controlled category vocabulary. Anything else is coerced to 'general'.
const CATEGORY_VOCAB = [
  "graha",
  "rashi",
  "bhava",
  "nakshatra",
  "yoga",
  "dosha",
  "dasha",
  "transit",
  "aspect",
  "remedy",
  "panchanga",
  "muhurta",
  "general",
];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}
function err(status: number, code: string, message?: string): Response {
  return json(status, { error: { code, message: message ?? code } });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stripQuotes(s: string): string {
  const t = (s ?? "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseTags(v: string | undefined): string[] {
  if (!v) return [];
  let t = v.trim();
  if (t.startsWith("[") && t.endsWith("]")) t = t.slice(1, -1);
  return t
    .split(",")
    .map((x) => stripQuotes(x).trim())
    .filter((x) => x.length > 0);
}

function mergeTags(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

type FrontMatter = {
  source?: string;
  default_category?: string;
  default_tags?: string;
};

function splitFrontmatter(text: string): { fm: FrontMatter; body: string } {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { fm: {}, body: text };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (mm) fm[mm[1].trim().toLowerCase()] = stripQuotes(mm[2].trim());
  }
  return { fm: fm as FrontMatter, body: text.slice(m[0].length) };
}

type ParsedEntry = {
  category: string;
  title: string;
  source: string | null;
  tags: string[];
  content: string;
  chunk_index: number;
  external_id: string;
};

function parseEntries(
  body: string,
  fileName: string,
  fm: FrontMatter,
): ParsedEntry[] {
  const lines = body.split(/\r?\n/);
  const raw: Array<{
    title: string;
    meta: Record<string, string>;
    content: string;
  }> = [];
  let i = 0;
  while (i < lines.length) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!h) {
      i++;
      continue;
    }
    const title = h[1].trim();
    i++;
    const meta: Record<string, string> = {};
    while (i < lines.length) {
      const mm = lines[i].match(/^-\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
      if (!mm) break;
      meta[mm[1].toLowerCase()] = mm[2].trim();
      i++;
    }
    const contentLines: string[] = [];
    while (i < lines.length && !/^##\s+/.test(lines[i])) {
      contentLines.push(lines[i]);
      i++;
    }
    const content = contentLines.join("\n").trim();
    if (title && content) raw.push({ title, meta, content });
  }

  return raw.map((e, idx) => {
    let category = (e.meta.category || fm.default_category || "general")
      .toLowerCase()
      .trim();
    if (!CATEGORY_VOCAB.includes(category)) category = "general";
    const source = stripQuotes(e.meta.source || "") || fm.source || null;
    const tags = mergeTags(parseTags(e.meta.tags), parseTags(fm.default_tags));
    return {
      category,
      title: e.title,
      source: source && source.length > 0 ? source : null,
      tags,
      content: e.content,
      chunk_index: idx,
      external_id: `${fileName}#${String(idx).padStart(3, "0")}-${slugify(e.title)}`,
    };
  });
}

async function embedAll(apiKey: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: batch,
        dimensions: EMBED_DIM,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${t.slice(0, 300)}`);
    }
    const jr = await resp.json();
    for (const d of jr.data) out[i + d.index] = d.embedding as number[];
  }
  return out;
}

type FileEntry = { path: string; name: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err(405, "method_not_allowed", "Only POST is supported");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_SECRET = Deno.env.get("KNOWLEDGE_INGEST_SECRET");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return err(500, "server_misconfigured", "Supabase env missing");
  }
  if (!ADMIN_SECRET) {
    return err(500, "server_misconfigured", "KNOWLEDGE_INGEST_SECRET not set");
  }
  if (!OPENAI_API_KEY) {
    return err(500, "server_misconfigured", "OPENAI_API_KEY not set");
  }

  if ((req.headers.get("x-admin-secret") || "") !== ADMIN_SECRET) {
    return err(401, "unauthorized", "Valid x-admin-secret required");
  }

  let body: {
    dry_run?: boolean;
    force?: boolean;
    only_path?: string;
    max_files?: number;
    prune?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body.dry_run === true;
  const force = body.force === true;
  const prune = body.prune === true;
  const onlyPath = body.only_path ? String(body.only_path).trim() : null;
  const maxFiles = Math.max(
    1,
    Math.min(50, Number(body.max_files) || DEFAULT_MAX_FILES),
  );

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ---- Recursively list .md files in the bucket ----
  async function listMd(prefix: string): Promise<FileEntry[]> {
    const found: FileEntry[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error: lerr } = await svc.storage
        .from(BUCKET)
        .list(prefix, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (lerr) throw new Error(`list('${prefix}'): ${lerr.message}`);
      if (!data || data.length === 0) break;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        // Folders come back with id === null.
        if ((item as any).id === null) {
          const nested = await listMd(path);
          found.push(...nested);
        } else if (item.name.toLowerCase().endsWith(".md")) {
          found.push({ path, name: item.name });
        }
      }
      if (data.length < 100) break;
      offset += data.length;
    }
    return found;
  }

  let files: FileEntry[];
  try {
    files = await listMd("");
  } catch (e) {
    return err(500, "list_failed", (e as Error).message);
  }
  if (onlyPath) files = files.filter((f) => f.path === onlyPath);

  const results: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  let filesProcessed = 0;
  let filesSkipped = 0;
  let chunksUpserted = 0;
  let chunksDeleted = 0;
  let remaining = 0;

  for (const f of files) {
    // Download + hash to detect changes.
    const { data: blob, error: derr } = await svc.storage
      .from(BUCKET)
      .download(f.path);
    if (derr || !blob) {
      errors.push({ path: f.path, error: derr?.message || "download failed" });
      continue;
    }
    const text = await blob.text();
    const fileHash = await sha256Hex(text);

    const { data: srcRow } = await svc
      .from("knowledge_sources")
      .select("file_hash")
      .eq("bucket", BUCKET)
      .eq("path", f.path)
      .maybeSingle();

    const changed = force || !srcRow || (srcRow as any).file_hash !== fileHash;
    if (!changed) {
      filesSkipped++;
      continue;
    }
    if (filesProcessed >= maxFiles) {
      remaining++;
      continue;
    }

    const { fm, body: mdBody } = splitFrontmatter(text);
    const entries = parseEntries(mdBody, f.path, fm);

    if (dryRun) {
      results.push({ path: f.path, chunks: entries.length, dry_run: true });
      filesProcessed++;
      continue;
    }

    if (entries.length === 0) {
      await svc.from("knowledge_sources").upsert(
        {
          bucket: BUCKET,
          path: f.path,
          file_hash: fileHash,
          chunk_count: 0,
          status: "empty",
          error: "no ## entries parsed",
          last_ingested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bucket,path" },
      );
      results.push({ path: f.path, chunks: 0, status: "empty" });
      filesProcessed++;
      continue;
    }

    // Embed all chunk bodies for this file.
    let vectors: number[][];
    try {
      vectors = await embedAll(
        OPENAI_API_KEY,
        entries.map((e) => e.content),
      );
    } catch (e) {
      errors.push({ path: f.path, error: (e as Error).message });
      await svc.from("knowledge_sources").upsert(
        {
          bucket: BUCKET,
          path: f.path,
          status: "error",
          error: (e as Error).message.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bucket,path" },
      );
      filesProcessed++;
      continue;
    }

    const nowIso = new Date().toISOString();
    const rows = await Promise.all(
      entries.map(async (e, idx) => ({
        source_type: "document",
        source_file: f.path,
        external_id: e.external_id,
        chunk_index: e.chunk_index,
        category: e.category,
        title: e.title,
        content: e.content,
        source: e.source,
        tags: e.tags,
        lang: "en",
        embedding: vectors[idx],
        content_hash: await sha256Hex(e.content),
        updated_at: nowIso,
      })),
    );

    // Upsert on external_id in batches.
    let fileUpserted = 0;
    const BATCH = 50;
    let upErrMsg: string | null = null;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: upErr } = await svc
        .from("knowledge_corpus")
        .upsert(slice, { onConflict: "external_id" });
      if (upErr) {
        upErrMsg = upErr.message;
        break;
      }
      fileUpserted += slice.length;
    }
    if (upErrMsg) {
      errors.push({ path: f.path, error: upErrMsg });
      await svc.from("knowledge_sources").upsert(
        {
          bucket: BUCKET,
          path: f.path,
          status: "error",
          error: upErrMsg.slice(0, 500),
          updated_at: nowIso,
        },
        { onConflict: "bucket,path" },
      );
      filesProcessed++;
      continue;
    }
    chunksUpserted += fileUpserted;

    // Prune stale chunks that were removed/renamed in this file.
    const keepIds = new Set(entries.map((e) => e.external_id));
    const { data: existingChunks } = await svc
      .from("knowledge_corpus")
      .select("external_id")
      .eq("source_file", f.path);
    const stale = (existingChunks ?? [])
      .map((r) => (r as any).external_id as string)
      .filter((id) => !keepIds.has(id));
    for (let i = 0; i < stale.length; i += BATCH) {
      const slice = stale.slice(i, i + BATCH);
      const { error: delErr } = await svc
        .from("knowledge_corpus")
        .delete()
        .in("external_id", slice);
      if (!delErr) chunksDeleted += slice.length;
    }

    await svc.from("knowledge_sources").upsert(
      {
        bucket: BUCKET,
        path: f.path,
        file_hash: fileHash,
        chunk_count: entries.length,
        status: "ingested",
        error: null,
        last_ingested_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "bucket,path" },
    );

    results.push({
      path: f.path,
      chunks: entries.length,
      upserted: fileUpserted,
      pruned: stale.length,
      status: "ingested",
    });
    filesProcessed++;
  }

  // Optional: remove orphaned files (present in DB, gone from bucket).
  if (prune && !onlyPath && !dryRun) {
    const currentPaths = new Set(files.map((f) => f.path));
    const { data: allSources } = await svc
      .from("knowledge_sources")
      .select("path")
      .eq("bucket", BUCKET);
    const orphans = (allSources ?? [])
      .map((r) => (r as any).path as string)
      .filter((p) => !currentPaths.has(p));
    for (const p of orphans) {
      const { data: delRows } = await svc
        .from("knowledge_corpus")
        .delete()
        .eq("source_file", p)
        .select("id");
      chunksDeleted += (delRows ?? []).length;
      await svc
        .from("knowledge_sources")
        .delete()
        .eq("bucket", BUCKET)
        .eq("path", p);
      results.push({ path: p, status: "orphan_removed" });
    }
  }

  return json(200, {
    ok: errors.length === 0,
    files_seen: files.length,
    files_processed: filesProcessed,
    files_skipped: filesSkipped,
    chunks_upserted: chunksUpserted,
    chunks_deleted: chunksDeleted,
    remaining,
    done: remaining === 0,
    dry_run: dryRun,
    results,
    errors,
  });
});
