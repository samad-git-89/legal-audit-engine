'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('Processing PDF & generating vector embeddings...');
    setIsSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Server returned an unreadable response. File may exceed size limits.');
      }

      if (res.ok && data.success) {
        setIsSuccess(true);
        setStatus(`Success! Document ingested into database. Created ${data.totalChunks} vector embeddings. (Document ID: ${data.documentId})`);
      } else {
        setIsSuccess(false);
        setStatus(`Error: ${data.error || 'Failed to process document'}`);
      }
    } catch (err: any) {
      setIsSuccess(false);
      setStatus(`Failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className={`min-h-screen transition-colors duration-300 flex flex-col items-center justify-center p-6 ${
      theme === 'dark' 
        ? 'bg-slate-950 text-slate-100' 
        : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Navbar / Theme Switcher */}
      <div className="max-w-2xl w-full flex justify-end mb-4">
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            theme === 'dark'
              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
          }`}
        >
          {theme === 'dark' ? (
            <>
              <span>☀️</span> Light Mode
            </>
          ) : (
            <>
              <span>🌙</span> Dark Mode
            </>
          )}
        </button>
      </div>

      {/* Main Card */}
      <div className={`max-w-2xl w-full border rounded-2xl p-8 shadow-xl transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-800 shadow-black/40'
          : 'bg-white border-slate-200 shadow-slate-200/60'
      }`}>
        <h1 className={`text-2xl font-bold tracking-tight mb-2 ${
          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
        }`}>
          Enterprise Document Audit Engine
        </h1>
        <p className={`mb-6 text-sm ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
        }`}>
          Upload legal contracts or regulatory PDFs to ingest into Database.
        </p>

        {/* File Dropzone */}
        <div className={`border-2 border-dashed transition-colors rounded-xl p-8 text-center cursor-pointer mb-6 ${
          theme === 'dark'
            ? 'border-slate-700 hover:border-emerald-500 bg-slate-950/40'
            : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
        }`}>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="text-3xl mb-2">📄</div>
            <p className={`text-sm font-medium ${
              theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
            }`}>
              {file ? file.name : 'Click to select or drag & drop a PDF contract'}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              PDF documents up to 4.5MB
            </p>
          </label>
        </div>

        {/* Action Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full font-medium py-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-white ${
            theme === 'dark'
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
          }`}
        >
          {uploading ? 'Processing & Embedding...' : 'Upload & Start Audit Pipeline'}
        </button>

        {/* Status Alert Box */}
        {status && (
          <div className={`mt-6 p-4 rounded-xl border text-xs font-mono leading-relaxed transition-all ${
            isSuccess === true
              ? theme === 'dark'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isSuccess === false
              ? theme === 'dark'
                ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
              : theme === 'dark'
              ? 'bg-slate-950 border-slate-800 text-slate-300'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </main>
  );
}