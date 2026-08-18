/**
 * Attachments — the files WellView stores inside the database itself.
 *
 * A report block bound to `wvAttachment` prints the FILES, not a table about
 * them: the shipped "Attached Image Files" template extracts zero columns,
 * because the images are the content. So this renders a gallery, and the
 * "Attachments" template's metadata table is handled by the normal block path.
 *
 * Images are fetched with the session's bearer token and wrapped in an object
 * URL — an <img src> pointing at the API would be unauthenticated, and putting
 * the token in the query string would leak it into logs and Referer headers.
 * Every object URL is revoked when the component unmounts.
 *
 * The server decides what may be shown in place, from the file's own bytes.
 * Anything it will not render inline (a PDF, an Office document, an SVG) is
 * offered as a download and never embedded.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvAttachment } from "../../entry/wellviewDb.js";

const kb = (n: number) => n >= 1024 * 1024
  ? `${(n / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(n / 1024))} KB`;

/** One image, fetched authenticated and released on unmount. */
function Thumb({ db, a, onOpen }: { db: string; a: WvAttachment; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    let made: string | null = null;
    wvDbApi.attachmentBlob(db, a.idrec)
      .then((b) => {
        if (dead) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => { if (!dead) setFailed(true); });
    return () => {
      dead = true;
      // Without this every gallery visit leaks the whole file.
      if (made) URL.revokeObjectURL(made);
    };
  }, [db, a.idrec]);

  if (failed) return <div className="h-32 flex items-center justify-center text-[11px] text-red-600">could not load</div>;
  if (!url) return <div className="h-32 flex items-center justify-center text-[11px] text-gray-400">loading…</div>;
  return (
    <button type="button" onClick={() => onOpen(url)} className="block w-full">
      <img src={url} alt={a.des ?? "attachment"} className="h-32 w-full object-contain bg-gray-50" />
    </button>
  );
}

interface Props {
  db: string;
  idwell: string;
  /**
   * Where an upload ATTACHES — not what is listed.
   *
   * These are different questions and conflating them shows an empty panel
   * nearly everywhere: `wvwellhead` (the wellhead equipment table, which owns
   * 8 of the sample's attachments) is not `wvWellHeader` (the well header), so
   * filtering the list to the folder in view almost always matches nothing.
   * The list is the WELL's files; the folder only decides where a new one goes.
   */
  table?: string;
  /** Narrow the LIST to one record's files, and attach uploads to it. */
  idrec?: string;
  /** Show the upload control. */
  canUpload?: boolean;
}

export function Attachments({ db, idwell, table, idrec, canUpload = true }: Props) {
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const q = useQuery({
    queryKey: ["wvdb", db, "attachments", idwell, idrec ?? ""],
    // Listed by well (or by one record when asked); NOT by the folder in view.
    queryFn: () => wvDbApi.attachments(db, { idwell, idrec }),
  });

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("idwell", idwell);
      if (table) form.set("table", table);
      if (idrec) form.set("parent", idrec);
      form.set("des", file.name);
      form.set("file", file);
      await wvDbApi.uploadAttachment(db, form);
      await qc.invalidateQueries({ queryKey: ["wvdb", db, "attachments"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const list = q.data?.attachments ?? [];
  const images = list.filter((a) => a.inline);
  const files = list.filter((a) => !a.inline);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-gray-500">
          {q.isLoading ? "Loading attachments…"
            : list.length === 0 ? "No attachments."
            : `${list.length} attachment${list.length === 1 ? "" : "s"}`
              + (images.length && files.length ? ` · ${images.length} image${images.length === 1 ? "" : "s"}, ${files.length} file${files.length === 1 ? "" : "s"}` : "")}
        </span>
        {canUpload && (
          <label className="ml-auto text-[11px]">
            <input ref={fileRef} type="file" data-testid="wv-attach-upload" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            <span className={`h-7 px-3 inline-flex items-center rounded border cursor-pointer ${
              busy ? "border-gray-200 text-gray-400" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              {busy ? "Uploading…" : "Add attachment"}
            </span>
          </label>
        )}
      </div>
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">{error}</div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {images.map((a) => (
            <figure key={a.idrec} className="border border-gray-200 rounded overflow-hidden" data-testid="wv-attach-image">
              <Thumb db={db} a={a} onOpen={setZoom} />
              <figcaption className="px-2 py-1 text-[10px] text-gray-600 border-t border-gray-100">
                <span className="block truncate font-medium">{a.des ?? "—"}</span>
                <span className="text-gray-400">
                  {[a.typ1, a.kind, kb(a.bytes)].filter(Boolean).join(" · ")}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded">
          {files.map((a) => (
            <li key={a.idrec} className="px-2 py-1.5 flex items-center gap-2 text-[11px]" data-testid="wv-attach-file">
              <span className="font-medium text-gray-700 truncate">{a.des ?? "—"}</span>
              <span className="text-gray-400">{a.kind} · {kb(a.bytes)}</span>
              <button type="button" className="ml-auto text-blue-700 hover:underline"
                onClick={() => void wvDbApi.attachmentBlob(db, a.idrec).then((b) => {
                  const u = URL.createObjectURL(b);
                  const el = document.createElement("a");
                  el.href = u;
                  el.download = a.des ?? "attachment";
                  el.click();
                  URL.revokeObjectURL(u);
                })}>
                Download
              </button>
            </li>
          ))}
        </ul>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
