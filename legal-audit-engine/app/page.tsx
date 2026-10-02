'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('Uploading PDF & generating vector embeddings...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(`Success! Processed ${data.totalChunks} chunks into Supabase Vector store.`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 413 || errorText.includes('Request Entity Too Large')) {
          throw new Error('File size too large for serverless execution. Please upload a smaller PDF (under 4.5MB).');
        }
        throw new Error(errorText || 'Failed to upload document');
      }
    } catch (err: any) {
      setStatus(`Failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-indigo-400">
          Enterprise Document Audit Engine
        </h1>
        <p className="text-slate-400 mb-6 text-sm">
          Upload legal contracts or regulatory PDFs to Database.
        </p>

        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-colors rounded-lg p-8 text-center cursor-pointer mb-6 bg-slate-950/50">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <p className="text-sm text-slate-300 font-medium">
              {file ? file.name : 'Click to select or drag & drop a PDF contract'}
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF documents up to 50MB</p>
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors shadow-lg"
        >
          {uploading ? 'Processing & Embedding...' : 'Upload & Start Audit Pipeline'}
        </button>

        {status && (
          <div className="mt-6 p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}