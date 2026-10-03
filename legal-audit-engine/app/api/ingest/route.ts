export const maxDuration = 60; // Allows up to 60s execution time on Vercel
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { embedMany } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
// @ts-ignore
import pdfParse from 'pdf-parse-fixed';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = (formData.get('userId') as string) || '00000000-0000-0000-0000-000000000000';

    if (!file) {
      return NextResponse.json({ error: 'Missing PDF file' }, { status: 400 });
    }

    // 1. Upload raw PDF to Vercel Blob Storage with suffix to allow duplicate names
    const blob = await put(file.name, file, { 
      access: 'private',
      addRandomSuffix: true,
    });

    // 2. Create parent record in audited_documents
    const { data: doc, error: docError } = await supabase
      .from('audited_documents')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_url: blob.url,
        upload_status: 'processing',
      })
      .select()
      .single();

    if (docError) throw docError;

    // 3. Extract text from PDF buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = await pdfParse(Buffer.from(arrayBuffer));
    const chunks = chunkText(pdfData.text);

    // 4. Batch generate embeddings using Gemini (explicit model string or standard provider model)
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel('text-embedding-004', {
        // Optional config if needed
      }),
      values: chunks,
    });

    // 5. Prepare rows for bulk insertion
    const records = chunks.map((chunk, idx) => ({
      document_id: doc.id,
      chunk_content: chunk,
      page_number: Math.floor(idx / 3) + 1,
      embedding: embeddings[idx],
    }));

    // 6. Bulk insert embeddings into Supabase
    const { error: embedError } = await supabase
      .from('document_embeddings')
      .insert(records);

    if (embedError) throw embedError;

    // 7. Update status to completed
    await supabase
      .from('audited_documents')
      .update({ upload_status: 'indexed' })
      .eq('id', doc.id);

    return NextResponse.json({ success: true, documentId: doc.id, totalChunks: chunks.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}