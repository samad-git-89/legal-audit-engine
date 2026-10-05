export const maxDuration = 60; // Allows up to 60s execution time on Vercel
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
// @ts-ignore
import pdfParse from 'pdf-parse-fixed';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

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

// Batch embedding call using the correct Google v1beta endpoint
async function getGeminiEmbeddings(chunks: string[], key: string): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${key}`;
  
  const requests = chunks.map((chunk) => ({
    model: 'models/text-embedding-004',
    content: {
      parts: [{ text: chunk }],
    },
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google Embedding API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.embeddings.map((e: { values: number[] }) => e.values);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = (formData.get('userId') as string) || '00000000-0000-0000-0000-000000000000';

    if (!file) {
      return NextResponse.json({ error: 'Missing PDF file' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
    }

    // 1. Upload raw PDF to Vercel Blob Storage
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

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No text extracted from PDF' }, { status: 400 });
    }

    // 4. Batch generate embeddings
    const embeddings = await getGeminiEmbeddings(chunks, apiKey);

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